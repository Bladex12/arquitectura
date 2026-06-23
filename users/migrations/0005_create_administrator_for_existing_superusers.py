# Generated manually
from django.db import migrations
from django.contrib.auth.models import User


def create_administrator_for_superusers(apps, schema_editor):
    """Crear objeto Administrator para todos los usuarios superuser/staff existentes"""
    from django.db.models import Q
    Administrator = apps.get_model('users', 'Administrator')
    User = apps.get_model('auth', 'User')
    
    # Obtener todos los usuarios que son superuser o staff pero no tienen Administrator
    superusers = User.objects.filter(
        Q(is_superuser=True) | Q(is_staff=True)
    )
    
    for user in superusers:
        # Crear Administrator si no existe
        Administrator.objects.get_or_create(
            user=user,
            defaults={'is_super_admin': user.is_superuser}
        )


def reverse_migration(apps, schema_editor):
    """No hacer nada al revertir"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_professoraccesscode_prof_access_code_lookup_idx'),
        ('auth', '__latest__'),
    ]

    operations = [
        migrations.RunPython(
            create_administrator_for_superusers,
            reverse_migration
        ),
    ]

