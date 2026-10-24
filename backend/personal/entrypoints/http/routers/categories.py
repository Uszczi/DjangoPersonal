from fastapi import APIRouter, Response, status

from personal.core.expenses import handlers
from personal.core.expenses.contracts import (
    CategoryRequest,
    CategoryResponse,
    PatchedCategoryRequest,
)
from personal.entrypoints.http.deps import CategoryRepositoryDep, CurrentUser

router = APIRouter(tags=['personal'])


@router.get('/categories/', operation_id='categories_list')
def list_categories(
    user: CurrentUser, categories: CategoryRepositoryDep
) -> list[CategoryResponse]:
    return [
        CategoryResponse.model_validate(category)
        for category in handlers.ListCategories(categories, user).execute()
    ]


@router.post(
    '/categories/',
    status_code=status.HTTP_201_CREATED,
    operation_id='categories_create',
)
def create_category(
    payload: CategoryRequest, user: CurrentUser, categories: CategoryRepositoryDep
) -> CategoryResponse:
    category = handlers.CreateCategory(categories, user).execute(payload)
    return CategoryResponse.model_validate(category)


@router.get('/categories/{id}/', operation_id='categories_retrieve')
def get_category(id: int, user: CurrentUser, categories: CategoryRepositoryDep) -> CategoryResponse:
    return CategoryResponse.model_validate(handlers.GetCategory(categories, user).execute(id))


@router.put('/categories/{id}/', operation_id='categories_update')
def replace_category(
    id: int, payload: CategoryRequest, user: CurrentUser, categories: CategoryRepositoryDep
) -> CategoryResponse:
    category = handlers.ReplaceCategory(categories, user).execute(id, payload)
    return CategoryResponse.model_validate(category)


@router.patch('/categories/{id}/', operation_id='categories_partial_update')
def update_category(
    id: int, payload: PatchedCategoryRequest, user: CurrentUser, categories: CategoryRepositoryDep
) -> CategoryResponse:
    category = handlers.UpdateCategory(categories, user).execute(id, payload)
    return CategoryResponse.model_validate(category)


@router.delete(
    '/categories/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='categories_destroy',
)
def delete_category(id: int, user: CurrentUser, categories: CategoryRepositoryDep) -> None:
    handlers.DeleteCategory(categories, user).execute(id)
