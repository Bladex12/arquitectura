"""Vista personalizada para JWT que permite autenticación por email o
username - ahora contra DynamoDB en lugar del ORM. Ver
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md.
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from users.auth import DynamoUser
from users.dynamodb import user as user_repo


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Serializer personalizado que permite autenticación por username o email"""

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if not username or not password:
            raise serializers.ValidationError(
                {'non_field_errors': ['Debe incluir "username" y "password".']}
            )

        item = user_repo.get_user_by_username(username) or user_repo.get_user_by_email(username)

        if not item:
            raise serializers.ValidationError(
                {'non_field_errors': ['No se encontró una cuenta de usuario activa para las credenciales provistas']}
            )

        if not item.get('is_active', True):
            raise serializers.ValidationError(
                {'non_field_errors': ['Esta cuenta de usuario está desactivada']}
            )

        if not user_repo.check_user_password(item, password):
            raise serializers.ValidationError(
                {'non_field_errors': ['No se encontró una cuenta de usuario activa para las credenciales provistas']}
            )

        user = DynamoUser(item)
        refresh = self.get_token(user)
        return {'refresh': str(refresh), 'access': str(refresh.access_token)}


class CustomTokenObtainPairView(TokenObtainPairView):
    """Vista personalizada para obtener tokens JWT con autenticación por email o username"""
    serializer_class = CustomTokenObtainPairSerializer
