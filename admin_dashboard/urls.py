"""
URLs para el Dashboard Administrativo
Completamente separado del flujo del juego
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminDashboardViewSet

router = DefaultRouter()
router.register(r'', AdminDashboardViewSet, basename='admin-dashboard')

urlpatterns = [
    path('', include(router.urls)),
]

