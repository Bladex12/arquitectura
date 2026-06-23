"""
URLs para el frontend (HTML de prueba)
"""
from django.urls import path
from .views import (
    login_view, panel_view, lobby_view, index_view,
    tablet_join_view, tablet_waiting_view, tablet_lobby_view, tablet_game_view,
    game_control_view, personalizacion_view, presentacion_view, resultados_etapa_view,
    seleccionar_tema_view, ver_desafio_view, bubble_map_view, prototipo_view,
    formulario_pitch_view, presentacion_pitch_view, confirmar_orden_pitch_view,
    profesor_reflexion_view, tablet_reflexion_view,
    tablet_personalizacion_view, tablet_minijuego_view, tablet_presentacion_view, tablet_etapa1_resultados_view,
    tablet_etapa2_resultados_view, tablet_etapa3_resultados_view,
    tablet_seleccionar_tema_view, tablet_seleccionar_desafio_view, tablet_ver_desafio_view, tablet_bubble_map_view,
    tablet_prototipo_view, tablet_formulario_pitch_view, tablet_presentacion_pitch_view, tablet_esperar_orden_pitch_view,
    tablet_resultados_view
)

urlpatterns = [
    path('', index_view, name='index'),
    path('login/', login_view, name='login'),
    path('panel/', panel_view, name='panel'),
    path('lobby/<int:session_id>/', lobby_view, name='lobby'),
    path('game-control/<int:session_id>/', game_control_view, name='game_control'),  # Mantener compatibilidad
    # Etapa 1: Trabajo en Equipo
    path('profesor/etapa1/personalizacion/<int:session_id>/', personalizacion_view, name='personalizacion'),
    path('profesor/etapa1/presentacion/<int:session_id>/', presentacion_view, name='presentacion'),
    # Etapa 2: Empatía
    path('profesor/etapa2/seleccionar-tema/<int:session_id>/', seleccionar_tema_view, name='seleccionar_tema'),
    path('profesor/etapa2/ver-desafio/<int:session_id>/', ver_desafio_view, name='ver_desafio'),
    path('profesor/etapa2/bubble-map/<int:session_id>/', bubble_map_view, name='bubble_map'),
    # Etapa 3: Creatividad
    path('profesor/etapa3/prototipo/<int:session_id>/', prototipo_view, name='prototipo'),
    # Etapa 4: Comunicación
    path('profesor/etapa4/formulario-pitch/<int:session_id>/', formulario_pitch_view, name='formulario_pitch'),
    path('profesor/etapa4/confirmar-orden-pitch/<int:session_id>/', confirmar_orden_pitch_view, name='confirmar_orden_pitch'),
    path('profesor/etapa4/presentacion-pitch/<int:session_id>/', presentacion_pitch_view, name='presentacion_pitch'),
    # Resultados (común para todas las etapas)
    path('profesor/resultados/<int:session_id>/', resultados_etapa_view, name='resultados_etapa'),
    # Reflexión (cierre del juego)
    path('profesor/reflexion/<int:session_id>/', profesor_reflexion_view, name='profesor_reflexion'),
    # URLs legacy (redirects para mantener compatibilidad)
    path('profesor/personalizacion/<int:session_id>/', personalizacion_view, name='personalizacion_legacy'),
    path('profesor/presentacion/<int:session_id>/', presentacion_view, name='presentacion_legacy'),
    path('profesor/seleccionar_tema/<int:session_id>/', seleccionar_tema_view, name='seleccionar_tema_legacy'),
    path('profesor/ver_desafio/<int:session_id>/', ver_desafio_view, name='ver_desafio_legacy'),
    path('profesor/bubble_map/<int:session_id>/', bubble_map_view, name='bubble_map_legacy'),
    
    # URLs para tablets
    path('tablet/join/', tablet_join_view, name='tablet_join'),
    path('tablet/join/<str:room_code>/', tablet_join_view, name='tablet_join_with_code'),
    path('tablet/waiting/', tablet_waiting_view, name='tablet_waiting'),
    path('tablet/lobby/', tablet_lobby_view, name='tablet_lobby'),
    path('tablet/game/', tablet_game_view, name='tablet_game'),  # Mantener para compatibilidad
    # Etapa 1: Trabajo en Equipo (tablets)
    path('tablet/etapa1/personalizacion/', tablet_personalizacion_view, name='tablet_personalizacion'),
    path('tablet/etapa1/minijuego/', tablet_minijuego_view, name='tablet_minijuego'),
    path('tablet/etapa1/presentacion/', tablet_presentacion_view, name='tablet_presentacion'),
    path('tablet/etapa1/resultados/', tablet_etapa1_resultados_view, name='tablet_etapa1_resultados'),
    # Etapa 2: Empatía (tablets)
    path('tablet/etapa2/seleccionar-tema/', tablet_seleccionar_tema_view, name='tablet_seleccionar_tema'),
    path('tablet/etapa2/seleccionar-desafio/', tablet_seleccionar_desafio_view, name='tablet_seleccionar_desafio'),
    path('tablet/etapa2/ver-desafio/', tablet_ver_desafio_view, name='tablet_ver_desafio'),
    path('tablet/etapa2/bubble-map/', tablet_bubble_map_view, name='tablet_bubble_map'),
    path('tablet/etapa2/resultados/', tablet_etapa2_resultados_view, name='tablet_etapa2_resultados'),
    # Etapa 3: Creatividad (tablets)
    path('tablet/etapa3/prototipo/', tablet_prototipo_view, name='tablet_prototipo'),
    path('tablet/etapa3/resultados/', tablet_etapa3_resultados_view, name='tablet_etapa3_resultados'),
    # Etapa 4: Comunicación (tablets)
    path('tablet/etapa4/formulario-pitch/', tablet_formulario_pitch_view, name='tablet_formulario_pitch'),
    path('tablet/etapa4/esperar-orden-pitch/', tablet_esperar_orden_pitch_view, name='tablet_esperar_orden_pitch'),
    path('tablet/etapa4/presentacion-pitch/', tablet_presentacion_pitch_view, name='tablet_presentacion_pitch'),
    # Resultados (tablets)
    path('tablet/resultados/', tablet_resultados_view, name='tablet_resultados'),
    # Reflexión (tablets)
    path('tablet/reflexion/', tablet_reflexion_view, name='tablet_reflexion'),
]

