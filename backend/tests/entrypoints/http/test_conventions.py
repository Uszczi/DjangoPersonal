"""The conventions every resource of the API shares, checked once per resource.

Each resource's own test module covers its domain rules; the behaviour that
comes from shared machinery is checked here instead of again in every module:
a token is required, rows are private to their user (another user's row and an
unknown id are both a 404), PATCH applies only the fields it is given and
refuses ``null`` for a required one, and names are trimmed, never blank and,
where the domain says so, unique ignoring case. Which methods a resource has is
read from the frozen contract (``snapshots/api_contract.json``), so a new
operation on a listed resource is covered without touching this file.
"""

import itertools
import json
from collections.abc import Callable
from dataclasses import dataclass, field
from http import HTTPStatus
from typing import Any

import pytest

from personal.infra.models import User
from tests.entrypoints.http.test_contract import SNAPSHOT
from tests.harness import ApiClient, Response
from tests.helpers import UNKNOWN_ID

CONTRACT: list[dict[str, Any]] = json.loads(SNAPSHOT.read_text())

#: The operations that are how a client gets a token in the first place.
PUBLIC_OPERATIONS = {'auth_login', 'auth_register', 'auth_refresh'}


def _created(response: Response) -> dict[str, Any]:
    assert response.status_code == HTTPStatus.CREATED, response.text
    body: dict[str, Any] = response.json()
    return body


def _task(client: ApiClient) -> int:
    task_id: int = _created(client.post('/api/v1/tasks/', {'title': 'Outline'}))['id']
    return task_id


_wallet_names = (f'Wallet {n}' for n in itertools.count())


def _wallet(client: ApiClient) -> int:
    wallet_id: int = _created(client.post('/api/v1/wallets/', {'name': next(_wallet_names)}))['id']
    return wallet_id


def _counter(client: ApiClient) -> int:
    counter_id: int = _created(client.post('/api/v1/counters/', {'name': 'Kawa'}))['id']
    return counter_id


def _item(client: ApiClient) -> int:
    item_id: int = _created(
        client.post('/api/v1/bibliography-items/', {'kind': 'book', 'title': 'Lalka'})
    )['id']
    return item_id


@dataclass(frozen=True)
class Resource:
    path: str
    #: A valid create body; it may create the rows it points at through the client.
    body: Callable[[ApiClient], dict[str, Any]]
    #: A valid PATCH, with fields named as the response names them.
    edit: dict[str, Any]
    #: A field the row always has, so a PATCH may not set it to ``null``.
    required: str
    #: The listing shows every row of the user without query parameters.
    listed: bool = True
    #: The free-text name field: trimmed and never blank.
    name: str | None = None
    #: Names are unique per user, ignoring case.
    unique_name: bool = False
    #: Response fields a write may change on its own (timestamps).
    volatile: frozenset[str] = field(default_factory=frozenset)

    def __str__(self) -> str:
        return self.path.removeprefix('/api/v1/').strip('/')

    @property
    def detail(self) -> str:
        return self.path + '{id}/'

    def methods(self) -> set[str]:
        """The methods the contract has on one row of this resource."""
        return {op['method'] for op in CONTRACT if op['path'] == self.detail}

    def create(self, client: ApiClient, **fields: Any) -> dict[str, Any]:
        return _created(client.post(self.path, {**self.body(client), **fields}))


