"""
Views para la app users. Professor/Administrator/Student are no longer
Django ORM models (see users/models.py), so these are plain
viewsets.ViewSet subclasses instead of ModelViewSet - list responses
are plain arrays (confirmed safe: the frontend already reads
`response.data.results || response.data`).
"""
import pandas as pd
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import Administrator, Professor, ProfessorAccessCode, Student
from .serializers import (
    ProfessorCreateSerializer, StudentBulkCreateSerializer, StudentSerializer,
    serialize_access_code, serialize_administrator, serialize_professor,
)


class AdministratorViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def me(self, request):
        try:
            administrator = request.user.administrator
        except Administrator.DoesNotExist:
            return Response({'error': 'El usuario no es un administrador'}, status=status.HTTP_403_FORBIDDEN)
        return Response(serialize_administrator(administrator))


class ProfessorViewSet(viewsets.ViewSet):

    def get_permissions(self):
        if self.action == 'create':
            permission_classes = []
        elif self.action in ['create_with_code', 'access_codes']:
            permission_classes = [IsAdminUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_authenticators(self):
        # Registration (create) is public - no Authorization header
        # expected, so don't even try to parse one (a stale/expired Bearer
        # token, or an unrelated admin-site session cookie, must not be
        # able to reject an otherwise-valid registration).
        #
        # Can't key this off `self.action` - DRF's ViewSetMixin only sets
        # that attribute *inside* initialize_request(), a few lines after
        # it calls super().initialize_request(), which is what calls
        # get_authenticators() in the first place. `self.action` is always
        # still None here. `self.action_map` (and the raw pre-DRF-wrapped
        # `self.request`) ARE already set by this point though - both get
        # assigned in ViewSetMixin.as_view()'s view() closure, before
        # .dispatch() (and therefore .initialize_request()) ever runs.
        request = getattr(self, 'request', None)
        action_map = getattr(self, 'action_map', None)
        if request is not None and action_map is not None:
            if action_map.get(request.method.lower()) == 'create':
                return []
        return super().get_authenticators()

    def create(self, request):
        serializer = ProfessorCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        professor = serializer.save()
        return Response(serialize_professor(professor), status=status.HTTP_201_CREATED)

    def list(self, request):
        return Response([serialize_professor(p) for p in Professor.objects.filter()])

    @action(detail=False, methods=['get'])
    def me(self, request):
        try:
            professor = request.user.professor
            professor = Professor.objects.get(id=professor.id)
        except Professor.DoesNotExist:
            return Response({'error': 'El usuario no es un profesor'}, status=status.HTTP_404_NOT_FOUND)
        data = serialize_professor(professor)
        data['is_administrator'] = hasattr(request.user, 'administrator')
        return Response(data)

    @action(detail=False, methods=['get'])
    def access_codes(self, request):
        return Response([serialize_access_code(c) for c in ProfessorAccessCode.objects.all()])

    @action(detail=False, methods=['get'])
    def stats(self, request):
        try:
            professor = Professor.objects.get(id=request.user.professor.id)
        except Professor.DoesNotExist:
            return Response({'error': 'El usuario no es un profesor'}, status=status.HTTP_404_NOT_FOUND)

        from game_sessions.dynamodb.game_session import list_sessions_for_professor
        completed_sessions_count = len(list_sessions_for_professor(professor.id, status='completed'))
        unique_students_count = professor.get_unique_students_count()

        return Response({'sessions': completed_sessions_count, 'students': unique_students_count})

    @action(detail=False, methods=['post'])
    def create_with_code(self, request):
        import random
        import string
        from urllib.parse import quote

        from django.conf import settings

        from users.dynamodb import user as user_repo

        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'El correo electrónico es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        if not email.endswith('@udd.cl'):
            return Response({'error': 'El correo debe ser de la universidad (@udd.cl)'}, status=status.HTTP_400_BAD_REQUEST)

        if ProfessorAccessCode.objects.filter(email=email, is_used=False).first():
            return Response({'error': 'Ya existe un código de acceso pendiente para este correo'}, status=status.HTTP_400_BAD_REQUEST)

        if user_repo.get_user_by_email(email) is not None:
            return Response({'error': 'Ya existe un usuario registrado con este correo electrónico'}, status=status.HTTP_400_BAD_REQUEST)

        max_attempts = 100
        access_code = None
        for _ in range(max_attempts):
            candidate = ''.join(random.choices(string.digits, k=6))
            if not ProfessorAccessCode.objects.filter(access_code=candidate).exists():
                access_code = candidate
                break

        if access_code is None:
            return Response({'error': 'No se pudo generar un código único. Intente nuevamente.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        ProfessorAccessCode.objects.create(email=email, access_code=access_code)

        app_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        register_url = f'{app_url}/profesor/registro'
        first_name = request.data.get('first_name', '').strip()
        greeting = f'Hola {first_name},' if first_name else 'Hola,'
        subject = 'Código de Acceso - Misión Emprende UDD'
        body_plain = (
            f'{greeting}\n\nHas sido invitado a registrarte como profesor en Misión Emprende UDD.\n\n'
            f'Tu código de acceso es: {access_code}\n\nPara completar tu registro:\n'
            f'1. Visita: {register_url}\n2. Ingresa tu correo: {email}\n'
            f'3. Ingresa el código de acceso: {access_code}\n4. Completa el formulario de registro\n\n'
            f'Este código es único y solo puede ser usado una vez.\n\n¡Bienvenido!\nEquipo Misión Emprende UDD'
        )
        mailto_link = f'mailto:{email}?subject={quote(subject)}&body={quote(body_plain)}'

        return Response({
            'success': True,
            'access_code': access_code,
            'email': email,
            'mailto_link': mailto_link,
            'subject': subject,
            'body': body_plain,
            'message': 'Código de acceso generado exitosamente. Abre tu cliente de correo para enviarlo.',
        }, status=status.HTTP_201_CREATED)


class StudentViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def list(self, request):
        return Response([
            {'id': s.id, 'full_name': s.full_name, 'email': s.email, 'rut': s.rut}
            for s in Student.objects.filter()
        ])

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        serializer = StudentBulkCreateSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.save()
            return Response(
                {'students': [{'id': s.id, 'full_name': s.full_name, 'email': s.email, 'rut': s.rut} for s in result['students']]},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def upload_excel(self, request):
        """Subir archivo Excel y crear estudiantes automáticamente."""
        if 'file' not in request.FILES:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=status.HTTP_400_BAD_REQUEST)

        excel_file = request.FILES['file']
        if not excel_file.name.endswith(('.xlsx', '.xls')):
            return Response({'error': 'El archivo debe ser un Excel (.xlsx o .xls)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(excel_file)
            required_columns = ['Correo', 'RUT', 'Nombre', 'Apellido Paterno', 'Apellido Materno']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return Response({
                    'error': f'Faltan las siguientes columnas en el Excel: {", ".join(missing_columns)}',
                    'columnas_requeridas': required_columns,
                    'columnas_encontradas': df.columns.tolist(),
                }, status=status.HTTP_400_BAD_REQUEST)

            students_created, students_updated, errors = [], [], []
            for index, row in df.iterrows():
                try:
                    nombre = str(row['Nombre']).strip() if pd.notna(row['Nombre']) else ''
                    apellido_paterno = str(row['Apellido Paterno']).strip() if pd.notna(row['Apellido Paterno']) else ''
                    apellido_materno = str(row['Apellido Materno']).strip() if pd.notna(row['Apellido Materno']) else ''
                    full_name = ' '.join(p for p in [nombre, apellido_paterno, apellido_materno] if p)
                    email = str(row['Correo']).strip() if pd.notna(row['Correo']) else ''
                    rut = str(row['RUT']).strip() if pd.notna(row['RUT']) else ''

                    if not email:
                        errors.append(f'Fila {index + 2}: Correo vacío')
                        continue
                    if not rut:
                        errors.append(f'Fila {index + 2}: RUT vacío')
                        continue
                    if not full_name:
                        errors.append(f'Fila {index + 2}: Nombre completo vacío')
                        continue

                    student, created = Student.objects.update_or_create(
                        email=email, defaults={'full_name': full_name, 'rut': rut},
                    )
                    entry = {'id': student.id, 'full_name': student.full_name, 'email': student.email, 'rut': student.rut}
                    (students_created if created else students_updated).append(entry)
                except Exception as e:
                    errors.append(f'Fila {index + 2}: {str(e)}')

            response_data = {
                'total_filas': len(df),
                'estudiantes_creados': len(students_created),
                'estudiantes_actualizados': len(students_updated),
                'errores': len(errors),
                'detalle_errores': errors[:10],
                'mensaje': (
                    f'Se procesaron {len(df)} filas. {len(students_created)} creados, '
                    f'{len(students_updated)} actualizados, {len(errors)} errores.'
                    if errors else
                    f'Se procesaron {len(df)} filas correctamente. {len(students_created)} creados, '
                    f'{len(students_updated)} actualizados.'
                ),
            }
            status_code = status.HTTP_201_CREATED if (students_created or students_updated) else status.HTTP_400_BAD_REQUEST
            return Response(response_data, status=status_code)
        except pd.errors.EmptyDataError:
            return Response({'error': 'El archivo Excel está vacío'}, status=status.HTTP_400_BAD_REQUEST)
        except pd.errors.ParserError as e:
            return Response({'error': f'Error al leer el archivo Excel: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Error inesperado al procesar el archivo: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
