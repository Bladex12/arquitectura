# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('game_sessions', '0010_sessiongroup_gamesession_session_group_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='teamactivityprogress',
            name='pitch_value',
            field=models.TextField(blank=True, null=True, verbose_name='Pitch: Valor'),
        ),
        migrations.AddField(
            model_name='teamactivityprogress',
            name='pitch_impact',
            field=models.TextField(blank=True, null=True, verbose_name='Pitch: Impacto'),
        ),
    ]






