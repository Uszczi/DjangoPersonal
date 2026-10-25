from personal.core.shared.errors import DomainError, NotFound
from personal.core.whiteboard.contracts import FolderRequest, PatchedFolderRequest
from personal.infra.models import Folder as FolderModel
from personal.infra.models import User
from personal.infra.repo import DuplicateFolderName, FolderRepository
from personal.infra.rules import folder_name_key, normalize_folder_name

DUPLICATE_NAME = 'A folder with this name already exists.'
INTO_ITSELF = 'A folder cannot be moved into itself or one of its subfolders.'


def get_folder(repository: FolderRepository, folder_id: int, *, user: User) -> FolderModel:
    folder = repository.find(folder_id, user=user)
    if folder is None:
        raise NotFound('Folder not found.')
    return folder


def _validate_name(
    repository: FolderRepository,
    name: str,
    parent_id: int | None,
    current: FolderModel | None = None,
    *,
    user: User,
) -> str:
    """Names are unique among the Folders that share a parent."""
    name = normalize_folder_name(name)
    if repository.name_taken(
        folder_name_key(name), user=user, parent_id=parent_id, exclude=current
    ):
        raise DomainError(DUPLICATE_NAME)
    return name


def _validate_parent(
    repository: FolderRepository,
    parent_id: int | None,
    moved: FolderModel | None = None,
    *,
    user: User,
) -> int | None:
    """A parent must be the user's own Folder, and never ``moved`` or one inside it."""
    if parent_id is None:
        return None
    get_folder(repository, parent_id, user=user)
    if moved is not None:
        parents = repository.parent_ids(user=user)
        ancestor: int | None = parent_id
        while ancestor is not None:
            if ancestor == moved.id:
                raise DomainError(INTO_ITSELF)
            ancestor = parents.get(ancestor)
    return parent_id


def _save(repository: FolderRepository, folder: FolderModel) -> FolderModel:
    """Persist a folder, presenting a name clash as a domain error."""
    try:
        return repository.save(folder)
    except DuplicateFolderName as error:
        raise DomainError(DUPLICATE_NAME) from error


class ListFolders:
    def __init__(self, folders: FolderRepository, user: User):
        self.folders = folders
        self.user = user

    def execute(self) -> list[FolderModel]:
        return self.folders.list_all(user=self.user)


class CreateFolder:
    def __init__(self, folders: FolderRepository, user: User):
        self.folders = folders
        self.user = user

    def execute(self, data: FolderRequest) -> FolderModel:
        parent_id = _validate_parent(self.folders, data.parent_id, user=self.user)
        folder = FolderModel(
            user=self.user,
            parent_id=parent_id,
            name=_validate_name(self.folders, data.name, parent_id, user=self.user),
        )
        return _save(self.folders, folder)


class UpdateFolder:
    """Rename or move a folder (PATCH), under the same rules as creating one."""

    def __init__(self, folders: FolderRepository, user: User):
        self.folders = folders
        self.user = user

    def execute(self, folder_id: int, data: PatchedFolderRequest) -> FolderModel:
        folder = get_folder(self.folders, folder_id, user=self.user)
        # ``null`` is meaningful here (the top level), so presence decides.
        parent_id = folder.parent_id
        if 'parent_id' in data.model_fields_set:
            parent_id = _validate_parent(self.folders, data.parent_id, folder, user=self.user)
        # Check the name against the new siblings before touching the row, so a
        # query's autoflush can't hit the unique index first.
        name = _validate_name(
            self.folders,
            data.name if data.name is not None else folder.name,
            parent_id,
            current=folder,
            user=self.user,
        )
        folder.parent_id = parent_id
        folder.name = name
        return _save(self.folders, folder)


class DeleteFolder:
    """Delete a folder; its subfolders and every Whiteboard and Notatka in them go with it."""

    def __init__(self, folders: FolderRepository, user: User):
        self.folders = folders
        self.user = user

    def execute(self, folder_id: int) -> None:
        folder = get_folder(self.folders, folder_id, user=self.user)
        self.folders.delete(folder)
