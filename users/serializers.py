"""
Serializers para la app users. Professor/Administrator/Student/
ProfessorAccessCode are no longer Django models (see users/models.py),
so these are plain serializers.Serializer subclasses doing manual
validation/dict-shaping instead of ModelSerializer.
"""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import ProfessorAccessCode


def serialize_user_proxy(user_proxy):
    return {
        'id': user_proxy.id,
        'username': user_proxy.username,
        'email': user_proxy.email,
        'first_name': user_proxy.first_name,
        'last_name': user_proxy.last_name,
    }


def serialize_professor(professor):
    return {
        'id': professor.id,
        'user': serialize_user_proxy(professor.user),
        'access_code': professor.access_code,
        'full_name': professor.user.get_full_name(),
        'created_at': professor.created_at,
        'updated_at': professor.updated_at,
    }


def serialize_administrator(administrator):
    return {
        'id': administrator.id,
        'user': serialize_user_proxy(administrator.user),
        'is_super_admin': administrator.is_super_admin,
        'created_at': administrator.created_at,
        'updated_at': administrator.updated_at,
    }


def serialize_access_code(code):
    return {
        # ProfessorAccessCode has no separate numeric id in the new schema -
        # access_code IS the natural unique key (used as the DynamoDB PK).
        # Frontend (ManageProfessors.tsx) uses this as a React list key.
        'id': code.access_code,
        'email': code.email,
        'access_code': code.access_code,
        'is_used': code.is_used,
        'created_at': code.created_at,
        'used_at': code.used_at,
    }


class ProfessorCreateSerializer(serializers.Serializer):
    """Serializer para crear un Profesor con User - Requiere código de acceso"""
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    access_code = serializers.CharField(required=True, allow_blank=False, allow_null=False)

    def validate_access_code(self, value):
        access_code_clean = value.strip()
        email = self.initial_data.get('email', '').strip().lower()

        if not email:
            raise serializers.ValidationError('El correo electrónico es requerido')

        matching = ProfessorAccessCode.objects.filter(
            access_code=access_code_clean, is_used=False, email__iexact=email,
        ).first()

        if not matching:
            existing_code = ProfessorAccessCode.objects.filter(access_code=access_code_clean).first()
            if existing_code:
                if existing_code.is_used:
                    raise serializers.ValidationError(
                        'El código de acceso ya fue utilizado. Contacta al administrador para obtener un nuevo código.'
                    )
                raise serializers.ValidationError(
                    'El código de acceso no corresponde a este correo electrónico. Verifica que el correo sea el mismo al que se envió el código.'
                )
            raise serializers.ValidationError(
                'El código de acceso no es válido. Contacta al administrador para obtener un código válido.'
            )
        return access_code_clean

    def validate_email(self, value):
        from users.dynamodb import user as user_repo
        email_lower = value.strip().lower()
        if user_repo.get_user_by_email(email_lower) is not None:
            raise serializers.ValidationError('Ya existe un usuario registrado con este correo electrónico')
        return email_lower

    def validate_username(self, value):
        from users.dynamodb import user as user_repo
        if user_repo.get_user_by_username(value) is not None:
            raise serializers.ValidationError('Ya existe un usuario registrado con este nombre de usuario')
        return value

    def create(self, validated_data):
        from .models import Professor

        access_code = validated_data.pop('access_code')
        try:
            professor = Professor.objects.create(**validated_data, access_code=access_code)
        except ValueError as e:
            # TOCTOU race: username passed validate_username() above but was
            # taken by a concurrent registration before this write landed.
            # create_user() raises a bare ValueError for that case - degrade
            # to a clean 400 instead of an unhandled 500 (final review Finding 3).
            raise serializers.ValidationError({'username': [str(e)]})

        # Re-check for a TOCTOU race: the code could have been consumed by
        # a concurrent request between validate_access_code() and here. If
        # so, the professor account above is already created (unavoidable
        # without a transactional create+consume) but the code itself must
        # not be silently left inconsistent - surface the error instead of
        # raising an unhandled AttributeError on `None`.
        code_obj = ProfessorAccessCode.objects.filter(
            access_code=access_code, is_used=False, email__iexact=professor.user.email,
        ).first()
        if code_obj:
            code_obj.is_used = True
            code_obj.save(update_fields=['is_used', 'used_at'])
        else:
            raise serializers.ValidationError('El código de acceso ya no está disponible')

        return professor


class StudentSerializer(serializers.Serializer):
    """Serializer para Estudiante. Also used as the (many=True) input shape
    for StudentBulkCreateSerializer - `id` is read_only so it's still
    included in output representations (e.g.
    game_sessions/serializers.py's TeamSerializer.students, which the
    frontend needs `.id` from for drag-and-drop roster edits and React
    keys) without being required on the create-from-Excel input path."""
    id = serializers.CharField(read_only=True)
    full_name = serializers.CharField()
    email = serializers.EmailField()
    rut = serializers.CharField()


class StudentBulkCreateSerializer(serializers.Serializer):
    """Serializer para crear múltiples estudiantes desde un Excel"""
    students = StudentSerializer(many=True)

    def create(self, validated_data):
        from .models import Student

        students = []
        for student_data in validated_data['students']:
            student, _created = Student.objects.get_or_create(
                email=student_data['email'], defaults=student_data,
            )
            students.append(student)
        return {'students': students}
