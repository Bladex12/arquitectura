"""
Views para la app academic
"""
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Faculty, Career, Course
from .serializers import (
    FacultySerializer, CareerSerializer, CareerListSerializer,
    CourseSerializer, CourseListSerializer
)


class FacultyViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Facultades
    """
    queryset = Faculty.objects.filter(is_active=True)
    serializer_class = FacultySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        """
        Permite leer sin autenticación para formularios públicos y tablets
        """
        if self.action in ['list', 'retrieve']:
            return []
        return super().get_permissions()

    def get_queryset(self):
        queryset = Faculty.objects.all()
        # Solo mostrar activas por defecto, a menos que se especifique
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset


class CareerViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Carreras
    """
    queryset = Career.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['faculty', 'is_active']
    search_fields = ['name', 'code', 'faculty__name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        """
        Permite leer sin autenticación para tablets
        """
        if self.action in ['list', 'retrieve']:
            return []
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'list':
            return CareerListSerializer
        return CareerSerializer

    def get_queryset(self):
        queryset = Career.objects.select_related('faculty')
        faculty_id = self.request.query_params.get('faculty')
        if faculty_id:
            queryset = queryset.filter(faculty_id=faculty_id)
        # Solo mostrar activas por defecto
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset


class CourseViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Cursos
    """
    queryset = Course.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['career', 'is_active']
    search_fields = ['name', 'code', 'career__name', 'career__faculty__name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        """
        Permite leer sin autenticación para tablets
        """
        if self.action in ['list', 'retrieve']:
            return []
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'list':
            return CourseListSerializer
        return CourseSerializer

    def get_queryset(self):
        queryset = Course.objects.select_related('career', 'career__faculty')
        career_id = self.request.query_params.get('career')
        if career_id:
            queryset = queryset.filter(career_id=career_id)
        # Solo mostrar activos por defecto
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset
