from django.http import HttpRequest
from typing import cast
from ninja import Router, Status
from ninja_jwt.authentication import JWTAuth

from apps.expenses import deps, handlers
from apps.expenses.contracts import CategoryRequest, CategoryResponse, PatchedCategoryRequest
from apps.infra.models import User
from apps.infra.models import Category as CategoryModel

router = Router(tags=['personal'])


@router.get(
    '/categories/',
    response=list[CategoryResponse],
    auth=JWTAuth(),
    operation_id='categories_list',
)
def list_categories(request: HttpRequest) -> list[CategoryModel]:
    return handlers.ListCategories(deps.category_repository(), cast(User, request.user)).execute()


@router.post(
    '/categories/',
    response={201: CategoryResponse},
    auth=JWTAuth(),
    operation_id='categories_create',
)
def create_category(request: HttpRequest, payload: CategoryRequest) -> Status[CategoryModel]:
    handler = handlers.CreateCategory(deps.category_repository(), cast(User, request.user))
    return Status(201, handler.execute(payload))


@router.get(
    '/categories/{id}/',
    response=CategoryResponse,
    auth=JWTAuth(),
    operation_id='categories_retrieve',
)
def get_category(request: HttpRequest, id: int) -> CategoryModel:
    return handlers.GetCategory(deps.category_repository(), cast(User, request.user)).execute(id)


@router.put(
    '/categories/{id}/',
    response=CategoryResponse,
    auth=JWTAuth(),
    operation_id='categories_update',
)
def replace_category(request: HttpRequest, id: int, payload: CategoryRequest) -> CategoryModel:
    handler = handlers.ReplaceCategory(deps.category_repository(), cast(User, request.user))
    return handler.execute(id, payload)


@router.patch(
    '/categories/{id}/',
    response=CategoryResponse,
    auth=JWTAuth(),
    operation_id='categories_partial_update',
)
def update_category(
    request: HttpRequest, id: int, payload: PatchedCategoryRequest
) -> CategoryModel:
    handler = handlers.UpdateCategory(deps.category_repository(), cast(User, request.user))
    return handler.execute(id, payload)


@router.delete(
    '/categories/{id}/',
    response={204: None},
    auth=JWTAuth(),
    operation_id='categories_destroy',
)
def delete_category(request: HttpRequest, id: int) -> Status[None]:
    handlers.DeleteCategory(deps.category_repository(), cast(User, request.user)).execute(id)
    return Status(204, None)
