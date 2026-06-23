"""
Serializers para la app academic
"""
from rest_framework import serializers
from .models import Faculty, Career, Course


class FacultySerializer(serializers.ModelSerializer):
    """Serializer para Facultad"""
    class Meta:
        model = Faculty
        fields = ['id', 'name', 'code', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CareerSerializer(serializers.ModelSerializer):
    """Serializer para Carrera"""
    faculty_name = serializers.CharField(source='faculty.name', read_only=True)
    
    class Meta:
        model = Career
        fields = ['id', 'faculty', 'faculty_name', 'name', 'code', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'faculty_name', 'created_at', 'updated_at']


class CareerListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listar carreras"""
    faculty_name = serializers.CharField(source='faculty.name', read_only=True)
    
    class Meta:
        model = Career
        fields = ['id', 'name', 'faculty_name', 'code', 'is_active']


class CourseSerializer(serializers.ModelSerializer):
    """Serializer para Curso"""
    career_name = serializers.CharField(source='career.name', read_only=True)
    faculty_name = serializers.CharField(source='career.faculty.name', read_only=True)
    
    class Meta:
        model = Course
        fields = ['id', 'career', 'career_name', 'faculty_name', 'name', 'code', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'career_name', 'faculty_name', 'created_at', 'updated_at']


class CourseListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listar cursos"""
    career_name = serializers.CharField(source='career.name', read_only=True)
    
    class Meta:
        model = Course
        fields = ['id', 'name', 'career_name', 'code', 'is_active']

