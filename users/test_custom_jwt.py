# users/test_custom_jwt.py
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from users.custom_jwt import CustomTokenObtainPairSerializer
from users.dynamodb import user as user_repo
from users.dynamodb.testing import DynamoDBTestCase


class CustomTokenObtainPairSerializerTest(DynamoDBTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.factory = APIRequestFactory()
        user_repo.create_user(username='loginuser', email='login@udd.cl', password='correct-pw')

    def test_login_by_username(self):
        serializer = CustomTokenObtainPairSerializer(data={'username': 'loginuser', 'password': 'correct-pw'})
        assert serializer.is_valid(), serializer.errors
        assert 'access' in serializer.validated_data
        assert 'refresh' in serializer.validated_data

    def test_login_by_email(self):
        serializer = CustomTokenObtainPairSerializer(data={'username': 'login@udd.cl', 'password': 'correct-pw'})
        assert serializer.is_valid(), serializer.errors

    def test_login_wrong_password(self):
        serializer = CustomTokenObtainPairSerializer(data={'username': 'loginuser', 'password': 'wrong'})
        assert serializer.is_valid() is False

    def test_login_unknown_user(self):
        serializer = CustomTokenObtainPairSerializer(data={'username': 'nobody', 'password': 'whatever'})
        assert serializer.is_valid() is False

    def test_login_inactive_user(self):
        item = user_repo.get_user_by_username('loginuser')
        user_repo.update_user(item['id'], {'is_active': False})
        serializer = CustomTokenObtainPairSerializer(data={'username': 'loginuser', 'password': 'correct-pw'})
        assert serializer.is_valid() is False
