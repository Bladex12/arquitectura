# users/auth.py
"""Custom JWT auth backed by DynamoDB instead of django.contrib.auth's
ORM-backed User. See
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from users.dynamodb import user as user_repo
from users.models import Administrator, _ProfessorProxy


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
            raise AuthenticationFailed('User not found', code='user_not_found')
        if not item.get('is_active', True):
            raise AuthenticationFailed('User is inactive', code='user_inactive')
        return DynamoUser(item)
