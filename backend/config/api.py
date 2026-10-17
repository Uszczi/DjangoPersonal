from ninja import NinjaAPI

from apps.work.api import router
from apps.work.api.errors import register_error_handlers

api = NinjaAPI(
    title='DjangoPersonal API',
    description='API for DjangoPersonal projects and tasks.',
    version='1.0.0',
    urls_namespace='api-v1',
    openapi_url='/schema/',
    docs_url=None,
)
api.add_router('/', router)
register_error_handlers(api)
