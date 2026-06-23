# Generated manually
from django.db import migrations


def create_professor_for_administrators(apps, schema_editor):
    """Crear perfil de profesor para todos los administradores existentes"""
    Administrator = apps.get_model('users', 'Administrator')
    Professor = apps.get_model('users', 'Professor')
    
    # Obtener todos los administradores que no tienen perfil de profesor
    administrators = Administrator.objects.all()
    
    for admin in administrators:
        # Crear perfil de profesor si no existe
        Professor.objects.get_or_create(
            user=admin.user,
            defaults={'access_code': None}
        )


def reverse_migration(apps, schema_editor):
    """No hacer nada al revertir (los perfiles de profesor pueden quedarse)"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_professoraccesscode'),
    ]

    operations = [
        migrations.RunPython(
            create_professor_for_administrators,
            reverse_migration
        ),
    ]







