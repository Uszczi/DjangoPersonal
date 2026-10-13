from rest_framework.viewsets import GenericViewSet, ModelViewSet
from rest_framework.exceptions import ValidationError
from rest_framework.mixins import CreateModelMixin, ListModelMixin, UpdateModelMixin
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view

from .models import Project, Task
from .serializers import (
    ProjectSerializer,
    TaskCreateSerializer,
    TaskSerializer,
    TaskUpdateSerializer,
)


@extend_schema(tags=['projects'])
class ProjectViewSet(ModelViewSet):
    queryset = Project.objects.order_by('-is_inbox', 'normalized_name')
    serializer_class = ProjectSerializer
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']


@extend_schema_view(
    list=extend_schema(
        tags=['tasks'],
        responses=TaskSerializer(many=True),
        parameters=[
            OpenApiParameter(
                name='project',
                type=int,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Project ID. Defaults to Inbox when omitted.',
            ),
        ],
    ),
    create=extend_schema(
        tags=['tasks'],
        request=TaskCreateSerializer,
        responses={201: TaskSerializer},
    ),
    partial_update=extend_schema(
        tags=['tasks'],
        request=TaskUpdateSerializer,
        responses={200: TaskSerializer},
    ),
)
class TaskViewSet(ListModelMixin, CreateModelMixin, UpdateModelMixin, GenericViewSet):
    serializer_class = TaskSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return TaskCreateSerializer
        if self.action == 'partial_update':
            return TaskUpdateSerializer
        return TaskSerializer

    def get_queryset(self):
        tasks = Task.objects.all()
        if self.action != 'list':
            return tasks

        project_id = self.request.query_params.get('project')

        if project_id is None:
            return tasks.filter(project__is_inbox=True)

        try:
            project_id = int(project_id)
        except ValueError as error:
            raise ValidationError({'project': 'Project must be a valid integer ID.'}) from error

        return tasks.filter(project_id=project_id)
