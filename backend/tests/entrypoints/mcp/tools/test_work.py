"""The work tools: projects, tasks, time entries and the timer."""

from personal.infra.models import User
from tests.entrypoints.mcp.helpers import call


def test_partial_update_tools_change_only_the_given_fields(mcp_user: User) -> None:
    project = call('create_project', name='Garden', description='Vegetables')
    task = call('create_task', title='Water', project_id=project['id'])
    entry = call('create_time_entry', task_id=task['id'], date='2026-10-01', duration_minutes=30)

    updated = call('update_project', project_id=project['id'], name='Orchard')
    assert updated['description'] == 'Vegetables'

    moved = call('update_time_entry', entry_id=entry['id'], duration_minutes=45)
    assert moved['task_id'] == task['id']
    assert moved['title'] == ''


def test_timer_tools(mcp_user: User) -> None:
    task = call('create_task', title='Write')

    started = call('start_timer', task_id=task['id'])
    assert started['entry']['task_id'] == task['id']
    assert call('get_timer')['entry']['id'] == started['entry']['id']

    stopped = call('stop_timer')
    assert stopped['entry']['end'] is not None
    assert call('get_timer')['entry'] is None


def test_timer_tool_takes_a_limit(mcp_user: User) -> None:
    task = call('create_task', title='Focus')

    started = call('start_timer', task_id=task['id'], duration_minutes=25)

    assert started['entry']['planned_end'] is not None


def test_task_comment_tools(mcp_user: User) -> None:
    task = call('create_task', title='Review')

    comment = call('add_task_comment', task_id=task['id'], body=' Looks good ')
    assert comment['body'] == 'Looks good'
    assert comment['attachments'] == []

    call('update_task_comment', comment_id=comment['id'], body='Ship it')
    assert [c['body'] for c in call('list_task_comments', task_id=task['id'])] == ['Ship it']

    assert call('delete_task_comment', comment_id=comment['id']) == 'deleted'
    assert call('list_task_comments', task_id=task['id']) == []
