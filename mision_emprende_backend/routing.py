"""
WebSocket URL routing for mision_emprende_backend project.
"""

from django.urls import re_path

# Importar consumers cuando los creemos
# from game_sessions.consumers import GameSessionConsumer

websocket_urlpatterns = [
    # Ejemplo de rutas WebSocket
    # re_path(r'ws/game-session/(?P<session_id>\w+)/$', GameSessionConsumer.as_asgi()),
]

