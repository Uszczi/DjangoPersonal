from personal.core.shared.errors import NotFound
from personal.core.shared.patch import apply_provided
from personal.infra.models import Pozycja as PozycjaModel
from personal.infra.models import User
from personal.infra.repo import PozycjaRepository

from ..contracts import PatchedPozycjaRequest, PozycjaRequest


def _get_pozycja(repository: PozycjaRepository, pozycja_id: int, *, user: User) -> PozycjaModel:
    pozycja = repository.find(pozycja_id, user=user)
    if pozycja is None:
        raise NotFound('Pozycja not found.')
    return pozycja


class ListPozycje:
    """Every Pozycja of the user, the most recently added first."""

    def __init__(self, pozycje: PozycjaRepository, user: User):
        self.pozycje = pozycje
        self.user = user

    def execute(self) -> list[PozycjaModel]:
        return self.pozycje.list_all(user=self.user)


class GetPozycja:
    def __init__(self, pozycje: PozycjaRepository, user: User):
        self.pozycje = pozycje
        self.user = user

    def execute(self, pozycja_id: int) -> PozycjaModel:
        return _get_pozycja(self.pozycje, pozycja_id, user=self.user)


class CreatePozycja:
    def __init__(self, pozycje: PozycjaRepository, user: User):
        self.pozycje = pozycje
        self.user = user

    def execute(self, data: PozycjaRequest) -> PozycjaModel:
        return self.pozycje.save(PozycjaModel(user=self.user, **data.model_dump()))


class UpdatePozycja:
    """Apply the supplied fields (PATCH); the kind stays what it was created with."""

    def __init__(self, pozycje: PozycjaRepository, user: User):
        self.pozycje = pozycje
        self.user = user

    def execute(self, pozycja_id: int, data: PatchedPozycjaRequest) -> PozycjaModel:
        pozycja = _get_pozycja(self.pozycje, pozycja_id, user=self.user)
        apply_provided(data, pozycja)
        return self.pozycje.save(pozycja)
