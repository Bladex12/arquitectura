"""
Serializers para la app academic.

Plain serializers.Serializer, not ModelSerializer -- ModelSerializer
introspects Meta.model._meta (real Django ORM machinery), which the
DynamoDB-backed shim classes in academic/models.py don't have.
"""
from rest_framework import serializers


class FacultySerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=200)
    code = serializers.CharField(max_length=50, required=False, allow_null=True, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from academic.models import Faculty
        return Faculty.objects.create(**validated_data)

    def update(self, instance, validated_data):
        from academic.dynamodb import faculty as faculty_repo
        from academic.models import Faculty
        item = faculty_repo.update_faculty(instance.id, validated_data)
        return Faculty(item)


class CareerSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    faculty = serializers.CharField(source='faculty_id')
    faculty_name = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=200)
    code = serializers.CharField(max_length=50, required=False, allow_null=True, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from academic.models import Career
        return Career.objects.create(
            name=validated_data['name'], faculty=validated_data['faculty_id'],
            code=validated_data.get('code'), is_active=validated_data.get('is_active', True),
        )

    def update(self, instance, validated_data):
        from academic.dynamodb import career as career_repo
        from academic.models import Career
        item = career_repo.update_career(instance.id, validated_data)
        return Career(item)


class CareerListSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField()
    faculty_name = serializers.CharField(read_only=True)
    code = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    is_active = serializers.BooleanField()


class CourseSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    career = serializers.CharField(source='career_id')
    career_name = serializers.CharField(read_only=True)
    faculty_name = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=200)
    code = serializers.CharField(max_length=50, required=False, allow_null=True, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from academic.models import Course
        return Course.objects.create(
            name=validated_data['name'], career=validated_data['career_id'],
            code=validated_data.get('code'), is_active=validated_data.get('is_active', True),
        )

    def update(self, instance, validated_data):
        from academic.dynamodb import course as course_repo
        from academic.models import Course
        item = course_repo.update_course(instance.id, validated_data)
        return Course(item)


class CourseListSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField()
    career_name = serializers.CharField(read_only=True)
    code = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    is_active = serializers.BooleanField()
