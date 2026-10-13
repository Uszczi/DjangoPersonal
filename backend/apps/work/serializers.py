from rest_framework import serializers

from .models import Project, Task, normalize_project_name, project_name_key


class ProjectSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=100, trim_whitespace=True)

    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'is_inbox']
        read_only_fields = ['id', 'is_inbox']

    def validate_name(self, value):
        name = normalize_project_name(value)
        normalized_name = project_name_key(name)

        if self.instance and self.instance.is_inbox:
            if name != self.instance.name:
                raise serializers.ValidationError('Inbox cannot be renamed.')
            return name

        if normalized_name == 'inbox':
            raise serializers.ValidationError('Inbox is a reserved project name.')

        duplicates = Project.objects.filter(normalized_name=normalized_name)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError('A project with this name already exists.')

        return name


class TaskSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'project', 'is_completed']
        read_only_fields = ['id', 'project', 'is_completed']


class TaskCreateSerializer(TaskSerializer):
    title = serializers.CharField(max_length=200, trim_whitespace=True)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
    )

    class Meta:
        model = Task
        fields = TaskSerializer.Meta.fields
        read_only_fields = ['id', 'is_completed']

    def create(self, validated_data):
        if 'project' not in validated_data:
            validated_data['project'] = Project.objects.get(is_inbox=True)
        return super().create(validated_data)

    def to_representation(self, instance):
        return TaskSerializer(instance, context=self.context).data
