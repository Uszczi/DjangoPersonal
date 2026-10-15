Status: ready-for-agent

# Time Tracking

## Problem Statement

DjangoPersonal records what the work is (Projects and Tasks) but not how long it takes. Without time data the user cannot monitor where the day goes, estimate future work from past actuals, or notice when a "quick task" quietly consumed an afternoon.

## Solution

Add time tracking to the existing React interface and Django Ninja API, inside the `work` app. The core unit is a Time entry: a start and end timestamp on a Task. A live timer produces entries; entries can also be logged manually and corrected afterwards. Exactly one timer can run at a time. Time tracking is loosely coupled with task completion: neither starting a timer nor completing a task changes the other. The feature ships with a dedicated timer page, separate from the task list, plus a one-click start on each task row.

## User Stories

1. As the user, I want to start a timer on a task from the task list, so that tracking my work takes one click.
2. As the user, I want at most one timer running at a time, so that my tracked time is never double-counted.
3. As the user, I want starting a timer on another task to end the previous one, so that switching work never leaves a stale timer behind.
4. As the user, I want to stop the running timer, so that the elapsed time is saved as a time entry.
5. As the user, I want to discard the running timer, so that an accidental start pollutes nothing.
6. As the user, I want to add a time entry manually with a date and a duration, so that work I forgot to time is still recorded.
7. As the user, I want to edit and delete stopped entries, so that mistakes in my history are correctable.
8. As the user, I want to see today's entries with their task and duration, so that I can see where the day went.
9. As the user, I want totals for today, per task, and for the last seven days, so that I can monitor my time at a glance.
10. As the user, I want a dedicated timer page with a tab navigation from the task list, so that time monitoring does not clutter task management.
11. As the user, I want the timer to keep running when I complete its task, and to be startable on a completed task, so that neither feature constrains the other.
12. As the user, I want to log time against a completed task manually, so that forgotten work can be recorded after the fact.

## Implementation Decisions

- Deliver a complete vertical slice inside the existing `work` app: model, migration, Django Ninja endpoints, generated TypeScript client, React UI.
- A Time entry belongs to exactly one Task and stores `start` and `end` datetimes. `end` is nullable; an entry without an end is the running timer. Timestamps always come from the server clock; duration is derived, never stored.
- The API exposes two resources: the `time-entries` collection (list with `task` and `date` filters, manual create, partial update, delete) and a `timer` singleton (`GET` current state, `POST` start, `POST` stop). This is the API's first DELETE endpoint.
- Starting a timer while another runs ends the previous entry automatically; starting on a completed task is allowed and does not reopen it. Completing or reopening a task never touches its entries. Manual entries on completed tasks are allowed. Overlapping entries are allowed.
- A manual entry is entered as a date plus a duration in minutes; the API stores it as a start/end pair on that date. Duration must be 1–1440 minutes and the date must not be in the future.
- An entry belongs to the calendar day its `start` falls on, so an overnight timer is reported on the day it began.
- The running timer cannot be edited; it can only be stopped or discarded (DELETE). Stopped entries are fully editable.
- Time entries PROTECT their Task, so time records cannot be silently destroyed by a future task-deletion feature.
- The timer page has four sections: the running timer, today's entries (editable, deletable), a manual entry form, and a summary (today's total, per-task totals for today, and daily totals for the last seven days).
- Navigation between the task list and the timer page is a tab switch in the header; no router is added.
- The task list rows gain a start button but no time totals; the list stays uncluttered.
- The `GET timer` response includes `server_now` so the frontend can correct client-clock skew while ticking.
- Regenerate the committed OpenAPI schema and TypeScript client; fix the `just generate-api` recipe, which still calls the removed drf-spectacular command.

## Testing Decisions

- Backend: pytest with pytest-django and Django's test client, in `backend/tests/test_time_tracking_api.py`. Cover the single-timer invariant, start/stop/discard, manual entry creation and validation, list filters, editing and deleting entries, and loose coupling with task completion. Tests control the server clock instead of sleeping.
- Frontend: Vitest and React Testing Library with fetch mocked at the network boundary, extending the existing App tests. Cover the tab navigation, the timer page sections, starting a timer from a task row, and the ticking display.
- Tests verify externally observable behavior over internal implementation details.

## Out of Scope

- Multiple concurrent timers.
- Rounding entries to billing increments and tracking pauses or breaks.
- Time totals on the task list rows.
- Charts or reporting beyond the seven-day daily totals.
- Any automatic start/stop/reopen coupling between timers and task completion.
- Task deletion semantics for existing entries (PROTECT stands until a deletion feature lands).
- Multi-user tracking, budgets, or estimates.

## Further Notes

- The domain terms `Time entry` and `Running timer` are recorded in the repository glossary.
- This spec does not prescribe concrete payload formats; those should be designed while implementing the API seam.
