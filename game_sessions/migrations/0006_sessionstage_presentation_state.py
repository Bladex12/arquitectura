# Generated manually to add presentation_state field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('game_sessions', '0005_sessionstage_current_presentation_team_id_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='sessionstage',
            name='presentation_state',
            field=models.CharField(
                choices=[
                    ('not_started', 'No Iniciado'),
                    ('preparing', 'Preparación'),
                    ('presenting', 'Presentando'),
                    ('evaluating', 'Evaluando'),
                ],
                default='not_started',
                help_text='Estado actual del flujo de presentaciones (Etapa 4)',
                max_length=20,
                verbose_name='Estado de Presentación'
            ),
        ),
    ]

