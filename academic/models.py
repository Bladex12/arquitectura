"""
Compatibility shim: Faculty/Career/Course used to be Django ORM models.
They're now plain Python classes backed by DynamoDB's ContentTable (see
academic/dynamodb/ and
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md).

This shim exists so existing call sites (academic/views.py,
academic/serializers.py, challenges/models.py, challenges/serializers.py,
admin_dashboard/views.py, game_sessions/views.py, game_sessions/serializers.py,
and the many test fixtures across game_sessions/test_*.py and
admin_dashboard/tests.py) keep working with `.objects.get/.filter/.create/
.get_or_create(...)` call shapes, without every call site needing a rewrite.

The real Django ORM class definitions this replaced are frozen in
academic/legacy_orm_models.py, used only by the one-time RDS->DynamoDB
backfill script.
"""
from django.core.exceptions import ObjectDoesNotExist

from academic.dynamodb import faculty as faculty_repo
from academic.dynamodb import career as career_repo
from academic.dynamodb import course as course_repo


class _ListResult(list):
    """list subclass adding the QuerySet-ish methods actual call sites
    use: .exists(), .values_list(field, flat=True), .first()."""

    def exists(self):
        return len(self) > 0

    def first(self):
        return self[0] if self else None

    def values_list(self, field, flat=False):
        return [getattr(obj, field) for obj in self]


def _id_of(value):
    """Accepts either a model instance (`.id`) or a raw id, matching
    Django's own `faculty=<instance>` / `faculty_id=<id>` duality."""
    if value is None:
        return None
    return getattr(value, 'id', value)


class Faculty:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            faculty_id = _id_of(id if id is not None else pk)
            item = faculty_repo.get_faculty(faculty_id)
            if item is None:
                raise Faculty.DoesNotExist(f'Faculty {faculty_id} does not exist')
            return Faculty(item)

        def filter(self, is_active=None, id__in=None):
            if id__in is not None:
                items = faculty_repo.get_faculties_by_ids([_id_of(i) for i in id__in])
                result = list(items.values())
            else:
                result = faculty_repo.list_faculties(active_only=is_active is True)
                if is_active is False:
                    result = [f for f in result if not f['is_active']]
            return _ListResult(Faculty(item) for item in result)

        def all(self):
            return self.filter()

        def create(self, *, name, code=None, is_active=True):
            return Faculty(faculty_repo.create_faculty(name=name, code=code, is_active=is_active))

        def get_or_create(self, *, name, defaults=None):
            existing = faculty_repo.find_faculty_by_name(name)
            if existing:
                return Faculty(existing), False
            fields = dict(defaults or {})
            fields.setdefault('is_active', True)
            return Faculty(faculty_repo.create_faculty(name=name, **fields)), True

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.name = item['name']
        self.code = item.get('code')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')

    def __str__(self):
        return self.name


class Career:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            career_id = _id_of(id if id is not None else pk)
            item = career_repo.get_career(career_id)
            if item is None:
                raise Career.DoesNotExist(f'Career {career_id} does not exist')
            return Career(item)

        def filter(self, faculty=None, faculty_id=None, is_active=None):
            fid = _id_of(faculty) if faculty is not None else faculty_id
            result = career_repo.list_careers(faculty_id=fid, active_only=is_active is True)
            if is_active is False:
                result = [c for c in result if not c['is_active']]
            return _ListResult(Career(item) for item in result)

        def all(self):
            return self.filter()

        def select_related(self, *_args, **_kwargs):
            # No-op: repo layer already attaches faculty_name eagerly.
            return self

        def create(self, *, name, faculty, code=None, is_active=True):
            return Career(career_repo.create_career(
                faculty_id=_id_of(faculty), name=name, code=code, is_active=is_active,
            ))

        def get_or_create(self, *, name, faculty, defaults=None):
            fid = _id_of(faculty)
            existing = career_repo.find_career(fid, name)
            if existing:
                return Career(existing), False
            fields = dict(defaults or {})
            fields.setdefault('is_active', True)
            return Career(career_repo.create_career(faculty_id=fid, name=name, **fields)), True

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.faculty_id = item['faculty_id']
        self.name = item['name']
        self.code = item.get('code')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')
        self._faculty_name = item.get('faculty_name')

    def __str__(self):
        return f"{self.name} - {self.faculty_name}"

    @property
    def faculty_name(self):
        if self._faculty_name is None and self.faculty_id:
            faculty = faculty_repo.get_faculty(self.faculty_id)
            self._faculty_name = faculty['name'] if faculty else None
        return self._faculty_name

    @property
    def faculty(self):
        item = faculty_repo.get_faculty(self.faculty_id)
        return Faculty(item) if item else None


class Course:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            course_id = _id_of(id if id is not None else pk)
            item = course_repo.get_course(course_id)
            if item is None:
                raise Course.DoesNotExist(f'Course {course_id} does not exist')
            return Course(item)

        def filter(self, career=None, career_id=None, is_active=None, id__in=None):
            if id__in is not None:
                items = course_repo.get_courses_by_ids([_id_of(i) for i in id__in])
                result = list(items.values())
            else:
                cid = _id_of(career) if career is not None else career_id
                result = course_repo.list_courses(career_id=cid, active_only=is_active is True)
                if is_active is False:
                    result = [c for c in result if not c['is_active']]
            return _ListResult(Course(item) for item in result)

        def all(self):
            return self.filter()

        def select_related(self, *_args, **_kwargs):
            # No-op: repo layer already attaches career_name/faculty_name eagerly.
            return self

        def create(self, *, name, career, code=None, is_active=True):
            return Course(course_repo.create_course(
                career_id=_id_of(career), name=name, code=code, is_active=is_active,
            ))

        def get_or_create(self, *, name, career, defaults=None):
            cid = _id_of(career)
            existing = course_repo.find_course(cid, name)
            if existing:
                return Course(existing), False
            fields = dict(defaults or {})
            fields.setdefault('is_active', True)
            return Course(course_repo.create_course(career_id=cid, name=name, **fields)), True

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.career_id = item['career_id']
        self.faculty_id = item.get('faculty_id')
        self.name = item['name']
        self.code = item.get('code')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')
        self._career_name = item.get('career_name')
        self._faculty_name = item.get('faculty_name')

    def __str__(self):
        return f"{self.name} - {self.career_name}"

    @property
    def career_name(self):
        if self._career_name is None and self.career_id:
            career = career_repo.get_career(self.career_id)
            self._career_name = career['name'] if career else None
        return self._career_name

    @property
    def faculty_name(self):
        if self._faculty_name is None and self.career_id:
            career = career_repo.get_career(self.career_id)
            self._faculty_name = career['faculty_name'] if career else None
        return self._faculty_name

    @property
    def career(self):
        item = career_repo.get_career(self.career_id)
        return Career(item) if item else None
