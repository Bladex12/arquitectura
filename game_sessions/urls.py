"""
URLs para la app game_sessions (sesiones de juego)
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    GameSessionViewSet, TeamViewSet, TeamPersonalizationViewSet,
    SessionStageViewSet, TeamActivityProgressViewSet, TeamBubbleMapViewSet,
    TabletViewSet, TabletConnectionViewSet,
    TeamRouletteAssignmentViewSet, TokenTransactionViewSet,
    PeerEvaluationViewSet, ReflectionEvaluationViewSet
)

router = DefaultRouter()
router.register(r'game-sessions', GameSessionViewSet, basename='game-session')
router.register(r'teams', TeamViewSet, basename='team')
router.register(r'team-personalizations', TeamPersonalizationViewSet, basename='team-personalization')
router.register(r'session-stages', SessionStageViewSet, basename='session-stage')
router.register(r'team-activity-progress', TeamActivityProgressViewSet, basename='team-activity-progress')
router.register(r'team-bubble-maps', TeamBubbleMapViewSet, basename='team-bubble-map')
router.register(r'tablets', TabletViewSet, basename='tablet')
router.register(r'tablet-connections', TabletConnectionViewSet, basename='tablet-connection')
router.register(r'roulette-assignments', TeamRouletteAssignmentViewSet, basename='roulette-assignment')
router.register(r'token-transactions', TokenTransactionViewSet, basename='token-transaction')
router.register(r'peer-evaluations', PeerEvaluationViewSet, basename='peer-evaluation')
router.register(r'reflection-evaluations', ReflectionEvaluationViewSet, basename='reflection-evaluation')

urlpatterns = [
    path('', include(router.urls)),
]

