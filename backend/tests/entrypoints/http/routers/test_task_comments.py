"""The Task comment and comment attachment endpoints."""

from collections.abc import Callable
from http import HTTPStatus
from typing import Any

from personal.core.work.attachments import MAX_ATTACHMENT_BYTES
from personal.infra.models import User
from tests.harness import ApiClient

PNG = b'\x89PNG\r\n\x1a\n' + bytes(range(256)) * 4


def _task(post_json: Any, title: str = 'Outline') -> int:
    response = post_json('/api/v1/tasks/', {'title': title})
    assert response.status_code == HTTPStatus.CREATED
    task_id: int = response.json()['id']
    return task_id


def _comment(post_json: Any, task_id: int, body: str = 'Looks good') -> dict[str, Any]:
    response = post_json('/api/v1/task-comments/', {'task': task_id, 'body': body})
    assert response.status_code == HTTPStatus.CREATED, response.json()
    comment: dict[str, Any] = response.json()
    return comment


def test_comments_are_listed_oldest_first(post_json: Any, api_client: ApiClient) -> None:
    task_id = _task(post_json)
    first = _comment(post_json, task_id, '  First  ')
    _comment(post_json, task_id, 'Second')

    listed = api_client.get(f'/api/v1/task-comments/?task={task_id}').json()

    assert first['body'] == 'First'
    assert first['task_id'] == task_id
    assert first['attachments'] == []
    assert [comment['body'] for comment in listed] == ['First', 'Second']


def test_comment_needs_an_existing_task(post_json: Any, api_client: ApiClient) -> None:
    assert post_json('/api/v1/task-comments/', {'task': 999, 'body': 'x'}).status_code == 400
    assert api_client.get('/api/v1/task-comments/?task=999').status_code == 404


def test_edit_and_delete_a_comment(
    post_json: Any, patch_json: Any, api_client: ApiClient
) -> None:
    task_id = _task(post_json)
    comment = _comment(post_json, task_id)

    edited = patch_json(f'/api/v1/task-comments/{comment["id"]}/', {'body': 'Changed'})
    assert edited.status_code == HTTPStatus.OK
    assert edited.json()['body'] == 'Changed'
    assert patch_json(f'/api/v1/task-comments/{comment["id"]}/', {'body': None}).status_code == 422

    deleted = api_client.delete(f'/api/v1/task-comments/{comment["id"]}/')
    assert deleted.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get(f'/api/v1/task-comments/?task={task_id}').json() == []


def test_attached_file_comes_back_byte_for_byte(post_json: Any, api_client: ApiClient) -> None:
    comment = _comment(post_json, _task(post_json))

    uploaded = api_client.upload(
        f'/api/v1/task-comments/{comment["id"]}/attachments/',
        file_name='C:\\Photos\\zdjęcie.png',
        data=PNG,
        content_type='application/octet-stream',
    )

    assert uploaded.status_code == HTTPStatus.CREATED, uploaded.json()
    attachment = uploaded.json()
    assert attachment['file_name'] == 'zdjęcie.png'
    # Recognised as a picture from its bytes, whatever the client declared.
    assert attachment['content_type'] == 'image/png'
    assert attachment['is_image'] is True
    assert attachment['size'] == len(PNG)

    downloaded = api_client.get(f'/api/v1/comment-attachments/{attachment["id"]}/')
    assert downloaded.status_code == HTTPStatus.OK
    assert downloaded.body == PNG
    assert downloaded.headers['content-type'] == 'image/png'
    assert downloaded.headers['content-disposition'].startswith('inline;')

    listed = api_client.get(f'/api/v1/task-comments/?task={comment["task_id"]}').json()
    assert [item['id'] for item in listed[0]['attachments']] == [attachment['id']]


def test_other_files_are_only_downloaded(post_json: Any, api_client: ApiClient) -> None:
    comment = _comment(post_json, _task(post_json))
    path = f'/api/v1/task-comments/{comment["id"]}/attachments/'

    html = api_client.upload(path, file_name='page.html', data=b'<script>', content_type='text/html')
    fake_png = api_client.upload(path, file_name='a.png', data=b'not a png', content_type='image/png')

    assert html.json()['content_type'] == 'text/html'
    assert html.json()['is_image'] is False
    assert fake_png.json()['content_type'] == 'application/octet-stream'
    downloaded = api_client.get(f'/api/v1/comment-attachments/{html.json()["id"]}/')
    assert downloaded.headers['content-disposition'].startswith('attachment;')
    assert downloaded.headers['x-content-type-options'] == 'nosniff'


def test_empty_and_oversized_files_are_refused(post_json: Any, api_client: ApiClient) -> None:
    comment = _comment(post_json, _task(post_json))
    path = f'/api/v1/task-comments/{comment["id"]}/attachments/'

    assert api_client.upload(path, file_name='a', data=b'').status_code == 400
    too_big = api_client.upload(path, file_name='a', data=b'0' * (MAX_ATTACHMENT_BYTES + 1))
    assert too_big.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE


def test_delete_an_attachment(post_json: Any, api_client: ApiClient) -> None:
    comment = _comment(post_json, _task(post_json))
    attachment = api_client.upload(
        f'/api/v1/task-comments/{comment["id"]}/attachments/', file_name='a.png', data=PNG
    ).json()

    assert api_client.delete(f'/api/v1/comment-attachments/{attachment["id"]}/').status_code == 204
    assert api_client.get(f'/api/v1/comment-attachments/{attachment["id"]}/').status_code == 404


def test_deleting_the_task_deletes_its_comments_and_files(
    post_json: Any, api_client: ApiClient
) -> None:
    task_id = _task(post_json)
    comment = _comment(post_json, task_id)
    attachment = api_client.upload(
        f'/api/v1/task-comments/{comment["id"]}/attachments/', file_name='a.png', data=PNG
    ).json()

    assert api_client.delete(f'/api/v1/tasks/{task_id}/').status_code == HTTPStatus.NO_CONTENT

    assert api_client.get(f'/api/v1/comment-attachments/{attachment["id"]}/').status_code == 404


def test_comments_and_files_are_private(
    post_json: Any,
    api_client: ApiClient,
    make_user: Callable[..., User],
    client_for: Callable[[User], ApiClient],
) -> None:
    task_id = _task(post_json)
    comment = _comment(post_json, task_id)
    attachment = api_client.upload(
        f'/api/v1/task-comments/{comment["id"]}/attachments/', file_name='a.png', data=PNG
    ).json()
    stranger = client_for(make_user(username='stranger'))

    assert stranger.get(f'/api/v1/task-comments/?task={task_id}').status_code == 404
    assert stranger.post('/api/v1/task-comments/', {'task': task_id}).status_code == 400
    assert stranger.patch(f'/api/v1/task-comments/{comment["id"]}/', {'body': 'x'}).status_code == 404
    assert stranger.delete(f'/api/v1/task-comments/{comment["id"]}/').status_code == 404
    upload_path = f'/api/v1/task-comments/{comment["id"]}/attachments/'
    assert stranger.upload(upload_path, file_name='a', data=PNG).status_code == 404
    assert stranger.get(f'/api/v1/comment-attachments/{attachment["id"]}/').status_code == 404
    assert stranger.delete(f'/api/v1/comment-attachments/{attachment["id"]}/').status_code == 404
