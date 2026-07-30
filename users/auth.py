# users/auth.py
"""Custom JWT auth backed by DynamoDB instead of django.contrib.auth's
ORM-backed User. See
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from users.dynamodb import user as user_repo
from users.models import Administrator, Professor, _ProfessorProxy


class DynamoUser:
    """Duck-typed stand-in for django.contrib.auth.models.User. Every
    professor/administrator account in the app is one of these - backed
    by a UsersTable item, never a real Django ORM row. Constructed fresh
    on every authenticated request by DynamoJWTAuthentication.get_user(),
    so (unlike users/models.py's longer-lived _UserProxy) there's no
    stale-snapshot concern to guard against here."""

    def __init__(self, item):
        self._item = item
        self.id = item['id']
        self.pk = item['id']
        self.username = item['username']
        self.email = item['email']
        self.first_name = item.get('first_name', '')
        self.last_name = item.get('last_name', '')
        self.is_active = item.get('is_active', True)
        # Default True: items written before `is_professor` existed were
        # all professor accounts (see users/dynamodb/user.py).
        self.is_professor = item.get('is_professor', True)
        self.is_administrator = item.get('is_administrator', False)
        self.is_super_admin = item.get('is_super_admin', False)
        self.is_staff = self.is_administrator
        self.is_authenticated = True
        self.is_anonymous = False

    def get_full_name(self):
        full = f'{self.first_name} {self.last_name}'.strip()
        return full or self.username

    def check_password(self, raw_password):
        return user_repo.check_user_password(self._item, raw_password)

    @property
    def professor(self):
        if not self.is_professor:
            raise Professor.DoesNotExist(f'User {self.id} is not a professor')
        return _ProfessorProxy(self.id)

    @property
    def administrator(self):
        if not self.is_administrator:
            raise Administrator.DoesNotExist(f'User {self.id} is not an administrator')
        # Re-fetch fresh (mirrors users/models.py's _UserProxy.administrator)
        # rather than trusting self._item, and guard against the item having
        # been deleted between construction and this property access -
        # Administrator(None) would otherwise raise a raw TypeError that
        # callers' `except Administrator.DoesNotExist` won't catch.
        item = user_repo.get_user_by_id(self.id)
        if item is None:
            raise Administrator.DoesNotExist(f'User {self.id} is not an administrator')
        return Administrator(item)


class DynamoJWTAuthentication(JWTAuthentication):
    """Overrides get_user() to fetch the account from DynamoDB instead of
    the ORM (default implementation does get_user_model().objects.get(id=...))."""

    def get_user(self, validated_token):
        user_id = validated_token.get('user_id')
        if user_id is None:
            raise AuthenticationFailed('Token contained no recognizable user identification')
        item = user_repo.get_user_by_id(str(user_id))
        if item is None:
            legacy = self._get_legacy_django_user(user_id)
            if legacy is not None:
                return legacy
            raise AuthenticationFailed('User not found', code='user_not_found')
        if not item.get('is_active', True):
            raise AuthenticationFailed('User is inactive', code='user_inactive')
        return DynamoUser(item)

    @staticmethod
    def _get_legacy_django_user(user_id):
        """Resolves a token whose subject is a django.contrib.auth row
        rather than a UsersTable item, or None if there is no such row.

        Django's auth.User table survived the migration (it still backs
        the /admin/ site, and SessionAuthentication is still configured
        for it), so those rows are still principals. They hold no
        professor/administrator role - users/models.py installs the
        accessors that say so - which reproduces the pre-migration
        contract exactly: such an account authenticates, then gets a 403
        from every role-scoped endpoint.

        Only integer ids are looked up. UsersTable ids are UUID4s, so a
        token for a deleted/unknown DynamoDB account can never fall
        through to here - it still raises AuthenticationFailed (401), and
        the frontend's "401 means log out" handling stays intact.

        The row comes back with its staff/superuser rights stripped in
        memory (it is never saved). Saying "no professor/administrator
        role" is not enough on its own: DRF's IsAdminUser - which gates
        ProfessorViewSet.create_with_code and ProfessorViewSet.access_codes
        - reads `request.user.is_staff` directly and never consults
        `.administrator`. Returning the row as-is would therefore let a
        staff auth.User holding a still-valid pre-migration token (same
        SECRET_KEY, not yet expired) into admin-only endpoints that
        rejected it before this fallback existed. Post-migration,
        administrator rights live on the UsersTable item's
        is_administrator flag, so an auth.User row holds none here by
        construction.
        """
        try:
            pk = int(user_id)
        except (TypeError, ValueError):
            return None
        from django.contrib.auth.models import User as DjangoUser

        user = DjangoUser.objects.filter(pk=pk, is_active=True).first()
        if user is None:
            return None
        # In-memory only - this instance must never be saved (nothing in
        # the codebase saves request.user).
        user.is_staff = False
        user.is_superuser = False
        # Defence in depth: clearing is_superuser alone still leaves
        # has_perm() consulting the row's group/user permission records.
        user.has_perm = lambda *args, **kwargs: False
        user.has_perms = lambda *args, **kwargs: False
        user.has_module_perms = lambda *args, **kwargs: False
        return user
