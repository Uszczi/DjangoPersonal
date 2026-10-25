"""Unit tests for the Project name rule (no DB, no API)."""

from personal.infra.rules import normalize_project_name, project_name_key


def test_project_names_are_trimmed() -> None:
    assert normalize_project_name('  Alpha  ') == 'Alpha'
    assert normalize_project_name('Alpha') == 'Alpha'
    assert normalize_project_name('\tInbox\n') == 'Inbox'


def test_project_name_key_casefolds() -> None:
    assert project_name_key('  Alpha  ') == 'alpha'
    assert project_name_key('InBoX') == 'inbox'


def test_inbox_reserved_key() -> None:
    assert project_name_key('INBOX') == 'inbox'
    assert project_name_key('inbox') == 'inbox'


def test_task_model_module_has_no_duplicate_name_rule() -> None:
    import personal.infra.models.task as task_module

    assert not hasattr(task_module, 'normalize_project_name')
    assert not hasattr(task_module, 'project_name_key')
