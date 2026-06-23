"""
Views principales del proyecto para servir HTML de prueba
"""
from django.shortcuts import render, redirect


def login_view(request):
    """Vista de login/registro"""
    return render(request, 'login.html')


def panel_view(request):
    """Vista del panel del profesor"""
    return render(request, 'profesor/panel.html')


def lobby_view(request, session_id):
    """Vista del lobby de una sesión"""
    return render(request, 'profesor/lobby.html', {'session_id': session_id})


def index_view(request):
    """Redirigir a login por defecto"""
    return redirect('login')


def tablet_join_view(request, room_code=None):
    """Vista para que las tablets se conecten a una sala"""
    context = {}
    if room_code:
        context['room_code'] = room_code.upper()
    return render(request, 'tablets/join.html', context)


def tablet_waiting_view(request):
    """Vista de espera del lobby para tablets (deprecated - usar tablet_lobby_view)"""
    return render(request, 'tablets/waiting.html')


def tablet_lobby_view(request):
    """Vista del lobby para tablets (muestra todos los equipos)"""
    return render(request, 'tablets/lobby.html')


def tablet_game_view(request):
    """Vista del juego para tablets"""
    return render(request, 'tablets/game.html')


def game_control_view(request, session_id):
    """Vista de control del juego para el profesor"""
    return render(request, 'profesor/game_control.html', {'session_id': session_id})


def personalizacion_view(request, session_id):
    """Vista de personalización para el profesor"""
    return render(request, 'profesor/personalizacion.html', {'session_id': session_id})


def presentacion_view(request, session_id):
    """Vista de presentación para el profesor"""
    return render(request, 'profesor/presentacion.html', {'session_id': session_id})


def resultados_etapa_view(request, session_id):
    """Vista de resultados de una etapa para el profesor"""
    return render(request, 'profesor/resultados_etapa.html', {'session_id': session_id})


def seleccionar_tema_view(request, session_id):
    """Vista de selección de tema para el profesor (Etapa 2)"""
    return render(request, 'profesor/seleccionar_tema.html', {'session_id': session_id})


def ver_desafio_view(request, session_id):
    """Vista de ver desafío para el profesor (Etapa 2)"""
    return render(request, 'profesor/ver_desafio.html', {'session_id': session_id})


def bubble_map_view(request, session_id):
    """Vista de bubble map para el profesor (Etapa 2)"""
    return render(request, 'profesor/bubble_map.html', {'session_id': session_id})


def prototipo_view(request, session_id):
    """Vista de subida de prototipo para el profesor (Etapa 3)"""
    return render(request, 'profesor/prototipo.html', {'session_id': session_id})


def formulario_pitch_view(request, session_id):
    """Vista de formulario de pitch para el profesor (Etapa 4)"""
    return render(request, 'profesor/formulario_pitch.html', {'session_id': session_id})


def presentacion_pitch_view(request, session_id):
    """Vista de presentación del pitch para el profesor (Etapa 4)"""
    return render(request, 'profesor/presentacion_pitch.html', {'session_id': session_id})


def confirmar_orden_pitch_view(request, session_id):
    """Vista para que el profesor confirme el orden de presentación del pitch"""
    return render(request, 'profesor/confirmar_orden_pitch.html', {'session_id': session_id})


# Vistas para tablets por actividad
def tablet_personalizacion_view(request):
    """Vista de personalización para tablets (Etapa 1)"""
    return render(request, 'tablets/etapa1/personalizacion.html')


def tablet_minijuego_view(request):
    """Vista de minijuego para tablets (Etapa 1) - puede ser anagramas, sopa de letras, etc."""
    return render(request, 'tablets/etapa1/minijuego.html')


def tablet_presentacion_view(request):
    """Vista de presentación hablando para tablets (Etapa 1)"""
    return render(request, 'tablets/etapa1/presentacion.html')


def tablet_etapa1_resultados_view(request):
    """Vista de resultados de la Etapa 1 para tablets"""
    return render(request, 'tablets/etapa1/resultados.html')


def tablet_seleccionar_tema_view(request):
    """Vista de selección de tema para tablets (Etapa 2)"""
    return render(request, 'tablets/etapa2/seleccionar-tema.html')


def tablet_seleccionar_desafio_view(request):
    """Vista de selección de desafío para tablets (Etapa 2)"""
    return render(request, 'tablets/etapa2/seleccionar-desafio.html')


def tablet_ver_desafio_view(request):
    """Vista de ver desafío para tablets (Etapa 2)"""
    return render(request, 'tablets/etapa2/ver_desafio.html')


def tablet_bubble_map_view(request):
    """Vista de bubble map para tablets (Etapa 2)"""
    return render(request, 'tablets/etapa2/bubble-map.html')


def tablet_etapa2_resultados_view(request):
    """Vista de resultados de la Etapa 2 para tablets"""
    return render(request, 'tablets/etapa2/resultados.html')


def tablet_prototipo_view(request):
    """Vista de prototipo para tablets (Etapa 3)"""
    return render(request, 'tablets/etapa3/prototipo.html')


def tablet_etapa3_resultados_view(request):
    """Vista de resultados de la Etapa 3 para tablets"""
    return render(request, 'tablets/etapa3/resultados.html')


def tablet_formulario_pitch_view(request):
    """Vista de formulario de pitch para tablets (Etapa 4)"""
    return render(request, 'tablets/etapa4/formulario-pitch.html')


def tablet_presentacion_pitch_view(request):
    """Vista de presentación del pitch para tablets (Etapa 4)"""
    return render(request, 'tablets/etapa4/presentacion-pitch.html')


def tablet_esperar_orden_pitch_view(request):
    """Vista para tablets esperando confirmación del orden de presentación"""
    return render(request, 'tablets/etapa4/esperar-orden-pitch.html')


def tablet_resultados_view(request):
    """Vista de resultados de etapa para tablets"""
    return render(request, 'tablets/resultados_etapa.html')


def profesor_reflexion_view(request, session_id):
    """Vista de reflexión para el profesor"""
    return render(request, 'profesor/reflexion.html', {'session_id': session_id})


def tablet_reflexion_view(request):
    """Vista de reflexión para tablets"""
    return render(request, 'tablets/reflexion.html')