RESOURCES = [
    Resource(
        '/api/v1/projects/',
        lambda _: {'name': 'Reading'},
        edit={'description': 'Books'},
        required='name',
        name='name',
        unique_name=True,
    ),
    Resource(
        '/api/v1/tasks/',
        lambda _: {'title': 'Outline'},
        edit={'description': 'The first draft'},
        required='title',
        name='title',
    ),
    Resource(
        '/api/v1/tags/',
        lambda _: {'name': 'Pilne'},
        edit={'color': '#3d6fb6'},
        required='name',
        name='name',
        unique_name=True,
    ),
    Resource(
        '/api/v1/task-comments/',
        lambda client: {'task': _task(client), 'body': 'Looks good'},
        edit={'body': 'Looks better'},
        required='body',
        listed=False,
    ),
    Resource(
        '/api/v1/time-entries/',
        lambda client: {'task': _task(client), 'date': '2026-10-13', 'duration_minutes': 30},
        edit={'title': 'Review'},
        required='date',
    ),
    Resource(
        '/api/v1/wallets/',
        lambda _: {'name': 'Personal'},
        edit={'color': '#3d6fb6'},
        required='name',
        name='name',
        unique_name=True,
    ),
    Resource(
        '/api/v1/categories/',
        lambda _: {'name': 'Hobby'},
        edit={'icon': 'coffee'},
        required='name',
        name='name',
        unique_name=True,
    ),
    Resource(
        '/api/v1/transactions/',
        lambda client: {
            'title': 'Kawa',
            'amount': '8.00',
            'date': '2026-10-18',
            'wallet': _wallet(client),
        },
        edit={'description': 'Z rynku'},
        required='amount',
        listed=False,
        name='title',
    ),
    Resource(
        '/api/v1/counters/',
        lambda _: {'name': 'Kawa'},
        edit={'color': '#3d6fb6'},
        required='name',
        name='name',
    ),
    Resource(
        '/api/v1/counter-entries/',
        lambda client: {'counter': _counter(client), 'occurred_at': '2026-10-20T08:00:00Z'},
        edit={'note': 'Double'},
        required='value',
        listed=False,
    ),
    Resource(
        '/api/v1/folders/',
        lambda _: {'name': 'Docs'},
        edit={'name': 'Papers'},
        required='name',
        name='name',
    ),
    Resource(
        '/api/v1/whiteboards/',
        lambda _: {'name': 'Plan'},
        edit={'name': 'Sketch'},
        required='name',
        name='name',
        volatile=frozenset({'updated_at'}),
    ),
    Resource(
        '/api/v1/bibliography-items/',
        lambda _: {'kind': 'book', 'title': 'Lalka'},
        edit={'creator': 'Bolesław Prus'},
        required='title',
        name='title',
    ),
    Resource(
        '/api/v1/bibliography-attempts/',
        lambda client: {'item': _item(client), 'outcome': 'in_progress'},
        edit={'progress': 40},
        required='outcome',
    ),
]

by_resource = pytest.mark.parametrize('resource', RESOURCES, ids=str)
by_named_resource = pytest.mark.parametrize(
    'resource', [r for r in RESOURCES if r.name], ids=str
)


def _try_every_method(
    client: ApiClient, resource: Resource, row_id: str, body: dict[str, Any]
) -> dict[str, int]:
    """The status each method the resource has on ``row_id`` answers ``client`` with."""
    url = f'{resource.path}{row_id}/'
    send = {
        'GET': lambda: client.get(url),
        'PATCH': lambda: client.patch(url, resource.edit),
        'PUT': lambda: client.put(url, {**body, **resource.edit}),
        'DELETE': lambda: client.delete(url),
    }
    return {method: send[method]().status_code for method in sorted(resource.methods())}


@pytest.mark.parametrize(
    'operation',
    [op for op in CONTRACT if op['operation_id'] not in PUBLIC_OPERATIONS],
    ids=lambda op: op['operation_id'],
)
def test_every_operation_but_getting_a_token_requires_one(
    anon_client: ApiClient, operation: dict[str, Any]
) -> None:
    path = operation['path'].replace('{id}', '1')

    response = anon_client.request(operation['method'], path, {})

    assert response.status_code == HTTPStatus.UNAUTHORIZED


