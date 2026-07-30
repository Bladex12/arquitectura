"""
URL configuration for mision_emprende_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from .views_health import health
from .views_frontend import spa_view

urlpatterns = [
    # Health check (Lambda Web Adapter readiness probe, no DB dependency)
    path('api/health/', health, name='health'),

    # Admin
    path('admin/', admin.site.urls),

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

# Frontend SPA (frontend/dist) -- MUST be the last thing appended to
# urlpatterns (after the DEBUG block above), and MUST NOT match api/*,
# admin/*, static/*, media/* even when unmatched by a specific route above,
# so that a typo'd/missing API path still 404s instead of returning HTML.
urlpatterns += [
    re_path(r'^(?!api/|admin/|static/|media/)(?P<path>.*)$', spa_view, name='spa'),
]
