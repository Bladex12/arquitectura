"""
Views para la app academic.

Plain viewsets.ViewSet, not ModelViewSet -- ModelViewSet's pagination/
filter-backend machinery (DjangoFilterBackend, SearchFilter,
OrderingFilter) needs a real QuerySet, which the DynamoDB-backed shim in
academic/models.py doesn't provide. List responses are plain arrays (not
DRF's paginated envelope) -- the frontend already reads
`response.data.results || response.data` (see
frontend/src/services/api.ts's unwrapResults), same precedent as the
users/game_sessions viewsets.
"""
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Faculty, Career, Course
from .serializers import (
    FacultySerializer, CareerSerializer, CareerListSerializer,
    CourseSerializer, CourseListSerializer,
)


def _apply_search(items, term, fields):
    if not term:
        return items
    term = term.lower()
    return [i for i in items if any(term in str(getattr(i, f, '') or '').lower() for f in fields)]


def _apply_ordering(items, ordering_param, default_field, allowed_fields):
    field = (ordering_param or default_field) or ''
    reverse = field.startswith('-')
    field = field.lstrip('-')
    if field not in allowed_fields:
        field = default_field.lstrip('-')
        reverse = default_field.startswith('-')
    return sorted(items, key=lambda i: (getattr(i, field, '') or ''), reverse=reverse)


class FacultyViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return []
        return super().get_permissions()

    def _get_queryset(self):
        include_inactive = self.request.query_params.get('include_inactive') == 'true'
        items = Faculty.objects.all() if include_inactive else Faculty.objects.filter(is_active=True)
        is_active_param = self.request.query_params.get('is_active')
        if is_active_param is not None:
            want_active = is_active_param == 'true'
            items = [i for i in items if i.is_active == want_active]
        items = _apply_search(items, self.request.query_params.get('search'), ['name', 'code'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), 'name', ['name', 'created_at'])
        return items

    def list(self, request):
        serializer = FacultySerializer(self._get_queryset(), many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        try:
            instance = Faculty.objects.get(id=pk)
        except Faculty.DoesNotExist:
            return Response({'error': 'Facultad no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        return Response(FacultySerializer(instance).data)

    def create(self, request):
        serializer = FacultySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(FacultySerializer(instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = Faculty.objects.get(id=pk)
        except Faculty.DoesNotExist:
            return Response({'error': 'Facultad no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FacultySerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(FacultySerializer(updated).data)

    partial_update = update

    def destroy(self, request, pk=None):
        from academic.dynamodb import faculty as faculty_repo
        try:
            faculty_repo.delete_faculty(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CareerViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return []
        return super().get_permissions()

    def _get_queryset(self):
        faculty_id = self.request.query_params.get('faculty')
        items = Career.objects.filter(faculty_id=faculty_id) if faculty_id else Career.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        items = _apply_search(items, self.request.query_params.get('search'),
                               ['name', 'code', 'faculty_name'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), 'name', ['name', 'created_at'])
        return items

    def list(self, request):
        serializer_class = CareerListSerializer
        serializer = serializer_class(self._get_queryset(), many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        try:
            instance = Career.objects.get(id=pk)
        except Career.DoesNotExist:
            return Response({'error': 'Carrera no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CareerSerializer(instance).data)

    def create(self, request):
        serializer = CareerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(CareerSerializer(instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = Career.objects.get(id=pk)
        except Career.DoesNotExist:
            return Response({'error': 'Carrera no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CareerSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(CareerSerializer(updated).data)

    partial_update = update

    def destroy(self, request, pk=None):
        from academic.dynamodb import career as career_repo
        try:
            career_repo.delete_career(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CourseViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return []
        return super().get_permissions()

    def _get_queryset(self):
        career_id = self.request.query_params.get('career')
        items = Course.objects.filter(career_id=career_id) if career_id else Course.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        items = _apply_search(items, self.request.query_params.get('search'),
                               ['name', 'code', 'career_name', 'faculty_name'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), 'name', ['name', 'created_at'])
        return items

    def list(self, request):
        serializer = CourseListSerializer(self._get_queryset(), many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        try:
            instance = Course.objects.get(id=pk)
        except Course.DoesNotExist:
            return Response({'error': 'Curso no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CourseSerializer(instance).data)

    def create(self, request):
        serializer = CourseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(CourseSerializer(instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = Course.objects.get(id=pk)
        except Course.DoesNotExist:
            return Response({'error': 'Curso no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CourseSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(CourseSerializer(updated).data)

    partial_update = update

    def destroy(self, request, pk=None):
        from academic.dynamodb import course as course_repo
        course_repo.delete_course(pk)
        return Response(status=status.HTTP_204_NO_CONTENT)
