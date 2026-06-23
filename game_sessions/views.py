"""
Views para la app game_sessions
"""
import pandas as pd
import random
import string
import qrcode
from io import BytesIO
import base64
import logging
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings
import os
from PIL import Image
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

logger = logging.getLogger(__name__)
from users.models import Professor, Student
from .models import (
    GameSession, SessionGroup, Team, TeamStudent, TeamPersonalization, SessionStage,
    TeamActivityProgress, TeamBubbleMap, Tablet, TabletConnection,
    TeamRouletteAssignment, TokenTransaction, PeerEvaluation, ReflectionEvaluation
)
from .serializers import (
    GameSessionSerializer, GameSessionCreateSerializer,
    TeamSerializer, TeamPersonalizationSerializer,
    SessionStageSerializer, TeamActivityProgressSerializer,
    TeamBubbleMapSerializer, TabletSerializer, TabletConnectionSerializer,
    TeamRouletteAssignmentSerializer, TokenTransactionSerializer,
    PeerEvaluationSerializer, ReflectionEvaluationSerializer
)
from users.models import Student


class GameSessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Sesiones de Juego
    """
    queryset = GameSession.objects.all()
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """
        Permite leer sin autenticación para tablets
        También permite acceso sin autenticación a acciones personalizadas para tablets
        """
        # Acciones estándar que no requieren autenticación
        if self.action in ['retrieve', 'list']:
            return [AllowAny()]
        # Acciones personalizadas que no requieren autenticación (para tablets)
        if self.action in ['lobby', 'activity_timer', 'stage_results']:
            return [AllowAny()]
        return super().get_permissions()
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['professor', 'course', 'status']
    search_fields = ['room_code', 'professor__user__username', 'course__name']
    ordering_fields = ['created_at', 'started_at', 'status']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return GameSessionCreateSerializer
        return GameSessionSerializer

    def get_queryset(self):
        queryset = GameSession.objects.select_related('professor__user', 'course', 'current_stage', 'current_activity')
        # Si el usuario está autenticado
        if self.request.user.is_authenticated:
            # Verificar si es administrador y profesor
            is_administrator = hasattr(self.request.user, 'administrator')
            is_professor = hasattr(self.request.user, 'professor')
            
            # Verificar si se solicita vista de administrador (parámetro admin_view=true)
            # Si admin_view=true, mostrar todas las sesiones (solo para administradores)
            # Si admin_view=false o no está presente, y el usuario es profesor, filtrar solo sus sesiones
            admin_view = self.request.query_params.get('admin_view', 'false').lower() == 'true'
            
            if is_professor:
                # Si el usuario es profesor (incluso si también es administrador)
                if admin_view and is_administrator:
                    # Accediendo como administrador: mostrar todas las sesiones
                    pass  # No filtrar
                else:
                    # Accediendo como profesor: mostrar solo sus sesiones
                    queryset = queryset.filter(professor__user=self.request.user)
            elif is_administrator and not is_professor:
                # Usuario es solo administrador (no profesor): mostrar todas las sesiones
                pass  # No filtrar
            # Si no es ni administrador ni profesor, no filtrar (aunque esto no debería pasar)
        return queryset

    def _generate_room_code(self):
        """Generar código de sala único (6 caracteres alfanuméricos)"""
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if not GameSession.objects.filter(room_code=code).exists():
                return code

    def _generate_qr_code(self, room_code, base_url='http://localhost:8000'):
        """Generar código QR para la sala"""
        qr_url = f"{base_url}/tablet/join/{room_code}"
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(qr_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convertir imagen a base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"

    def _create_teams_automatically(self, game_session, students, min_size=3, max_size=8):
        """
        Crear equipos automáticamente con estudiantes
        
        Args:
            game_session: Sesión de juego
            students: Lista de estudiantes
            min_size: Tamaño mínimo por equipo (default: 3)
            max_size: Tamaño máximo por equipo (default: 8)
        
        Returns:
            Lista de equipos creados
        """
        if not students:
            return []
        
        # Colores disponibles para equipos
        team_colors = ['Verde', 'Azul', 'Rojo', 'Amarillo', 'Naranja', 'Morado', 'Rosa', 'Cian', 'Gris', 'Marrón']
        
        # Mezclar estudiantes aleatoriamente
        shuffled_students = list(students)
        random.shuffle(shuffled_students)
        
        total_students = len(shuffled_students)
        
        # Validar que haya suficientes estudiantes
        if total_students < min_size:
            # Si hay menos estudiantes que el mínimo, crear un solo equipo con todos
            num_teams = 1
        else:
            # Calcular número óptimo de equipos
            # Intentar crear equipos de tamaño óptimo (entre min_size y max_size)
            # Calcular cuántos equipos podemos hacer con el tamaño máximo
            num_teams_max = (total_students + max_size - 1) // max_size  # División entera hacia arriba
            
            # Calcular cuántos equipos podemos hacer con el tamaño mínimo
            num_teams_min = total_students // min_size
            
            # Elegir el número de equipos que mejor distribuya los estudiantes
            # Preferir más equipos si es posible, pero asegurando que todos tengan al menos min_size
            num_teams = min(num_teams_max, num_teams_min)
            if num_teams == 0:
                num_teams = 1
        
        # Calcular tamaño base de cada equipo
        base_team_size = total_students // num_teams
        remainder = total_students % num_teams  # Estudiantes restantes a distribuir
        
        teams = []
        student_index = 0
        
        for i in range(num_teams):
            # Calcular tamaño del equipo actual
            # Distribuir estudiantes restantes en los primeros equipos
            current_team_size = base_team_size + (1 if i < remainder else 0)
            
            # Asegurar que el tamaño esté dentro del rango
            current_team_size = max(min_size, min(max_size, current_team_size))
            
            # Obtener estudiantes para este equipo
            team_students = shuffled_students[student_index:student_index + current_team_size]
            student_index += current_team_size
            
            # Crear equipo
            color = team_colors[i % len(team_colors)]
            team = Team.objects.create(
                game_session=game_session,
                name=f"Equipo {color}",
                color=color
            )
            
            # Asignar estudiantes al equipo
            for student in team_students:
                TeamStudent.objects.create(team=team, student=student)
            
            teams.append(team)
        
        return teams

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def process_excel(self, request):
        """
        Procesar archivo Excel y calcular cuántas salas se necesitan
        No crea ninguna sesión, solo procesa y retorna información
        """
        # Validar que el usuario es profesor
        try:
            professor = request.user.professor
        except Professor.DoesNotExist:
            return Response(
                {'error': 'El usuario no es un profesor'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validar curso: acepta course_id (numérico) o nombres (faculty_name + career_name + course_name)
        course_id = request.data.get('course_id')
        course_name_param = request.data.get('course_name', '').strip()
        faculty_name_param = request.data.get('faculty_name', '').strip()
        career_name_param = request.data.get('career_name', '').strip()

        from academic.models import Course, Career, Faculty as FacultyModel
        if course_id:
            try:
                course = Course.objects.get(id=course_id)
            except Course.DoesNotExist:
                return Response({'error': 'Curso no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        elif course_name_param and career_name_param and faculty_name_param:
            faculty_obj, _ = FacultyModel.objects.get_or_create(name=faculty_name_param)
            career_obj, _ = Career.objects.get_or_create(name=career_name_param, faculty=faculty_obj)
            course, _ = Course.objects.get_or_create(name=course_name_param, career=career_obj)
        else:
            return Response(
                {'error': 'Se requiere course_id o (faculty_name + career_name + course_name)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar archivo Excel
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No se proporcionó ningún archivo'},
                status=status.HTTP_400_BAD_REQUEST
            )

        excel_file = request.FILES['file']

        if not excel_file.name.endswith(('.xlsx', '.xls')):
            return Response(
                {'error': 'El archivo debe ser un Excel (.xlsx o .xls)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Leer y procesar Excel
            df = pd.read_excel(excel_file)
            
            # Validar columnas
            required_columns = ['Correo', 'RUT', 'Nombre', 'Apellido Paterno', 'Apellido Materno']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                return Response(
                    {
                        'error': f'Faltan las siguientes columnas: {", ".join(missing_columns)}',
                        'columnas_requeridas': required_columns,
                        'columnas_encontradas': df.columns.tolist()
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Procesar estudiantes
            students_list = []
            errors = []
            
            for index, row in df.iterrows():
                try:
                    # Combinar nombre completo
                    nombre = str(row['Nombre']).strip() if pd.notna(row['Nombre']) else ''
                    apellido_paterno = str(row['Apellido Paterno']).strip() if pd.notna(row['Apellido Paterno']) else ''
                    apellido_materno = str(row['Apellido Materno']).strip() if pd.notna(row['Apellido Materno']) else ''
                    
                    full_name_parts = [part for part in [nombre, apellido_paterno, apellido_materno] if part]
                    full_name = ' '.join(full_name_parts)
                    
                    email = str(row['Correo']).strip() if pd.notna(row['Correo']) else ''
                    rut = str(row['RUT']).strip() if pd.notna(row['RUT']) else ''
                    
                    if not email or not rut or not full_name:
                        errors.append(f'Fila {index + 2}: Datos incompletos')
                        continue
                    
                    # Obtener o crear estudiante
                    student, created = Student.objects.get_or_create(
                        email=email,
                        defaults={
                            'full_name': full_name,
                            'rut': rut,
                        }
                    )
                    students_list.append(student)
                    
                except Exception as e:
                    errors.append(f'Fila {index + 2}: {str(e)}')
                    continue
            
            if not students_list:
                return Response(
                    {'error': 'No se pudieron procesar estudiantes del archivo Excel'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calcular cuántas salas se necesitan
            # 9-32 alumnos: 1 sala, 33-64: 2 salas, 65-96: 3 salas, etc.
            total_students = len(students_list)
            if total_students < 9:
                return Response(
                    {'error': 'Se requieren al menos 9 estudiantes para crear una sesión'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calcular número de salas necesarias (cada sala puede tener máximo 32 alumnos)
            # Máximo 3-4 grupos por sala, cada grupo 3-8 alumnos = máximo 32 alumnos por sala
            number_of_sessions = ((total_students - 1) // 32) + 1
            
            return Response({
                'total_students': total_students,
                'number_of_sessions': number_of_sessions,
                'students_per_session': total_students // number_of_sessions if number_of_sessions > 0 else 0,
                'errors': errors[:10] if errors else [],
                'course_id': course_id,
                'course_name': course.name,
            }, status=status.HTTP_200_OK)
            
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
                {'error': f'Error inesperado: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def create_with_excel(self, request):
        """
        Crear sesión(es) de juego con archivo Excel y asignación automática de equipos
        
        Requiere:
        - course_id: ID del curso
        - file: Archivo Excel con estudiantes
        - number_of_sessions: Número de salas a crear (1, 2, 3, etc.)
        - min_team_size (opcional): Tamaño mínimo por equipo (default: 3)
        - max_team_size (opcional): Tamaño máximo por equipo (default: 8)
        """
        # Validar que el usuario es profesor
        try:
            professor = request.user.professor
        except Professor.DoesNotExist:
            return Response(
                {'error': 'El usuario no es un profesor'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validar número de sesiones
        number_of_sessions = int(request.data.get('number_of_sessions', 1))
        if number_of_sessions < 1 or number_of_sessions > 10:
            return Response(
                {'error': 'El número de sesiones debe estar entre 1 y 10'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar si el profesor ya tiene sesiones activas (lobby o running) que no estén en un grupo
        active_sessions = GameSession.objects.filter(
            professor=professor,
            status__in=['lobby', 'running'],
            session_group__isnull=True
        )
        
        if active_sessions.exists():
            return Response(
                {
                    'error': 'Ya tienes sesiones activas sin grupo',
                    'active_sessions': [{'id': s.id, 'room_code': s.room_code} for s in active_sessions],
                    'message': 'Debes finalizar o cancelar las sesiones actuales antes de crear nuevas'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar curso: acepta course_id (numérico) o nombres (faculty_name + career_name + course_name)
        course_id = request.data.get('course_id')
        course_name_param = request.data.get('course_name', '').strip()
        faculty_name_param = request.data.get('faculty_name', '').strip()
        career_name_param = request.data.get('career_name', '').strip()

        from academic.models import Course, Career, Faculty as FacultyModel
        if course_id:
            try:
                course = Course.objects.get(id=course_id)
            except Course.DoesNotExist:
                return Response({'error': 'Curso no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        elif course_name_param and career_name_param and faculty_name_param:
            faculty_obj, _ = FacultyModel.objects.get_or_create(name=faculty_name_param)
            career_obj, _ = Career.objects.get_or_create(name=career_name_param, faculty=faculty_obj)
            course, _ = Course.objects.get_or_create(name=course_name_param, career=career_obj)
        else:
            return Response(
                {'error': 'Se requiere course_id o (faculty_name + career_name + course_name)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar archivo Excel
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No se proporcionó ningún archivo'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        excel_file = request.FILES['file']
        
        if not excel_file.name.endswith(('.xlsx', '.xls')):
            return Response(
                {'error': 'El archivo debe ser un Excel (.xlsx o .xls)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Obtener parámetros de tamaño de equipo
        min_team_size = int(request.data.get('min_team_size', 3))
        max_team_size = int(request.data.get('max_team_size', 8))
        
        try:
            # Leer y procesar Excel
            df = pd.read_excel(excel_file)
            
            # Validar columnas
            required_columns = ['Correo', 'RUT', 'Nombre', 'Apellido Paterno', 'Apellido Materno']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                return Response(
                    {
                        'error': f'Faltan las siguientes columnas: {", ".join(missing_columns)}',
                        'columnas_requeridas': required_columns,
                        'columnas_encontradas': df.columns.tolist()
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Procesar estudiantes
            students_list = []
            errors = []
            
            for index, row in df.iterrows():
                try:
                    # Combinar nombre completo
                    nombre = str(row['Nombre']).strip() if pd.notna(row['Nombre']) else ''
                    apellido_paterno = str(row['Apellido Paterno']).strip() if pd.notna(row['Apellido Paterno']) else ''
                    apellido_materno = str(row['Apellido Materno']).strip() if pd.notna(row['Apellido Materno']) else ''
                    
                    full_name_parts = [part for part in [nombre, apellido_paterno, apellido_materno] if part]
                    full_name = ' '.join(full_name_parts)
                    
                    email = str(row['Correo']).strip() if pd.notna(row['Correo']) else ''
                    rut = str(row['RUT']).strip() if pd.notna(row['RUT']) else ''
                    
                    if not email or not rut or not full_name:
                        errors.append(f'Fila {index + 2}: Datos incompletos')
                        continue
                    
                    # Obtener o crear estudiante
                    student, created = Student.objects.get_or_create(
                        email=email,
                        defaults={
                            'full_name': full_name,
                            'rut': rut,
                        }
                    )
                    students_list.append(student)
                    
                except Exception as e:
                    errors.append(f'Fila {index + 2}: {str(e)}')
                    continue
            
            if not students_list:
                return Response(
                    {'error': 'No se pudieron procesar estudiantes del archivo Excel'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            total_students = len(students_list)
            
            # Crear SessionGroup si hay múltiples sesiones
            session_group = None
            if number_of_sessions > 1:
                session_group = SessionGroup.objects.create(
                    professor=professor,
                    course=course,
                    total_students=total_students,
                    number_of_sessions=number_of_sessions
                )
            
            # Dividir estudiantes en grupos para cada sesión
            students_per_session = total_students // number_of_sessions
            remainder = total_students % number_of_sessions
            
            created_sessions = []
            all_teams = []
            student_index = 0
            
            for session_num in range(number_of_sessions):
                # Calcular cuántos estudiantes van en esta sesión
                session_students_count = students_per_session + (1 if session_num < remainder else 0)
                session_students = students_list[student_index:student_index + session_students_count]
                student_index += session_students_count
                
                # Crear sesión de juego
                room_code = self._generate_room_code()
                qr_code = self._generate_qr_code(room_code)
                
                game_session = GameSession.objects.create(
                    professor=professor,
                    course=course,
                    room_code=room_code,
                    qr_code=qr_code,
                    status='lobby',
                    session_group=session_group
                )
                
                # Crear equipos automáticamente
                teams = self._create_teams_automatically(
                    game_session,
                    session_students,
                    min_size=min_team_size,
                    max_size=max_team_size
                )
                
                created_sessions.append(game_session)
                all_teams.extend(teams)
            
            # Serializar respuesta
            if number_of_sessions == 1:
                # Si es una sola sesión, retornar como antes
                serializer = GameSessionSerializer(created_sessions[0])
                team_serializer = TeamSerializer(all_teams, many=True)
                
                return Response({
                    'game_session': serializer.data,
                    'teams': team_serializer.data,
                    'students_processed': total_students,
                    'teams_created': len(all_teams),
                    'errors': errors[:10] if errors else [],
                    'message': f'Sesión creada exitosamente. {total_students} estudiantes procesados, {len(all_teams)} equipos creados.'
                }, status=status.HTTP_201_CREATED)
            else:
                # Si son múltiples sesiones, retornar todas
                sessions_data = [GameSessionSerializer(s).data for s in created_sessions]
                
                return Response({
                    'session_group_id': session_group.id,
                    'game_sessions': sessions_data,
                    'total_students': total_students,
                    'number_of_sessions': number_of_sessions,
                    'students_per_session': students_per_session,
                    'total_teams_created': len(all_teams),
                    'errors': errors[:10] if errors else [],
                    'message': f'{number_of_sessions} sesiones creadas exitosamente. {total_students} estudiantes procesados, {len(all_teams)} equipos creados en total.'
                }, status=status.HTTP_201_CREATED)
            
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
                {'error': f'Error inesperado: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Iniciar una sesión de juego"""
        try:
            # Obtener sesión directamente sin usar get_object() para evitar verificación de permisos
            try:
                game_session = GameSession.objects.get(id=pk)
            except GameSession.DoesNotExist:
                return Response(
                    {'error': 'Sesión no encontrada'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            import traceback
            print(f"Error en start al obtener objeto: {e}")
            print(traceback.format_exc())
            return Response(
                {'error': f'Error al obtener sesión: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        if game_session.status != 'lobby':
            return Response(
                {'error': 'La sesión no está en estado lobby'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar que todas las tablets estén conectadas
        teams = game_session.teams.all()
        all_teams_connected = all(
            team.tablet_connections.filter(disconnected_at__isnull=True).exists()
            for team in teams
        )
        
        if not all_teams_connected:
            connected_teams = sum(1 for team in teams if team.tablet_connections.filter(disconnected_at__isnull=True).exists())
            return Response(
                {
                    'error': 'No se puede iniciar el juego. Todas las tablets deben estar conectadas.',
                    'teams_connected': connected_teams,
                    'total_teams': teams.count()
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # NO establecer etapa ni actividad al iniciar - el video institucional es previo a las etapas
        # La etapa 1 se establecerá cuando se complete el video institucional
        
        game_session.status = 'running'
        game_session.started_at = timezone.now()
        
        # Guardar cambios (incluyendo current_stage y current_activity si se establecieron)
        game_session.save()
        
        # Inicializar started_at para todos los equipos en la primera actividad
        if game_session.current_activity:
            # Verificar que current_stage no sea None
            if not game_session.current_stage:
                return Response(
                    {'error': 'No se puede iniciar el juego. La etapa no está establecida.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            activity_start_time = timezone.now()
            from .models import Team, TeamActivityProgress, SessionStage
            teams = Team.objects.filter(game_session=game_session)
            
            # Crear SessionStage para esta etapa si no existe
            # Usar get_or_create que maneja automáticamente los casos de existencia
            try:
                session_stage, created = SessionStage.objects.get_or_create(
                    game_session=game_session,
                    stage=game_session.current_stage,
                    defaults={
                        'status': 'in_progress',
                        'started_at': activity_start_time
                    }
                )
            except Exception as e:
                # Si get_or_create falla, intentar obtener el objeto existente
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f'Error en get_or_create: {e}. Intentando obtener objeto existente.')
                try:
                    session_stage = SessionStage.objects.get(
                        game_session=game_session,
                        stage=game_session.current_stage
                    )
                    created = False
                except SessionStage.DoesNotExist:
                    # Si no existe, devolver error
                    return Response(
                        {'error': f'No se pudo crear SessionStage: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            
            # Si no se creó nuevo, actualizar el status y started_at si es necesario
            if not created:
                session_stage.status = 'in_progress'
                if not session_stage.started_at:
                    session_stage.started_at = activity_start_time
                session_stage.save(update_fields=['status', 'started_at'])
            
            # Intentar establecer presentation_state si existe (después de guardar)
            try:
                if hasattr(session_stage, 'presentation_state') and not session_stage.presentation_state:
                    # Solo establecer si no tiene valor
                    SessionStage.objects.filter(id=session_stage.id).update(presentation_state='not_started')
                    session_stage.refresh_from_db()
            except Exception:
                # Si falla, no importa, el objeto ya está guardado
                pass
            
            # Inicializar started_at para todos los equipos en la primera actividad
            for team in teams:
                progress, created = TeamActivityProgress.objects.get_or_create(
                    team=team,
                    activity=game_session.current_activity,
                    session_stage=session_stage,
                    defaults={
                        'status': 'pending',
                        'started_at': activity_start_time
                    }
                )
                # SIEMPRE actualizar el started_at para sincronizar
                if not created:
                    progress.started_at = activity_start_time
                    progress.save()
        
        # Recargar desde la BD para asegurar que los campos relacionados estén disponibles
        game_session.refresh_from_db()
        
        # Seleccionar campos relacionados explícitamente
        try:
            # Refrescar la sesión para asegurar que todos los campos estén actualizados
            game_session.refresh_from_db()
            
            # Intentar obtener con select_related, pero si falla, usar el objeto que ya tenemos
            try:
                game_session = GameSession.objects.select_related(
                    'current_stage', 'current_activity'
                ).get(id=game_session.id)
            except GameSession.DoesNotExist:
                # Si no existe, usar el objeto que ya tenemos
                pass
            
            serializer = self.get_serializer(game_session)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Error en start al serializar: {e}")
            print(error_trace)
            
            # Intentar devolver al menos información básica de la sesión
            try:
                game_session.refresh_from_db()
                return Response({
                    'id': game_session.id,
                    'status': game_session.status,
                    'room_code': game_session.room_code,
                    'error': f'Error al serializar respuesta completa: {str(e)}',
                    'trace': error_trace
                })
            except Exception:
                return Response(
                    {'error': f'Error al serializar respuesta: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    @action(detail=True, methods=['post'], parser_classes=[JSONParser])
    def sync_teams(self, request, pk=None):
        """
        Sincronizar la distribución de equipos del Lobby con la base de datos.
        Llamado tanto por el botón "Guardar Configuración" como antes de "Lanzar Misión".

        Payload esperado:
          { "teams": [ { "id"?: int, "name": str, "color": str, "student_ids": [int] } ] }

        Lógica:
        - Equipos con 'id':  se actualizan sus estudiantes.
        - Equipos sin 'id':  se crean nuevos.
        - Equipos del backend no presentes en el payload: se eliminan
          y sus TabletConnections activas se marcan como desconectadas.
        """
        try:
            game_session = GameSession.objects.get(id=pk)
        except GameSession.DoesNotExist:
            return Response({'error': 'Sesión no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        if game_session.status != 'lobby':
            return Response(
                {'error': 'Solo se puede sincronizar equipos cuando la sesión está en estado lobby'},
                status=status.HTTP_400_BAD_REQUEST
            )

        teams_data = request.data.get('teams', [])
        if not isinstance(teams_data, list) or not teams_data:
            return Response({'error': 'Se requiere una lista de equipos no vacía'}, status=status.HTTP_400_BAD_REQUEST)

        # IDs que el frontend quiere conservar
        frontend_team_ids = {t['id'] for t in teams_data if t.get('id')}

        # Eliminar equipos del backend que ya no están en el payload
        teams_to_delete = game_session.teams.exclude(id__in=frontend_team_ids)
        for team in teams_to_delete:
            team.tablet_connections.filter(disconnected_at__isnull=True).update(
                disconnected_at=timezone.now()
            )
        teams_to_delete.delete()

        color_choices = ['Verde', 'Azul', 'Rojo', 'Amarillo', 'Naranja', 'Morado', 'Rosa', 'Cian', 'Gris', 'Marrón']
        updated_team_ids = []

        for idx, team_data in enumerate(teams_data):
            team_id = team_data.get('id')
            student_ids = team_data.get('student_ids', [])

            if team_id:
                try:
                    team = Team.objects.get(id=team_id, game_session=game_session)
                except Team.DoesNotExist:
                    continue
                TeamStudent.objects.filter(team=team).delete()
            else:
                color = team_data.get('color') or color_choices[idx % len(color_choices)]
                name = team_data.get('name') or f'Equipo {idx + 1}'
                if Team.objects.filter(game_session=game_session, name=name).exists():
                    name = f'{name} ({idx + 1})'
                team = Team.objects.create(game_session=game_session, name=name, color=color)

            for student_id in student_ids:
                try:
                    student = Student.objects.get(id=student_id)
                    TeamStudent.objects.get_or_create(team=team, student=student)
                except Student.DoesNotExist:
                    logger.warning(f'sync_teams: estudiante {student_id} no encontrado, ignorando')

            updated_team_ids.append(team.id)

        final_teams = game_session.teams.prefetch_related('students').filter(id__in=updated_team_ids)
        serializer = TeamSerializer(final_teams, many=True)
        return Response({
            'message': 'Configuración de equipos guardada',
            'teams': serializer.data
        })

    @action(detail=True, methods=['post'])
    def next_activity(self, request, pk=None):
        """
        Avanzar a la siguiente actividad de la etapa actual
        """
        game_session = self.get_object()
        
        if game_session.status != 'running':
            return Response(
                {'error': 'La sesión debe estar en estado running'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not game_session.current_stage:
            return Response(
                {'error': 'No hay etapa actual establecida'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not game_session.current_activity:
            return Response(
                {'error': 'No hay actividad actual establecida'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from challenges.models import Activity
        
        # Buscar la siguiente actividad en la misma etapa
        current_order = game_session.current_activity.order_number
        
        # En Etapa 2: Si estamos en "Seleccionar Tema" (orden 1), saltar "Ver Desafío" (orden 2) 
        # y ir directo a "Bubble Map"
        if game_session.current_stage.number == 2 and current_order == 1:
            # Buscar Bubble Map por nombre (más robusto que asumir orden 3)
            from django.db.models import Q
            bubble_map_activity = Activity.objects.filter(
                stage=game_session.current_stage,
                is_active=True
            ).filter(
                Q(name__icontains='bubble') | 
                Q(name__icontains='mapa') | 
                Q(name__icontains='mapa mental') |
                Q(name__icontains='bubblemap')
            ).filter(
                order_number__gt=current_order
            ).order_by('order_number').first()
            
            if bubble_map_activity:
                next_activity = bubble_map_activity
            else:
                # Si no se encuentra por nombre, intentar orden 3
                next_activity = Activity.objects.filter(
                    stage=game_session.current_stage,
                    order_number=3,
                    is_active=True
                ).first()
                
                # Si tampoco existe orden 3, buscar la siguiente actividad normalmente
                if not next_activity:
                    next_activity = Activity.objects.filter(
                        stage=game_session.current_stage,
                        order_number__gt=current_order,
                        is_active=True
                    ).order_by('order_number').first()
        else:
            # Para otras etapas o situaciones, buscar la siguiente actividad normalmente
            next_activity = Activity.objects.filter(
                stage=game_session.current_stage,
                order_number__gt=current_order,
                is_active=True
            ).order_by('order_number').first()
        
        # Si no hay más actividades en esta etapa, marcar etapa como completada y retornar resultados
        if not next_activity:
            # Marcar la actividad actual como completada para todos los equipos antes de completar la etapa
            from .models import SessionStage, Team, TeamActivityProgress
            session_stage = SessionStage.objects.filter(
                game_session=game_session,
                stage=game_session.current_stage
            ).first()
            
            if session_stage:
                # Marcar la actividad actual como completada para todos los equipos
                current_activity = game_session.current_activity
                if current_activity:
                    teams = Team.objects.filter(game_session=game_session)
                    for team in teams:
                        progress, created = TeamActivityProgress.objects.get_or_create(
                            team=team,
                            activity=current_activity,
                            session_stage=session_stage,
                            defaults={
                                'status': 'completed',
                                'progress_percentage': 100,
                                'completed_at': timezone.now()
                            }
                        )
                        if not created:
                            # Si ya existía, actualizar a completado
                            progress.status = 'completed'
                            progress.progress_percentage = 100
                            if not progress.completed_at:
                                progress.completed_at = timezone.now()
                            progress.save()
                
                # Marcar la etapa como completada
                session_stage.status = 'completed'
                session_stage.completed_at = timezone.now()
                session_stage.save()
            
            # Limpiar current_activity para indicar que estamos en resultados
            game_session.current_activity = None
            game_session.save()
            
            # Retornar información de que se completó la etapa
            return Response({
                'stage_completed': True,
                'stage_id': game_session.current_stage.id,
                'stage_name': game_session.current_stage.name,
                'stage_number': game_session.current_stage.number,
                'message': f'Etapa {game_session.current_stage.number} completada. Mostrando resultados...'
            })
        
        # Marcar la actividad actual como completada antes de avanzar a la siguiente
        from .models import SessionStage, Team, TeamActivityProgress
        session_stage = SessionStage.objects.filter(
            game_session=game_session,
            stage=game_session.current_stage
        ).first()
        
        if session_stage:
            current_activity = game_session.current_activity
            if current_activity:
                teams = Team.objects.filter(game_session=game_session)
                for team in teams:
                    progress, created = TeamActivityProgress.objects.get_or_create(
                        team=team,
                        activity=current_activity,
                        session_stage=session_stage,
                        defaults={
                            'status': 'completed',
                            'progress_percentage': 100,
                            'completed_at': timezone.now()
                        }
                    )
                    if not created:
                        # Si ya existía, actualizar a completado
                        progress.status = 'completed'
                        progress.progress_percentage = 100
                        if not progress.completed_at:
                            progress.completed_at = timezone.now()
                        progress.save()
        
        # Actualizar actividad actual
        game_session.current_activity = next_activity
        game_session.save()
        
        # Crear o actualizar SessionStage si no existe
        from .models import SessionStage
        session_stage, created = SessionStage.objects.get_or_create(
            game_session=game_session,
            stage=game_session.current_stage,
            defaults={
                'status': 'in_progress',
                'started_at': timezone.now()
            }
        )
        
        # Inicializar started_at para todos los equipos cuando cambia la actividad
        # Esto asegura que todos los temporizadores estén sincronizados
        activity_start_time = timezone.now()
        from .models import Team, TeamActivityProgress
        teams = Team.objects.filter(game_session=game_session)
        for team in teams:
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=next_activity,
                session_stage=session_stage,
                defaults={
                    'status': 'pending',
                    'started_at': activity_start_time  # Mismo tiempo para todos
                }
            )
            # SIEMPRE actualizar el started_at para sincronizar (incluso si ya existía)
            if not created:
                progress.started_at = activity_start_time
                if progress.status == 'completed':
                    # Si ya estaba completado, mantener el estado pero actualizar started_at
                    pass
                else:
                    progress.status = 'pending'
                progress.save()
        
        game_session.refresh_from_db()
        game_session = GameSession.objects.select_related(
            'current_stage', 'current_activity'
        ).get(id=game_session.id)
        
        serializer = self.get_serializer(game_session)
        return Response({
            **serializer.data,
            'message': f'Actividad actualizada a: {next_activity.name}',
            'activity_started_at': activity_start_time.isoformat() if activity_start_time else None,
            'current_activity_id': next_activity.id,
            'current_activity_name': next_activity.name,
            'current_activity_order_number': next_activity.order_number
        })

    @action(detail=True, methods=['post'])
    def start_stage_1(self, request, pk=None):
        """
        Iniciar la Etapa 1 después del video institucional
        Establece la etapa 1 y la primera actividad (Personalización)
        """
        game_session = self.get_object()
        
        if game_session.status != 'running':
            return Response(
                {'error': 'El juego no está en ejecución'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from challenges.models import Stage, Activity, ActivityType
        from django.db.models import Q
        from .models import SessionStage, Team, TeamActivityProgress

        # Obtener o crear Stage 1 (resiliencia ante seeders no ejecutados)
        stage_1, _ = Stage.objects.get_or_create(
            number=1,
            defaults={
                'name': 'Trabajo en Equipo',
                'description': 'Primera etapa del juego enfocada en trabajo colaborativo',
                'objective': 'Fomentar el trabajo en equipo y la colaboración',
                'estimated_duration': 60,
                'is_active': True,
            }
        )
        if not stage_1.is_active:
            stage_1.is_active = True
            stage_1.save(update_fields=['is_active'])

        # Buscar la actividad de Personalización usando cuatro estrategias en orden de fiabilidad.

        # Estrategia 1: por código de ActivityType ('personalizacion').
        #   ASCII puro → inmune a colaciones de BD o encoding con la 'ó' de 'Personalización'.
        first_activity = Activity.objects.filter(
            stage=stage_1,
            is_active=True,
            activity_type__code='personalizacion'
        ).order_by('order_number').first()

        # Estrategia 2: excluir actividades pre-etapa por código de ActivityType.
        #   Usa Q objects con OR explícito para NULL-safety: un ActivityType con code=NULL
        #   (registros previos al campo 'code') NO es pre-etapa y sí debe incluirse.
        if not first_activity:
            first_activity = Activity.objects.filter(
                stage=stage_1,
                is_active=True,
            ).filter(
                Q(activity_type__code__isnull=True) |
                ~Q(activity_type__code__in=['instructivo', 'video_institucional'])
            ).exclude(
                name__icontains='Instructivo'
            ).exclude(
                name__icontains='Video'
            ).order_by('order_number').first()

        # Estrategia 3 (último recurso): excluir solo por nombre.
        #   Nunca selecciona Instructivo/Video para evitar el estado inconsistente
        #   current_stage_number=1 + current_activity_name="Instructivo".
        if not first_activity:
            first_activity = Activity.objects.filter(
                stage=stage_1,
                is_active=True
            ).exclude(
                name__icontains='Instructivo'
            ).exclude(
                name__icontains='Video'
            ).order_by('order_number').first()

        # Estrategia 4 (self-healing): si los seeders create_initial_data no fueron ejecutados,
        #   Stage 1 puede existir sin ninguna actividad de Personalización.
        #   En ese caso, la creamos automáticamente para que el juego pueda continuar.
        if not first_activity:
            all_acts = list(Activity.objects.filter(stage=stage_1).values(
                'id', 'name', 'order_number', 'is_active', 'activity_type__code'
            ))
            print(f'[start_stage_1] ⚠️ Ninguna estrategia encontró Personalización. '
                  f'Actividades en Stage {stage_1.id}: {all_acts}')
            print(f'[start_stage_1] ⚙️ Auto-creando ActivityType + Activity "Personalización"...')

            personalizacion_type, _ = ActivityType.objects.get_or_create(
                code='personalizacion',
                defaults={
                    'name': 'Personalización',
                    'description': 'Actividad de personalización de equipos',
                    'is_active': True,
                }
            )
            if not personalizacion_type.is_active:
                personalizacion_type.is_active = True
                personalizacion_type.save(update_fields=['is_active'])

            # Buscar el primer order_number libre en Stage 1
            used_orders = set(
                Activity.objects.filter(stage=stage_1).values_list('order_number', flat=True)
            )
            free_order = 1
            while free_order in used_orders:
                free_order += 1

            first_activity = Activity.objects.create(
                stage=stage_1,
                activity_type=personalizacion_type,
                name='Personalización',
                description='Los equipos personalizan su nombre e indican si se conocen',
                order_number=free_order,
                is_active=True,
            )
            print(f'[start_stage_1] ✅ Actividad "Personalización" auto-creada '
                  f'(id={first_activity.id}, order={free_order}). '
                  f'Ejecuta create_initial_data para seedear correctamente.')

        if not first_activity:
            # Esto no debería alcanzarse nunca tras la Estrategia 4, pero es una red de seguridad.
            return Response(
                {'error': 'No se pudo crear ni encontrar la plantilla de Personalización para la Etapa 1. '
                          'Verifica que la app challenges esté correctamente migrada.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Establecer etapa y actividad
        game_session.current_stage = stage_1
        game_session.current_activity = first_activity
        game_session.save()
        
        # Forzar refresh desde la base de datos para asegurar que se guardó correctamente
        game_session.refresh_from_db()
        
        # Crear SessionStage para la Etapa 1
        activity_start_time = timezone.now()
        session_stage, created = SessionStage.objects.get_or_create(
            game_session=game_session,
            stage=stage_1,
            defaults={
                'status': 'in_progress',
                'started_at': activity_start_time
            }
        )
        
        if not created:
            session_stage.status = 'in_progress'
            if not session_stage.started_at:
                session_stage.started_at = activity_start_time
            session_stage.save()
        
        # Inicializar progreso para todos los equipos en la primera actividad
        teams = Team.objects.filter(game_session=game_session)
        for team in teams:
            TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=first_activity,
                session_stage=session_stage,
                defaults={
                    'status': 'pending',
                    'started_at': activity_start_time
                }
            )
        
        # Refrescar nuevamente después de crear los progresos
        game_session.refresh_from_db()
        
        serializer = self.get_serializer(game_session)
        response_data = {
            **serializer.data,
            'message': 'Etapa 1 iniciada. Primera actividad: Personalización',
            'stage_started': True,
            'current_activity_name': first_activity.name,
            'current_activity_id': first_activity.id,
            'current_stage_number': stage_1.number,
            'current_stage_name': stage_1.name
        }
        
        # Log para debugging
        print(f'[start_stage_1] Etapa 1 iniciada - Session: {game_session.id}')
        print(f'  - current_stage: {game_session.current_stage.name if game_session.current_stage else None} (ID: {game_session.current_stage.id if game_session.current_stage else None})')
        print(f'  - current_activity: {game_session.current_activity.name if game_session.current_activity else None} (ID: {game_session.current_activity.id if game_session.current_activity else None})')
        print(f'  - current_stage_number: {response_data.get("current_stage_number")}')
        print(f'  - current_activity_name: {response_data.get("current_activity_name")}')
        
        return Response(response_data)

    @action(detail=True, methods=['post'])
    def set_video_institucional_activity(self, request, pk=None):
        """
        Establecer la actividad "Video Institucional" como actividad actual
        Esto se usa cuando el profesor está en VideoInstitucional y necesita establecerla como current_activity
        antes de avanzar a Instructivo
        """
        game_session = self.get_object()
        
        if game_session.status != 'running':
            return Response(
                {'error': 'El juego no está en ejecución'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from challenges.models import Stage, Activity
        from .models import SessionStage, Team, TeamActivityProgress
        from django.utils import timezone

        # Obtener o crear Stage 1 (resiliencia ante seeders no ejecutados)
        stage_1, _ = Stage.objects.get_or_create(
            number=1,
            defaults={
                'name': 'Trabajo en Equipo',
                'description': 'Primera etapa del juego enfocada en trabajo colaborativo',
                'objective': 'Fomentar el trabajo en equipo y la colaboración',
                'estimated_duration': 60,
                'is_active': True,
            }
        )
        if not stage_1.is_active:
            stage_1.is_active = True
            stage_1.save(update_fields=['is_active'])

        # Buscar la actividad "Video Institucional"
        video_activity = Activity.objects.filter(
            stage=stage_1,
            name__icontains='Video Institucional',
            is_active=True
        ).first()
        
        if not video_activity:
            return Response(
                {'error': 'La actividad Video Institucional no existe'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Asegurar que la actividad "Instructivo" existe con el order_number correcto
        # Video Institucional = 1, Instructivo = 2, Personalización = 3, Presentación = 4
        from challenges.models import ActivityType
        instructivo_type, _ = ActivityType.objects.get_or_create(
            code='instructivo',
            defaults={
                'name': 'Instructivo',
                'description': 'Instructivo del juego',
                'is_active': True
            }
        )
        
        instructivo_activity = Activity.objects.filter(
            stage=stage_1,
            name__icontains='Instructivo',
            is_active=True
        ).first()
        
        if not instructivo_activity:
            # Crear Instructivo con order_number 2
            instructivo_activity = Activity.objects.create(
                stage=stage_1,
                activity_type=instructivo_type,
                name='Instructivo',
                description='Instructivo del juego - Instrucciones para los estudiantes',
                order_number=2,
                is_active=True
            )
            
            # Reorganizar: Personalización -> 3, Presentación -> 4
            personalizacion = Activity.objects.filter(
                stage=stage_1,
                name__icontains='Personalización',
                is_active=True
            ).exclude(id=instructivo_activity.id).first()
            
            if personalizacion and personalizacion.order_number != 3:
                personalizacion.order_number = 3
                personalizacion.save()
            
            presentacion = Activity.objects.filter(
                stage=stage_1,
                name__icontains='Presentación',
                is_active=True
            ).exclude(id=instructivo_activity.id).first()
            
            if presentacion and presentacion.order_number != 4:
                presentacion.order_number = 4
                presentacion.save()
        
        # Establecer etapa y actividad
        game_session.current_stage = stage_1
        game_session.current_activity = video_activity
        game_session.save()
        
        # Crear SessionStage si no existe
        activity_start_time = timezone.now()
        session_stage, created = SessionStage.objects.get_or_create(
            game_session=game_session,
            stage=stage_1,
            defaults={
                'status': 'in_progress',
                'started_at': activity_start_time
            }
        )
        
        if not created:
            session_stage.status = 'in_progress'
            if not session_stage.started_at:
                session_stage.started_at = activity_start_time
            session_stage.save()
        
        # Inicializar progreso para todos los equipos en Video Institucional
        teams = Team.objects.filter(game_session=game_session)
        for team in teams:
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=video_activity,
                session_stage=session_stage,
                defaults={
                    'status': 'in_progress',
                    'started_at': activity_start_time
                }
            )
            if not created:
                progress.status = 'in_progress'
                progress.started_at = activity_start_time
                progress.save()
        
        game_session.refresh_from_db()
        serializer = self.get_serializer(game_session)
        return Response({
            **serializer.data,
            'message': 'Actividad Video Institucional establecida',
            'current_activity_name': video_activity.name,
            'current_activity_id': video_activity.id,
            'current_stage_number': stage_1.number
        })

    @action(detail=True, methods=['post'])
    def set_instructivo_activity(self, request, pk=None):
        """
        Establecer la actividad "Instructivo" como actividad actual
        El Instructivo es previo a las etapas (como Video Institucional)
        NO establece current_stage ni SessionStage - solo current_activity
        """
        game_session = self.get_object()
        
        if game_session.status != 'running':
            return Response(
                {'error': 'El juego no está en ejecución'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from challenges.models import Stage, Activity, ActivityType
        from django.utils import timezone

        # Obtener o crear Stage 1 (resiliencia ante seeders no ejecutados)
        stage_1, _ = Stage.objects.get_or_create(
            number=1,
            defaults={
                'name': 'Trabajo en Equipo',
                'description': 'Primera etapa del juego enfocada en trabajo colaborativo',
                'objective': 'Fomentar el trabajo en equipo y la colaboración',
                'estimated_duration': 60,
                'is_active': True,
            }
        )
        if not stage_1.is_active:
            stage_1.is_active = True
            stage_1.save(update_fields=['is_active'])

        # Buscar o crear el tipo de actividad "Instructivo"
        instructivo_type, _ = ActivityType.objects.get_or_create(
            code='instructivo',
            defaults={
                'name': 'Instructivo',
                'description': 'Instructivo del juego',
                'is_active': True
            }
        )
        
        # Buscar o crear la actividad "Instructivo"
        # Nota: Aunque la actividad está asociada a stage_1 en la BD, no establecemos current_stage
        instructivo_activity = Activity.objects.filter(
            stage=stage_1,
            name__icontains='Instructivo',
            is_active=True
        ).first()
        
        if not instructivo_activity:
            # Reorganizar actividades existentes para dejar order_number=2 libre para Instructivo.
            # Se busca por activity_type__code (ASCII puro) para evitar fallos de encoding/colación
            # con la 'ó' de 'Personalización'/'Presentación'.

            # Personalización → order_number 3
            personalizacion = Activity.objects.filter(
                stage=stage_1,
                activity_type__code='personalizacion',
                is_active=True
            ).first()
            # Fallback al nombre si el ActivityType no tiene el código
            if not personalizacion:
                personalizacion = Activity.objects.filter(
                    stage=stage_1,
                    name__icontains='Personaliz',
                    is_active=True
                ).first()

            if personalizacion and personalizacion.order_number != 3:
                # Siempre verificar conflicto antes de mover (el bug original no chequeaba
                # cuando order_number == 2, lo que causaba IntegrityError si Presentación
                # ya estaba en 3).
                conflict_3 = Activity.objects.filter(
                    stage=stage_1,
                    order_number=3,
                    is_active=True
                ).exclude(id=personalizacion.id).first()

                if conflict_3:
                    # Mover el conflicto a un número superior disponible
                    next_free = 4
                    while Activity.objects.filter(stage=stage_1, order_number=next_free, is_active=True).exists():
                        next_free += 1
                    conflict_3.order_number = next_free
                    conflict_3.save()

                personalizacion.order_number = 3
                personalizacion.save()

            # Presentación → order_number 4
            presentacion = Activity.objects.filter(
                stage=stage_1,
                activity_type__code='minijuego',
                is_active=True
            ).first()
            # Fallback al nombre
            if not presentacion:
                presentacion = Activity.objects.filter(
                    stage=stage_1,
                    name__icontains='Presentaci',
                    is_active=True
                ).first()
            
            if presentacion and presentacion.order_number != 4:
                # Verificar que no haya otra actividad en 4
                conflict_4 = Activity.objects.filter(
                    stage=stage_1,
                    order_number=4,
                    is_active=True
                ).exclude(id=presentacion.id).first()
                
                if conflict_4:
                    # Si hay conflicto, mover la actividad en 4 a 5
                    conflict_4.order_number = 5
                    conflict_4.save()
                
                presentacion.order_number = 4
                presentacion.save()
            
            # Verificar una última vez que no haya actividad en order_number=2
            existing_activity_2 = Activity.objects.filter(
                stage=stage_1,
                order_number=2,
                is_active=True
            ).exclude(name__icontains='Instructivo').first()
            
            if existing_activity_2:
                # Si todavía hay una actividad en 2, moverla a un número más alto
                existing_activity_2.order_number = 5
                existing_activity_2.save()
            
            # Ahora crear Instructivo con order_number 2
            instructivo_activity = Activity.objects.create(
                stage=stage_1,
                activity_type=instructivo_type,
                name='Instructivo',
                description='Instructivo del juego - Instrucciones para los estudiantes',
                order_number=2,
                is_active=True
            )
        
        # Establecer SOLO current_activity (NO current_stage, NO SessionStage)
        # El Instructivo es previo a las etapas, igual que Video Institucional
        game_session.current_activity = instructivo_activity
        # NO establecer current_stage - permanece None hasta que se inicie la Etapa 1
        game_session.save()
        
        # Refrescar desde la base de datos
        game_session.refresh_from_db()
        
        serializer = self.get_serializer(game_session)
        response_data = {
            **serializer.data,
            'message': 'Actividad Instructivo establecida',
            'current_activity_name': instructivo_activity.name,
            'current_activity_id': instructivo_activity.id,
            'current_stage_number': None,  # No hay etapa aún
            'current_stage_name': None
        }
        
        return Response(response_data)

    @action(detail=True, methods=['post'], parser_classes=[JSONParser])
    def complete_stage(self, request, pk=None):
        """
        Completar manualmente la etapa actual (usado cuando el profesor va a resultados)
        Esto limpia current_activity y marca la etapa como completada
        """
        try:
            print(f'[Backend complete_stage] INICIANDO - Session ID: {pk}')
            print(f'   - Timestamp: {timezone.now().isoformat()}')
            print(f'   - Request data: {request.data}')
        except:
            pass
        
        game_session = self.get_object()
        
        try:
            print(f'[Backend complete_stage] Estado inicial del juego:', {
            'session_id': game_session.id,
            'status': game_session.status,
            'current_stage_id': game_session.current_stage.id if game_session.current_stage else None,
            'current_stage_number': game_session.current_stage.number if game_session.current_stage else None,
            'current_activity_id': game_session.current_activity.id if game_session.current_activity else None,
            'current_activity_name': game_session.current_activity.name if game_session.current_activity else None
            })
        except:
            pass
        
        if game_session.status != 'running':
            try:
                print(f'[Backend complete_stage] Error: Sesion no esta en estado running')
            except:
                pass
            return Response(
                {'error': 'La sesion debe estar en estado running'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not game_session.current_stage:
            try:
                print(f'[Backend complete_stage] Error: No hay etapa actual')
            except:
                pass
            return Response(
                {'error': 'No hay etapa actual establecida'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        stage_id = request.data.get('stage_id')
        # Aceptar tanto stage_id (ID numérico) como stage_number (número de etapa)
        stage_number = request.data.get('stage_number')
        
        # Si se envía stage_number, verificar que coincida con el número de etapa actual
        if stage_number:
            if game_session.current_stage.number != stage_number:
                try:
                    print(f'[Backend complete_stage] Error: stage_number no coincide')
                    print(f'   - stage_number recibido: {stage_number}')
                    print(f'   - current_stage.number: {game_session.current_stage.number}')
                except:
                    pass
                return Response(
                    {'error': 'El stage_number no coincide con la etapa actual'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        # Si se envía stage_id, verificar que coincida con el ID de etapa actual
        elif stage_id and game_session.current_stage.id != stage_id:
            try:
                print(f'[Backend complete_stage] Error: stage_id no coincide')
                print(f'   - stage_id recibido: {stage_id}')
                print(f'   - current_stage.id: {game_session.current_stage.id}')
            except:
                pass
            return Response(
                {'error': 'El stage_id no coincide con la etapa actual'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .models import SessionStage, Team, TeamActivityProgress
        
        # Obtener o crear session_stage
        session_stage = SessionStage.objects.filter(
            game_session=game_session,
            stage=game_session.current_stage
        ).first()
        
        try:
            print(f'[Backend complete_stage] SessionStage encontrado:', {
                'session_stage_id': session_stage.id if session_stage else None,
                'status_actual': session_stage.status if session_stage else None,
                'completed_at_actual': session_stage.completed_at if session_stage else None
            })
        except:
            pass
        
        if not session_stage:
            try:
                print(f'[Backend complete_stage] Creando nuevo SessionStage...')
            except:
                pass
            session_stage = SessionStage.objects.create(
                game_session=game_session,
                stage=game_session.current_stage,
                status='completed',
                completed_at=timezone.now()
            )
            try:
                print(f'[Backend complete_stage] SessionStage creado con status=completed')
            except:
                pass
        else:
            # Marcar la etapa como completada
            try:
                print(f'[Backend complete_stage] Actualizando SessionStage existente...')
                print(f'   - Status anterior: {session_stage.status}')
            except:
                pass
            session_stage.status = 'completed'
            if not session_stage.completed_at:
                session_stage.completed_at = timezone.now()
            session_stage.save()
            try:
                print(f'[Backend complete_stage] SessionStage actualizado:', {
                    'status': session_stage.status,
                    'completed_at': session_stage.completed_at.isoformat() if session_stage.completed_at else None
                })
            except:
                pass
        
        # Si hay una actividad actual, marcarla como completada para todos los equipos
        if game_session.current_activity:
            current_activity = game_session.current_activity
            try:
                print(f'[Backend complete_stage] Marcando actividad actual como completada para todos los equipos...')
                print(f'   - Actividad: {current_activity.name} (ID: {current_activity.id})')
                teams = Team.objects.filter(game_session=game_session)
                print(f'   - Total equipos: {teams.count()}')
            except:
                teams = Team.objects.filter(game_session=game_session)
            
            for team in teams:
                progress, created = TeamActivityProgress.objects.get_or_create(
                    team=team,
                    activity=current_activity,
                    session_stage=session_stage,
                    defaults={
                        'status': 'completed',
                        'progress_percentage': 100,
                        'completed_at': timezone.now()
                    }
                )
                if not created:
                    # Si ya existía, actualizar a completado
                    progress.status = 'completed'
                    progress.progress_percentage = 100
                    if not progress.completed_at:
                        progress.completed_at = timezone.now()
                    progress.save()
                try:
                    print(f'   - Equipo {team.id} ({team.name}): {"Creado" if created else "Actualizado"}')
                except:
                    pass
        
        # Limpiar current_activity para indicar que estamos en resultados
        try:
            print(f'[Backend complete_stage] Limpiando current_activity...')
            print(f'   - current_activity ANTES: {game_session.current_activity.id if game_session.current_activity else None}')
        except:
            pass
        game_session.current_activity = None
        
        # NO finalizar automáticamente la sala cuando se completa la etapa 4
        # La sala se finaliza manualmente en reflexión
        # Si se completó la etapa 4, solo marcar la etapa como completada, NO finalizar la sala
        if game_session.current_stage and game_session.current_stage.number == 4:
            try:
                print(f'[Backend complete_stage] Etapa 4 completada - NO finalizando sala automáticamente (se finaliza en reflexión)')
            except:
                pass
        
        game_session.save()
        try:
            print(f'   - current_activity DESPUES: {game_session.current_activity}')
            print(f'[Backend complete_stage] current_activity limpiado correctamente')
        except:
            pass
        
        # Refrescar para obtener datos actualizados
        game_session.refresh_from_db()
        
        serializer = self.get_serializer(game_session)
        response_data = {
            **serializer.data,
            'stage_completed': True,
            'stage_id': game_session.current_stage.id,
            'stage_name': game_session.current_stage.name,
            'stage_number': game_session.current_stage.number,
            'message': f'Etapa {game_session.current_stage.number} completada. Mostrando resultados...'
        }
        
        try:
            print(f'[Backend complete_stage] COMPLETADO - Respuesta:', {
                'stage_completed': response_data['stage_completed'],
                'stage_id': response_data['stage_id'],
                'stage_number': response_data['stage_number'],
                'current_activity': response_data.get('current_activity'),
                'current_activity_name': response_data.get('current_activity_name')
            })
            print(f'   - Las tablets deberian detectar current_activity=None en el proximo polling')
        except:
            pass
        
        return Response(response_data)

    @action(detail=True, methods=['get'], permission_classes=[], authentication_classes=[])
    def activity_timer(self, request, pk=None):
        """
        Obtener información del temporizador de la actividad actual
        Endpoint centralizado para sincronización de temporizadores
        Permite acceso sin autenticación para tablets
        """
        try:
            # Obtener sesión directamente sin verificar permisos
            try:
                game_session = GameSession.objects.get(id=pk)
            except GameSession.DoesNotExist:
                return Response(
                    {'error': 'Sesión no encontrada'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            if not game_session.current_activity:
                return Response(
                    {'error': 'No hay actividad actual'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            activity = game_session.current_activity
            
            # Manejar timer_duration de forma segura (puede ser None)
            timer_duration = getattr(activity, 'timer_duration', None)
            
            # Obtener el started_at más temprano de todos los equipos para esta actividad
            from .models import SessionStage, TeamActivityProgress
            session_stage = None
            if game_session.current_stage:
                session_stage = SessionStage.objects.filter(
                    game_session=game_session,
                    stage=game_session.current_stage
                ).first()
            
            earliest_start = None
            if session_stage:
                try:
                    progress_list = TeamActivityProgress.objects.filter(
                        activity=activity,
                        session_stage=session_stage
                    ).exclude(started_at__isnull=True).order_by('started_at')
                    
                    if progress_list.exists():
                        earliest_start = progress_list.first().started_at
                except Exception as e:
                    print(f"Error obteniendo progress_list: {e}")
            
            # Si no hay started_at, usar el started_at de la sesión
            if not earliest_start and game_session.started_at:
                earliest_start = game_session.started_at

            remaining_seconds = None
            now = timezone.now()
            if timer_duration is not None and earliest_start:
                elapsed_seconds = int((now - earliest_start).total_seconds())
                remaining_seconds = max(0, timer_duration - elapsed_seconds)

            return Response({
                'activity_id': activity.id,
                'activity_name': activity.name,
                'timer_duration': timer_duration,  # En segundos (puede ser None)
                'started_at': earliest_start.isoformat() if earliest_start else None,
                'current_time': now.isoformat(),
                'remaining_seconds': remaining_seconds
            })
        except Exception as e:
            import traceback
            print(f"Error en activity_timer: {e}")
            print(traceback.format_exc())
            return Response(
                {'error': f'Error interno del servidor: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'], permission_classes=[], authentication_classes=[])
    def stage_results(self, request, pk=None):
        """
        Obtener resultados de una etapa completada
        Permite acceso sin autenticación para tablets
        """
        # Obtener sesión directamente sin verificar permisos
        try:
            game_session = GameSession.objects.get(id=pk)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        stage_id = request.query_params.get('stage_id')
        
        if not stage_id:
            # Si no se especifica stage_id, usar la etapa actual
            if not game_session.current_stage:
                return Response(
                    {'error': 'No hay etapa actual establecida'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            stage_id = game_session.current_stage.id
        
        from challenges.models import Stage
        from .models import SessionStage, Team, TokenTransaction
        
        try:
            stage = Stage.objects.get(id=stage_id)
        except Stage.DoesNotExist:
            return Response(
                {'error': 'Etapa no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener SessionStage para esta etapa
        session_stage = SessionStage.objects.filter(
            game_session=game_session,
            stage=stage
        ).first()
        
        if not session_stage:
            return Response(
                {'error': 'No se encontró información de esta etapa para esta sesión'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener todos los equipos con su personalización
        teams = Team.objects.filter(game_session=game_session).select_related('personalization')
        
        # Calcular resultados para cada equipo
        results = []
        for team in teams:
            # Tokens ganados en esta etapa
            from django.db.models import Sum
            stage_tokens = TokenTransaction.objects.filter(
                team=team,
                game_session=game_session,
                session_stage=session_stage
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            # Tokens totales acumulados
            total_tokens = team.tokens_total
            
            # Progreso de actividades en esta etapa
            from .models import TeamActivityProgress
            from challenges.models import Activity
            activities = Activity.objects.filter(stage=stage, is_active=True).order_by('order_number')
            
            activities_progress = []
            for activity in activities:
                progress = TeamActivityProgress.objects.filter(
                    team=team,
                    activity=activity,
                    session_stage=session_stage
                ).first()
                
                # Si no hay progreso pero la etapa está completada, considerar todas las actividades como completadas
                # Si hay progreso, usar su estado real
                if progress:
                    activity_status = progress.status
                    progress_percentage = progress.progress_percentage
                    completed_at = progress.completed_at.isoformat() if progress.completed_at else None
                else:
                    # Si no hay registro de progreso pero estamos en resultados de etapa completada,
                    # considerar como completada (puede que no se haya registrado correctamente)
                    if session_stage.status == 'completed':
                        activity_status = 'completed'
                        progress_percentage = 100
                        completed_at = None
                    else:
                        activity_status = 'pending'
                        progress_percentage = 0
                        completed_at = None
                
                activities_progress.append({
                    'activity_id': activity.id,
                    'activity_name': activity.name,
                    'status': activity_status,
                    'progress_percentage': progress_percentage,
                    'completed_at': completed_at
                })
            
            # Obtener el nombre personalizado si existe, sino usar el nombre del equipo
            personalized_name = team.name  # Por defecto: "Equipo Rojo", "Equipo Verde", etc.
            try:
                # Intentar acceder a la personalización (OneToOneField)
                if hasattr(team, 'personalization'):
                    personalization = getattr(team, 'personalization', None)
                    if personalization and personalization.team_name:
                        personalized_name = personalization.team_name
            except Exception as e:
                # Si no hay personalización o hay algún error, usar el nombre del equipo
                pass
            
            results.append({
                'team_id': team.id,
                'team_name': personalized_name,
                'team_color': team.color,
                'tokens_stage': stage_tokens,
                'tokens_total': total_tokens,
                'activities_progress': activities_progress
            })
        
        # Ordenar por tokens totales (ranking)
        results.sort(key=lambda x: x['tokens_total'], reverse=True)
        
        return Response({
            'stage_id': stage.id,
            'stage_name': stage.name,
            'stage_number': stage.number,
            'session_stage_id': session_stage.id,
            'session_stage_status': session_stage.status,
            'session_stage_completed_at': session_stage.completed_at.isoformat() if session_stage.completed_at else None,
            'teams_results': results
        })

    @action(detail=True, methods=['post'], parser_classes=[JSONParser])
    def next_stage(self, request, pk=None):
        """
        Avanzar a la siguiente etapa
        """
        game_session = self.get_object()
        
        if game_session.status != 'running':
            return Response(
                {'error': 'La sesión debe estar en estado running'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not game_session.current_stage:
            return Response(
                {'error': 'No hay etapa actual establecida'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from challenges.models import Stage
        current_stage_number = game_session.current_stage.number
        next_stage = Stage.objects.filter(
            number=current_stage_number + 1,
            is_active=True
        ).first()
        
        if not next_stage:
            return Response(
                {'error': 'No hay más etapas disponibles'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Actualizar etapa actual
        game_session.current_stage = next_stage

        # Obtener la primera actividad de la nueva etapa
        from challenges.models import Activity
        first_activity = Activity.objects.filter(
            stage=next_stage,
            is_active=True
        ).order_by('order_number').first()

        if first_activity:
            game_session.current_activity = first_activity
        else:
            game_session.current_activity = None

        game_session.show_results_stage = 0
        game_session.save()
        
        # Crear SessionStage para la nueva etapa
        from .models import SessionStage, Team, TeamActivityProgress
        session_stage, created = SessionStage.objects.get_or_create(
            game_session=game_session,
            stage=next_stage,
            defaults={
                'status': 'in_progress',
                'started_at': timezone.now()
            }
        )
        
        # Si la etapa ya existía pero estaba completada, actualizar su estado
        if not created and session_stage.status == 'completed':
            session_stage.status = 'in_progress'
            session_stage.completed_at = None
            session_stage.save()
        
        # Si hay una primera actividad, inicializar started_at para todos los equipos
        if first_activity:
            teams = Team.objects.filter(game_session=game_session)
            for team in teams:
                progress, created = TeamActivityProgress.objects.get_or_create(
                    team=team,
                    activity=first_activity,
                    session_stage=session_stage,
                    defaults={
                        'status': 'in_progress',
                        'started_at': timezone.now(),
                        'progress_percentage': 0
                    }
                )
                # Si ya existía, actualizar started_at si no tenía
                if not created and not progress.started_at:
                    progress.started_at = timezone.now()
                    progress.status = 'in_progress'
                    progress.save()
        
        game_session.refresh_from_db()
        game_session = GameSession.objects.select_related(
            'current_stage', 'current_activity'
        ).get(id=game_session.id)
        
        serializer = self.get_serializer(game_session)
        return Response({
            **serializer.data,
            'message': f'Avanzando a Etapa {next_stage.number}: {next_stage.name}',
            'next_stage_number': next_stage.number
        })

    @action(detail=True, methods=['post'], parser_classes=[JSONParser])
    def show_results(self, request, pk=None):
        """
        Activar/desactivar la pantalla de resultados en tablets.
        Payload: {"stage": 1-4} para activar, {"stage": 0} para limpiar.
        """
        game_session = self.get_object()
        stage = request.data.get('stage', 0)
        try:
            stage = int(stage)
        except (TypeError, ValueError):
            return Response({'error': 'stage debe ser un entero 0-4'}, status=status.HTTP_400_BAD_REQUEST)
        if stage < 0 or stage > 4:
            return Response({'error': 'stage debe estar entre 0 y 4'}, status=status.HTTP_400_BAD_REQUEST)
        game_session.show_results_stage = stage
        game_session.save(update_fields=['show_results_stage'])
        return Response({'show_results_stage': game_session.show_results_stage})

    @action(detail=True, methods=['post'], parser_classes=[JSONParser])
    def end(self, request, pk=None):
        """Finalizar una sesión de juego manualmente"""
        game_session = self.get_object()
        
        # Verificar si estamos en reflexión
        from .models import SessionStage
        from challenges.models import Stage
        stage_4 = Stage.objects.filter(number=4, is_active=True).first()
        in_reflection = False
        if stage_4:
            session_stage = SessionStage.objects.filter(
                game_session=game_session,
                stage=stage_4
            ).first()
            if session_stage and session_stage.presentation_timestamps:
                in_reflection = session_stage.presentation_timestamps.get('_reflection', False)
        
        # Permitir finalizar si está en lobby, running, o en reflexión
        if game_session.status not in ['lobby', 'running', 'completed'] and not in_reflection:
            return Response(
                {'error': 'La sesión no está activa'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Obtener motivo de cancelación del request
        cancellation_reason = request.data.get('cancellation_reason', '')
        cancellation_reason_other = request.data.get('cancellation_reason_other', '')
        
        # Si está en reflexión, usar valores por defecto si no se proporcionan
        if in_reflection:
            if not cancellation_reason:
                cancellation_reason = 'Finalización normal'
            if not cancellation_reason_other:
                cancellation_reason_other = 'Sesión completada después de reflexión'
        else:
            # Validar que se proporcione un motivo solo si NO está en reflexión
            if not cancellation_reason:
                return Response(
                    {'error': 'Debe proporcionar un motivo de cancelación'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Si el motivo es "Otro", validar que se proporcione la descripción
            if cancellation_reason == 'Otro' and not cancellation_reason_other:
                return Response(
                    {'error': 'Debe proporcionar una descripción cuando selecciona "Otro"'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Si estamos en reflexión, NO desconectar las tablets automáticamente
        # Las tablets deben permanecer en la pantalla de reflexión para que los estudiantes completen la encuesta
        tablets_disconnected = 0
        if not in_reflection:
            # Solo desconectar tablets si NO estamos en reflexión
            from .models import TabletConnection
            active_connections = TabletConnection.objects.filter(
                game_session=game_session,
                disconnected_at__isnull=True
            )
            
            disconnect_time = timezone.now()
            for connection in active_connections:
                connection.disconnected_at = disconnect_time
                connection.save()
            tablets_disconnected = active_connections.count()
        
        # Marcar como completada (no cancelada) si está en reflexión
        if in_reflection:
            game_session.status = 'completed'
        else:
            game_session.status = 'cancelled'
        
        game_session.ended_at = timezone.now()
        game_session.cancellation_reason = cancellation_reason
        if cancellation_reason == 'Otro':
            game_session.cancellation_reason_other = cancellation_reason_other
        game_session.save()
        
        serializer = self.get_serializer(game_session)
        return Response({
            **serializer.data,
            'tablets_disconnected': tablets_disconnected,
            'in_reflection': in_reflection
        })

    @action(detail=False, methods=['get'])
    def active_session(self, request):
        """
        Obtener la(s) sesión(es) activa(s) del profesor (lobby o running)
        Puede retornar múltiples sesiones si están en un grupo
        Prioriza sesiones en estado 'running' sobre 'lobby'
        OPTIMIZADO: Una sola consulta con select_related y prefetch_related
        """
        try:
            professor = request.user.professor
        except Professor.DoesNotExist:
            return Response(
                {'error': 'El usuario no es un profesor'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Optimizar: Una sola consulta para ambas condiciones usando Q objects
        from django.db.models import Q
        
        # Buscar sesiones activas (running primero, luego lobby) con optimizaciones
        active_sessions = GameSession.objects.filter(
            professor=professor,
            status__in=['running', 'lobby']
        ).select_related(
            'professor__user', 
            'course', 
            'current_stage', 
            'current_activity',
            'session_group'
        ).prefetch_related(
            'teams'  # Prefetch teams para evitar consultas adicionales en teams_count
        ).order_by(
            '-status',  # 'running' antes que 'lobby' (orden alfabético inverso)
            '-created_at'
        )
        
        if not active_sessions.exists():
            return Response(
                {'active_session': None},
                status=status.HTTP_200_OK
            )
        
        # Obtener todas las sesiones activas
        sessions_list = list(active_sessions)
        
        # Si hay múltiples sesiones activas, retornar todas (independientemente del grupo)
        if len(sessions_list) > 1:
            # Ordenar: 'running' primero, luego 'lobby'
            sessions_list.sort(key=lambda s: (s.status != 'running', -s.created_at.timestamp() if s.created_at else 0))
            serializer = self.get_serializer(sessions_list, many=True)
            session_group = sessions_list[0].session_group if sessions_list else None
            return Response({
                'active_sessions': serializer.data,
                'session_group_id': session_group.id if session_group else None,
                'number_of_sessions': len(sessions_list)
            })
        elif len(sessions_list) == 1:
            # Una sola sesión activa
            serializer = self.get_serializer(sessions_list[0])
            return Response(serializer.data)
        else:
            # No hay sesión activa
            return Response(
                {'active_session': None},
                status=status.HTTP_200_OK
            )
    
    @action(detail=True, methods=['post'])
    def start_reflection(self, request, pk=None):
        """
        Marcar que estamos en fase de reflexión
        Esto permite que las tablets detecten que deben ir a reflexión
        Usamos presentation_timestamps como señal temporal
        IMPORTANTE: Al iniciar reflexión, la sala se marca como completada automáticamente
        """
        game_session = self.get_object()
        
        from .models import SessionStage
        from challenges.models import Stage
        
        # Obtener la etapa 4
        stage_4 = Stage.objects.filter(number=4, is_active=True).first()
        if not stage_4:
            return Response(
                {'error': 'No se encontró la Etapa 4'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener SessionStage para etapa 4
        session_stage = SessionStage.objects.filter(
            game_session=game_session,
            stage=stage_4
        ).first()
        
        if not session_stage:
            return Response(
                {'error': 'No se encontró la etapa 4 para esta sesión'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Usar presentation_timestamps como señal temporal para indicar reflexión
        if not session_stage.presentation_timestamps:
            session_stage.presentation_timestamps = {}
        
        # Agregar un flag especial para indicar reflexión
        session_stage.presentation_timestamps['_reflection'] = True
        session_stage.presentation_timestamps['_reflection_started_at'] = timezone.now().isoformat()
        session_stage.save()
        
        # Marcar la sala como completada automáticamente al iniciar reflexión
        # Esto permite que profesor y tablets permanezcan en reflexión sin redirigirse
        if game_session.status == 'running':
            game_session.status = 'completed'
            game_session.ended_at = timezone.now()
            game_session.save()
        
        return Response({
            'message': 'Fase de reflexión iniciada',
            'reflection_started': True,
            'session_completed': True
        })
    
    @action(detail=True, methods=['get'], permission_classes=[], authentication_classes=[])
    def reflection_qr(self, request, pk=None):
        """Generar QR para evaluación de reflexión"""
        try:
            # Obtener sesión directamente sin verificar permisos (para tablets)
            try:
                game_session = GameSession.objects.get(id=pk)
            except GameSession.DoesNotExist:
                return Response(
                    {'error': 'Sesión no encontrada'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # URL del formulario de evaluación
            base_url = request.build_absolute_uri('/').rstrip('/')
            # Usar la URL del frontend si está disponible, sino usar la base_url
            frontend_url = getattr(settings, 'FRONTEND_URL', base_url.replace(':8000', ':5173'))
            evaluation_url = f"{frontend_url}/evaluacion/{game_session.room_code}"
            
            # Generar QR
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(evaluation_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convertir a base64
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            qr_code = f"data:image/png;base64,{img_str}"
            
            return Response({
                'qr_code': qr_code,
                'evaluation_url': evaluation_url,
                'room_code': game_session.room_code
            })
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Error generando QR de reflexión: {str(e)}')
            return Response(
                {'error': f'Error al generar QR: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def teams(self, request, pk=None):
        """Obtener equipos de una sesión"""
        game_session = self.get_object()
        teams = game_session.teams.all()
        serializer = TeamSerializer(teams, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], permission_classes=[], authentication_classes=[])
    def lobby(self, request, pk=None):
        """
        Obtener información completa del lobby de una sesión
        Incluye: equipos, estudiantes, tablets conectadas, código QR
        No requiere autenticación (accesible para tablets)
        Funciona si la sesión está en estado 'lobby', 'running', 'finished' o 'completed'
        (permite acceso en reflexión aunque la sesión esté finalizada)
        """
        # Obtener sesión directamente sin verificar permisos
        try:
            game_session = GameSession.objects.get(id=pk)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Permitir acceso si la sesión está activa o finalizada (necesario para reflexión)
        # Solo bloquear si está en un estado inválido
        if game_session.status not in ['lobby', 'running', 'finished', 'completed']:
            return Response(
                {
                    'error': 'Estado de sesión inválido',
                    'status': game_session.status
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Obtener equipos con estudiantes
        teams = game_session.teams.prefetch_related('students', 'tablet_connections__tablet').all()
        team_serializer = TeamSerializer(teams, many=True)
        
        # Obtener conexiones de tablets activas
        tablet_connections = game_session.tablet_connections.filter(disconnected_at__isnull=True)
        tablet_serializer = TabletConnectionSerializer(tablet_connections, many=True)
        
        # Verificar si todas las tablets están conectadas
        all_teams_have_tablets = all(
            team.tablet_connections.filter(disconnected_at__isnull=True).exists()
            for team in teams
        )
        
        # Serializar sesión
        session_serializer = GameSessionSerializer(game_session)
        
        return Response({
            'game_session': session_serializer.data,
            'teams': team_serializer.data,
            'tablet_connections': tablet_serializer.data,
            'all_teams_connected': all_teams_have_tablets,
            'total_teams': teams.count(),
            'connected_teams': sum(1 for team in teams if team.tablet_connections.filter(disconnected_at__isnull=True).exists())
        })

    @action(detail=True, methods=['get'], url_path='etapa/(?P<etapa_id>[^/.]+)')
    def etapa(self, request, pk=None, etapa_id=None):
        """
        Obtener detalles de una etapa y sus actividades para una sesión dada.
        Retorna 404 controlado si la etapa no existe o no está vinculada a la sesión.
        """
        try:
            game_session = GameSession.objects.get(id=pk)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada.'},
                status=status.HTTP_404_NOT_FOUND
            )

        from challenges.models import Stage
        from challenges.serializers import ActivitySerializer

        try:
            etapa = Stage.objects.get(id=etapa_id)
        except Stage.DoesNotExist:
            return Response(
                {'error': 'La etapa solicitada no ha sido creada o no existe en esta sesión.'},
                status=status.HTTP_404_NOT_FOUND
            )

        actividades = etapa.activities.filter(is_active=True).order_by('order_number')
        serializer = ActivitySerializer(actividades, many=True)

        return Response({
            'etapa_id': etapa.id,
            'etapa_nombre': etapa.name,
            'actividades': serializer.data,
        })


class TeamViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Equipos
    """
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['game_session', 'color']
    search_fields = ['name', 'game_session__room_code']

    def get_queryset(self):
        queryset = Team.objects.select_related('game_session').prefetch_related('students')
        game_session_id = self.request.query_params.get('game_session')
        if game_session_id:
            queryset = queryset.filter(game_session_id=game_session_id)
        return queryset

    @action(detail=True, methods=['post'])
    def move_student(self, request, pk=None):
        """
        Mover un estudiante de un equipo a otro
        
        Requiere:
        - student_id: ID del estudiante a mover
        - target_team_id: ID del equipo destino
        """
        team = self.get_object()
        student_id = request.data.get('student_id')
        target_team_id = request.data.get('target_team_id')
        
        if not student_id or not target_team_id:
            return Response(
                {'error': 'Se requiere student_id y target_team_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            student = Student.objects.get(id=student_id)
            target_team = Team.objects.get(id=target_team_id)
        except (Student.DoesNotExist, Team.DoesNotExist):
            return Response(
                {'error': 'Estudiante o equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verificar que el estudiante esté en el equipo actual
        if not team.students.filter(id=student_id).exists():
            return Response(
                {'error': 'El estudiante no está en este equipo'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar que el equipo destino esté en la misma sesión
        if team.game_session != target_team.game_session:
            return Response(
                {'error': 'Los equipos deben estar en la misma sesión'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Mover estudiante
        TeamStudent.objects.filter(team=team, student=student).delete()
        TeamStudent.objects.get_or_create(team=target_team, student=student)
        
        # Serializar equipos actualizados
        team_serializer = TeamSerializer(team)
        target_team_serializer = TeamSerializer(target_team)
        
        return Response({
            'message': 'Estudiante movido exitosamente',
            'source_team': team_serializer.data,
            'target_team': target_team_serializer.data
        })

    @action(detail=False, methods=['post'])
    def shuffle_all(self, request):
        """
        Reorganizar todos los estudiantes de una sesión aleatoriamente
        Mantiene el número de equipos y el tamaño mínimo/máximo
        """
        game_session_id = request.data.get('game_session_id')
        if not game_session_id:
            return Response(
                {'error': 'Se requiere game_session_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            game_session = GameSession.objects.get(id=game_session_id)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener todos los estudiantes de la sesión
        all_students = list(
            Student.objects.filter(teams__game_session=game_session).distinct()
        )
        
        if not all_students:
            return Response(
                {'error': 'No hay estudiantes en esta sesión'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Obtener equipos existentes
        teams = list(game_session.teams.all())
        
        if not teams:
            return Response(
                {'error': 'No hay equipos en esta sesión'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Eliminar todas las asignaciones actuales
        TeamStudent.objects.filter(team__game_session=game_session).delete()
        
        # Mezclar estudiantes aleatoriamente
        random.shuffle(all_students)
        
        # Redistribuir estudiantes
        min_size = 3
        max_size = 8
        num_teams = len(teams)
        total_students = len(all_students)
        
        base_team_size = total_students // num_teams
        remainder = total_students % num_teams
        
        student_index = 0
        for i, team in enumerate(teams):
            current_team_size = base_team_size + (1 if i < remainder else 0)
            current_team_size = max(min_size, min(max_size, current_team_size))
            
            team_students = all_students[student_index:student_index + current_team_size]
            student_index += current_team_size
            
            # Asignar estudiantes al equipo
            for student in team_students:
                TeamStudent.objects.create(team=team, student=student)
        
        # Serializar equipos actualizados
        teams_serializer = TeamSerializer(teams, many=True)
        
        return Response({
            'message': 'Estudiantes reorganizados aleatoriamente',
            'teams': teams_serializer.data
        })


class TeamPersonalizationViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Personalización de Equipos
    """
    queryset = TeamPersonalization.objects.all()
    serializer_class = TeamPersonalizationSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = []  # No requerir autenticación (se controla con get_permissions)
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['team']

    def get_permissions(self):
        """
        Permite crear/actualizar/listar sin autenticación para tablets
        """
        if self.action in ['create', 'update', 'partial_update', 'list']:
            return []
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        """
        Crear o actualizar personalización (permite sin autenticación para tablets)
        """
        team_id = request.data.get('team')
        
        if not team_id:
            return Response(
                {'error': 'Se requiere team'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            team = Team.objects.get(id=team_id)
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Crear o actualizar personalización
        personalization, created = TeamPersonalization.objects.update_or_create(
            team=team,
            defaults={
                'team_name': request.data.get('team_name', ''),
                'team_members_know_each_other': request.data.get('team_members_know_each_other')
            }
        )
        
        serializer = self.get_serializer(personalization)
        
        if created:
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.data, status=status.HTTP_200_OK)


class SessionStageViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Etapas de Sesión
    """
    queryset = SessionStage.objects.all()
    serializer_class = SessionStageSerializer
    permission_classes = [IsAuthenticated]
    # NO establecer authentication_classes = [] a nivel de clase
    # Las acciones del profesor necesitan autenticación JWT
    # Las acciones de tablets tienen authentication_classes=[] en el decorador @action
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['game_session', 'stage', 'status']
    search_fields = ['game_session__room_code', 'stage__name']
    ordering_fields = ['started_at', 'completed_at']
    ordering = ['stage__number']

    def get_permissions(self):
        """
        Permite leer sin autenticación para tablets
        Permite marcar presentación como completada sin autenticación
        """
        if self.action in ['list', 'retrieve', 'presentation_status', 'mark_presentation_done']:
            return []
        return super().get_permissions()

    def get_queryset(self):
        return SessionStage.objects.select_related('game_session', 'stage')
    
    @action(detail=True, methods=['post'], authentication_classes=[JWTAuthentication, SessionAuthentication])
    def generate_presentation_order(self, request, pk=None):
        """
        Generar orden de presentación automáticamente (aleatorio) para la Etapa 4
        NO permite generar si ya están presentando
        """
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # CRÍTICO: No permitir generar si ya están presentando
        presentation_state = getattr(session_stage, 'presentation_state', 'not_started')
        if presentation_state != 'not_started' and session_stage.current_presentation_team_id:
            return Response(
                {'error': 'No se puede generar un nuevo orden mientras las presentaciones están en curso'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .models import Team
        import random
        
        teams = Team.objects.filter(game_session=session_stage.game_session)
        team_ids = list(teams.values_list('id', flat=True))
        
        # Generar orden aleatorio
        random.shuffle(team_ids)
        
        session_stage.presentation_order = team_ids
        session_stage.save()
        
        serializer = self.get_serializer(session_stage)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], authentication_classes=[JWTAuthentication, SessionAuthentication])
    def update_presentation_order(self, request, pk=None):
        """
        Actualizar el orden de presentación (el profesor puede reordenar)
        NO permite cambios si ya están presentando
        """
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # CRÍTICO: No permitir cambios si ya están presentando
        presentation_state = getattr(session_stage, 'presentation_state', 'not_started')
        if presentation_state != 'not_started' and session_stage.current_presentation_team_id:
            return Response(
                {'error': 'No se puede modificar el orden de presentación mientras las presentaciones están en curso'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        new_order = request.data.get('presentation_order')
        if not new_order or not isinstance(new_order, list):
            return Response(
                {'error': 'Se requiere presentation_order como array de IDs de equipos'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        session_stage.presentation_order = new_order
        session_stage.save()
        
        serializer = self.get_serializer(session_stage)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], authentication_classes=[JWTAuthentication, SessionAuthentication])
    def start_presentation(self, request, pk=None):
        """
        Iniciar las presentaciones (confirmar orden y comenzar con el primer equipo)
        """
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not session_stage.presentation_order:
            return Response(
                {'error': 'Primero debes generar o confirmar el orden de presentación'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Establecer el primer equipo como el que está presentando y cambiar estado a 'preparing'
        if len(session_stage.presentation_order) > 0:
            session_stage.current_presentation_team_id = session_stage.presentation_order[0]
            # Solo establecer presentation_state si el campo existe (migración aplicada)
            if hasattr(session_stage, 'presentation_state'):
                session_stage.presentation_state = 'preparing'  # Estado de preparación
            session_stage.save()
        
        serializer = self.get_serializer(session_stage)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], authentication_classes=[JWTAuthentication, SessionAuthentication])
    def next_presentation(self, request, pk=None):
        """
        Avanzar al siguiente equipo en el orden de presentación
        """
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not session_stage.presentation_order:
            return Response(
                {'error': 'No hay orden de presentación establecido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        current_index = None
        if session_stage.current_presentation_team_id:
            try:
                current_index = session_stage.presentation_order.index(session_stage.current_presentation_team_id)
            except ValueError:
                current_index = 0
        
        # Avanzar al siguiente
        if current_index is None or current_index < 0:
            next_index = 0
        else:
            next_index = current_index + 1
        
        if next_index >= len(session_stage.presentation_order):
            # Todas las presentaciones completadas
            session_stage.current_presentation_team_id = None
            if hasattr(session_stage, 'presentation_state'):
                session_stage.presentation_state = 'not_started'  # Ya no hay más presentaciones
        else:
            session_stage.current_presentation_team_id = session_stage.presentation_order[next_index]
            if hasattr(session_stage, 'presentation_state'):
                session_stage.presentation_state = 'preparing'  # Preparar al siguiente equipo
        
        session_stage.save()
        
        serializer = self.get_serializer(session_stage)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], authentication_classes=[JWTAuthentication, SessionAuthentication])
    def start_team_pitch(self, request, pk=None):
        """
        Iniciar el pitch del equipo actual (cambiar estado a 'presenting' e iniciar temporizador de 3 minutos)
        """
        from django.utils import timezone
        
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not session_stage.current_presentation_team_id:
            return Response(
                {'error': 'No hay un equipo presentando actualmente'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar estado si el campo existe (migración aplicada)
        if hasattr(session_stage, 'presentation_state') and session_stage.presentation_state != 'preparing':
            return Response(
                {'error': 'El equipo no está en estado de preparación'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Cambiar estado a 'presenting' e iniciar temporizador
        if hasattr(session_stage, 'presentation_state'):
            session_stage.presentation_state = 'presenting'
        
        # Guardar timestamp de inicio de presentación en un campo JSONField
        # Usaremos presentation_order como almacenamiento temporal, o mejor crear un nuevo campo
        # Por ahora, guardaremos en un diccionario usando el campo JSONField existente
        # Necesitamos un campo específico, pero usaremos presentation_order temporalmente
        # O mejor, guardar en un campo separado si existe
        
        # Guardar el timestamp de inicio de la presentación actual
        presentation_started_at = timezone.now()
        
        # Guardar el timestamp en presentation_timestamps (JSONField)
        if not hasattr(session_stage, 'presentation_timestamps') or session_stage.presentation_timestamps is None:
            session_stage.presentation_timestamps = {}
        
        team_id = session_stage.current_presentation_team_id
        session_stage.presentation_timestamps[str(team_id)] = presentation_started_at.isoformat()
        
        session_stage.save()
        
        serializer = self.get_serializer(session_stage)
        response_data = serializer.data
        # Agregar el timestamp de inicio en la respuesta
        
        # La duración de cada presentación individual es siempre 1:30 (90 segundos)
        # NO usar timer_duration de la actividad ya que puede ser para la duración total de la etapa
        presentation_duration = 90  # Siempre 1:30 minutos para cada presentación individual
        
        response_data['presentation_started_at'] = presentation_started_at.isoformat()
        response_data['presentation_duration'] = presentation_duration
        
        return Response(response_data)
    
    @action(detail=True, methods=['post'], authentication_classes=[JWTAuthentication, SessionAuthentication])
    def finish_team_presentation(self, request, pk=None):
        """
        Finalizar la presentación del equipo actual (cambiar estado a 'evaluating')
        """
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not session_stage.current_presentation_team_id:
            return Response(
                {'error': 'No hay un equipo presentando actualmente'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar estado si el campo existe (migración aplicada)
        if hasattr(session_stage, 'presentation_state') and session_stage.presentation_state != 'presenting':
            return Response(
                {'error': 'El equipo no está en estado de presentación'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Cambiar estado a 'evaluating'
        if hasattr(session_stage, 'presentation_state'):
            session_stage.presentation_state = 'evaluating'
        session_stage.save()
        
        serializer = self.get_serializer(session_stage)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], permission_classes=[], authentication_classes=[])
    def presentation_status(self, request, pk=None):
        """
        Obtener el estado actual de las presentaciones (para tablets)
        """
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .models import Team
        from challenges.models import Activity
        
        teams_data = []
        completed_team_ids = []
        
        # Obtener la actividad de presentación del pitch
        try:
            presentation_activity = Activity.objects.filter(
                stage__number=4,
                activity_type__name__icontains='presentación'
            ).first()
            
            if presentation_activity and session_stage.presentation_order:
                # Verificar qué equipos ya completaron su presentación
                completed_progress = TeamActivityProgress.objects.filter(
                    session_stage=session_stage,
                    activity=presentation_activity,
                    status='completed'
                ).values_list('team_id', flat=True)
                completed_team_ids = list(completed_progress)
        except Exception as e:
            print(f"Error al obtener equipos completados: {e}")
        
        if session_stage.presentation_order:
            for team_id in session_stage.presentation_order:
                try:
                    team = Team.objects.get(id=team_id)
                    teams_data.append({
                        'id': team.id,
                        'name': team.name,
                        'color': team.color
                    })
                except Team.DoesNotExist:
                    continue
        
        # Obtener prototipo y pitch del equipo que está presentando
        current_team_prototype = None
        current_team_pitch = None
        
        if session_stage.current_presentation_team_id:
            try:
                from .models import TeamActivityProgress
                current_team = Team.objects.get(id=session_stage.current_presentation_team_id)
                
                # Obtener actividad de prototipo (Etapa 3)
                prototype_activity = Activity.objects.filter(
                    stage__number=3,
                    activity_type__name__icontains='prototipo'
                ).first()
                
                # Obtener actividad de formulario pitch (Etapa 4)
                pitch_activity = Activity.objects.filter(
                    stage__number=4,
                    activity_type__name__icontains='formulario'
                ).first()
                
                # Obtener prototipo
                if prototype_activity:
                    prototype_progress = TeamActivityProgress.objects.filter(
                        team=current_team,
                        activity=prototype_activity,
                        session_stage__game_session=session_stage.game_session,
                        session_stage__stage__number=3
                    ).first()
                    
                    if prototype_progress and prototype_progress.prototype_image_url:
                        current_team_prototype = prototype_progress.prototype_image_url
                
                # Obtener pitch
                if pitch_activity:
                    pitch_progress = TeamActivityProgress.objects.filter(
                        team=current_team,
                        activity=pitch_activity,
                        session_stage=session_stage
                    ).first()
                    
                    if pitch_progress:
                        current_team_pitch = {
                            'intro_problem': pitch_progress.pitch_intro_problem or '',
                            'solution': pitch_progress.pitch_solution or '',
                            'value': pitch_progress.pitch_value or '',
                            'impact': pitch_progress.pitch_impact or '',
                            'closing': pitch_progress.pitch_closing or ''
                        }
            except Exception as e:
                print(f"Error obteniendo prototipo/pitch del equipo actual: {e}")
        
        response_data = {
            'presentation_order': session_stage.presentation_order,
            'current_presentation_team_id': session_stage.current_presentation_team_id,
            'teams': teams_data,
            'order_confirmed': session_stage.current_presentation_team_id is not None,  # True si las presentaciones comenzaron
            'completed_team_ids': completed_team_ids,  # Equipos que ya completaron su presentación
            'presentation_state': getattr(session_stage, 'presentation_state', 'not_started'),  # Estado actual: 'not_started', 'preparing', 'presenting', 'evaluating'
            'current_team_prototype': current_team_prototype,  # URL de la imagen del prototipo del equipo que presenta
            'current_team_pitch': current_team_pitch  # Guion del pitch del equipo que presenta
        }
        
        return Response(response_data)
    
    @action(detail=True, methods=['get'], permission_classes=[], authentication_classes=[])
    def presentation_timer(self, request, pk=None):
        """
        Obtener información del temporizador de la presentación actual (3 minutos)
        Endpoint para tablets y profesor para sincronizar el temporizador
        """
        from datetime import datetime
        
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not session_stage.current_presentation_team_id:
            return Response(
                {'error': 'No hay un equipo presentando actualmente'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Obtener el timestamp de inicio de la presentación del equipo actual
        team_id = str(session_stage.current_presentation_team_id)
        presentation_timestamps = getattr(session_stage, 'presentation_timestamps', None) or {}
        
        if team_id not in presentation_timestamps:
            return Response(
                {'error': 'La presentación aún no ha iniciado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parsear el timestamp
        try:
            started_at_str = presentation_timestamps[team_id]
            if isinstance(started_at_str, str):
                # Parsear ISO format string
                if 'T' in started_at_str:
                    started_at = datetime.fromisoformat(started_at_str.replace('Z', '+00:00'))
                else:
                    started_at = datetime.fromisoformat(started_at_str)
                # Convertir a timezone aware si no lo es
                if timezone.is_naive(started_at):
                    started_at = timezone.make_aware(started_at)
            else:
                started_at = started_at_str
        except Exception as e:
            return Response(
                {'error': f'Error al parsear timestamp: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # La duración de cada presentación individual es siempre 1:30 (90 segundos)
        # NO usar timer_duration de la actividad ya que puede ser para la duración total de la etapa
        duration_seconds = 90  # Siempre 1:30 minutos para cada presentación individual
        
        elapsed = (timezone.now() - started_at).total_seconds()
        remaining = max(0, duration_seconds - elapsed)
        
        return Response({
            'started_at': started_at.isoformat(),
            'timer_duration': duration_seconds,
            'remaining_seconds': int(remaining),
            'is_finished': remaining <= 0,
            'current_time': timezone.now().isoformat()
        })
    
    @action(detail=True, methods=['post'], permission_classes=[], authentication_classes=[])
    def mark_presentation_done(self, request, pk=None):
        """
        Marcar que un equipo completó su presentación (desde tablets)
        """
        team_id = request.data.get('team_id')
        activity_id = request.data.get('activity_id')
        
        if not team_id or not activity_id:
            return Response(
                {'error': 'Se requieren team_id y activity_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team
            from challenges.models import Activity
            
            team = Team.objects.get(id=team_id)
            activity = Activity.objects.get(id=activity_id)
            
            # Verificar que el equipo que está presentando es el correcto
            if session_stage.current_presentation_team_id != team_id:
                return Response(
                    {'error': 'No es tu turno de presentar'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Marcar la actividad de presentación como completada para este equipo
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=activity,
                session_stage=session_stage,
                defaults={
                    'status': 'completed',
                    'progress_percentage': 100,
                    'completed_at': timezone.now(),
                    'started_at': timezone.now()
                }
            )
            
            if not created:
                progress.status = 'completed'
                progress.progress_percentage = 100
                if not progress.completed_at:
                    progress.completed_at = timezone.now()
                if not progress.started_at:
                    progress.started_at = timezone.now()
                progress.save()
            
            serializer = TeamActivityProgressSerializer(progress)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'], permission_classes=[], authentication_classes=[])
    def presentation_evaluation_progress(self, request, pk=None):
        """
        Obtener el progreso de evaluaciones para el equipo que está presentando
        Devuelve cuántas evaluaciones se han completado y cuántas faltan
        """
        session_stage = self.get_object()
        
        if session_stage.stage.number != 4:
            return Response(
                {'error': 'Este endpoint solo está disponible para la Etapa 4'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not session_stage.current_presentation_team_id:
            return Response(
                {'error': 'No hay un equipo presentando actualmente'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, PeerEvaluation
            
            presenting_team_id = session_stage.current_presentation_team_id
            
            # Obtener todos los equipos de la sesión excepto el que está presentando
            all_teams = Team.objects.filter(game_session=session_stage.game_session)
            other_teams = all_teams.exclude(id=presenting_team_id)
            total_teams = other_teams.count()
            
            # Contar cuántas evaluaciones se han completado
            completed_evaluations = PeerEvaluation.objects.filter(
                evaluated_team_id=presenting_team_id,
                game_session=session_stage.game_session
            ).count()
            
            return Response({
                'completed': completed_evaluations,
                'total': total_teams,
                'presenting_team_id': presenting_team_id
            })
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Error obteniendo progreso de evaluaciones: {str(e)}')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TeamActivityProgressViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Progreso de Actividades de Equipos
    """
    queryset = TeamActivityProgress.objects.all()
    serializer_class = TeamActivityProgressSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = []  # No requerir autenticación (se controla con get_permissions)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['team', 'session_stage', 'activity', 'status']
    search_fields = ['team__name', 'activity__name']
    ordering_fields = ['started_at', 'completed_at', 'progress_percentage']
    ordering = ['-started_at']

    def get_permissions(self):
        """
        Permite crear/actualizar sin autenticación para tablets
        """
        if self.action in ['create', 'update', 'partial_update', 'list', 'submit_anagram', 'submit_word_search', 'select_topic', 'select_challenge', 'upload_prototype', 'save_pitch']:
            return []
        return super().get_permissions()
    
    def get_parsers(self):
        """
        Soporta FormData para subida de imágenes
        """
        # Verificar si action existe y es 'upload_prototype' o 'select_challenge'
        if hasattr(self, 'action') and self.action in ['upload_prototype', 'select_challenge']:
            return [MultiPartParser, FormParser]
        return super().get_parsers()

    def get_queryset(self):
        return TeamActivityProgress.objects.select_related(
            'team', 'session_stage__stage', 'activity', 'selected_topic', 'selected_challenge'
        )

    def create(self, request, *args, **kwargs):
        """
        Crear o actualizar progreso de actividad (permite sin autenticación para tablets)
        """
        team_id = request.data.get('team')
        activity_id = request.data.get('activity')
        session_stage_id = request.data.get('session_stage')
        status_value = request.data.get('status', 'pending')
        
        if not all([team_id, activity_id, session_stage_id]):
            return Response(
                {'error': 'Se requieren team, activity y session_stage'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, SessionStage
            from challenges.models import Activity
            
            team = Team.objects.get(id=team_id)
            activity = Activity.objects.get(id=activity_id)
            session_stage = SessionStage.objects.get(id=session_stage_id)
            
            # Obtener o crear progreso (manejar casos de duplicados)
            progress_list = TeamActivityProgress.objects.filter(
                team=team,
                activity=activity,
                session_stage=session_stage
            )
            
            if progress_list.exists():
                # Si hay registros existentes, usar el primero (o eliminar duplicados si hay más de uno)
                progress = progress_list.first()
                
                # Si hay más de un registro, eliminar los duplicados y mantener el mejor (completado > en progreso > pendiente)
                if progress_list.count() > 1:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f'Se encontraron {progress_list.count()} registros duplicados para TeamActivityProgress (team={team.id}, activity={activity.id}, session_stage={session_stage.id}). Eliminando duplicados...')
                    
                    # Priorizar el registro con mejor estado: completed > in_progress > submitted > pending
                    status_priority = {'completed': 4, 'in_progress': 3, 'submitted': 2, 'pending': 1}
                    best_progress = max(progress_list, key=lambda p: status_priority.get(p.status, 0))
                    
                    # Mantener el mejor registro
                    progress = best_progress
                    
                    # Eliminar los demás
                    ids_to_delete = list(progress_list.exclude(id=progress.id).values_list('id', flat=True))
                    TeamActivityProgress.objects.filter(id__in=ids_to_delete).delete()
                    logger.info(f'Eliminados {len(ids_to_delete)} registros duplicados. Mantenido registro ID {progress.id} con status {progress.status}')
                
                created = False
            else:
                # No existe, crear uno nuevo
                progress = TeamActivityProgress.objects.create(
                    team=team,
                    activity=activity,
                    session_stage=session_stage,
                    status=status_value,
                    started_at=timezone.now() if not request.data.get('started_at') else None
                )
                created = True
            
            # Actualizar el status y otros campos
            progress.status = status_value
            
            # Si el status es 'completed', establecer completed_at y otorgar tokens
            if status_value == 'completed':
                was_completed = progress.completed_at is not None
                if not progress.completed_at:
                    progress.completed_at = timezone.now()
                if progress.progress_percentage < 100:
                    progress.progress_percentage = 100
                
                # Otorgar tokens solo si no estaba completado antes (para evitar duplicados)
                # NOTA: Los tokens de la parte 1 se otorgan cuando se guarda part1_completed en response_data
                # No se otorgan aquí para evitar duplicados
                pass
            
            # Actualizar otros campos si se proporcionan
            if 'response_data' in request.data:
                new_response_data = request.data.get('response_data')
                old_response_data = progress.response_data or {}
                
                from .models import TokenTransaction
                
                # Verificar si se completó la parte 1 de presentación
                part1_completed = new_response_data.get('part1_completed')
                old_part1_completed = old_response_data.get('part1_completed')
                
                if part1_completed and not old_part1_completed:
                    # Se completó la parte 1, otorgar 5 tokens
                    tokens_to_award = 5
                    
                    # Verificar si ya se otorgaron tokens por la parte 1
                    existing_transaction = TokenTransaction.objects.filter(
                        team=team,
                        game_session=session_stage.game_session,
                        session_stage=session_stage,
                        source_type='activity',
                        source_id=activity.id,
                        reason__icontains='Parte 1'
                    ).exists()
                    
                    if not existing_transaction:
                        TokenTransaction.objects.create(
                            team=team,
                            game_session=session_stage.game_session,
                            session_stage=session_stage,
                            amount=tokens_to_award,
                            source_type='activity',
                            source_id=activity.id,
                            reason=f'Actividad "{activity.name}": Parte 1 completada',
                            awarded_by=None
                        )
                        
                        team.tokens_total += tokens_to_award
                        team.save()
                
                # Verificar si se completó el caos de presentación
                chaos_data = new_response_data.get('chaos', {})
                old_chaos_data = old_response_data.get('chaos', {})
                
                if chaos_data.get('completed') and not old_chaos_data.get('completed'):
                    # Se completó el caos, otorgar 5 tokens
                    tokens_to_award = 5
                    
                    # Verificar si ya se otorgaron tokens por el caos
                    existing_transaction = TokenTransaction.objects.filter(
                        team=team,
                        game_session=session_stage.game_session,
                        session_stage=session_stage,
                        source_type='activity',
                        source_id=activity.id,
                        reason__icontains='caos'
                    ).exists()
                    
                    if not existing_transaction:
                        TokenTransaction.objects.create(
                            team=team,
                            game_session=session_stage.game_session,
                            session_stage=session_stage,
                            amount=tokens_to_award,
                            source_type='activity',
                            source_id=activity.id,
                            reason=f'Actividad "{activity.name}": Preguntas del caos completadas',
                            awarded_by=None
                        )
                        
                        team.tokens_total += tokens_to_award
                        team.save()
                
                progress.response_data = new_response_data
                
            if 'progress_percentage' in request.data:
                progress.progress_percentage = request.data.get('progress_percentage')
            
            progress.save()
            
            serializer = self.get_serializer(progress)
            if created:
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.data, status=status.HTTP_200_OK)
                
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except SessionStage.DoesNotExist:
            return Response(
                {'error': 'Etapa de sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Error al crear/actualizar progreso: {e}')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def partial_update(self, request, *args, **kwargs):
        """
        Actualizar parcialmente el progreso (usado por update del frontend)
        Incluye lógica para detectar completado del caos y otorgar tokens
        """
        instance = self.get_object()
        old_response_data = instance.response_data or {}
        
        # Actualizar campos estándar
        if 'status' in request.data:
            instance.status = request.data.get('status')
            if instance.status == 'completed' and not instance.completed_at:
                instance.completed_at = timezone.now()
                if instance.progress_percentage < 100:
                    instance.progress_percentage = 100
        
        # Actualizar response_data si se proporciona
        if 'response_data' in request.data:
            new_response_data = request.data.get('response_data')
            
            # Verificar si se completó el caos de presentación
            chaos_data = new_response_data.get('chaos', {})
            old_chaos_data = old_response_data.get('chaos', {})
            
            if chaos_data.get('completed') and not old_chaos_data.get('completed'):
                # Se completó el caos, otorgar 5 tokens
                from .models import TokenTransaction
                tokens_to_award = 5
                
                # Verificar si ya se otorgaron tokens por el caos
                existing_transaction = TokenTransaction.objects.filter(
                    team=instance.team,
                    game_session=instance.session_stage.game_session,
                    session_stage=instance.session_stage,
                    source_type='activity',
                    source_id=instance.activity.id,
                    reason__icontains='caos'
                ).exists()
                
                if not existing_transaction:
                    TokenTransaction.objects.create(
                        team=instance.team,
                        game_session=instance.session_stage.game_session,
                        session_stage=instance.session_stage,
                        amount=tokens_to_award,
                        source_type='activity',
                        source_id=instance.activity.id,
                        reason=f'Actividad "{instance.activity.name}": Preguntas del caos completadas',
                        awarded_by=None
                    )
                    
                    instance.team.tokens_total += tokens_to_award
                    instance.team.save()
            
            # Actualizar response_data
            instance.response_data = new_response_data
        
        if 'progress_percentage' in request.data:
            instance.progress_percentage = request.data.get('progress_percentage')
        
        instance.save()
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def submit_anagram(self, request):
        """
        Endpoint para enviar respuestas del juego de anagramas
        No requiere autenticación (para tablets)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        team_id = request.data.get('team')
        activity_id = request.data.get('activity')
        session_stage_id = request.data.get('session_stage')
        answers = request.data.get('answers', [])  # Lista de respuestas: [{'word': 'emprender', 'answer': 'emprender'}, ...]
        
        logger.info(f'[submit_anagram] Datos recibidos: team={team_id}, activity={activity_id}, session_stage={session_stage_id}, answers={answers}')
        
        if not team_id:
            return Response(
                {'error': 'Se requiere team', 'received': {'team': team_id, 'activity': activity_id, 'session_stage': session_stage_id, 'answers': answers}},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not activity_id:
            return Response(
                {'error': 'Se requiere activity', 'received': {'team': team_id, 'activity': activity_id, 'session_stage': session_stage_id, 'answers': answers}},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not session_stage_id:
            return Response(
                {'error': 'Se requiere session_stage', 'received': {'team': team_id, 'activity': activity_id, 'session_stage': session_stage_id, 'answers': answers}},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not answers or len(answers) == 0:
            return Response(
                {'error': 'Se requiere answers (lista no vacía)', 'received': {'team': team_id, 'activity': activity_id, 'session_stage': session_stage_id, 'answers': answers}},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, SessionStage, TokenTransaction
            from challenges.models import Activity
            
            team = Team.objects.get(id=team_id)
            activity = Activity.objects.get(id=activity_id)
            session_stage = SessionStage.objects.get(id=session_stage_id)
            
            # Obtener tipo de minijuego del request PRIMERO (antes de obtener/crear el progreso)
            minigame_type = request.data.get('minigame_type', None)
            
            # Obtener o crear el progreso
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=activity,
                session_stage=session_stage,
                defaults={
                    'status': 'in_progress',
                    'started_at': timezone.now()
                }
            )
            
            # Permitir actualizar progreso incluso si está completado (para permitir correcciones o actualizaciones)
            # Solo bloquear si realmente no hay nada nuevo que agregar
            # (Esta verificación se hace más adelante en el código)
            
            # Si no hay minigame_type en el request, intentar obtenerlo del response_data existente
            if not minigame_type:
                existing_response_data = progress.response_data or {}
                minigame_type = existing_response_data.get('minigame_type', None)
            
            # Obtener palabras del anagrama con prioridad:
            # 1) Del request (si el frontend las envía)
            # 2) Del response_data guardado
            # 3) De la actividad (como último recurso)
            anagram_words_from_request = request.data.get('anagram_words', [])
            existing_response_data_for_words = progress.response_data or {}
            anagram_words_from_progress = existing_response_data_for_words.get('anagram_words', [])
            
            # Priorizar palabras del request, luego del progreso guardado
            if anagram_words_from_request:
                anagram_words_from_progress = anagram_words_from_request
                logger.info(f'[submit_anagram] Usando anagram_words del request: {len(anagram_words_from_progress)} palabras')
            elif not anagram_words_from_progress:
                # Si no hay palabras guardadas en el progreso, intentar obtenerlas de la actividad
                try:
                    # Obtener anagram_data de la actividad
                    anagram_data = activity.get_anagram_data(
                        count=5,
                        team_id=team.id,
                        session_stage_id=session_stage.id
                    )
                    if anagram_data and anagram_data.get('words'):
                        anagram_words_from_progress = [w.get('word', '').upper() if isinstance(w, dict) else str(w).upper() 
                                                      for w in anagram_data['words']]
                        logger.info(f'[submit_anagram] Obtenidas palabras desde actividad: {len(anagram_words_from_progress)} palabras')
                except Exception as e:
                    logger.warning(f'No se pudieron obtener palabras del anagrama desde la actividad: {e}')
            
            # Normalizar palabras para comparación
            normalized_words = [w.upper() if isinstance(w, str) else str(w).upper() 
                              for w in anagram_words_from_progress] if anagram_words_from_progress else []
            
            logger.info(f'[submit_anagram] normalized_words: {normalized_words}, count={len(normalized_words)}')
            
            # SIEMPRE usar 1 token por palabra (no usar tokens_per_word de la configuración)
            tokens_per_word = 1  # 1 token por palabra
            
            # Calcular el número esperado de palabras
            # Prioridad: 1) total_words enviado por el frontend, 2) palabras en configuración, 3) 3 como mínimo
            total_words_from_request = request.data.get('total_words')
            if total_words_from_request is not None and total_words_from_request > 0:
                # El frontend envía el número real de palabras generadas
                total_words_expected = int(total_words_from_request)
            elif normalized_words:
                total_words_expected = len(normalized_words)
            else:
                # Si no hay configuración, usar 3 como mínimo
                total_words_expected = 3
            
            # Obtener respuestas existentes o crear nuevas (MANTENER progreso de ambas partes)
            existing_response_data = progress.response_data or {}
            existing_answers = existing_response_data.get('answers', [])
            existing_found_words = existing_response_data.get('found_words', [])  # Mantener palabras de sopa de letras
            # PRESERVAR el total_words original de la sopa de letras si existe
            existing_total_words = existing_response_data.get('total_words')
            
            # Diccionario para fácil búsqueda de respuestas existentes
            existing_answers_dict = {a.get('word', '').upper(): a for a in existing_answers}
            
            # Actualizar respuestas existentes o agregar nuevas
            new_correct_answers = 0
            new_tokens = 0
            
            for answer_data in answers:
                word = answer_data.get('word', '').upper()
                answer = answer_data.get('answer', '').strip().upper()
                
                # Buscar si ya existe esta respuesta
                existing_answer = existing_answers_dict.get(word)
                
                # Verificar si la respuesta es correcta (la palabra coincide con la respuesta)
                # La validación principal es que word == answer (ambos en mayúsculas)
                # Si normalized_words está disponible y no está vacío, también verificar que la palabra esté en la lista
                # Si normalized_words está vacío, confiar en que word == answer es suficiente
                if len(normalized_words) > 0:
                    is_correct = (word == answer) and (word in normalized_words)
                else:
                    # Si no hay lista de palabras normalizadas, solo verificar que word == answer
                    is_correct = (word == answer)
                
                # Log para debugging
                logger.info(f'[submit_anagram] Validación: word={word}, answer={answer}, is_correct={is_correct}, normalized_words_count={len(normalized_words)}')
                
                # Si la respuesta es correcta pero no se detectó, intentar normalizar más
                if not is_correct and word.upper().strip() == answer.upper().strip():
                    logger.warning(f'[submit_anagram] Respuesta debería ser correcta pero no se detectó. Normalizando: word={word.upper().strip()}, answer={answer.upper().strip()}')
                    is_correct = True
                
                if is_correct:
                    # Verificar si es una nueva respuesta correcta
                    # Si no existe la respuesta o si existe pero estaba incorrecta, otorgar tokens
                    was_already_correct = existing_answer and existing_answer.get('answer', '').upper() == answer
                    
                    if not was_already_correct:
                        # Verificar si ya se otorgaron tokens para esta palabra específica
                        # Buscar transacciones que mencionen esta palabra específica en el reason
                        existing_transaction = TokenTransaction.objects.filter(
                            team=team,
                            game_session=session_stage.game_session,
                            session_stage=session_stage,
                            source_type='activity',
                            source_id=activity.id,
                            reason__icontains='anagrama'
                        ).filter(
                            reason__icontains=word
                        ).exists()
                        
                        if not existing_transaction:
                            # Otorgar tokens inmediatamente por cada palabra correcta nueva
                            new_correct_answers += 1
                            new_tokens += tokens_per_word
                            
                            # Crear transacción de tokens inmediatamente
                            TokenTransaction.objects.create(
                                team=team,
                                game_session=session_stage.game_session,
                                session_stage=session_stage,
                                amount=tokens_per_word,
                                source_type='activity',
                                source_id=activity.id,
                                reason=f'Actividad "{activity.name}": Palabra "{word}" correcta en anagrama',
                                awarded_by=None  # Sistema automático
                            )
                            
                            # Actualizar tokens del equipo inmediatamente
                            team.tokens_total += tokens_per_word
                            team.save()
                    
                    # Actualizar o agregar respuesta
                    if existing_answer:
                        existing_answer['answer'] = answer
                    else:
                        existing_answers.append({'word': word, 'answer': answer})
                        existing_answers_dict[word] = existing_answers[-1]
                else:
                    # Respuesta incorrecta o nueva
                    if existing_answer:
                        existing_answer['answer'] = answer
                    else:
                        existing_answers.append({'word': word, 'answer': answer})
                        existing_answers_dict[word] = existing_answers[-1]
            
            # Contar total de respuestas correctas del anagrama
            # IMPORTANTE: Si normalized_words está disponible y no está vacío, verificar que la palabra esté en la lista
            # Si normalized_words está vacío, solo verificar que word == answer
            total_correct_anagram = 0
            for a in existing_answers:
                word_upper = a.get('word', '').upper()
                answer_upper = a.get('answer', '').upper()
                is_match = word_upper == answer_upper
                
                if normalized_words:
                    # Si hay lista de palabras normalizadas, verificar que la palabra esté en la lista
                    in_list = word_upper in normalized_words
                    if is_match and in_list:
                        total_correct_anagram += 1
                        logger.debug(f'[submit_anagram] Contando respuesta correcta: word={word_upper}, answer={answer_upper}, in_normalized={in_list}')
                    elif is_match and not in_list:
                        logger.warning(f'[submit_anagram] Respuesta coincide pero no está en normalized_words: word={word_upper}, normalized_words={normalized_words}')
                else:
                    # Si no hay lista de palabras normalizadas, contar todas las respuestas donde word == answer
                    if is_match:
                        total_correct_anagram += 1
                        logger.debug(f'[submit_anagram] Contando respuesta correcta (sin normalized_words): word={word_upper}, answer={answer_upper}')
            
            logger.info(f'[submit_anagram] Total correctas calculadas: {total_correct_anagram} de {len(existing_answers)} respuestas')
            
            # Calcular tokens totales de ambas partes
            word_search_correct = len(existing_found_words)
            total_tokens_earned = (word_search_correct * tokens_per_word) + (total_correct_anagram * tokens_per_word)
            
            # Guardar datos de respuesta (MANTENER ambas partes)
            # IMPORTANTE: Usar campos separados para los totales de cada parte del minijuego
            existing_response_data_for_totals = progress.response_data or {}
            word_search_total_words = existing_response_data_for_totals.get('word_search_total_words')
            anagram_total_words = total_words_expected  # El total del anagrama viene del request o configuración
            
            # Si no existe word_search_total_words, preservar el total_words original si existe
            if word_search_total_words is None:
                word_search_total_words = existing_response_data_for_totals.get('total_words')
            
            # Preservar las palabras del anagrama guardadas (el frontend las guarda cuando las carga)
            # Prioridad: 1) Del request, 2) Del response_data guardado, 3) De las respuestas existentes
            anagram_words = request.data.get('anagram_words', [])
            if not anagram_words:
                anagram_words = existing_response_data_for_totals.get('anagram_words', [])
            if not anagram_words and existing_answers:
                # Si no hay palabras guardadas pero hay respuestas, extraer las palabras de las respuestas
                anagram_words = [a.get('word', '').upper() for a in existing_answers if a.get('word')]
                # Eliminar duplicados manteniendo el orden
                seen = set()
                anagram_words = [w for w in anagram_words if w and (w not in seen and not seen.add(w))]
            
            # Normalizar anagram_words para guardar
            if anagram_words:
                anagram_words = [w.upper() if isinstance(w, str) else str(w).upper() for w in anagram_words]
            
            # Guardar el índice actual del anagrama
            current_index = request.data.get('current_index')
            if current_index is None:
                # Si no se envía, calcular basado en respuestas correctas
                current_index = total_correct_anagram
            
            # Log para debugging
            logger.info(f'[submit_anagram] Guardando progreso: total_correct_anagram={total_correct_anagram}, existing_answers_count={len(existing_answers)}, anagram_total_words={anagram_total_words}, normalized_words_count={len(normalized_words)}')
            for idx, ans in enumerate(existing_answers):
                word_upper = ans.get("word", "").upper()
                answer_upper = ans.get("answer", "").upper()
                is_match = word_upper == answer_upper
                in_normalized = word_upper in normalized_words if normalized_words else True
                logger.debug(f'[submit_anagram] Respuesta {idx}: word={word_upper}, answer={answer_upper}, match={is_match}, in_normalized={in_normalized}, counted={is_match and (not normalized_words or in_normalized)}')
            
            progress.response_data = {
                'answers': existing_answers,
                'correct_answers': total_correct_anagram,
                'total_words': word_search_total_words,  # Mantener compatibilidad con código antiguo (usar word_search_total_words)
                'tokens_earned': total_tokens_earned,
                'minigame_type': minigame_type,  # Guardar tipo de minijuego (anagrama o word_search)
                'minigame_part': 'anagram',  # Parte 2: anagrama
                'found_words': existing_found_words,  # Mantener palabras de sopa de letras
                'word_search_words_found': word_search_correct,
                'anagram_words_found': total_correct_anagram,
                'word_search_total_words': word_search_total_words,  # Total de palabras para sopa de letras
                'anagram_total_words': anagram_total_words,  # Total de palabras para anagrama
                'anagram_words': anagram_words,  # Guardar las palabras del anagrama para mantener consistencia
                'anagram_current_index': current_index  # Guardar el índice actual del anagrama
            }
            
            # Log después de guardar
            logger.info(f'[submit_anagram] Progreso guardado: anagram_words_found={progress.response_data.get("anagram_words_found")}, anagram_total_words={progress.response_data.get("anagram_total_words")}')
            
            # Actualizar progreso (solo marcar como completado si ambas partes están completas)
            # Verificar si ambas partes están completas usando los totales específicos de cada parte
            both_parts_complete = (word_search_correct >= word_search_total_words) and (total_correct_anagram >= anagram_total_words)
            
            if both_parts_complete:
                progress.status = 'completed'
                progress.completed_at = timezone.now()
                progress.progress_percentage = 100
            else:
                progress.status = 'in_progress'
                # Calcular progreso total basado en ambas partes usando los totales específicos
                total_words_both_parts = word_search_total_words + anagram_total_words
                total_progress = ((word_search_correct + total_correct_anagram) / total_words_both_parts) * 100 if total_words_both_parts > 0 else 0
                progress.progress_percentage = int(total_progress)
            
            # Los tokens ya se otorgaron inmediatamente cuando se detectó cada respuesta correcta nueva (líneas 3119-3133)
            # No es necesario otorgarlos aquí de nuevo
            
            progress.save()
            
            # Recargar el equipo para obtener tokens actualizados
            team.refresh_from_db()
            
            serializer = self.get_serializer(progress)
            return Response({
                **serializer.data,
                'correct_answers': total_correct_anagram,
                'total_words': total_words_expected,
                'tokens_earned': new_tokens,  # Solo tokens ganados en este envío
                'team_tokens_total': team.tokens_total  # Tokens totales del equipo
            })
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except SessionStage.DoesNotExist:
            return Response(
                {'error': 'Etapa de sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def submit_word_search(self, request):
        """
        Endpoint para enviar palabras encontradas en la sopa de letras
        No requiere autenticación (para tablets)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        team_id = request.data.get('team')
        activity_id = request.data.get('activity')
        session_stage_id = request.data.get('session_stage')
        found_words = request.data.get('found_words', [])  # Lista de palabras encontradas: ['IDEA', 'META', ...]
        minigame_type = request.data.get('minigame_type', 'word_search')
        completed = request.data.get('completed', False)
        
        logger.info(f'[submit_word_search] Datos recibidos: team={team_id}, activity={activity_id}, session_stage={session_stage_id}, found_words={found_words}, completed={completed}')
        
        if not team_id:
            return Response(
                {'error': 'Se requiere team'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not activity_id:
            return Response(
                {'error': 'Se requiere activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not session_stage_id:
            return Response(
                {'error': 'Se requiere session_stage'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, SessionStage, TokenTransaction
            from challenges.models import Activity
            
            team = Team.objects.get(id=team_id)
            activity = Activity.objects.get(id=activity_id)
            session_stage = SessionStage.objects.get(id=session_stage_id)
            
            # Obtener o crear el progreso
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=activity,
                session_stage=session_stage,
                defaults={
                    'status': 'in_progress',
                    'started_at': timezone.now()
                }
            )
            
            if not created and progress.status == 'completed' and not completed:
                return Response(
                    {'error': 'Esta actividad ya fue completada'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Obtener configuración de la actividad
            config = activity.config_data or {}
            words_config = config.get('words', [])
            # SIEMPRE usar 1 token por palabra (no usar tokens_per_word de la configuración)
            tokens_per_word = 1  # 1 token por palabra encontrada
            
            # Normalizar palabras de la configuración
            normalized_config_words = []
            for w in words_config:
                if isinstance(w, dict):
                    normalized_config_words.append(w.get('word', '').upper())
                else:
                    normalized_config_words.append(str(w).upper())
            
            # Calcular el número esperado de palabras
            # Prioridad: 1) total_words enviado por el frontend, 2) palabras en configuración, 3) palabras encontradas o 3 como mínimo
            total_words_from_request = request.data.get('total_words')
            if total_words_from_request is not None and total_words_from_request > 0:
                # El frontend envía el número real de palabras generadas
                total_words_expected = int(total_words_from_request)
            elif normalized_config_words:
                total_words_expected = len(normalized_config_words)
            else:
                # Si no hay configuración, usar el número de palabras encontradas o 3 como mínimo
                total_words_expected = max(len(found_words) if found_words else 0, 3)
            
            # Normalizar palabras encontradas
            found_words_normalized = [w.upper().strip() for w in found_words if w and w.strip()]
            
            # Obtener respuestas existentes o crear nuevas (MANTENER progreso de ambas partes)
            existing_response_data = progress.response_data or {}
            existing_found_words = existing_response_data.get('found_words', [])
            existing_answers = existing_response_data.get('answers', [])  # Mantener respuestas del anagrama
            
            # Combinar palabras encontradas (sin duplicados)
            combined_found_words = list(set(existing_found_words + found_words_normalized))
            
            # Contar palabras correctas
            # IMPORTANTE: El frontend ya valida las palabras antes de enviarlas, así que todas las palabras
            # encontradas que se envían son correctas. Si hay configuración, verificamos contra ella,
            # pero si no hay configuración o las palabras no están en la configuración, aceptamos todas
            # las palabras encontradas como correctas (ya que el frontend las generó y validó)
            if normalized_config_words:
                # Verificar contra configuración, pero también aceptar palabras que no estén en la configuración
                # si fueron generadas por el frontend (esto permite flexibilidad cuando el frontend genera palabras por defecto)
                correct_words = [w for w in combined_found_words if w in normalized_config_words]
                # Si hay palabras encontradas que no están en la configuración, también son correctas
                # (el frontend las generó y validó)
                words_not_in_config = [w for w in combined_found_words if w not in normalized_config_words]
                if words_not_in_config:
                    correct_words.extend(words_not_in_config)
                # Eliminar duplicados
                correct_words = list(set(correct_words))
            else:
                # Si no hay configuración, todas las encontradas son correctas
                correct_words = combined_found_words
            
            total_correct_word_search = len(correct_words)
            
            # Calcular tokens ganados (solo para nuevas palabras)
            new_words = [w for w in found_words_normalized if w not in existing_found_words]
            new_correct_words = [w for w in new_words if w in correct_words]
            new_tokens = len(new_correct_words) * tokens_per_word
            
            # Calcular tokens totales de ambas partes
            anagram_correct = sum(1 for a in existing_answers 
                                if a.get('word', '').upper() == a.get('answer', '').upper())
            total_tokens_earned = (total_correct_word_search * tokens_per_word) + (anagram_correct * tokens_per_word)
            
            # Guardar datos de respuesta (MANTENER ambas partes)
            # IMPORTANTE: Usar campos separados para los totales de cada parte del minijuego
            existing_response_data_for_totals = progress.response_data or {}
            word_search_total_words = total_words_expected  # El total de la sopa de letras viene del request o configuración
            anagram_total_words = existing_response_data_for_totals.get('anagram_total_words')
            
            # Si no existe anagram_total_words, usar un valor por defecto (5) o preservar el total_words original si existe
            if anagram_total_words is None:
                anagram_total_words = existing_response_data_for_totals.get('total_words', 5)
            
            progress.response_data = {
                'found_words': combined_found_words,
                'correct_words': correct_words,
                'correct_answers': total_correct_word_search,
                'total_words': word_search_total_words,  # Mantener compatibilidad con código antiguo (usar word_search_total_words)
                'tokens_earned': total_tokens_earned,
                'minigame_type': minigame_type,
                'minigame_part': 'word_search',  # Parte 1: sopa de letras
                'answers': existing_answers,  # Mantener respuestas del anagrama
                'word_search_words_found': total_correct_word_search,
                'anagram_words_found': anagram_correct,
                'word_search_total_words': word_search_total_words,  # Total de palabras para sopa de letras
                'anagram_total_words': anagram_total_words  # Total de palabras para anagrama
            }
            
            # Actualizar progreso (solo marcar como completado si ambas partes están completas)
            # Verificar si ambas partes están completas usando los totales específicos de cada parte
            both_parts_complete = (total_correct_word_search >= word_search_total_words) and (anagram_correct >= anagram_total_words)
            
            if completed or both_parts_complete:
                progress.status = 'completed'
                progress.completed_at = timezone.now()
                progress.progress_percentage = 100
            else:
                progress.status = 'in_progress'
                # Calcular progreso total basado en ambas partes usando los totales específicos
                total_words_both_parts = word_search_total_words + anagram_total_words
                total_progress = ((total_correct_word_search + anagram_correct) / total_words_both_parts) * 100 if total_words_both_parts > 0 else 0
                progress.progress_percentage = int(total_progress)
            
            # Asignar tokens solo para nuevas palabras correctas
            if new_tokens > 0:
                TokenTransaction.objects.create(
                    team=team,
                    game_session=session_stage.game_session,
                    session_stage=session_stage,
                    amount=new_tokens,
                    source_type='activity',
                    source_id=activity.id,
                    reason=f'Actividad "{activity.name}": +{len(new_correct_words)} palabra(s) encontrada(s) en sopa de letras',
                    awarded_by=None
                )
                
                team.tokens_total += new_tokens
                team.save()
            
            progress.save()
            
            # Recargar el equipo para obtener tokens actualizados
            team.refresh_from_db()
            
            serializer = self.get_serializer(progress)
            return Response({
                **serializer.data,
                'found_words': combined_found_words,
                'correct_words': correct_words,
                'correct_answers': total_correct_word_search,
                'total_words': total_words_expected,
                'tokens_earned': new_tokens,  # Solo tokens ganados en este envío
                'team_tokens_total': team.tokens_total
            })
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except SessionStage.DoesNotExist:
            return Response(
                {'error': 'Etapa de sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'Error en submit_word_search: {str(e)}')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def submit_general_knowledge(self, request):
        """
        Enviar respuestas del quiz de conocimiento general (Parte 3)
        El backend calcula TODO: respuestas correctas, otorga tokens (1 por respuesta correcta), actualiza progreso
        No requiere autenticación (para tablets)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        team_id = request.data.get('team')
        activity_id = request.data.get('activity')
        session_stage_id = request.data.get('session_stage')
        answers = request.data.get('answers', [])  # [{question_id, selected}]
        
        if not team_id:
            return Response(
                {'error': 'Se requiere team'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not activity_id:
            return Response(
                {'error': 'Se requiere activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not session_stage_id:
            return Response(
                {'error': 'Se requiere session_stage'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar que hayan respuestas
        if len(answers) == 0:
            return Response(
                {'error': 'Debe haber al menos una respuesta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, SessionStage, TokenTransaction
            from challenges.models import Activity, GeneralKnowledgeQuestion
            
            team = Team.objects.get(id=team_id)
            activity = Activity.objects.get(id=activity_id)
            session_stage = SessionStage.objects.get(id=session_stage_id)
            
            # Obtener o crear el progreso
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=activity,
                session_stage=session_stage,
                defaults={
                    'status': 'in_progress',
                    'started_at': timezone.now()
                }
            )
            
            # Obtener datos existentes del progreso
            existing_response_data = progress.response_data or {}
            existing_general_knowledge = existing_response_data.get('general_knowledge', {})
            existing_answers = existing_general_knowledge.get('answers', [])
            
            # Crear un diccionario de respuestas existentes por question_id para evitar duplicados
            existing_answers_dict = {a.get('question_id'): a for a in existing_answers}
            
            # Calcular respuestas correctas y otorgar tokens (TODO en el backend)
            new_tokens_awarded = 0
            question_results = []
            
            for answer_data in answers:
                question_id = answer_data.get('question_id')
                selected_answer = answer_data.get('selected')  # Cambiado de 'selected_answer' a 'selected'
                
                # IMPORTANTE: También rechazar si selected_answer es -1 (valor por defecto cuando no hay respuesta)
                if question_id is None or selected_answer is None or selected_answer == -1:
                    logger.warning(f'[submit_general_knowledge] Respuesta inválida omitida: question_id={question_id}, selected={selected_answer}')
                    continue
                
                try:
                    # CONSULTA A BASE DE DATOS: Obtener la pregunta
                    question = GeneralKnowledgeQuestion.objects.get(id=question_id)
                    
                    # CÁLCULO EN BACKEND: Verificar si la respuesta es correcta
                    is_correct = question.correct_answer == selected_answer
                    
                    # Verificar si esta pregunta ya había sido respondida correctamente
                    existing_answer = existing_answers_dict.get(question_id)
                    was_already_correct = existing_answer and existing_answer.get('correct', False)
                    
                    # CONSULTA A BASE DE DATOS: Verificar si ya se otorgó token para esta pregunta
                    if is_correct and not was_already_correct:
                        existing_transaction = TokenTransaction.objects.filter(
                            team=team,
                            game_session=session_stage.game_session,
                            session_stage=session_stage,
                            source_type='activity',
                            source_id=activity.id,
                            reason__icontains=f'Pregunta {question_id}'
                        ).exists()
                        
                        if not existing_transaction:
                            # CREAR TRANSACCIÓN EN BASE DE DATOS: Otorgar 1 token por respuesta correcta
                            TokenTransaction.objects.create(
                                team=team,
                                game_session=session_stage.game_session,
                                session_stage=session_stage,
                                amount=1,
                                source_type='activity',
                                source_id=activity.id,
                                reason=f'Actividad "{activity.name}": Pregunta {question_id} de conocimiento general respondida correctamente',
                                awarded_by=None  # Sistema automático
                            )
                            
                            # ACTUALIZAR BASE DE DATOS: Tokens del equipo
                            team.tokens_total += 1
                            team.save()
                            new_tokens_awarded += 1
                    
                    question_results.append({
                        'question_id': question_id,
                        'selected': selected_answer,
                        'correct': bool(is_correct)  # Asegurar que sea un booleano explícito
                    })
                    
                    # Log para debugging
                    logger.debug(f'[submit_general_knowledge] Procesada pregunta {question_id}: selected={selected_answer}, correct={is_correct}')
                    
                except GeneralKnowledgeQuestion.DoesNotExist:
                    continue
            
            # Actualizar response_data con todas las respuestas (nuevas y existentes)
            # IMPORTANTE: Las respuestas nuevas siempre sobrescriben las existentes para asegurar que 'correct' esté actualizado
            all_answers_dict = {}
            # Primero agregar las respuestas existentes que NO están en las nuevas respuestas
            new_question_ids = {a.get('question_id') for a in question_results}
            for existing_answer in existing_answers:
                existing_qid = existing_answer.get('question_id')
                # Solo agregar si no está en las nuevas respuestas que se están procesando
                if existing_qid not in new_question_ids:
                    all_answers_dict[existing_qid] = existing_answer
            # Luego agregar/sobrescribir con las nuevas respuestas (que tienen 'correct' actualizado)
            for new_answer in question_results:
                all_answers_dict[new_answer['question_id']] = new_answer
            
            all_answers = list(all_answers_dict.values())
            # Contar correctas: solo las que tienen 'correct' = True
            # IMPORTANTE: Verificar explícitamente que 'correct' sea True (no solo truthy)
            total_correct = sum(1 for a in all_answers if a.get('correct') is True)
            # IMPORTANTE: total_questions siempre debe ser 5 (total de preguntas esperadas), no el número de respuestas dadas
            total_questions = 5
            
            # Log para debugging
            logger.info(f'[submit_general_knowledge] Conteo de respuestas: total={total_questions}, correctas={total_correct}')
            logger.info(f'[submit_general_knowledge] Respuestas procesadas: {len(question_results)} nuevas, {len(existing_answers)} existentes')
            for a in all_answers:
                correct_value = a.get('correct')
                logger.debug(f'[submit_general_knowledge] Pregunta {a.get("question_id")}: correct={correct_value} (type: {type(correct_value)}), selected={a.get("selected")}')
                # Verificar si alguna respuesta tiene correct=None o no está definido
                if correct_value is None:
                    logger.warning(f'[submit_general_knowledge] ⚠️ Pregunta {a.get("question_id")} tiene correct=None!')
            
            # Verificar si está completado (5 preguntas respondidas)
            is_completed = len(all_answers) >= 5
            
            # ACTUALIZAR BASE DE DATOS: Progreso de la actividad
            existing_response_data['general_knowledge'] = {
                'answers': all_answers,
                'correct_count': total_correct,
                'total_questions': total_questions,
                'completed': is_completed
            }
            
            progress.response_data = existing_response_data
            
            if is_completed:
                progress.status = 'completed'
                progress.completed_at = timezone.now()
                progress.progress_percentage = 100
            
            progress.save()
            
            # Recargar el equipo para obtener tokens actualizados
            team.refresh_from_db()
            
            serializer = self.get_serializer(progress)
            
            # Log final para debugging
            logger.info(f'[submit_general_knowledge] RESULTADO FINAL: total_questions={total_questions}, total_correct={total_correct}, new_tokens={new_tokens_awarded}, team_tokens={team.tokens_total}')
            
            return Response({
                **serializer.data,
                'correct_count': total_correct,
                'total_questions': total_questions,
                'tokens_earned': new_tokens_awarded,
                'team_tokens_total': team.tokens_total
            })
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except SessionStage.DoesNotExist:
            return Response(
                {'error': 'Etapa de sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            logger.error(f'Error en submit_general_knowledge: {str(e)}')
            logger.error(f'Traceback completo: {error_trace}')
            return Response(
                {'error': str(e), 'trace': error_trace},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def select_topic(self, request):
        """
        Seleccionar un tema para una actividad
        No requiere autenticación (para tablets)
        """
        team_id = request.data.get('team')
        activity_id = request.data.get('activity')
        session_stage_id = request.data.get('session_stage')
        topic_id = request.data.get('topic')
        
        if not all([team_id, activity_id, session_stage_id, topic_id]):
            return Response(
                {'error': 'Se requieren team, activity, session_stage y topic'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, SessionStage
            from challenges.models import Activity, Topic
            
            team = Team.objects.get(id=team_id)
            activity = Activity.objects.get(id=activity_id)
            session_stage = SessionStage.objects.get(id=session_stage_id)
            topic = Topic.objects.get(id=topic_id)
            
            # Obtener o crear progreso
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=activity,
                session_stage=session_stage,
                defaults={
                    'status': 'in_progress',
                    'started_at': timezone.now()
                }
            )
            
            # Actualizar tema seleccionado
            progress.selected_topic = topic
            # Si ya hay desafío seleccionado, marcar como completado
            if progress.selected_challenge:
                progress.status = 'completed'
                progress.completed_at = timezone.now()
                progress.progress_percentage = 100
            else:
                progress.status = 'in_progress'
            if not progress.started_at:
                progress.started_at = timezone.now()
            progress.save()
            
            # Recargar desde la base de datos para asegurar que se incluyan las relaciones
            # Importar logger para debugging
            import logging
            logger = logging.getLogger(__name__)
            
            progress.refresh_from_db()
            progress = TeamActivityProgress.objects.select_related(
                'selected_topic', 'selected_challenge'
            ).get(id=progress.id)
            
            logger.info(f"✅ Tema seleccionado guardado: Equipo {team.id}, Tema {topic.id}, Progress ID {progress.id}")
            
            serializer = self.get_serializer(progress)
            response_data = serializer.data
            logger.info(f"📤 Respuesta serializer - selected_topic: {response_data.get('selected_topic')}")
            return Response(response_data)
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except SessionStage.DoesNotExist:
            return Response(
                {'error': 'Etapa de sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Topic.DoesNotExist:
            return Response(
                {'error': 'Tema no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def select_challenge(self, request):
        """
        Seleccionar un desafío para una actividad
        No requiere autenticación (para tablets)
        Puede recibir una imagen de la persona (persona_image) en FormData
        """
        team_id = request.data.get('team')
        activity_id = request.data.get('activity')
        session_stage_id = request.data.get('session_stage')
        challenge_id = request.data.get('challenge')
        persona_image_file = request.FILES.get('persona_image')
        
        if not all([team_id, activity_id, session_stage_id, challenge_id]):
            return Response(
                {'error': 'Se requieren team, activity, session_stage y challenge'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, SessionStage
            from challenges.models import Activity, Challenge
            
            team = Team.objects.get(id=team_id)
            activity = Activity.objects.get(id=activity_id)
            session_stage = SessionStage.objects.get(id=session_stage_id)
            challenge = Challenge.objects.get(id=challenge_id)
            
            # Si se envía una imagen de la persona, guardarla en el desafío
            if persona_image_file:
                # Validar tamaño de archivo (5MB máximo)
                if persona_image_file.size > settings.IMAGE_UPLOAD_MAX_SIZE:
                    return Response(
                        {'error': f'El archivo es demasiado grande. Máximo: {settings.IMAGE_UPLOAD_MAX_SIZE / 1024 / 1024}MB'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Validar tipo de archivo
                allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
                if persona_image_file.content_type not in allowed_types:
                    return Response(
                        {'error': 'Tipo de archivo no permitido. Use JPEG, PNG o WEBP'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                try:
                    # Procesar y guardar imagen
                    img = Image.open(persona_image_file)
                    
                    # Convertir a RGB si es necesario (para JPEG)
                    if img.mode in ('RGBA', 'LA', 'P'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                        img = background
                    
                    # Redimensionar si es muy grande (máximo 800x800 para imágenes de perfil)
                    max_size = (800, 800)
                    if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                        img.thumbnail(max_size, Image.Resampling.LANCZOS)
                    
                    # Guardar en buffer
                    from io import BytesIO
                    buffer = BytesIO()
                    img_format = 'JPEG'
                    img.save(buffer, format=img_format, quality=85, optimize=True)
                    buffer.seek(0)
                    
                    # Si ya había una imagen, eliminar la anterior
                    if challenge.persona_image:
                        old_path = challenge.persona_image.path
                        if os.path.exists(old_path):
                            os.remove(old_path)
                    
                    # Guardar la nueva imagen
                    import uuid
                    file_extension = 'jpg'
                    filename = f'personas/{challenge.id}_{uuid.uuid4().hex[:8]}.{file_extension}'
                    challenge.persona_image.save(filename, ContentFile(buffer.read()), save=False)
                    challenge.save()
                    
                except Exception as img_error:
                    return Response(
                        {'error': f'Error al procesar imagen: {str(img_error)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Obtener o crear progreso
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=activity,
                session_stage=session_stage,
                defaults={
                    'status': 'in_progress',
                    'started_at': timezone.now()
                }
            )
            
            # Actualizar desafío seleccionado
            progress.selected_challenge = challenge
            
            # Automáticamente obtener y guardar el tema del desafío
            # El desafío siempre tiene un tema asociado
            if challenge.topic and not progress.selected_topic:
                progress.selected_topic = challenge.topic
            
            # Si el frontend también envía el tema (por compatibilidad), usarlo si no hay uno del desafío
            topic_id = request.data.get('topic')
            if topic_id and not progress.selected_topic:
                from challenges.models import Topic
                try:
                    topic = Topic.objects.get(id=topic_id)
                    progress.selected_topic = topic
                except Topic.DoesNotExist:
                    pass  # Si el tema no existe, continuar sin él
            
            # Si hay tema seleccionado (del desafío o enviado), marcar como completado
            if progress.selected_topic:
                progress.status = 'completed'
                progress.completed_at = timezone.now()
                progress.progress_percentage = 100
            else:
                progress.status = 'in_progress'
            if not progress.started_at:
                progress.started_at = timezone.now()
            progress.save()
            
            # Recargar desde la base de datos para asegurar que se incluyan las relaciones
            progress.refresh_from_db()
            progress = TeamActivityProgress.objects.select_related(
                'selected_topic', 'selected_challenge'
            ).get(id=progress.id)
            
            # Recargar el desafío para obtener la imagen actualizada
            challenge.refresh_from_db()
            
            serializer = self.get_serializer(progress)
            return Response(serializer.data)
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except SessionStage.DoesNotExist:
            return Response(
                {'error': 'Etapa de sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Challenge.DoesNotExist:
            return Response(
                {'error': 'Desafío no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'Error en select_challenge: {str(e)}')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def upload_prototype(self, request):
        """
        Subir imagen del prototipo Lego y guardar nombre/tagline del producto.
        No requiere autenticación (para tablets).

        Requiere:
        - team: ID del equipo
        - activity: ID de la actividad
        - session_stage: ID de la etapa de sesión

        Opcional:
        - image: Archivo de imagen (FormData) — puede omitirse si el equipo saltó la foto
        - product_name: Nombre del producto (se guarda en response_data)
        - product_tagline: Frase descriptiva del producto (se guarda en response_data)
        """
        team_id = request.data.get('team')
        activity_id = request.data.get('activity')
        session_stage_id = request.data.get('session_stage')
        image_file = request.FILES.get('image')
        
        if not all([team_id, activity_id, session_stage_id]):
            return Response(
                {'error': 'Se requieren team, activity y session_stage'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar tamaño de archivo (5MB máximo)
        if image_file and image_file.size > settings.IMAGE_UPLOAD_MAX_SIZE:
            return Response(
                {'error': f'El archivo es demasiado grande. Máximo: {settings.IMAGE_UPLOAD_MAX_SIZE / 1024 / 1024}MB'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar tipo de archivo
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if image_file and image_file.content_type not in allowed_types:
            return Response(
                {'error': 'Tipo de archivo no permitido. Use JPEG, PNG o WEBP'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, SessionStage
            from challenges.models import Activity
            
            team = Team.objects.get(id=team_id)
            activity = Activity.objects.get(id=activity_id)
            session_stage = SessionStage.objects.get(id=session_stage_id)
            
            # Obtener o crear progreso
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=activity,
                session_stage=session_stage,
                defaults={
                    'status': 'submitted',
                    'progress_percentage': 100,
                    'started_at': timezone.now()
                }
            )
            
            # Procesar y guardar imagen (opcional si se saltó la foto)
            image_url = None
            if image_file:
                try:
                    # Abrir imagen con PIL para validar y optimizar
                    img = Image.open(image_file)

                    # Convertir a RGB si es necesario (para JPEG)
                    if img.mode in ('RGBA', 'LA', 'P'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                        img = background

                    # Redimensionar si es muy grande (máximo 1920x1920)
                    max_size = (1920, 1920)
                    if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                        img.thumbnail(max_size, Image.Resampling.LANCZOS)

                    # Guardar en buffer
                    from io import BytesIO
                    buffer = BytesIO()
                    img.save(buffer, format='JPEG', quality=85, optimize=True)
                    buffer.seek(0)

                    # Generar nombre único para el archivo
                    import uuid
                    filename = f'prototypes/{team.id}_{session_stage.id}_{uuid.uuid4().hex[:8]}.jpg'

                    # Guardar en el sistema de archivos
                    saved_path = default_storage.save(filename, ContentFile(buffer.read()))
                    image_url = f"{settings.MEDIA_URL}{saved_path}"

                except Exception as img_error:
                    return Response(
                        {'error': f'Error al procesar imagen: {str(img_error)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Si ya había una imagen y se subió una nueva, eliminar la anterior
            if image_file and progress.prototype_image_url and not created:
                old_path = progress.prototype_image_url.replace(settings.MEDIA_URL, '')
                if default_storage.exists(old_path):
                    default_storage.delete(old_path)
            
            # Actualizar progreso
            if image_url:
                progress.prototype_image_url = image_url
            progress.status = 'submitted'
            progress.progress_percentage = 100
            if not progress.started_at:
                progress.started_at = timezone.now()
            progress.completed_at = timezone.now()

            # Guardar nombre y tagline del producto en response_data
            product_name = request.data.get('product_name')
            product_tagline = request.data.get('product_tagline')
            if product_name is not None or product_tagline is not None:
                existing = progress.response_data or {}
                if product_name is not None:
                    existing['product_name'] = product_name.strip()
                if product_tagline is not None:
                    existing['product_tagline'] = product_tagline.strip()
                progress.response_data = existing

            progress.save()
            
            # Otorgar 15 tokens por subir el prototipo
            from .models import TokenTransaction
            tokens_to_award = 15
            
            # Verificar si ya se otorgaron tokens por este prototipo
            existing_transaction = TokenTransaction.objects.filter(
                team=team,
                game_session=team.game_session,
                session_stage=session_stage,
                source_type='activity',
                source_id=progress.id
            ).first()
            
            if not existing_transaction:
                # Crear transacción de tokens
                TokenTransaction.objects.create(
                    team=team,
                    game_session=team.game_session,
                    session_stage=session_stage,
                    amount=tokens_to_award,
                    source_type='activity',
                    source_id=progress.id,
                    reason='Prototipo subido (15 tokens)',
                    awarded_by=None
                )
                
                # Actualizar tokens del equipo
                team.tokens_total += tokens_to_award
                team.save()
            
            # Reload para incluir relaciones
            progress.refresh_from_db()
            progress = TeamActivityProgress.objects.select_related(
                'team', 'session_stage__stage', 'activity', 'selected_topic', 'selected_challenge'
            ).get(id=progress.id)
            
            serializer = self.get_serializer(progress)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except SessionStage.DoesNotExist:
            return Response(
                {'error': 'Etapa de sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def save_pitch(self, request):
        """
        Guardar el formulario de pitch (Etapa 4)
        """
        team_id = request.data.get('team_id')
        activity_id = request.data.get('activity_id')
        session_stage_id = request.data.get('session_stage_id')
        pitch_intro_problem = request.data.get('pitch_intro_problem', '')
        pitch_solution = request.data.get('pitch_solution', '')
        pitch_value = request.data.get('pitch_value', '')
        pitch_impact = request.data.get('pitch_impact', '')
        pitch_closing = request.data.get('pitch_closing', '')
        
        if not all([team_id, activity_id, session_stage_id]):
            return Response(
                {'error': 'Faltan datos necesarios (team_id, activity_id, session_stage_id)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, SessionStage
            from challenges.models import Activity
            
            team = Team.objects.get(id=team_id)
            activity = Activity.objects.get(id=activity_id)
            session_stage = SessionStage.objects.get(id=session_stage_id)
            
            # Obtener o crear progreso
            progress, created = TeamActivityProgress.objects.get_or_create(
                team=team,
                activity=activity,
                session_stage=session_stage,
                defaults={
                    'status': 'in_progress',
                    'started_at': timezone.now(),
                    'progress_percentage': 0
                }
            )
            
            # Actualizar campos del pitch
            progress.pitch_intro_problem = pitch_intro_problem
            progress.pitch_solution = pitch_solution
            progress.pitch_value = pitch_value
            progress.pitch_impact = pitch_impact
            progress.pitch_closing = pitch_closing
            
            # Si todos los campos están completos, marcar como completado
            if pitch_intro_problem and pitch_solution and pitch_value and pitch_impact and pitch_closing:
                progress.status = 'completed'
                progress.progress_percentage = 100
                if not progress.completed_at:
                    progress.completed_at = timezone.now()
            else:
                # Calcular porcentaje de completitud (5 campos)
                fields_completed = sum([
                    bool(pitch_intro_problem), 
                    bool(pitch_solution), 
                    bool(pitch_value),
                    bool(pitch_impact),
                    bool(pitch_closing)
                ])
                progress.progress_percentage = int((fields_completed / 5) * 100)
                progress.status = 'in_progress'
            
            if not progress.started_at:
                progress.started_at = timezone.now()
            
            progress.save()
            
            # Reload para incluir relaciones
            progress.refresh_from_db()
            progress = TeamActivityProgress.objects.select_related(
                'team', 'session_stage__stage', 'activity', 'selected_topic', 'selected_challenge'
            ).get(id=progress.id)
            
            serializer = self.get_serializer(progress)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except SessionStage.DoesNotExist:
            return Response(
                {'error': 'Etapa de sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import traceback
            import logging
            error_trace = traceback.format_exc()
            logger = logging.getLogger(__name__)
            logger.error(f'Error en save_pitch: {str(e)}')
            logger.error(f'Traceback: {error_trace}')
            error_message = str(e)
            if 'pitch_value' in error_message or 'pitch_impact' in error_message:
                error_message += ' (Nota: Ejecuta la migración: python manage.py migrate game_sessions)'
            return Response(
                {'error': error_message, 'details': error_trace if settings.DEBUG else None},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TabletViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Tablets
    """
    queryset = Tablet.objects.all()
    serializer_class = TabletSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['tablet_code']


class TabletConnectionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Conexiones de Tablets
    """
    queryset = TabletConnection.objects.all()
    serializer_class = TabletConnectionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['tablet', 'team', 'game_session']
    search_fields = ['tablet__tablet_code', 'team__name', 'game_session__room_code']

    def get_queryset(self):
        return TabletConnection.objects.select_related('tablet', 'team', 'game_session')

    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def connect(self, request):
        """
        Conectar un equipo a una sesión de juego (BYOD)
        No requiere autenticación (público para dispositivos de alumnos).

        Requiere:
        - room_code: Código de la sala
        - team_name: Nombre del equipo (mín. 2 caracteres)
        - team_color: Color del equipo (Azul, Rojo, Verde, Amarillo, Morado, Naranja)
        """
        room_code = request.data.get('room_code')
        team_name = str(request.data.get('team_name', '')).strip()
        team_color = str(request.data.get('team_color', '')).strip()

        if not room_code or not team_name or not team_color:
            return Response(
                {'error': 'Se requiere room_code, team_name y team_color'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(team_name) < 2:
            return Response(
                {'error': 'El nombre del equipo debe tener al menos 2 caracteres'},
                status=status.HTTP_400_BAD_REQUEST
            )

        room_code = str(room_code).strip().upper()

        try:
            game_session = GameSession.objects.get(room_code=room_code)

            # Verificar que la sesión esté activa
            if game_session.status not in ['lobby', 'running']:
                return Response(
                    {
                        'error': 'La sesión ya ha finalizado',
                        'status': game_session.status,
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

            # Si ya está en running, no permitir nuevas conexiones
            # (reconexión debe hacerse via /reconnect/ con team_session_token)
            if game_session.status == 'running':
                return Response(
                    {'error': 'No se pueden conectar nuevos equipos. El juego ya ha comenzado. Usa tu token de reconexión.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Buscar primer equipo sin conexión activa
            teams = game_session.teams.all()
            available_team = None

            for team in teams:
                has_active_connection = TabletConnection.objects.filter(
                    team=team,
                    game_session=game_session,
                    disconnected_at__isnull=True
                ).exists()

                if not has_active_connection:
                    available_team = team
                    break

            if not available_team:
                return Response(
                    {'error': 'Todos los equipos ya tienen un dispositivo conectado'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Actualizar identidad del equipo con los datos del alumno
            available_team.name = team_name
            available_team.color = team_color
            available_team.save()

            # Crear conexión sin tablet física (BYOD)
            connection = TabletConnection.objects.create(
                tablet=None,
                team=available_team,
                game_session=game_session
            )

            serializer = TabletConnectionSerializer(connection)
            team_serializer = TeamSerializer(available_team)

            return Response({
                'connection': serializer.data,
                'team': team_serializer.data,
                'game_session': {
                    'id': game_session.id,
                    'room_code': game_session.room_code,
                    'status': game_session.status
                },
                'team_session_token': str(connection.team_session_token),
                'message': 'Conectado exitosamente'
            }, status=status.HTTP_201_CREATED)

        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Código de sala inválido'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Error inesperado: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['patch'], permission_classes=[], authentication_classes=[])
    def update_screen(self, request, pk=None):
        """
        Las tablets reportan su pantalla actual (sin autenticación).
        Payload: {"screen": "results_1"} o {"screen": "lobby"}
        """
        connection = self.get_object()
        screen = request.data.get('screen', '')
        connection.current_screen = str(screen)[:50]
        connection.save(update_fields=['current_screen'])
        return Response({'current_screen': connection.current_screen})

    @action(detail=True, methods=['post'])
    def disconnect(self, request, pk=None):
        """Desconectar una tablet"""
        connection = self.get_object()
        if connection.disconnected_at is not None:
            return Response(
                {'error': 'La tablet ya está desconectada'},
                status=status.HTTP_400_BAD_REQUEST
            )
        connection.disconnected_at = timezone.now()
        connection.save()
        serializer = self.get_serializer(connection)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def reconnect(self, request):
        """
        Reconectar a una sesión usando el team_session_token (BYOD).
        No requiere autenticación.

        Requiere:
        - team_session_token: UUID devuelto al conectarse originalmente
        """
        token = request.data.get('team_session_token')

        if not token:
            return Response(
                {'error': 'Se requiere team_session_token'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            connection = TabletConnection.objects.select_related('team', 'game_session').get(
                team_session_token=token
            )

            game_session = connection.game_session

            if game_session.status not in ['lobby', 'running']:
                return Response(
                    {'error': 'La sesión ha finalizado'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Reactivar conexión si estaba desconectada
            if connection.disconnected_at is not None:
                connection.disconnected_at = None
                connection.save()

            team = connection.team
            serializer = TabletConnectionSerializer(connection)
            team_serializer = TeamSerializer(team)

            return Response({
                'connection': serializer.data,
                'team': team_serializer.data,
                'game_session': {
                    'id': game_session.id,
                    'room_code': game_session.room_code,
                    'status': game_session.status
                },
                'team_session_token': str(connection.team_session_token),
                'message': 'Reconectado exitosamente'
            }, status=status.HTTP_200_OK)

        except TabletConnection.DoesNotExist:
            return Response(
                {'error': 'Token de sesión inválido o expirado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Error inesperado: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def by_team(self, request):
        """Obtener conexiones de tablets por equipo"""
        team_id = request.query_params.get('team')
        game_session_id = request.query_params.get('game_session')
        
        queryset = self.get_queryset()
        
        if team_id:
            queryset = queryset.filter(team_id=team_id)
        if game_session_id:
            queryset = queryset.filter(game_session_id=game_session_id)
        
        # Solo conexiones activas
        queryset = queryset.filter(disconnected_at__isnull=True)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[], authentication_classes=[])
    def status(self, request):
        """
        Obtener estado de conexión de una tablet
        No requiere autenticación
        """
        connection_id = request.query_params.get('connection_id')
        
        if not connection_id:
            return Response(
                {'error': 'Se requiere connection_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            connection = TabletConnection.objects.select_related('tablet', 'team', 'game_session').get(id=connection_id)
            serializer = TabletConnectionSerializer(connection)
            
            team = connection.team
            game_session = connection.game_session
            team_serializer = TeamSerializer(team)
            
            # Obtener personalización del equipo
            personalization = None
            try:
                personalization = team.personalization
            except:
                pass
            
            return Response({
                'connection': serializer.data,
                'team': team_serializer.data,
                'game_session': {
                    'id': game_session.id,
                    'room_code': game_session.room_code,
                    'status': game_session.status
                },
                'personalization': {
                    'team_members_know_each_other': personalization.team_members_know_each_other if personalization else None
                } if personalization else None
            })
        except TabletConnection.DoesNotExist:
            return Response(
                {'error': 'Conexión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )


class TeamRouletteAssignmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Asignaciones de Retos de Ruleta
    """
    queryset = TeamRouletteAssignment.objects.all()
    serializer_class = TeamRouletteAssignmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['team', 'session_stage', 'roulette_challenge', 'status']
    search_fields = ['team__name', 'roulette_challenge__description']
    ordering_fields = ['assigned_at', 'accepted_at', 'completed_at']
    ordering = ['-assigned_at']

    def get_queryset(self):
        return TeamRouletteAssignment.objects.select_related(
            'team', 'session_stage', 'roulette_challenge', 'validated_by__user'
        )

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Aceptar un reto de ruleta"""
        assignment = self.get_object()
        if assignment.status != 'assigned':
            return Response(
                {'error': 'El reto no está en estado asignado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        assignment.status = 'accepted'
        assignment.accepted_at = timezone.now()
        assignment.save()
        serializer = self.get_serializer(assignment)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Rechazar un reto de ruleta"""
        assignment = self.get_object()
        if assignment.status != 'assigned':
            return Response(
                {'error': 'El reto no está en estado asignado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        assignment.status = 'rejected'
        assignment.rejected_at = timezone.now()
        assignment.save()
        serializer = self.get_serializer(assignment)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """Validar completación de un reto (por profesor)"""
        assignment = self.get_object()
        if assignment.status not in ['accepted', 'completed']:
            return Response(
                {'error': 'El reto debe estar aceptado para ser validado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        assignment.status = 'completed'
        assignment.completed_at = timezone.now()
        assignment.validated_by = request.user.professor
        assignment.save()
        
        # Crear transacción de tokens
        TokenTransaction.objects.create(
            team=assignment.team,
            game_session=assignment.session_stage.game_session,
            session_stage=assignment.session_stage,
            amount=assignment.token_reward,
            source_type='roulette_challenge',
            source_id=assignment.id,
            reason=f'Reto de ruleta completado: {assignment.roulette_challenge.description[:50]}',
            awarded_by=request.user.professor
        )
        
        # Actualizar tokens del equipo
        assignment.team.tokens_total += assignment.token_reward
        assignment.team.save()
        
        serializer = self.get_serializer(assignment)
        return Response(serializer.data)


class TokenTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para Transacciones de Tokens (solo lectura)
    """
    queryset = TokenTransaction.objects.all()
    serializer_class = TokenTransactionSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = []  # No requerir autenticación (se controla con get_permissions)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['team', 'game_session', 'session_stage', 'source_type']
    search_fields = ['team__name', 'game_session__room_code', 'reason']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']

    def get_permissions(self):
        """
        Permite leer sin autenticación para tablets
        """
        if self.action in ['list', 'retrieve']:
            return []  # Sin autenticación para tablets
        return super().get_permissions()

    def get_queryset(self):
        return TokenTransaction.objects.select_related(
            'team', 'game_session', 'session_stage', 'awarded_by__user'
        )


class PeerEvaluationViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Evaluaciones Peer
    """
    queryset = PeerEvaluation.objects.all()
    serializer_class = PeerEvaluationSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = []  # No requerir autenticación (se controla con get_permissions)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['evaluator_team', 'evaluated_team', 'game_session']
    search_fields = ['evaluator_team__name', 'evaluated_team__name', 'game_session__room_code']
    ordering_fields = ['submitted_at', 'total_score']
    ordering = ['-submitted_at']

    def get_queryset(self):
        return PeerEvaluation.objects.select_related(
            'evaluator_team', 'evaluated_team', 'game_session'
        )
    
    def get_permissions(self):
        """
        Permite leer sin autenticación para tablets
        Permite crear sin autenticación para tablets
        """
        if self.action in ['list', 'retrieve', 'create', 'for_professor', 'for_team']:
            return []  # Sin autenticación para tablets
        return super().get_permissions()
    
    def create(self, request, *args, **kwargs):
        """
        Crear una evaluación peer (desde tablets)
        """
        try:
            evaluator_team_id = request.data.get('evaluator_team_id')
            evaluated_team_id = request.data.get('evaluated_team_id')
            game_session_id = request.data.get('game_session_id')
            criteria_scores = request.data.get('criteria_scores', {})
            feedback = request.data.get('feedback', '')
            
            if not all([evaluator_team_id, evaluated_team_id, game_session_id]):
                return Response(
                    {'error': 'Faltan datos necesarios (evaluator_team_id, evaluated_team_id, game_session_id)'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            from .models import Team, GameSession
            from django.utils import timezone
            
            evaluator_team = Team.objects.get(id=evaluator_team_id)
            evaluated_team = Team.objects.get(id=evaluated_team_id)
            game_session = GameSession.objects.get(id=game_session_id)
            
            # No permitir que un equipo se evalúe a sí mismo
            if evaluator_team_id == evaluated_team_id:
                return Response(
                    {'error': 'Un equipo no puede evaluarse a sí mismo'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calcular puntuación total (suma de todos los criterios)
            total_score = sum(criteria_scores.values()) if isinstance(criteria_scores, dict) else 0
            
            # Calcular tokens otorgados: 1 token por punto
            tokens_awarded = total_score
            
            # Verificar si ya existe una evaluación
            existing_evaluation = PeerEvaluation.objects.filter(
                evaluator_team=evaluator_team,
                evaluated_team=evaluated_team,
                game_session=game_session
            ).first()
            
            if existing_evaluation:
                # Actualizar evaluación existente
                old_tokens_awarded = existing_evaluation.tokens_awarded
                existing_evaluation.criteria_scores = criteria_scores
                existing_evaluation.total_score = total_score
                existing_evaluation.tokens_awarded = tokens_awarded
                existing_evaluation.feedback = feedback
                existing_evaluation.save()
                evaluation = existing_evaluation
                
                # Si los tokens cambiaron, actualizar la transacción
                if old_tokens_awarded != tokens_awarded:
                    try:
                        from .models import TokenTransaction, SessionStage
                        
                        session_stage = SessionStage.objects.filter(
                            game_session=game_session,
                            stage__number=4
                        ).first()
                        
                        if session_stage:
                            # Buscar la transacción existente
                            existing_transaction = TokenTransaction.objects.filter(
                                team=evaluated_team,
                                game_session=game_session,
                                session_stage=session_stage,
                                source_type='peer_evaluation',
                                source_id=evaluation.id
                            ).first()
                            
                            if existing_transaction:
                                # Calcular la diferencia de tokens
                                token_difference = tokens_awarded - old_tokens_awarded
                                
                                if token_difference != 0:
                                    # Actualizar la transacción
                                    existing_transaction.amount = tokens_awarded
                                    existing_transaction.save()
                                    
                                    # Actualizar tokens del equipo
                                    evaluated_team.tokens_total += token_difference
                                    evaluated_team.save()
                    except Exception as e:
                        # Si hay un error al actualizar tokens, registrar pero no fallar
                        import logging
                        logger = logging.getLogger(__name__)
                        try:
                            logger.error(f'Error al actualizar tokens para evaluacion {evaluation.id}: {str(e)}')
                        except:
                            logger.error('Error al actualizar tokens para evaluacion')
            else:
                # Crear nueva evaluación
                evaluation = PeerEvaluation.objects.create(
                    evaluator_team=evaluator_team,
                    evaluated_team=evaluated_team,
                    game_session=game_session,
                    criteria_scores=criteria_scores,
                    total_score=total_score,
                    tokens_awarded=tokens_awarded,
                    feedback=feedback
                )
                
                # Otorgar tokens al equipo evaluado (solo para nuevas evaluaciones)
                if tokens_awarded > 0:
                    try:
                        from .models import TokenTransaction, SessionStage
                        
                        # Obtener el session_stage de la Etapa 4
                        session_stage = SessionStage.objects.filter(
                            game_session=game_session,
                            stage__number=4
                        ).first()
                        
                        if session_stage:
                            # Verificar si ya se otorgaron tokens por esta evaluación
                            existing_transaction = TokenTransaction.objects.filter(
                                team=evaluated_team,
                                game_session=game_session,
                                session_stage=session_stage,
                                source_type='peer_evaluation',
                                source_id=evaluation.id
                            ).exists()
                            
                            if not existing_transaction:
                                # Crear transacción de tokens
                                TokenTransaction.objects.create(
                                    team=evaluated_team,
                                    game_session=game_session,
                                    session_stage=session_stage,
                                    amount=tokens_awarded,
                                    source_type='peer_evaluation',
                                    source_id=evaluation.id,
                                    reason=f'Evaluación peer: {evaluator_team.name} → {evaluated_team.name}',
                                    awarded_by=None  # Sistema automático
                                )
                                
                                # Actualizar tokens del equipo evaluado
                                evaluated_team.tokens_total += tokens_awarded
                                evaluated_team.save()
                    except Exception as e:
                        # Si hay un error al otorgar tokens, registrar pero no fallar
                        import logging
                        logger = logging.getLogger(__name__)
                        try:
                            logger.error(f'Error al otorgar tokens para evaluacion {evaluation.id}: {str(e)}')
                        except:
                            logger.error('Error al otorgar tokens para evaluacion')
            
            # Verificar si se evaluó al último equipo y todas las evaluaciones están completadas
            # Esto marca la actividad como completada
            try:
                from challenges.models import Activity
                
                # Obtener el session_stage de la Etapa 4
                session_stage = SessionStage.objects.filter(
                    game_session=game_session,
                    stage__number=4
                ).first()
                
                if session_stage and session_stage.presentation_order:
                    # Obtener la actividad de presentación pitch
                    presentation_activity = Activity.objects.filter(
                        stage__number=4,
                        activity_type__name__icontains='presentación'
                    ).first()
                    
                    if presentation_activity:
                        # Contar cuántos equipos hay en total
                        total_teams = len(session_stage.presentation_order)
                        
                        # Contar cuántas evaluaciones se han completado para el equipo evaluado
                        # Cada equipo debe ser evaluado por todos los demás equipos
                        evaluations_received = PeerEvaluation.objects.filter(
                            evaluated_team=evaluated_team,
                            game_session=game_session
                        ).count()
                        
                        # Si todas las evaluaciones están completadas (todos los demás equipos evaluaron)
                        if evaluations_received >= (total_teams - 1):
                            # Marcar la actividad como completada para el equipo evaluado
                            progress, created = TeamActivityProgress.objects.get_or_create(
                                team=evaluated_team,
                                activity=presentation_activity,
                                session_stage=session_stage,
                                defaults={
                                    'status': 'completed',
                                    'progress_percentage': 100,
                                    'completed_at': timezone.now()
                                }
                            )
                            
                            if not created:
                                progress.status = 'completed'
                                progress.progress_percentage = 100
                                if not progress.completed_at:
                                    progress.completed_at = timezone.now()
                                progress.save()
                            
                            try:
                                print(f'[Backend] Actividad de presentacion marcada como completada para equipo {evaluated_team.name}')
                            except:
                                pass
            except Exception as e:
                try:
                    print(f'[Backend] Error al verificar completitud de actividad: {str(e)}')
                except:
                    pass
            
            serializer = self.get_serializer(evaluation)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Sesion de juego no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            # Manejar errores de codificación al convertir a string
            try:
                error_msg = str(e)
            except:
                error_msg = 'Error interno del servidor'
            return Response(
                {'error': error_msg},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], permission_classes=[], authentication_classes=[])
    def for_professor(self, request):
        """
        Obtener todas las evaluaciones de una sesión (para el profesor)
        """
        game_session_id = request.query_params.get('game_session_id')
        
        if not game_session_id:
            return Response(
                {'error': 'Se requiere game_session_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            game_session = GameSession.objects.get(id=game_session_id)
            evaluations = PeerEvaluation.objects.filter(
                game_session=game_session
            ).select_related('evaluator_team', 'evaluated_team')
            
            serializer = self.get_serializer(evaluations, many=True)
            return Response(serializer.data)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'], permission_classes=[], authentication_classes=[])
    def for_team(self, request):
        """
        Obtener evaluaciones recibidas por un equipo (para tablets)
        """
        team_id = request.query_params.get('team_id')
        game_session_id = request.query_params.get('game_session_id')
        
        if not team_id or not game_session_id:
            return Response(
                {'error': 'Se requieren team_id y game_session_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            team = Team.objects.get(id=team_id)
            game_session = GameSession.objects.get(id=game_session_id)
            
            evaluations = PeerEvaluation.objects.filter(
                evaluated_team=team,
                game_session=game_session
            ).select_related('evaluator_team', 'evaluated_team')
            
            serializer = self.get_serializer(evaluations, many=True)
            return Response(serializer.data)
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )


class ReflectionEvaluationViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Evaluaciones de Reflexión
    """
    queryset = ReflectionEvaluation.objects.all()
    serializer_class = ReflectionEvaluationSerializer
    permission_classes = []  # No requiere autenticación para que los estudiantes puedan responder
    authentication_classes = []
    
    def get_queryset(self):
        queryset = ReflectionEvaluation.objects.select_related('game_session')
        room_code = self.request.query_params.get('room_code')
        if room_code:
            queryset = queryset.filter(game_session__room_code=room_code)
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Crear una nueva evaluación de reflexión"""
        room_code = request.data.get('room_code')
        if not room_code:
            return Response(
                {'error': 'room_code es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            game_session = GameSession.objects.get(room_code=room_code)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verificar si el estudiante ya respondió (por email)
        student_email = request.data.get('student_email')
        if student_email:
            existing_evaluation = ReflectionEvaluation.objects.filter(
                game_session=game_session,
                student_email=student_email
            ).first()
            
            if existing_evaluation:
                # Si ya existe, actualizar la evaluación existente en lugar de crear una nueva
                data = request.data.copy()
                data['game_session'] = game_session.id
                
                serializer = self.get_serializer(existing_evaluation, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                
                return Response(
                    {
                        **serializer.data,
                        'message': 'Evaluación actualizada (ya habías respondido anteriormente)'
                    },
                    status=status.HTTP_200_OK
                )
        
        # Crear nueva evaluación
        data = request.data.copy()
        data['game_session'] = game_session.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    @action(detail=False, methods=['get'], permission_classes=[], authentication_classes=[])
    def by_room(self, request):
        """Obtener evaluaciones por código de sala"""
        room_code = request.query_params.get('room_code')
        if not room_code:
            return Response(
                {'error': 'room_code es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            game_session = GameSession.objects.get(room_code=room_code)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        evaluations = ReflectionEvaluation.objects.filter(game_session=game_session)
        serializer = self.get_serializer(evaluations, many=True)
        
        # Calcular total de estudiantes usando TeamStudent directamente (más eficiente y confiable)
        from .models import Team, TeamStudent
        from django.db.models import Count
        
        # Primero intentar contar desde TeamStudent (más confiable)
        total_students = TeamStudent.objects.filter(
            team__game_session=game_session
        ).values('student').distinct().count()
        
        print(f"🔍 [by_room] Total desde TeamStudent: {total_students}")
        
        # Si no hay estudiantes en TeamStudent, intentar contar desde Team.students como fallback
        if total_students == 0:
            teams = Team.objects.filter(game_session=game_session).prefetch_related('students')
            print(f"🔍 [by_room] Número de equipos: {teams.count()}")
            
            # Usar annotate para contar de forma más eficiente
            teams_with_counts = teams.annotate(student_count=Count('students'))
            total_students = sum(team.student_count for team in teams_with_counts)
            print(f"🔍 [by_room] Total desde annotate: {total_students}")
            
            # Si aún es 0, intentar contar directamente desde la relación many-to-many
            if total_students == 0:
                for team in teams:
                    count = team.students.all().count()
                    total_students += count
                    if count > 0:
                        print(f"⚠️ [by_room] Equipo {team.name} tiene {count} estudiantes (contado desde team.students.all())")
        
        print(f"📊 [by_room] Total final de estudiantes: {total_students} para sesión {game_session.id} (room_code: {game_session.room_code})")
        
        # Contar estudiantes únicos que han respondido (por email)
        # Esto evita contar múltiples respuestas del mismo estudiante
        unique_students_responded = evaluations.values('student_email').distinct().count()
        total_evaluations = evaluations.count()
        
        return Response({
            'count': unique_students_responded,  # Estudiantes únicos que han respondido
            'total_evaluations': total_evaluations,  # Total de evaluaciones (puede incluir duplicados)
            'total_students': total_students,
            'results': serializer.data
        })


class TeamBubbleMapViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Bubble Maps de Equipos
    """
    queryset = TeamBubbleMap.objects.all()
    serializer_class = TeamBubbleMapSerializer
    permission_classes = []
    authentication_classes = []  # No requerir autenticación para tablets
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['team', 'session_stage']

    def get_permissions(self):
        """
        Permite acceso sin autenticación para tablets
        """
        if self.action in ['create', 'update', 'partial_update', 'retrieve', 'list']:
            return []
        return super().get_permissions()

    def get_queryset(self):
        return TeamBubbleMap.objects.select_related('team', 'session_stage__stage')
    
    def create(self, request, *args, **kwargs):
        """Crear bubble map (los tokens se otorgan solo al finalizar)"""
        response = super().create(request, *args, **kwargs)
        # Los tokens se otorgan solo cuando se envía explícitamente o acaba el tiempo
        return response
    
    def update(self, request, *args, **kwargs):
        """Actualizar bubble map (los tokens se otorgan solo al finalizar)"""
        # Verificar si es un envío final (cuando se envía explícitamente)
        is_final_submit = request.data.get('is_final', False)
        response = super().update(request, *args, **kwargs)
        
        # Solo otorgar tokens si es un envío final
        if response.status_code == 200 and is_final_submit:
            self._award_tokens_for_bubble_map()
        
        return response
    
    @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
    def finalize_bubble_map(self, request):
        """
        Finalizar bubble map y otorgar tokens (llamado cuando se envía explícitamente o acaba el tiempo)
        """
        team_id = request.data.get('team')
        session_stage_id = request.data.get('session_stage')
        
        if not team_id or not session_stage_id:
            return Response(
                {'error': 'Se requieren team y session_stage'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Team, SessionStage
            team = Team.objects.get(id=team_id)
            session_stage = SessionStage.objects.get(id=session_stage_id)
            
            # Buscar el bubble map del equipo
            bubble_map = TeamBubbleMap.objects.filter(
                team=team,
                session_stage=session_stage
            ).first()
            
            if not bubble_map:
                return Response(
                    {'error': 'No se encontró bubble map para este equipo'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Otorgar tokens
            self._award_tokens_for_bubble_map_instance(bubble_map)
            
            # Recargar el equipo para obtener tokens actualizados
            team.refresh_from_db()
            
            serializer = self.get_serializer(bubble_map)
            return Response({
                **serializer.data,
                'tokens_awarded': True,
                'team_tokens_total': team.tokens_total
            })
            
        except Team.DoesNotExist:
            return Response(
                {'error': 'Equipo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except SessionStage.DoesNotExist:
            return Response(
                {'error': 'Etapa de sesión no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'Error en finalize_bubble_map: {str(e)}')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _award_tokens_for_bubble_map(self):
        """Wrapper para otorgar tokens usando el objeto actual"""
        bubble_map = self.get_object()
        self._award_tokens_for_bubble_map_instance(bubble_map)
    
    def _award_tokens_for_bubble_map_instance(self, bubble_map):
        """Calcular y otorgar tokens basándose en todas las burbujas (preguntas + respuestas)"""
        team = bubble_map.team
        session_stage = bubble_map.session_stage
        
        map_data = bubble_map.map_data or {}
        
        # Calcular tokens: 1 token por burbuja (preguntas + respuestas, sin la central)
        if 'questions' in map_data:
            questions = map_data.get('questions', [])
            # Contar todas las burbujas: preguntas + respuestas
            num_questions = len(questions)
            num_answers = sum(len(q.get('answers', [])) for q in questions)
            total_bubbles = num_questions + num_answers
            tokens_to_award = total_bubbles
            reason_text = f'Bubble Map: {total_bubbles} burbujas ({num_questions} preguntas + {num_answers} respuestas)'
        else:
            # Estructura antigua (compatibilidad)
            nodes = map_data.get('nodes', [])
            total_bubbles = len(nodes)
            tokens_to_award = total_bubbles
            reason_text = f'Bubble Map: {total_bubbles} burbujas'
        
        if tokens_to_award > 0:
            from .models import TokenTransaction
            
            # Verificar si ya se otorgaron tokens por este bubble map
            existing_transaction = TokenTransaction.objects.filter(
                team=team,
                game_session=team.game_session,
                session_stage=session_stage,
                source_type='activity',
                source_id=bubble_map.id
            ).first()
            
            if not existing_transaction:
                # Crear transacción de tokens
                TokenTransaction.objects.create(
                    team=team,
                    game_session=team.game_session,
                    session_stage=session_stage,
                    amount=tokens_to_award,
                    source_type='activity',
                    source_id=bubble_map.id,
                    reason=reason_text,
                    awarded_by=None
                )
                
                # Actualizar tokens del equipo
                team.tokens_total += tokens_to_award
                team.save()
