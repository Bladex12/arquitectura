"""
Compatibility shim: Professor/Administrator/Student/ProfessorAccessCode
used to be Django ORM models (OneToOneField'd to django.contrib.auth's
User). They're now plain Python classes backed by DynamoDB (see
users/dynamodb/ and
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md).

This shim exists so every existing call site (game_sessions/views.py,
game_sessions/serializers.py, admin_dashboard/views.py, and the
game_sessions/test_*.py fixtures that build throwaway
django.contrib.auth.models.User rows) keeps working completely
unmodified - `.objects.get(id=...)`, `.objects.filter(id__in=...)`,
`hasattr(request.user, 'professor')`, etc.

Django's own `django.contrib.auth.models.User` table is untouched and
unrelated - it still exists (for the `/admin/` site, used by
academic/challenges content maintainers) and, as a convenience, test
fixtures may still construct one and pass it to `Professor.objects.create(user=...)`
/ `Administrator.objects.create(user=...)` - only its username/email/
already-hashed password get copied into the new DynamoDB User item;
nothing links back to it.
"""
from django.core.exceptions import ObjectDoesNotExist

from users.dynamodb import access_code as access_code_repo
from users.dynamodb import student as student_repo
from users.dynamodb import user as user_repo


class _UserProxy:
    """Stands in for the old `professor.user` / `administrator.user`
    OneToOneField accessor."""

    def __init__(self, item):
        self.id = item['id']
        self.username = item['username']
        self.email = item['email']
        self.first_name = item.get('first_name', '')
        self.last_name = item.get('last_name', '')
        self.is_active = item.get('is_active', True)

    def get_full_name(self):
        full = f'{self.first_name} {self.last_name}'.strip()
        return full or self.username


class _ListResult(list):
    """list subclass adding the QuerySet-ish methods actual call sites
    use: .exists(), .values_list(field, flat=True), .first()."""

    def exists(self):
        return len(self) > 0

    def first(self):
        return self[0] if self else None

    def values_list(self, field, flat=False):
        return [getattr(obj, field) for obj in self]


def _user_item_to_professor_fields(item):
    return {
        'id': item['id'],
        'access_code': item.get('professor_access_code'),
        'created_at': item['created_at'],
        'updated_at': item['updated_at'],
        'user': _UserProxy(item),
    }


class Professor:
    class DoesNotExist(ObjectDoesNotExist, AttributeError):
        pass

    class _Manager:
        def get(self, id):
            item = user_repo.get_user_by_id(id)
            if item is None:
                raise Professor.DoesNotExist(f'Professor {id} does not exist')
            return Professor(item)

        def filter(self, id__in=None):
            if id__in is not None:
                items = user_repo.get_users_by_ids(id__in)
                return _ListResult(Professor(item) for item in items.values())
            return _ListResult(Professor(item) for item in user_repo.list_users())

        def select_related(self, *_args, **_kwargs):
            # No-op: the DynamoDB item already carries every field a SQL
            # join would have fetched (no separate `user` row to join).
            return self

        def create(self, *, user=None, username=None, email=None, password=None,
                    first_name='', last_name='', access_code=None):
            if user is not None:
                # Test-fixture convenience: `user` is a throwaway
                # django.contrib.auth.models.User (or a _UserProxy from
                # an already-created Professor/Administrator).
                item = user_repo.create_user(
                    username=user.username,
                    email=user.email or f'{user.username}@example.udd.cl',
                    password_hash=getattr(user, 'password', None) or user_repo.make_password_placeholder(),
                    first_name=getattr(user, 'first_name', ''),
                    last_name=getattr(user, 'last_name', ''),
                    professor_access_code=access_code,
                )
            else:
                item = user_repo.create_user(
                    username=username, email=email, password=password,
                    first_name=first_name, last_name=last_name,
                    professor_access_code=access_code,
                )
            return Professor(item)

        def count(self):
            return user_repo.count_users()

    objects = _Manager()

    def __init__(self, item):
        fields = _user_item_to_professor_fields(item)
        self.id = fields['id']
        self.access_code = fields['access_code']
        self.created_at = fields['created_at']
        self.updated_at = fields['updated_at']
        self.user = fields['user']

    def get_unique_students_count(self):
        """Unchanged from the pre-migration version (game_sessions cutover,
        Task 6): rosters live embedded in each Team's student_ids."""
        from game_sessions.dynamodb.game_session import list_sessions_for_professor
        from game_sessions.dynamodb.team import list_teams

        unique_student_ids = set()
        for session in list_sessions_for_professor(self.id, status='completed'):
            for team in list_teams(session['room_code']):
                unique_student_ids.update(team['student_ids'])
        return len(unique_student_ids)


