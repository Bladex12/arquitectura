"""
URLs para la app sessions (sesiones de juego)
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Importar views cuando las creemos
# from .views import GameSessionViewSet, TeamViewSet, SessionStageViewSet

# router = DefaultRouter()
# router.register(r'game-sessions', GameSessionViewSet, basename='game-session')
# router.register(r'teams', TeamViewSet, basename='team')
# router.register(r'stages', SessionStageViewSet, basename='session-stage')

urlpatterns = [
    # path('', include(router.urls)),
]

