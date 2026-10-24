"""Category use cases."""

from functools import partial

from personal.core.shared.errors import DomainError, NotFound
from personal.core.shared.patch import apply_provided
from personal.infra.models import Category as CategoryModel
from personal.infra.models import User
from personal.infra.repo import CategoryRepository, DuplicateCategoryName
from personal.infra.rules import category_name_key, normalize_category_name

from ..contracts import CategoryRequest, PatchedCategoryRequest

#: The labels every new user starts with, created with their first wallet,
#: each with its icon.
BASE_CATEGORIES: dict[str, str] = {
    'Jedzenie': 'utensils',
    'Mieszkanie': 'house',
    'Transport': 'car',
    'Zdrowie': 'heart-pulse',
    'Rozrywka': 'gamepad-2',
    'Zakupy': 'shopping-cart',
    'Rachunki': 'receipt',
    'Edukacja': 'graduation-cap',
    'Podróże': 'plane',
    'Inne': 'tag',
}

#: The category balance corrections are filed under: an initial balance on
#: wallet creation and the difference when the current balance is adjusted.
SYSTEM_CATEGORY_NAME = 'System'
SYSTEM_CATEGORY_ICON = 'settings'


def seed_base_categories(repository: CategoryRepository, user: User) -> None:
    """Add every base category the user does not already have.

    Runs inside the caller's transaction (registration, the seed), so a user
    never exists without the full set. Merging (rather than skipping outright) means a user who happens to create
    a category before their first wallet still ends up with the full base set,
    and no seeded name can clash with one they already made.
    """
    for name, icon in BASE_CATEGORIES.items():
        if repository.name_taken(category_name_key(name), user=user):
            continue
        repository.save(CategoryModel(user=user, name=name, icon=icon))
    ensure_system_category(repository, user)


def ensure_system_category(repository: CategoryRepository, user: User) -> CategoryModel:
    """The user's System category, created (or repaired) on the spot.

    Users who predate the System category have none; a user who happens to
    hold the name with a plain category gets it promoted, so balance
    corrections always land in a category the balance rule can recognize.
    """
    system = repository.find_by_name_key(category_name_key(SYSTEM_CATEGORY_NAME), user=user)
    if system is None:
        return repository.save(
            CategoryModel(
                user=user, name=SYSTEM_CATEGORY_NAME, icon=SYSTEM_CATEGORY_ICON, is_system=True
            )
        )
    if not system.is_system:
        system.is_system = True
        system.icon = SYSTEM_CATEGORY_ICON
        return repository.save(system)
    return system


def _get_category(
    repository: CategoryRepository, category_id: int, *, user: User
) -> CategoryModel:
    """Fetch a category addressed by id, or raise ``NotFound``."""
    category = repository.find(category_id, user=user)
    if category is None:
        raise NotFound('Category not found.')
    return category


def _validate_name(
    repository: CategoryRepository,
    name: str,
    current: CategoryModel | None = None,
    *,
    user: User,
) -> str:
    """Return the trimmed category name, or raise when it breaks a naming rule."""
    name = normalize_category_name(name)
    name_key = category_name_key(name)

    if repository.name_taken(name_key, user=user, exclude=current):
        raise DomainError('A category with this name already exists.')

    return name


def _save(repository: CategoryRepository, category: CategoryModel) -> CategoryModel:
    """Persist a category, presenting a name clash as a domain error."""
    try:
        return repository.save(category)
    except DuplicateCategoryName as error:
        raise DomainError('A category with this name already exists.') from error


def _reject_system(category: CategoryModel, action: str) -> None:
    """The System category is the balance ledger's; the user cannot touch it."""
    if category.is_system:
        raise DomainError(f'The System category cannot be {action}.')


class ListCategories:
    """List every category for the user."""

    def __init__(self, categories: CategoryRepository, user: User):
        self.categories = categories
        self.user = user

    def execute(self) -> list[CategoryModel]:
        return self.categories.list_all(user=self.user)


class GetCategory:
    """Fetch a single category addressed by id."""

    def __init__(self, categories: CategoryRepository, user: User):
        self.categories = categories
        self.user = user

    def execute(self, category_id: int) -> CategoryModel:
        return _get_category(self.categories, category_id, user=self.user)


class CreateCategory:
    """Create a category from a validated payload."""

    def __init__(self, categories: CategoryRepository, user: User):
        self.categories = categories
        self.user = user

    def execute(self, data: CategoryRequest) -> CategoryModel:
        category = CategoryModel(
            user=self.user,
            name=_validate_name(self.categories, data.name, user=self.user),
            icon=data.icon,
        )
        return _save(self.categories, category)


class ReplaceCategory:
    """Replace a category wholesale with the supplied payload (PUT)."""

    def __init__(self, categories: CategoryRepository, user: User):
        self.categories = categories
        self.user = user

    def execute(self, category_id: int, data: CategoryRequest) -> CategoryModel:
        category = _get_category(self.categories, category_id, user=self.user)
        _reject_system(category, 'renamed')
        apply_provided(
            data,
            category,
            resolve={
                'name': partial(_validate_name, self.categories, current=category, user=self.user)
            },
        )
        return _save(self.categories, category)


class UpdateCategory:
    """Apply the supplied fields to an existing category (PATCH)."""

    def __init__(self, categories: CategoryRepository, user: User):
        self.categories = categories
        self.user = user

    def execute(self, category_id: int, data: PatchedCategoryRequest) -> CategoryModel:
        category = _get_category(self.categories, category_id, user=self.user)
        _reject_system(category, 'renamed')

        apply_provided(
            data,
            category,
            resolve={
                'name': partial(_validate_name, self.categories, current=category, user=self.user)
            },
        )

        return _save(self.categories, category)


class DeleteCategory:
    """Delete a category; its transactions cascade away."""

    def __init__(self, categories: CategoryRepository, user: User):
        self.categories = categories
        self.user = user

    def execute(self, category_id: int) -> None:
        category = _get_category(self.categories, category_id, user=self.user)
        _reject_system(category, 'deleted')
        self.categories.delete(category)
