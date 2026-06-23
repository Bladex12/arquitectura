"""
URL configuration for mision_emprende_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # Frontend (HTML de prueba)
    path('', include('mision_emprende_backend.urls_frontend')),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # API Endpoints - Autenticación y Usuarios
    path('api/auth/', include('users.urls')),
    
    # API Endpoints - Estructura Académica
    path('api/academic/', include('academic.urls')),
    
    # API Endpoints - Sesiones de Juego
    path('api/sessions/', include('game_sessions.urls')),
    
    # API Endpoints - Desafíos y Retos
    path('api/challenges/', include('challenges.urls')),
    
    # API Endpoints - Dashboard Administrativo
    path('api/admin/dashboard/', include('admin_dashboard.urls')),
]

# Servir archivos estáticos y media en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    
    # Debug Toolbar
    if 'debug_toolbar' in settings.INSTALLED_APPS:
        urlpatterns += [
            path('__debug__/', include('debug_toolbar.urls')),
        ]
