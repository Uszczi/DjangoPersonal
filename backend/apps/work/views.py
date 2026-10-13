from rest_framework.viewsets import ModelViewSet
from drf_spectacular.utils import extend_schema

from .models import Project
from .serializers import ProjectSerializer


@extend_schema(tags=['projects'])
class ProjectViewSet(ModelViewSet):
    queryset = Project.objects.order_by('-is_inbox', 'normalized_name')
    serializer_class = ProjectSerializer
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']
