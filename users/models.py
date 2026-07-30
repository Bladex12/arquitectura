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


class _ProfessorProxy:
    """Minimal stand-in for `request.user.professor` used by call sites
    that only ever read `.id` off it (e.g. `professor_id =
    request.user.professor.id`). Available off any account whose item has
    `is_professor` set - i.e. everything except the administrator-only
    accounts `Administrator.objects.create()` builds from an identity
    with no professor profile, which is how the old ORM's "an
    administrators row with no professors row" survives the merge into
    one item."""

    def __init__(self, user_id):
        self.id = user_id


class _UserProxy:
    """Stands in for the old `professor.user` / `administrator.user`
    OneToOneField accessor. Also stands in for `request.user` itself in
    code paths that reach it directly rather than through
    DynamoJWTAuthentication - notably DRF's `force_authenticate(user=
    professor.user)` in tests, which bypasses the auth class entirely -
    so `.professor` / `.administrator` duck-typing (and the
    `Professor.DoesNotExist` / `Administrator.DoesNotExist` exceptions
    call sites catch) needs to work here too, not just on Task 8's
    DynamoUser."""

    def __init__(self, item):
        self.id = item['id']
        self.pk = item['id']
        self.username = item['username']
        self.email = item['email']
        self.first_name = item.get('first_name', '')
        self.last_name = item.get('last_name', '')
        self.is_active = item.get('is_active', True)
        # Default True: items written before `is_professor` existed were
        # all professor accounts.
        self.is_professor = item.get('is_professor', True)
        self.is_administrator = item.get('is_administrator', False)
        self.is_super_admin = item.get('is_super_admin', False)
        # Mirrors users/auth.py's DynamoUser: DRF's IsAuthenticated (and
        # anything else that treats this as request.user, e.g. tests doing
        # force_authenticate(user=professor.user)) reads these off the
        # user object directly.
        self.is_staff = self.is_administrator
        self.is_authenticated = True
        self.is_anonymous = False

    def __str__(self):
        return self.username

    def get_full_name(self):
        full = f'{self.first_name} {self.last_name}'.strip()
        return full or self.username

    @property
    def professor(self):
        if not self.is_professor:
            raise Professor.DoesNotExist(f'User {self.id} is not a professor')
        return _ProfessorProxy(self.id)

    @property
    def administrator(self):
        if not self.is_administrator:
            raise Administrator.DoesNotExist(f'User {self.id} is not an administrator')
        item = user_repo.get_user_by_id(self.id)
        return Administrator(item)


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
            # Lookup-by-id is a plain account fetch (call sites resolve a
            # professor_id that already came off a session/transaction into
            # a display name), so it does NOT filter on is_professor -
            # unlike the no-argument enumerate-all-professors form below.
            if id__in is not None:
                items = user_repo.get_users_by_ids(id__in)
                return _ListResult(Professor(item) for item in items.values())
            return _ListResult(
                Professor(item) for item in user_repo.list_users()
                if item.get('is_professor', True)
            )

        def select_related(self, *_args, **_kwargs):
            # No-op: the DynamoDB item already carries every field a SQL
            # join would have fetched (no separate `user` row to join).
            return self

        def create(self, *, user=None, username=None, email=None, password=None,
                    first_name='', last_name='', access_code=None):
            if user is not None:
                # Test-fixture convenience: `user` is always a throwaway
                # django.contrib.auth.models.User here (unlike
                # Administrator.objects.create(), this is never called
                # with a _UserProxy in practice - every real call site
                # passes a freshly-created Django auth.User).
                #
                # The new item ADOPTS that Django row's pk as its own id
                # rather than minting a fresh UUID4. Call sites routinely
                # mint a JWT straight off the Django object
                # (`RefreshToken.for_user(user)`, which embeds `user.id`
                # as the `user_id` claim) and expect it to authenticate
                # as this account; with an unrelated UUID4 the token
                # would resolve to nothing. Only this convenience path
                # does that - the explicit-fields path below still
                # generates a true UUID4.
                item = user_repo.create_user(
                    username=user.username,
                    email=user.email or f'{user.username}@example.udd.cl',
                    password_hash=getattr(user, 'password', None) or user_repo.make_password_placeholder(),
                    first_name=getattr(user, 'first_name', ''),
                    last_name=getattr(user, 'last_name', ''),
                    professor_access_code=access_code,
                    user_id=user.id,
                )
            else:
                item = user_repo.create_user(
                    username=username, email=email, password=password,
                    first_name=first_name, last_name=last_name,
                    professor_access_code=access_code,
                )
            return Professor(item)

        def count(self):
            # Counts professor accounts only, matching the old
            # `Professor.objects.count()` over the professors table
            # (administrator-only accounts had no row there).
            return len(self.filter())

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
                # Same id-adoption rationale as Professor.objects.create()
                # above: an account built from a throwaway Django auth.User
                # keeps that row's pk so a JWT minted off the Django object
                # resolves back to this item.
                item = user_repo.create_user(
                    username=user.username,
                    email=user.email or f'{user.username}@example.udd.cl',
                    password_hash=getattr(user, 'password', None) or user_repo.make_password_placeholder(),
                    first_name=getattr(user, 'first_name', ''),
                    last_name=getattr(user, 'last_name', ''),
                    is_administrator=True,
                    is_super_admin=is_super_admin,
                    user_id=getattr(user, 'id', None),
                    # Administrator-only account: the identity had no
                    # professor profile before this call, and creating an
                    # administrator never created one (the old ORM would
                    # have inserted an administrators row and no
                    # professors row).
                    is_professor=False,
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
                if is_used is True:
                    # get_pending_access_code_by_email only ever indexes
                    # unused codes by email - there's no repository
                    # lookup for "used codes by email", so silently
                    # returning [] here would be a wrong answer, not an
                    # empty-but-correct one. Fail loudly instead.
                    raise NotImplementedError(
                        'ProfessorAccessCode filtering by email for used codes is not '
                        'supported - the repository layer only indexes pending codes by email'
                    )
                pending = access_code_repo.get_pending_access_code_by_email(target_email)
                items = [pending] if pending else []
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


# ---------------------------------------------------------------------------
# Role accessors on django.contrib.auth.models.User
# ---------------------------------------------------------------------------
# Before the migration, Professor/Administrator were ORM models with a
# OneToOneField to auth.User, so every auth.User carried `.professor` /
# `.administrator` reverse descriptors that raised
# Professor.DoesNotExist / Administrator.DoesNotExist when no matching row
# existed. Django's auth.User table is still around and its rows are still
# real principals - SessionAuthentication is still wired up for them (see
# settings.REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']) so the /admin/
# site's maintainers can reach DRF endpoints - and call sites such as
# admin_dashboard/views.py's _check_admin() and game_sessions/views.py's
# active_session() still rely on those exceptions to answer "does this
# principal hold the role?" with a 403. Dropping the models turned that into
# a bare AttributeError, i.e. an uncaught 500 for exactly those accounts.
#
# Nothing links an auth.User row to a UsersTable item, so the honest answer
# for one of these accounts is always "no role": authenticated, but not a
# professor and not an administrator.
def _django_user_professor(self):
    raise Professor.DoesNotExist(f'auth.User {self.pk} has no professor profile')


def _django_user_administrator(self):
    raise Administrator.DoesNotExist(f'auth.User {self.pk} has no administrator profile')


def _install_role_accessors():
    from django.contrib.auth.models import User as DjangoUser

    DjangoUser.professor = property(_django_user_professor)
    DjangoUser.administrator = property(_django_user_administrator)


_install_role_accessors()