class Administrator:
    class DoesNotExist(ObjectDoesNotExist, AttributeError):
        pass

    class _Manager:
        def create(self, *, user, is_super_admin=False):
            existing = None
            if isinstance(user, _UserProxy):
                existing = user_repo.get_user_by_id(user.id)
            else:
                existing = user_repo.get_user_by_username(user.username)

            if existing:
                user_repo.update_user(existing['id'], {
                    'is_administrator': True,
                    'is_super_admin': is_super_admin,
                })
                item = user_repo.get_user_by_id(existing['id'])
            else:
                item = user_repo.create_user(
                    username=user.username,
                    email=user.email or f'{user.username}@example.udd.cl',
                    password_hash=getattr(user, 'password', None) or user_repo.make_password_placeholder(),
                    first_name=getattr(user, 'first_name', ''),
                    last_name=getattr(user, 'last_name', ''),
                    is_administrator=True,
                    is_super_admin=is_super_admin,
                )
            return Administrator(item)

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.is_super_admin = item.get('is_super_admin', False)
        self.created_at = item['created_at']
        self.updated_at = item['updated_at']
        self.user = _UserProxy(item)


class Student:
    class DoesNotExist(ObjectDoesNotExist, AttributeError):
        pass

    class _Manager:
        def create(self, *, full_name, email, rut):
            return Student(student_repo.create_student(full_name=full_name, email=email, rut=rut))

        def get(self, id):
            item = student_repo.get_student(id)
            if item is None:
                raise Student.DoesNotExist(f'Student {id} does not exist')
            return Student(item)

        def filter(self, id=None, id__in=None):
            if id__in is not None:
                items = student_repo.get_students_by_ids(id__in)
                return _ListResult(Student(item) for item in items.values())
            if id is not None:
                item = student_repo.get_student(id)
                return _ListResult([Student(item)] if item else [])
            return _ListResult(Student(item) for item in student_repo.list_students())

        def get_or_create(self, *, email, defaults):
            item, created = student_repo.get_or_create_student(
                email=email, full_name=defaults['full_name'], rut=defaults['rut'],
            )
            return Student(item), created

        def update_or_create(self, *, email, defaults):
            item, created = student_repo.update_or_create_student(
                email=email, full_name=defaults['full_name'], rut=defaults['rut'],
            )
            return Student(item), created

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.full_name = item['full_name']
        self.email = item['email']
        self.rut = item['rut']
        self.created_at = item['created_at']
        self.updated_at = item['updated_at']


class ProfessorAccessCode:
    class _Manager:
        def create(self, *, email, access_code):
            return ProfessorAccessCode(access_code_repo.create_access_code(email, access_code))

        def filter(self, access_code=None, is_used=None, email=None, email__iexact=None):
            target_email = email or email__iexact
            if access_code is not None:
                item = access_code_repo.get_access_code(access_code)
                items = [item] if item else []
            elif target_email is not None:
                pending = access_code_repo.get_pending_access_code_by_email(target_email)
                items = [pending] if pending else []
                if is_used is False:
                    pass  # get_pending_access_code_by_email already filters to unused
                elif pending is not None and is_used is not None and pending['is_used'] != is_used:
                    items = []
            else:
                items = access_code_repo.list_access_codes()

            if access_code is not None and is_used is not None:
                items = [i for i in items if i['is_used'] == is_used]
            if access_code is not None and target_email is not None:
                items = [i for i in items if i['email'] == target_email.lower()]

            return _ListResult(ProfessorAccessCode(i) for i in items)

        def all(self):
            return _ListResult(ProfessorAccessCode(i) for i in access_code_repo.list_access_codes())

    objects = _Manager()

    def __init__(self, item):
        self._code = item['access_code']
        self.email = item['email']
        self.access_code = item['access_code']
        self.is_used = item['is_used']
        self.created_at = item['created_at']
        self.used_at = item.get('used_at')

    def save(self, update_fields=None):
        if self.is_used:
            access_code_repo.mark_access_code_used(self._code)
