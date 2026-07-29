# users/test_views.py
from django.test import TestCase
from rest_framework.test import APIClient

from users.dynamodb import access_code as access_code_repo
from users.dynamodb import user as user_repo
from users.dynamodb.testing import DynamoDBTestCase


class RegistrationTest(DynamoDBTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        access_code_repo.create_access_code('newprof@udd.cl', '123456')

    def test_register_with_valid_code(self):
        response = self.client.post('/api/auth/professors/', {
            'username': 'newprof', 'email': 'newprof@udd.cl', 'password': 'pw12345!x',
            'first_name': 'New', 'last_name': 'Prof', 'access_code': '123456',
        })
        assert response.status_code == 201, response.data
        assert user_repo.get_user_by_username('newprof') is not None
        code = access_code_repo.get_access_code('123456')
        assert code['is_used'] is True

    def test_register_with_invalid_code_rejected(self):
        response = self.client.post('/api/auth/professors/', {
            'username': 'newprof2', 'email': 'other@udd.cl', 'password': 'pw12345!x',
            'access_code': 'wrong-code',
        })
        assert response.status_code == 400

    def test_register_with_mismatched_email_rejected(self):
        response = self.client.post('/api/auth/professors/', {
            'username': 'newprof3', 'email': 'different@udd.cl', 'password': 'pw12345!x',
            'access_code': '123456',
        })
        assert response.status_code == 400


class LoginAndMeTest(DynamoDBTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.item = user_repo.create_user(
            username='meprof', email='meprof@udd.cl', password='pw12345!x',
            first_name='Me', last_name='Prof',
        )

    def _login(self):
        response = self.client.post('/api/auth/token/', {'username': 'meprof', 'password': 'pw12345!x'})
        assert response.status_code == 200, response.data
        return response.data['access']

    def test_login_then_me(self):
        access = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.get('/api/auth/professors/me/')
        assert response.status_code == 200
        assert response.data['user']['username'] == 'meprof'
        assert response.data['is_administrator'] is False

    def test_administrator_me_forbidden_for_non_admin(self):
        access = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.get('/api/auth/administrators/me/')
        assert response.status_code == 403

    def test_administrator_me_ok_for_admin(self):
        user_repo.update_user(self.item['id'], {'is_administrator': True})
        access = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.get('/api/auth/administrators/me/')
        assert response.status_code == 200

    def test_me_requires_auth(self):
        response = self.client.get('/api/auth/professors/me/')
        assert response.status_code == 401


class AdminManageProfessorsTest(DynamoDBTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        admin_item = user_repo.create_user(
            username='admin1', email='admin1@udd.cl', password='pw12345!x', is_administrator=True,
        )
        login = self.client.post('/api/auth/token/', {'username': 'admin1', 'password': 'pw12345!x'})
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        user_repo.create_user(username='listedprof', email='listed@udd.cl', password='pw12345!x')

    def test_list_professors(self):
        response = self.client.get('/api/auth/professors/')
        assert response.status_code == 200
        usernames = {p['user']['username'] for p in response.data}
        assert 'listedprof' in usernames
        assert 'admin1' in usernames  # admins are auto-professors too

    def test_create_with_code(self):
        response = self.client.post('/api/auth/professors/create_with_code/', {'email': 'invitee@udd.cl'})
        assert response.status_code == 201, response.data
        assert 'access_code' in response.data

    def test_create_with_code_rejects_non_udd_email(self):
        response = self.client.post('/api/auth/professors/create_with_code/', {'email': 'invitee@gmail.com'})
        assert response.status_code == 400

    def test_access_codes_list(self):
        self.client.post('/api/auth/professors/create_with_code/', {'email': 'invitee2@udd.cl'})
        response = self.client.get('/api/auth/professors/access_codes/')
        assert response.status_code == 200
        assert any(c['email'] == 'invitee2@udd.cl' for c in response.data)

    def test_create_with_code_requires_admin(self):
        user_repo.create_user(username='plainprof', email='plainprof@udd.cl', password='pw12345!x')
        login = self.client.post('/api/auth/token/', {'username': 'plainprof', 'password': 'pw12345!x'})
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = client.post('/api/auth/professors/create_with_code/', {'email': 'x@udd.cl'})
        assert response.status_code == 403
