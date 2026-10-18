from ninja import NinjaAPI

from apps.accounts.api import router as accounts_router
from apps.accounts.api.errors import register_error_handlers as register_accounts_error_handlers
from apps.whiteboard.api import router as whiteboard_router
from apps.whiteboard.api.errors import register_error_handlers as register_whiteboard_error_handlers
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
api.add_router('/', accounts_router)
api.add_router('/', router)
api.add_router('/', whiteboard_router)
register_error_handlers(api)
register_accounts_error_handlers(api)
register_whiteboard_error_handlers(api)
