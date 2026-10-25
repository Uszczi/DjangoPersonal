from functools import partial

from personal.core.shared.errors import DomainError, NotFound
from personal.core.shared.patch import apply_provided
from personal.core.whiteboard.contracts import FolderRequest, PatchedFolderRequest
from personal.infra.models import Folder as FolderModel
from personal.infra.models import User
from personal.infra.repo import DuplicateFolderName, FolderRepository
from personal.infra.rules import folder_name_key, normalize_folder_name

DUPLICATE_NAME = 'A folder with this name already exists.'


def get_folder(repository: FolderRepository, folder_id: int, *, user: User) -> FolderModel:
    folder = repository.find(folder_id, user=user)
    if folder is None:
        raise NotFound('Folder not found.')
    return folder


def _validate_name(
    repository: FolderRepository,
    name: str,
    current: FolderModel | None = None,
    *,
    user: User,
) -> str:
    name = normalize_folder_name(name)
    if repository.name_taken(folder_name_key(name), user=user, exclude=current):
        raise DomainError(DUPLICATE_NAME)
    return name


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
        folder = FolderModel(
            user=self.user, name=_validate_name(self.folders, data.name, user=self.user)
        )
        return _save(self.folders, folder)


class UpdateFolder:
    """Rename a folder (PATCH), under the same name rules as creating one."""

    def __init__(self, folders: FolderRepository, user: User):
        self.folders = folders
        self.user = user

    def execute(self, folder_id: int, data: PatchedFolderRequest) -> FolderModel:
        folder = get_folder(self.folders, folder_id, user=self.user)
        apply_provided(
            data,
            folder,
            resolve={
                'name': partial(_validate_name, self.folders, current=folder, user=self.user)
            },
        )
        return _save(self.folders, folder)


class DeleteFolder:
    """Delete a folder; the Whiteboards and Notatki in it go with it."""

    def __init__(self, folders: FolderRepository, user: User):
        self.folders = folders
        self.user = user

    def execute(self, folder_id: int) -> None:
        folder = get_folder(self.folders, folder_id, user=self.user)
        self.folders.delete(folder)
