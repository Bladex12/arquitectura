# Generated manually
from django.db import migrations


def create_admin_and_professor_for_staff(apps, schema_editor):
    """Crear Administrator y Professor para todos los usuarios staff existentes"""
    Administrator = apps.get_model('users', 'Administrator')
    Professor = apps.get_model('users', 'Professor')
    User = apps.get_model('auth', 'User')
    
    # Obtener todos los usuarios que son staff pero no tienen Administrator o Professor
    staff_users = User.objects.filter(is_staff=True)
    
    for user in staff_users:
        # Crear Administrator si no existe
        Administrator.objects.get_or_create(
            user=user,
            defaults={'is_super_admin': False}
        )
        
        # Crear Professor si no existe (los administradores siempre son profesores)
        Professor.objects.get_or_create(
            user=user,
            defaults={'access_code': None}
        )


def reverse_migration(apps, schema_editor):
    """No hacer nada al revertir"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_create_administrator_for_existing_superusers'),
        ('auth', '__latest__'),
    ]

    operations = [
        migrations.RunPython(
            create_admin_and_professor_for_staff,
            reverse_migration
        ),
    ]