@by_resource
def test_a_row_can_be_created_read_edited_and_deleted(
    api_client: ApiClient, resource: Resource
) -> None:
    body = resource.body(api_client)
    created = _created(api_client.post(resource.path, body))
    url = f'{resource.path}{created["id"]}/'
    methods = resource.methods()

    if 'GET' in methods:
        assert api_client.get(url).json() == created
    edited = api_client.patch(url, resource.edit)
    assert edited.status_code == HTTPStatus.OK, edited.text
    assert edited.json() | resource.edit == edited.json()
    if 'PUT' in methods:
        replaced = api_client.put(url, {**body, **resource.edit})
        assert replaced.status_code == HTTPStatus.OK, replaced.text
    deleted = api_client.delete(url)

    assert deleted.status_code == HTTPStatus.NO_CONTENT
    assert set(_try_every_method(api_client, resource, created['id'], body).values()) == {
        HTTPStatus.NOT_FOUND
    }


@by_resource
def test_a_patch_changes_only_the_fields_it_is_given(
    api_client: ApiClient, resource: Resource
) -> None:
    created = resource.create(api_client)
    url = f'{resource.path}{created["id"]}/'

    untouched = api_client.patch(url, {})
    edited = api_client.patch(url, resource.edit)

    def stable(row: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in row.items() if k not in resource.volatile}

    assert untouched.status_code == HTTPStatus.OK, untouched.text
    assert stable(untouched.json()) == stable(created)
    assert stable(edited.json()) == stable(created) | resource.edit


@by_resource
def test_a_patch_cannot_clear_a_required_field(
    api_client: ApiClient, resource: Resource
) -> None:
    created = resource.create(api_client)

    response = api_client.patch(f'{resource.path}{created["id"]}/', {resource.required: None})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


@by_resource
def test_an_unknown_id_is_not_found(api_client: ApiClient, resource: Resource) -> None:
    body = resource.body(api_client)

    statuses = _try_every_method(api_client, resource, UNKNOWN_ID, body)

    assert set(statuses.values()) == {HTTPStatus.NOT_FOUND}, statuses


@by_resource
def test_another_users_row_is_out_of_reach(
    api_client: ApiClient,
    client_for: Callable[[User], ApiClient],
    make_user: Callable[..., User],
    resource: Resource,
) -> None:
    owner = client_for(make_user('owner'))
    body = resource.body(owner)
    row = _created(owner.post(resource.path, body))

    statuses = _try_every_method(api_client, resource, row['id'], body)

    assert set(statuses.values()) == {HTTPStatus.NOT_FOUND}, statuses
    kept = owner.patch(f'{resource.path}{row["id"]}/', {}).json()
    assert {k: v for k, v in kept.items() if k not in resource.volatile} == {
        k: v for k, v in row.items() if k not in resource.volatile
    }
    if resource.listed:
        assert row['id'] not in [r['id'] for r in api_client.get(resource.path).json()]


@by_named_resource
def test_names_are_trimmed_and_never_blank(api_client: ApiClient, resource: Resource) -> None:
    assert resource.name is not None
    created = resource.create(api_client, **{resource.name: '  Plan  '})

    blank = api_client.post(resource.path, {**resource.body(api_client), resource.name: '   '})
    renamed = api_client.patch(f'{resource.path}{created["id"]}/', {resource.name: ' '})

    assert created[resource.name] == 'Plan'
    assert blank.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert renamed.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


@pytest.mark.parametrize('resource', [r for r in RESOURCES if r.unique_name], ids=str)
def test_names_are_unique_ignoring_case(api_client: ApiClient, resource: Resource) -> None:
    assert resource.name is not None
    resource.create(api_client, **{resource.name: 'Plan'})
    other = resource.create(api_client, **{resource.name: 'Other'})

    duplicate = api_client.post(resource.path, {**resource.body(api_client), resource.name: 'plan'})
    renamed = api_client.patch(f'{resource.path}{other["id"]}/', {resource.name: 'PLAN'})

    assert duplicate.status_code == HTTPStatus.BAD_REQUEST
    assert 'already exists' in duplicate.json()['detail']
    assert renamed.status_code == HTTPStatus.BAD_REQUEST
