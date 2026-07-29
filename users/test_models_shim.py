# users/test_models_shim.py
from django.contrib.auth.models import User as DjangoUser
from django.test import TestCase

from users.dynamodb.testing import DynamoDBTestCase
from users.models import Administrator, Professor, ProfessorAccessCode, Student


class ProfessorShimTest(DynamoDBTestCase, TestCase):
    def test_create_from_django_user_then_get_by_id(self):
        """Matches game_sessions/test_*.py fixture shape:
        User.objects.create_user(...) then Professor.objects.create(user=user)."""
        django_user = DjangoUser.objects.create_user(username='prof_abc123', password='pass')
        professor = Professor.objects.create(user=django_user)
        fetched = Professor.objects.get(id=professor.id)
        assert fetched.user.username == 'prof_abc123'

    def test_create_with_access_code(self):
        django_user = DjangoUser.objects.create_user(username='prof_xyz', password='pass')
        professor = Professor.objects.create(user=django_user, access_code='1111')
        assert professor.access_code == '1111'

    def test_get_missing_raises_does_not_exist(self):
        try:
            Professor.objects.get(id='missing')
            assert False, 'expected DoesNotExist'
        except Professor.DoesNotExist:
            pass

    def test_filter_id_in_with_select_related_chain(self):
        """Matches game_sessions/views.py:156:
        Professor.objects.select_related('user').filter(id__in=professor_ids)"""
        u1 = DjangoUser.objects.create_user(username='p1', password='pass')
        u2 = DjangoUser.objects.create_user(username='p2', password='pass')
        prof1 = Professor.objects.create(user=u1)
        Professor.objects.create(user=u2)
        results = Professor.objects.select_related('user').filter(id__in=[prof1.id])
        assert len(results) == 1
        assert results[0].user.get_full_name() == 'p1'  # no first/last name set

    def test_registration_create_with_explicit_fields(self):
        """Matches the real registration path (ProfessorCreateSerializer)."""
        professor = Professor.objects.create(
            username='newprof', email='newprof@udd.cl', password='pw12345!',
            first_name='New', last_name='Prof', access_code='222222',
        )
        assert professor.user.username == 'newprof'
        assert professor.user.email == 'newprof@udd.cl'

    def test_count(self):
        DjangoUser and None  # no-op to keep import used
        Professor.objects.create(username='c1', email='c1@udd.cl', password='pw12345!')
        Professor.objects.create(username='c2', email='c2@udd.cl', password='pw12345!')
        assert Professor.objects.count() == 2


class AdministratorShimTest(DynamoDBTestCase, TestCase):
    def test_create_from_existing_professor(self):
        """Matches game_sessions/test_game_session_viewset.py:105:
        Administrator.objects.create(user=prof_a.user)"""
        django_user = DjangoUser.objects.create_user(username='profa', password='pass')
        professor = Professor.objects.create(user=django_user)
        Administrator.objects.create(user=professor.user)
        # Same account should now also read back as administrator
        fetched_professor = Professor.objects.get(id=professor.id)
        assert fetched_professor.user.username == 'profa'

    def test_create_from_raw_django_user_without_prior_professor(self):
        """Matches game_sessions/test_game_session_viewset.py:134:
        admin_user = User.objects.create_user(...); Administrator.objects.create(user=admin_user)
        - no Professor.objects.create() call first."""
        django_user = DjangoUser.objects.create_user(username='rawadmin', password='pass')
        admin = Administrator.objects.create(user=django_user)
        assert admin.user.username == 'rawadmin'
        # It's also fetchable as a Professor (admins are auto-professors)
        as_professor = Professor.objects.get(id=admin.id)
        assert as_professor.user.username == 'rawadmin'


class StudentShimTest(DynamoDBTestCase, TestCase):
    def test_create_then_get(self):
        student = Student.objects.create(full_name='Ana', email='ana@udd.cl', rut='1-1')
        fetched = Student.objects.get(id=student.id)
        assert fetched.full_name == 'Ana'

    def test_get_missing_raises_does_not_exist(self):
        try:
            Student.objects.get(id='missing')
            assert False, 'expected DoesNotExist'
        except Student.DoesNotExist:
            pass

    def test_filter_id_exists(self):
        """Matches game_sessions/views.py:1007:
        Student.objects.filter(id=student_id).exists()"""
        student = Student.objects.create(full_name='Bea', email='bea@udd.cl', rut='2-2')
        assert Student.objects.filter(id=student.id).exists() is True
        assert Student.objects.filter(id='missing').exists() is False

    def test_filter_id_in_values_list(self):
        """Matches game_sessions/serializers.py:178:
        set(Student.objects.filter(id__in=value).values_list('id', flat=True))"""
        s1 = Student.objects.create(full_name='C1', email='c1@udd.cl', rut='3-3')
        s2 = Student.objects.create(full_name='C2', email='c2@udd.cl', rut='4-4')
        ids = set(Student.objects.filter(id__in=[s1.id, s2.id]).values_list('id', flat=True))
        assert ids == {s1.id, s2.id}

    def test_get_or_create(self):
        """Matches game_sessions/views.py:488."""
        student, created = Student.objects.get_or_create(
            email='dd@udd.cl', defaults={'full_name': 'D D', 'rut': '5-5'},
        )
        assert created is True
        student2, created2 = Student.objects.get_or_create(
            email='dd@udd.cl', defaults={'full_name': 'ignored', 'rut': 'ignored'},
        )
        assert created2 is False
        assert student2.id == student.id


class ProfessorAccessCodeShimTest(DynamoDBTestCase, TestCase):
    def test_create_and_filter_by_code_used_email(self):
        """Matches users/serializers.py's validate_access_code:
        ProfessorAccessCode.objects.filter(access_code=..., is_used=False, email__iexact=...).first()"""
        ProfessorAccessCode.objects.create(email='p@udd.cl', access_code='999999')
        found = ProfessorAccessCode.objects.filter(
            access_code='999999', is_used=False, email__iexact='P@UDD.cl',
        ).first()
        assert found is not None
        assert found.email == 'p@udd.cl'

    def test_filter_by_code_only(self):
        """Matches users/views.py's create_with_code uniqueness check:
        ProfessorAccessCode.objects.filter(access_code=access_code).exists()"""
        ProfessorAccessCode.objects.create(email='q@udd.cl', access_code='888888')
        assert ProfessorAccessCode.objects.filter(access_code='888888').exists() is True
        assert ProfessorAccessCode.objects.filter(access_code='000000').exists() is False

    def test_filter_by_email_pending_only(self):
        """Matches users/views.py's create_with_code pending check:
        ProfessorAccessCode.objects.filter(email=email, is_used=False).first()"""
        ProfessorAccessCode.objects.create(email='r@udd.cl', access_code='777777')
        found = ProfessorAccessCode.objects.filter(email='r@udd.cl', is_used=False).first()
        assert found.access_code == '777777'

    def test_save_marks_used(self):
        ProfessorAccessCode.objects.create(email='s@udd.cl', access_code='666666')
        code = ProfessorAccessCode.objects.filter(access_code='666666').first()
        code.is_used = True
        code.save(update_fields=['is_used', 'used_at'])
        refetched = ProfessorAccessCode.objects.filter(access_code='666666').first()
        assert refetched.is_used is True

    def test_all_ordered_newest_first(self):
        ProfessorAccessCode.objects.create(email='t@udd.cl', access_code='555555')
        ProfessorAccessCode.objects.create(email='u@udd.cl', access_code='444444')
        codes = list(ProfessorAccessCode.objects.all())
        assert [c.access_code for c in codes] == ['444444', '555555']
