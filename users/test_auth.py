# users/test_auth.py
from django.test import TestCase
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from users.auth import DynamoJWTAuthentication, DynamoUser
from users.dynamodb import user as user_repo
from users.dynamodb.testing import DynamoDBTestCase
from users.models import Administrator


class DynamoUserTest(DynamoDBTestCase, TestCase):
    def test_basic_fields(self):
        item = user_repo.create_user(username='jdoe', email='jdoe@udd.cl', password='pw12345!',
                                       first_name='J', last_name='Doe')
        du = DynamoUser(item)
        assert du.username == 'jdoe'
        assert du.is_authenticated is True
        assert du.is_anonymous is False
        assert du.is_staff is False
        assert du.get_full_name() == 'J Doe'

    def test_professor_always_present(self):
        item = user_repo.create_user(username='jdoe2', email='jdoe2@udd.cl', password='pw12345!')
        du = DynamoUser(item)
        assert hasattr(du, 'professor')
        assert du.professor.id == du.id

    def test_administrator_absent_when_not_admin(self):
        item = user_repo.create_user(username='jdoe3', email='jdoe3@udd.cl', password='pw12345!')
        du = DynamoUser(item)
        assert hasattr(du, 'administrator') is False

    def test_administrator_present_when_admin(self):
        item = user_repo.create_user(username='jdoe4', email='jdoe4@udd.cl', password='pw12345!',
                                       is_administrator=True)
        du = DynamoUser(item)
        assert hasattr(du, 'administrator') is True
        assert du.is_staff is True

    def test_administrator_raises_does_not_exist_when_accessed_directly(self):
        item = user_repo.create_user(username='jdoe5', email='jdoe5@udd.cl', password='pw12345!')
        du = DynamoUser(item)
        try:
            du.administrator
            assert False, 'expected Administrator.DoesNotExist'
        except Administrator.DoesNotExist:
            pass

    def test_administrator_re_fetches_fresh_rather_than_stale_snapshot(self):
        item = user_repo.create_user(username='jdoe6', email='jdoe6@udd.cl', password='pw12345!',
                                       is_administrator=True)
        du = DynamoUser(item)
        # Mutate the underlying DynamoDB item *after* DynamoUser was
        # constructed. If .administrator ever regresses to building
        # Administrator(self._item) instead of re-fetching, this field
        # would still read False.
        user_repo.update_user(item['id'], {'is_super_admin': True})
        assert du.administrator.is_super_admin is True

    def test_administrator_raises_does_not_exist_when_item_deleted(self):
        item = user_repo.create_user(username='jdoe7', email='jdoe7@udd.cl', password='pw12345!',
                                       is_administrator=True)
        du = DynamoUser(item)
        user_repo.delete_user(item['id'])
        assert hasattr(du, 'administrator') is False
        try:
            du.administrator
            assert False, 'expected Administrator.DoesNotExist'
        except Administrator.DoesNotExist:
            pass

    def test_check_password(self):
        item = user_repo.create_user(username='jdoe8', email='jdoe8@udd.cl', password='some-password')
        du = DynamoUser(item)
        assert du.check_password('some-password') is True
        assert du.check_password('wrong') is False


class DynamoJWTAuthenticationTest(DynamoDBTestCase, TestCase):
    def test_get_user_returns_dynamo_user(self):
        item = user_repo.create_user(username='auth1', email='auth1@udd.cl', password='pw12345!')
        auth = DynamoJWTAuthentication()
        user = auth.get_user({'user_id': item['id']})
        assert isinstance(user, DynamoUser)
        assert user.username == 'auth1'

    def test_get_user_missing_raises_authentication_failed(self):
        auth = DynamoJWTAuthentication()
        try:
            auth.get_user({'user_id': 'missing-id'})
            assert False, 'expected AuthenticationFailed'
        except AuthenticationFailed:
            pass

    def test_get_user_inactive_raises_authentication_failed(self):
        item = user_repo.create_user(username='auth2', email='auth2@udd.cl', password='pw12345!')
        user_repo.update_user(item['id'], {'is_active': False})
        auth = DynamoJWTAuthentication()
        try:
            auth.get_user({'user_id': item['id']})
            assert False, 'expected AuthenticationFailed'
        except AuthenticationFailed:
            pass

    def test_get_user_missing_user_id_claim_raises_authentication_failed(self):
        auth = DynamoJWTAuthentication()
        try:
            auth.get_user({})
            assert False, 'expected AuthenticationFailed'
        except AuthenticationFailed:
            pass
