
from django.http import HttpRequest
from ninja import NinjaAPI

from apps.accounts.errors import AccountsError

STATUS_BY_CODE = {
    AccountsError.code: 400,
}


def status_for(error: AccountsError) -> int:
    if error.status is not None:
        return error.status
    return STATUS_BY_CODE.get(error.code, 400)


def register_error_handlers(api: NinjaAPI) -> None:
    @api.exception_handler(AccountsError)
    def _handle_accounts_error(request: HttpRequest, error: AccountsError) -> object:
        return api.create_response(
            request,
            {'detail': error.message},
            status=status_for(error),
        )