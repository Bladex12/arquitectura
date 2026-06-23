# Generated manually to remove duplicates before adding unique constraint

from django.db import migrations


def remove_duplicate_progress(apps, schema_editor):
    """
    Eliminar registros duplicados de TeamActivityProgress antes de aplicar la restricción unique_together
    Mantener el registro con mejor estado (completed > in_progress > submitted > pending)
    """
    TeamActivityProgress = apps.get_model('game_sessions', 'TeamActivityProgress')
    
    # Obtener todos los grupos de registros duplicados
    from django.db.models import Count
    duplicates = TeamActivityProgress.objects.values(
        'team_id', 'activity_id', 'session_stage_id'
    ).annotate(
        count=Count('id')
    ).filter(count__gt=1)
    
    status_priority = {'completed': 4, 'in_progress': 3, 'submitted': 2, 'pending': 1}
    
    for dup in duplicates:
        # Obtener todos los registros duplicados para este grupo
        progress_list = TeamActivityProgress.objects.filter(
            team_id=dup['team_id'],
            activity_id=dup['activity_id'],
            session_stage_id=dup['session_stage_id']
        )
        
        # Mantener el registro con mejor estado
        best_progress = max(progress_list, key=lambda p: status_priority.get(p.status, 0))
        
        # Eliminar los demás
        progress_list.exclude(id=best_progress.id).delete()


def reverse_remove_duplicates(apps, schema_editor):
    """
    No hay nada que revertir (los duplicados ya fueron eliminados)
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('game_sessions', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(remove_duplicate_progress, reverse_remove_duplicates),
    ]

