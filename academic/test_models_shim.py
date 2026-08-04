"""Shim-level tests for academic/models.py, verifying the exact call
shapes real call sites use (game_sessions/views.py, game_sessions test
fixtures, admin_dashboard/views.py) -- not just the repo layer
underneath."""
from academic.dynamodb.testing import DynamoDBTestCase
from academic.models import Faculty, Career, Course


class FacultyShimTest(DynamoDBTestCase):
    def test_create_and_get_or_create(self):
        f = Faculty.objects.create(name='Ingeniería')
        assert f.id is not None

        found, created = Faculty.objects.get_or_create(name='Ingeniería')
        assert created is False
        assert found.id == f.id

        new, created2 = Faculty.objects.get_or_create(name='Medicina')
        assert created2 is True
        assert new.name == 'Medicina'

    def test_filter_is_active(self):
        Faculty.objects.create(name='Activa')
        Faculty.objects.create(name='Inactiva', is_active=False)
        active = Faculty.objects.filter(is_active=True)
        assert len(active) == 1
        assert active[0].name == 'Activa'


class CareerShimTest(DynamoDBTestCase):
    def setUp(self):
        super().setUp()
        self.faculty = Faculty.objects.create(name='Ingeniería')

    def test_create_with_instance_kwarg(self):
        career = Career.objects.create(name='Civil', faculty=self.faculty)
        assert career.faculty_id == self.faculty.id
        assert career.faculty_name == 'Ingeniería'

    def test_get_or_create_matches_django_signature(self):
        career, created = Career.objects.get_or_create(name='Informática', faculty=self.faculty)
        assert created is True
        again, created2 = Career.objects.get_or_create(name='Informática', faculty=self.faculty)
        assert created2 is False
        assert again.id == career.id

    def test_filter_by_faculty_instance(self):
        Career.objects.create(name='Civil', faculty=self.faculty)
        other = Faculty.objects.create(name='Medicina')
        Career.objects.create(name='Enfermería', faculty=other)

        careers = Career.objects.filter(faculty=self.faculty, is_active=True)
        assert len(careers) == 1
        assert careers[0].name == 'Civil'


class CourseShimTest(DynamoDBTestCase):
    def setUp(self):
        super().setUp()
        self.faculty = Faculty.objects.create(name='Ingeniería')
        self.career = Career.objects.create(name='Informática', faculty=self.faculty)

    def test_create_and_get(self):
        course = Course.objects.create(name='Emprendimiento', career=self.career)
        fetched = Course.objects.get(id=course.id)
        assert fetched.name == 'Emprendimiento'
        assert fetched.career_id == self.career.id

    def test_get_or_create_matches_django_signature(self):
        course, created = Course.objects.get_or_create(name='Curso X', career=self.career)
        assert created is True
        again, created2 = Course.objects.get_or_create(name='Curso X', career=self.career)
        assert created2 is False
        assert again.id == course.id

    def test_filter_id_in_carries_faculty_id(self):
        c1 = Course.objects.create(name='C1', career=self.career)
        c2 = Course.objects.create(name='C2', career=self.career)
        result = {c.id: c.faculty_id for c in Course.objects.filter(id__in=[c1.id, c2.id])}
        assert result[c1.id] == self.faculty.id
        assert result[c2.id] == self.faculty.id
