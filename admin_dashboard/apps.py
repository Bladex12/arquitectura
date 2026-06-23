from django.apps import AppConfig


class AdminDashboardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'admin_dashboard'
    verbose_name = 'Dashboard Administrativo'
    
    def ready(self):
        import admin_dashboard.signals  # Registrar señales

