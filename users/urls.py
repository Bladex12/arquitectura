"""
URLs para la app users (autenticación y usuarios)
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)
from .views import AdministratorViewSet, ProfessorViewSet, StudentViewSet
from .custom_jwt import CustomTokenObtainPairView

router = DefaultRouter()
router.register(r'administrators', AdministratorViewSet, basename='administrator')
router.register(r'professors', ProfessorViewSet, basename='professor')
router.register(r'students', StudentViewSet, basename='student')

urlpatterns = [
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('', include(router.urls)),
]

