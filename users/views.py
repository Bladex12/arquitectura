"""
Views para la app users
"""
import pandas as pd
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.models import User
from .models import Administrator, Professor, Student, ProfessorAccessCode
from .serializers import (
    UserSerializer, AdministratorSerializer, ProfessorSerializer,
    ProfessorCreateSerializer, StudentSerializer, StudentBulkCreateSerializer
)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para ver usuarios (solo lectura)
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Obtener información del usuario actual"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class AdministratorViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Administradores
    """
    queryset = Administrator.objects.all()
    serializer_class = AdministratorSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Obtener información del administrador actual"""
        try:
            administrator = request.user.administrator
            serializer = self.get_serializer(administrator)
            return Response(serializer.data)
        except Administrator.DoesNotExist:
            return Response(
                {'error': 'El usuario no es un administrador'},
                status=status.HTTP_403_FORBIDDEN
            )


class ProfessorViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Profesores
    """
    queryset = Professor.objects.all()
    serializer_class = ProfessorSerializer

    def get_permissions(self):
        """
        Permite registro público (create) sin autenticación
        pero requiere autenticación para otras acciones
        create_with_code y access_codes requieren ser administrador
        me y stats permiten acceso a usuarios autenticados (profesores y administradores)
        """
        if self.action == 'create':
            permission_classes = []
        elif self.action in ['create_with_code', 'access_codes']:
            permission_classes = [IsAdminUser]
        else:
            # me, stats y otras acciones requieren autenticación
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        if self.action == 'create':
            return ProfessorCreateSerializer
        return ProfessorSerializer
    
    def dispatch(self, request, *args, **kwargs):
        """
        Sobrescribir dispatch para deshabilitar autenticación solo para create
        """
        # Si es una petición POST al endpoint base (create), deshabilitar autenticación
        if request.method == 'POST' and not kwargs.get('pk'):
            # Guardar authentication_classes original
            original_auth_classes = getattr(self, 'authentication_classes', None)
            # Deshabilitar autenticación para create
            self.authentication_classes = []
            try:
                return super().dispatch(request, *args, **kwargs)
            finally:
                # Restaurar authentication_classes original
                if original_auth_classes is not None:
                    self.authentication_classes = original_auth_classes
        return super().dispatch(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Obtener información del profesor actual (incluye administradores)"""
        try:
            professor = request.user.professor
            serializer = self.get_serializer(professor)
            data = serializer.data
            data['is_administrator'] = hasattr(request.user, 'administrator')
            return Response(data)
        except Professor.DoesNotExist:
            return Response(
                {'error': 'El usuario no es un profesor'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'])
    def access_codes(self, request):
        """Listar códigos de acceso pendientes y usados (solo administradores)"""
        codes = ProfessorAccessCode.objects.all().order_by('-created_at')
        data = []
        for code in codes:
            data.append({
                'id': code.id,
                'email': code.email,
                'access_code': code.access_code,
                'is_used': code.is_used,
                'created_at': code.created_at.isoformat(),
                'used_at': code.used_at.isoformat() if code.used_at else None,
            })
        return Response(data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Obtener estadísticas del profesor para el panel"""
        try:
            professor = request.user.professor
        except Professor.DoesNotExist:
            return Response(
                {'error': 'El usuario no es un profesor'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        completed_sessions_count = professor.game_sessions.filter(status='completed').count()
        unique_students_count = professor.get_unique_students_count()
        
        return Response({
            'sessions': completed_sessions_count,
            'students': unique_students_count
        })
    
    @action(detail=False, methods=['post'])
    def create_with_code(self, request):
        """Generar un código de acceso para un profesor"""
        import random
        import string
        from django.conf import settings
        from urllib.parse import quote
        
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response(
                {'error': 'El correo electrónico es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar que el correo sea de la universidad (udd.cl)
        if not email.endswith('@udd.cl'):
            return Response(
                {'error': 'El correo debe ser de la universidad (@udd.cl)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar si ya existe un código pendiente para este email
        existing_code = ProfessorAccessCode.objects.filter(
            email=email,
            is_used=False
        ).first()
        
        if existing_code:
            return Response(
                {'error': 'Ya existe un código de acceso pendiente para este correo'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar si el usuario ya está registrado
        if User.objects.filter(email=email).exists():
            return Response(
                {'error': 'Ya existe un usuario registrado con este correo electrónico'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generar código de acceso único (6 dígitos)
        max_attempts = 100
        attempts = 0
        while attempts < max_attempts:
            access_code = ''.join(random.choices(string.digits, k=6))
            if not ProfessorAccessCode.objects.filter(access_code=access_code).exists():
                break
            attempts += 1
        
        if attempts >= max_attempts:
            return Response(
                {'error': 'No se pudo generar un código único. Intente nuevamente.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Crear el código de acceso pendiente
        try:
            access_code_obj = ProfessorAccessCode.objects.create(
                email=email,
                access_code=access_code
            )
            
            # Preparar contenido del email HTML para mailto
            app_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            register_url = f"{app_url}/profesor/registro"
            
            first_name = request.data.get('first_name', '').strip()
            greeting = f"Hola {first_name}," if first_name else "Hola,"
            
            subject = 'Código de Acceso - Misión Emprende UDD'
            
            # Cuerpo del email en texto plano (para compatibilidad)
            body_plain = f"""{greeting}

Has sido invitado a registrarte como profesor en Misión Emprende UDD.

Tu código de acceso es: {access_code}

Para completar tu registro:
1. Visita: {register_url}
2. Ingresa tu correo: {email}
3. Ingresa el código de acceso: {access_code}
4. Completa el formulario de registro

Este código es único y solo puede ser usado una vez.

¡Bienvenido!
Equipo Misión Emprende UDD"""
            
            # Cuerpo del email en HTML (más bonito)
            body_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #093c92 0%, #2563eb 50%, #f757ac 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin: -30px -30px 30px -30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .greeting {{
            font-size: 18px;
            font-weight: 500;
            color: #093c92;
            margin-bottom: 20px;
        }}
        .code-box {{
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 2px solid #2563eb;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 25px 0;
        }}
        .code-label {{
            font-size: 14px;
            color: #64748b;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        .code-value {{
            font-size: 32px;
            font-weight: bold;
            color: #093c92;
            font-family: 'Courier New', monospace;
            letter-spacing: 4px;
        }}
        .instructions {{
            background-color: #f8fafc;
            border-left: 4px solid #2563eb;
            padding: 20px;
            margin: 25px 0;
            border-radius: 4px;
        }}
        .instructions h3 {{
            margin-top: 0;
            color: #093c92;
            font-size: 16px;
        }}
        .instructions ol {{
            margin: 15px 0;
            padding-left: 20px;
        }}
        .instructions li {{
            margin: 10px 0;
            color: #475569;
        }}
        .register-button {{
            display: inline-block;
            background: linear-gradient(135deg, #2563eb 0%, #093c92 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 25px 0;
            text-align: center;
            box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
            transition: transform 0.2s;
        }}
        .register-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 8px rgba(37, 99, 235, 0.4);
        }}
        .warning {{
            background-color: #fef3c7;
            border: 1px solid #fbbf24;
            border-radius: 6px;
            padding: 15px;
            margin: 25px 0;
            color: #92400e;
        }}
        .warning strong {{
            display: block;
            margin-bottom: 5px;
        }}
        .footer {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 14px;
        }}
        .info-box {{
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #1e40af;
        }}
        .info-box strong {{
            display: block;
            margin-bottom: 8px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 Misión Emprende UDD</h1>
        </div>
        
        <div class="greeting">{greeting}</div>
        
        <p>Has sido invitado a registrarte como profesor en <strong>Misión Emprende UDD</strong>.</p>
        
        <div class="code-box">
            <div class="code-label">Tu código de acceso</div>
            <div class="code-value">{access_code}</div>
        </div>
        
        <div class="instructions">
            <h3>📝 Para completar tu registro:</h3>
            <ol>
                <li>Haz clic en el botón de abajo o visita: <a href="{register_url}" style="color: #2563eb; text-decoration: none;">{register_url}</a></li>
                <li>Ingresa tu correo: <strong>{email}</strong></li>
                <li>Ingresa el código de acceso: <strong>{access_code}</strong></li>
                <li>Completa el formulario de registro con tus datos</li>
            </ol>
        </div>
        
        <div style="text-align: center;">
            <a href="{register_url}" class="register-button">🚀 Comenzar Registro</a>
        </div>
        
        <div class="info-box">
            <strong>📧 Información de acceso:</strong>
            <div style="margin-top: 8px;">
                <strong>Correo:</strong> {email}<br>
                <strong>Código:</strong> {access_code}
            </div>
        </div>
        
        <div class="warning">
            <strong>⚠️ Importante:</strong>
            Este código es único y solo puede ser usado una vez. Si tienes problemas, contacta al administrador.
        </div>
        
        <div class="footer">
            <p><strong>¡Bienvenido!</strong></p>
            <p>Equipo Misión Emprende UDD</p>
        </div>
    </div>
</body>
</html>"""
            
            # Crear enlace mailto con HTML (algunos clientes lo soportan)
            # Usamos el texto plano para compatibilidad máxima
            mailto_link = f"mailto:{email}?subject={quote(subject)}&body={quote(body_plain)}"
            
            return Response({
                'success': True,
                'access_code': access_code,
                'email': email,
                'mailto_link': mailto_link,
                'subject': subject,
                'body': body_plain,
                'body_html': body_html,
                'message': 'Código de acceso generado exitosamente. Abre tu cliente de correo para enviarlo.'
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Error al generar el código de acceso: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class StudentViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Estudiantes
    """
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Crear múltiples estudiantes desde un Excel"""
        serializer = StudentBulkCreateSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.create(serializer.validated_data)
            return Response(result, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def upload_excel(self, request):
        """
        Subir archivo Excel y crear estudiantes automáticamente
        
        Formato esperado del Excel:
        - Correo: correo electrónico del estudiante
        - RUT: RUT del estudiante
        - Nombre: nombre del estudiante
        - Apellido Paterno: apellido paterno
        - Apellido Materno: apellido materno
        """
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No se proporcionó ningún archivo'},
                status=status.HTTP_400_BAD_REQUEST
            )

        excel_file = request.FILES['file']
        
        # Validar extensión del archivo
        if not excel_file.name.endswith(('.xlsx', '.xls')):
            return Response(
                {'error': 'El archivo debe ser un Excel (.xlsx o .xls)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Leer el archivo Excel
            df = pd.read_excel(excel_file)
            
            # Validar columnas requeridas
            required_columns = ['Correo', 'RUT', 'Nombre', 'Apellido Paterno', 'Apellido Materno']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                return Response(
                    {
                        'error': f'Faltan las siguientes columnas en el Excel: {", ".join(missing_columns)}',
                        'columnas_requeridas': required_columns,
                        'columnas_encontradas': df.columns.tolist()
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Procesar cada fila
            students_created = []
            students_updated = []
            errors = []
            
            for index, row in df.iterrows():
                try:
                    # Combinar nombre completo
                    nombre = str(row['Nombre']).strip() if pd.notna(row['Nombre']) else ''
                    apellido_paterno = str(row['Apellido Paterno']).strip() if pd.notna(row['Apellido Paterno']) else ''
                    apellido_materno = str(row['Apellido Materno']).strip() if pd.notna(row['Apellido Materno']) else ''
                    
                    # Combinar nombre completo
                    full_name_parts = [part for part in [nombre, apellido_paterno, apellido_materno] if part]
                    full_name = ' '.join(full_name_parts)
                    
                    # Obtener email y RUT
                    email = str(row['Correo']).strip() if pd.notna(row['Correo']) else ''
                    rut = str(row['RUT']).strip() if pd.notna(row['RUT']) else ''
                    
                    # Validar campos requeridos
                    if not email:
                        errors.append(f'Fila {index + 2}: Correo vacío')
                        continue
                    if not rut:
                        errors.append(f'Fila {index + 2}: RUT vacío')
                        continue
                    if not full_name:
                        errors.append(f'Fila {index + 2}: Nombre completo vacío')
                        continue
                    
                    # Crear o actualizar estudiante
                    student, created = Student.objects.update_or_create(
                        email=email,
                        defaults={
                            'full_name': full_name,
                            'rut': rut,
                        }
                    )
                    
                    if created:
                        students_created.append({
                            'id': student.id,
                            'full_name': student.full_name,
                            'email': student.email,
                            'rut': student.rut
                        })
                    else:
                        students_updated.append({
                            'id': student.id,
                            'full_name': student.full_name,
                            'email': student.email,
                            'rut': student.rut
                        })
                        
                except Exception as e:
                    errors.append(f'Fila {index + 2}: {str(e)}')
                    continue
            
            # Preparar respuesta
            response_data = {
                'total_filas': len(df),
                'estudiantes_creados': len(students_created),
                'estudiantes_actualizados': len(students_updated),
                'errores': len(errors),
                'detalle_errores': errors[:10] if errors else [],  # Limitar a 10 errores
            }
            
            if errors:
                response_data['mensaje'] = f'Se procesaron {len(df)} filas. {len(students_created)} creados, {len(students_updated)} actualizados, {len(errors)} errores.'
            else:
                response_data['mensaje'] = f'Se procesaron {len(df)} filas correctamente. {len(students_created)} creados, {len(students_updated)} actualizados.'
            
            status_code = status.HTTP_201_CREATED if students_created or students_updated else status.HTTP_400_BAD_REQUEST
            return Response(response_data, status=status_code)
            
        except pd.errors.EmptyDataError:
            return Response(
                {'error': 'El archivo Excel está vacío'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except pd.errors.ParserError as e:
            return Response(
                {'error': f'Error al leer el archivo Excel: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Error inesperado al procesar el archivo: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
