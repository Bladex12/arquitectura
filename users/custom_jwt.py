"""
Vista personalizada para JWT que permite autenticación por email o username
"""
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializer personalizado que permite autenticación por username o email
    """
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        
        if not username or not password:
            raise serializers.ValidationError(
                {'non_field_errors': ['Debe incluir "username" y "password".']}
            )
        
        # Intentar encontrar el usuario por username primero
        user = None
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Si no existe por username, intentar por email
            try:
                user = User.objects.get(email=username)
            except User.DoesNotExist:
                pass
        
        # Si no se encontró el usuario, retornar error
        if not user:
            raise serializers.ValidationError(
                {'non_field_errors': ['No se encontró una cuenta de usuario activa para las credenciales provistas']}
            )
        
        # Verificar que el usuario esté activo
        if not user.is_active:
            raise serializers.ValidationError(
                {'non_field_errors': ['Esta cuenta de usuario está desactivada']}
            )
        
        # Verificar la contraseña
        if not user.check_password(password):
            raise serializers.ValidationError(
                {'non_field_errors': ['No se encontró una cuenta de usuario activa para las credenciales provistas']}
            )
        
        # Si todo está bien, generar los tokens
        refresh = self.get_token(user)
        data = {}
        data['refresh'] = str(refresh)
        data['access'] = str(refresh.access_token)
        
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vista personalizada para obtener tokens JWT con autenticación por email o username
    """
    serializer_class = CustomTokenObtainPairSerializer

