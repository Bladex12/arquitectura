"""
URLs para la app academic (estructura académica)
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FacultyViewSet, CareerViewSet, CourseViewSet

router = DefaultRouter()
router.register(r'faculties', FacultyViewSet, basename='faculty')
router.register(r'careers', CareerViewSet, basename='career')
router.register(r'courses', CourseViewSet, basename='course')

urlpatterns = [
    path('', include(router.urls)),
]

