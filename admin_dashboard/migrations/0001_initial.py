# Generated manually for admin_dashboard

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('challenges', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ActivityDurationMetric',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('total_completions', models.IntegerField(default=0, verbose_name='Total de Completaciones')),
                ('total_duration_seconds', models.FloatField(default=0, verbose_name='Duración Total (segundos)')),
                ('avg_duration_seconds', models.FloatField(default=0, verbose_name='Duración Promedio (segundos)')),
                ('min_duration_seconds', models.FloatField(blank=True, null=True, verbose_name='Duración Mínima (segundos)')),
                ('max_duration_seconds', models.FloatField(blank=True, null=True, verbose_name='Duración Máxima (segundos)')),
                ('last_updated', models.DateTimeField(auto_now=True, verbose_name='Última Actualización')),
                ('activity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='duration_metrics', to='challenges.activity', verbose_name='Actividad')),
                ('stage', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activity_duration_metrics', to='challenges.stage', verbose_name='Etapa')),
            ],
            options={
                'verbose_name': 'Métrica de Duración de Actividad',
                'verbose_name_plural': 'Métricas de Duración de Actividades',
                'db_table': 'activity_duration_metrics',
            },
        ),
        migrations.CreateModel(
            name='ChallengeSelectionMetric',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('selection_count', models.IntegerField(default=0, verbose_name='Total de Selecciones')),
                ('avg_tokens_earned', models.FloatField(default=0, verbose_name='Tokens Promedio Obtenidos')),
                ('last_selected_at', models.DateTimeField(blank=True, null=True, verbose_name='Última Selección')),
                ('challenge', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='selection_metrics', to='challenges.challenge', verbose_name='Desafío')),
                ('topic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='challenge_selection_metrics', to='challenges.topic', verbose_name='Tema')),
            ],
            options={
                'verbose_name': 'Métrica de Selección de Desafío',
                'verbose_name_plural': 'Métricas de Selección de Desafíos',
                'db_table': 'challenge_selection_metrics',
            },
        ),
        migrations.CreateModel(
            name='DailyMetricsSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(unique=True, verbose_name='Fecha')),
                ('games_completed', models.IntegerField(default=0, verbose_name='Juegos Completados')),
                ('new_professors', models.IntegerField(default=0, verbose_name='Nuevos Profesores')),
                ('new_students', models.IntegerField(default=0, verbose_name='Nuevos Estudiantes')),
                ('total_sessions', models.IntegerField(default=0, verbose_name='Total de Sesiones')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Creado en')),
            ],
            options={
                'verbose_name': 'Snapshot Diario de Métricas',
                'verbose_name_plural': 'Snapshots Diarios de Métricas',
                'db_table': 'daily_metrics_snapshots',
                'ordering': ['-date'],
            },
        ),
        migrations.CreateModel(
            name='StageDurationMetric',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('total_completions', models.IntegerField(default=0, verbose_name='Total de Completaciones')),
                ('total_duration_seconds', models.FloatField(default=0, verbose_name='Duración Total (segundos)')),
                ('avg_duration_seconds', models.FloatField(default=0, verbose_name='Duración Promedio (segundos)')),
                ('last_updated', models.DateTimeField(auto_now=True, verbose_name='Última Actualización')),
                ('stage', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='duration_metrics', to='challenges.stage', verbose_name='Etapa')),
            ],
            options={
                'verbose_name': 'Métrica de Duración de Etapa',
                'verbose_name_plural': 'Métricas de Duración de Etapas',
                'db_table': 'stage_duration_metrics',
            },
        ),
        migrations.CreateModel(
            name='TopicSelectionMetric',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('selection_count', models.IntegerField(default=0, verbose_name='Total de Selecciones')),
                ('last_selected_at', models.DateTimeField(blank=True, null=True, verbose_name='Última Selección')),
                ('topic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='selection_metrics', to='challenges.topic', verbose_name='Tema')),
            ],
            options={
                'verbose_name': 'Métrica de Selección de Tema',
                'verbose_name_plural': 'Métricas de Selección de Temas',
                'db_table': 'topic_selection_metrics',
            },
        ),
        migrations.AddIndex(
            model_name='activitydurationmetric',
            index=models.Index(fields=['activity'], name='activity_du_activit_idx'),
        ),
        migrations.AddIndex(
            model_name='activitydurationmetric',
            index=models.Index(fields=['stage'], name='activity_du_stage_i_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='activitydurationmetric',
            unique_together={('activity', 'stage')},
        ),
        migrations.AlterUniqueTogether(
            name='stagedurationmetric',
            unique_together={('stage',)},
        ),
        migrations.AlterUniqueTogether(
            name='topicselectionmetric',
            unique_together={('topic',)},
        ),
        migrations.AlterUniqueTogether(
            name='challengeselectionmetric',
            unique_together={('challenge',)},
        ),
        migrations.AddIndex(
            model_name='dailymetricssnapshot',
            index=models.Index(fields=['date'], name='daily_metr_date_idx'),
        ),
    ]

