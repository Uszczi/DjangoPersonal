from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ProjectViewSet, TaskListCreateView

router = DefaultRouter()
router.register('projects', ProjectViewSet, basename='project')

urlpatterns = [
    *router.urls,
    path('tasks/', TaskListCreateView.as_view(), name='task-list'),
]
