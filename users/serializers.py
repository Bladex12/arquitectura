"""
Serializers para la app users
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from .models import Administrator, Professor, Student, ProfessorAccessCode


class UserSerializer(serializers.ModelSerializer):
    """Serializer para el modelo User de Django"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class AdministratorSerializer(serializers.ModelSerializer):
    """Serializer para Administrador"""
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Administrator
        fields = ['id', 'user', 'user_id', 'is_super_admin', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProfessorSerializer(serializers.ModelSerializer):
    """Serializer para Profesor"""
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Professor
        fields = ['id', 'user', 'user_id', 'access_code', 'full_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class ProfessorCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear un Profesor con User - Requiere código de acceso"""
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    access_code = serializers.CharField(required=True, allow_blank=False, allow_null=False)

    class Meta:
        model = Professor
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'access_code']

    def validate_access_code(self, value):
        """Validar que el código de acceso existe, está disponible y corresponde al email"""
        if not value or value.strip() == '':
            raise serializers.ValidationError(
                'El código de acceso es requerido para registrarse'
            )
        
        access_code_clean = value.strip()
        email = self.initial_data.get('email', '').strip().lower()
        
        if not email:
            raise serializers.ValidationError(
                'El correo electrónico es requerido'
            )
        
        # Buscar el código de acceso pendiente en una sola consulta optimizada
        # Usamos filter en lugar de get para mejor rendimiento y validamos ambas condiciones
        access_code_obj = ProfessorAccessCode.objects.filter(
            access_code=access_code_clean,
            is_used=False,
            email__iexact=email  # Comparación case-insensitive en la BD
        ).first()
        
        if not access_code_obj:
            # Verificar si el código existe pero está usado o el email no coincide
            existing_code = ProfessorAccessCode.objects.filter(
                access_code=access_code_clean
            ).first()
            
            if existing_code:
                if existing_code.is_used:
                    raise serializers.ValidationError(
                        'El código de acceso ya fue utilizado. Contacta al administrador para obtener un nuevo código.'
                    )
                else:
                    raise serializers.ValidationError(
                        'El código de acceso no corresponde a este correo electrónico. Verifica que el correo sea el mismo al que se envió el código.'
                    )
            else:
                raise serializers.ValidationError(
                    'El código de acceso no es válido. Contacta al administrador para obtener un código válido.'
                )
        
        return access_code_clean

    def validate_email(self, value):
        """Validar que el email no esté ya registrado"""
        email_lower = value.strip().lower()
        if User.objects.filter(email=email_lower).exists():
            raise serializers.ValidationError(
                'Ya existe un usuario registrado con este correo electrónico'
            )
        return email_lower

    def create(self, validated_data):
        user_data = {
            'username': validated_data.pop('username'),
            'email': validated_data.pop('email'),
            'password': validated_data.pop('password'),
            'first_name': validated_data.pop('first_name', ''),
            'last_name': validated_data.pop('last_name', ''),
        }
        # Asegurar que el usuario se cree como activo
        user = User.objects.create_user(**user_data)
        user.is_active = True
        user.save()
        
        # Obtener el código de acceso
        access_code = validated_data.pop('access_code')
        
        # Marcar el código de acceso como usado (ya validado arriba, así que debe existir)
        access_code_obj = ProfessorAccessCode.objects.filter(
            access_code=access_code,
            is_used=False,
            email__iexact=user.email
        ).first()
        
        if access_code_obj:
            access_code_obj.is_used = True
            access_code_obj.used_at = timezone.now()
            access_code_obj.save(update_fields=['is_used', 'used_at'])
        else:
            # Esto no debería pasar porque ya validamos arriba, pero por seguridad
            raise serializers.ValidationError(
                'El código de acceso ya no está disponible'
            )
        
        # Crear el profesor con el código de acceso
        professor = Professor.objects.create(user=user, access_code=access_code, **validated_data)
        return professor


class StudentSerializer(serializers.ModelSerializer):
    """Serializer para Estudiante"""
    class Meta:
        model = Student
        fields = ['id', 'full_name', 'email', 'rut', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class StudentBulkCreateSerializer(serializers.Serializer):
    """Serializer para crear múltiples estudiantes desde un Excel"""
    students = StudentSerializer(many=True)

    def create(self, validated_data):
        students_data = validated_data['students']
        students = []
        for student_data in students_data:
            student, created = Student.objects.get_or_create(
                email=student_data['email'],
                defaults=student_data
            )
            students.append(student)
        return {'students': students}

