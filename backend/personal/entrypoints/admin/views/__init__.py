"""What the admin panel shows and lets staff change.

Rows are created through the app (users with ``just createsuperuser``), so no
view allows creating. Edits are limited to plain fields whose rules the mapper
events enforce for every writer (``personal.infra.rules``: name normalization, the
Inbox keeping its name); status lists, task statuses and money stay with the
app's use cases. Deletes of users and projects go through their repositories,
which turn constraint failures into domain errors the panel shows as a message
(and the Inbox refuses deletion in its ``before_delete`` event).
"""

from sqladmin import ModelView

from .accounts import UserView
from .bibliography import AttemptView, BibliographyItemView
from .counters import CounterEntryView, CounterView
from .expenses import CategoryView, TransactionView, WalletView
from .whiteboard import FolderView, WhiteboardView
from .work import (
    CommentAttachmentView,
    ProjectView,
    TagView,
    TaskCommentView,
    TaskView,
    TimeEntryView,
)

VIEWS: list[type[ModelView]] = [
    UserView,
    ProjectView,
    TaskView,
    TagView,
    TaskCommentView,
    CommentAttachmentView,
    TimeEntryView,
    WhiteboardView,
    FolderView,
    WalletView,
    CategoryView,
    TransactionView,
    CounterView,
    CounterEntryView,
    BibliographyItemView,
    AttemptView,
]
