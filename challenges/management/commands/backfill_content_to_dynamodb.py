"""
Backfill academic/challenges/admin_dashboard RDS MySQL data into the new
ContentTable DynamoDB table.

Reads via the real Django ORM classes frozen in each app's
legacy_orm_models.py (not the live academic/models.py /
challenges/models.py / admin_dashboard/models.py, which are DynamoDB
compatibility shims, not ORM models) -- see those files' docstrings.

Preserves each row's MySQL auto-increment id (stringified) as the
DynamoDB item's id, per docs/superpowers/specs/
2026-08-03-academic-challenges-dynamodb-migration-design.md -- existing
game_sessions DynamoDB items already reference these ids (course_id,
current_stage_id, current_activity_id), so minting fresh ids would
orphan them.

Idempotent: every write is an unconditional put_item, safe to re-run.

Usage:
    python manage.py backfill_content_to_dynamodb --dry-run
    python manage.py backfill_content_to_dynamodb
    python manage.py backfill_content_to_dynamodb --verify
"""
import os
from decimal import Decimal

import boto3
from django.core.management.base import BaseCommand

from academic.legacy_orm_models import Faculty, Career, Course
from challenges.legacy_orm_models import (
    Stage, ActivityType, Activity, WordSearchOption, Topic, Challenge,
    RouletteChallenge, Minigame, LearningObjective, AnagramWord,
    ChaosQuestion, GeneralKnowledgeQuestion,
)
from admin_dashboard.legacy_orm_models import (
    ActivityDurationMetric, StageDurationMetric, TopicSelectionMetric,
    ChallengeSelectionMetric, DailyMetricsSnapshot,
)


def get_table():
    dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    return dynamodb.Table(os.environ['CONTENT_TABLE'])


def num(value):
    """DynamoDB has no native float type -- boto3 requires Decimal."""
    if value is None:
        return None
    return Decimal(str(value))


def iso(dt):
    return dt.isoformat() if dt else None


def pad(n, width=4):
    return str(n).zfill(width)


# ---------------------------------------------------------------------------
# Item builders -- one per entity, matching the design doc's key scheme.
# ---------------------------------------------------------------------------

def faculty_item(f):
    item = {
        'PK': f'FACULTY#{f.id}', 'SK': 'METADATA', 'type': 'Faculty',
        'id': str(f.id), 'name': f.name, 'code': f.code,
        'is_active': f.is_active, 'created_at': iso(f.created_at), 'updated_at': iso(f.updated_at),
    }
    if f.is_active:
        item['GSI1PK'] = 'FACULTY#ACTIVE'
        item['GSI1SK'] = f.name
    return item


def career_item(c):
    return {
        'PK': f'CAREER#{c.id}', 'SK': 'METADATA', 'type': 'Career',
        'id': str(c.id), 'faculty_id': str(c.faculty_id), 'name': c.name, 'code': c.code,
        'is_active': c.is_active, 'created_at': iso(c.created_at), 'updated_at': iso(c.updated_at),
        'GSI1PK': f'FACULTY#{c.faculty_id}', 'GSI1SK': f'CAREER#{c.name}',
    }


def course_item(c, faculty_id):
    return {
        'PK': f'COURSE#{c.id}', 'SK': 'METADATA', 'type': 'Course',
        'id': str(c.id), 'career_id': str(c.career_id), 'faculty_id': str(faculty_id),
        'name': c.name, 'code': c.code,
        'is_active': c.is_active, 'created_at': iso(c.created_at), 'updated_at': iso(c.updated_at),
        'GSI1PK': f'CAREER#{c.career_id}', 'GSI1SK': f'COURSE#{c.name}',
    }


def stage_item(s):
    return {
        'PK': f'STAGE#{s.id}', 'SK': 'METADATA', 'type': 'Stage',
        'id': str(s.id), 'number': s.number, 'name': s.name, 'description': s.description,
        'objective': s.objective, 'estimated_duration': s.estimated_duration,
        'is_active': s.is_active, 'created_at': iso(s.created_at), 'updated_at': iso(s.updated_at),
        'GSI1PK': 'STAGE#ALL', 'GSI1SK': pad(s.number),
    }


def activity_type_item(t):
    return {
        'PK': f'ACTIVITYTYPE#{t.id}', 'SK': 'METADATA', 'type': 'ActivityType',
        'id': str(t.id), 'code': t.code, 'name': t.name, 'description': t.description,
        'is_active': t.is_active, 'created_at': iso(t.created_at), 'updated_at': iso(t.updated_at),
    }


def activity_item(a):
    return {
        'PK': f'STAGE#{a.stage_id}', 'SK': f'ACTIVITY#{pad(a.order_number)}#{a.id}', 'type': 'Activity',
        'id': str(a.id), 'stage_id': str(a.stage_id), 'activity_type_id': str(a.activity_type_id),
        'name': a.name, 'description': a.description, 'order_number': a.order_number,
        'timer_duration': a.timer_duration, 'config_data': a.config_data,
        'is_active': a.is_active, 'created_at': iso(a.created_at), 'updated_at': iso(a.updated_at),
        'GSI1PK': f'ACTIVITY#{a.id}', 'GSI1SK': 'METADATA',
    }


def word_search_option_item(o):
    activity = o.activity
    return {
        'PK': f'STAGE#{activity.stage_id}',
        'SK': f'ACTIVITY#{pad(activity.order_number)}#{activity.id}#WSOPTION#{o.id}',
        'type': 'WordSearchOption',
        'id': str(o.id), 'activity_id': str(o.activity_id), 'name': o.name,
        'words': o.words, 'grid': o.grid, 'word_positions': o.word_positions, 'seed': o.seed,
        'is_active': o.is_active, 'created_at': iso(o.created_at), 'updated_at': iso(o.updated_at),
        'GSI1PK': f'WSOPTION#ACTIVITY#{o.activity_id}', 'GSI1SK': o.name,
    }


def topic_item(t):
    item = {
        'PK': f'TOPIC#{t.id}', 'SK': 'METADATA', 'type': 'Topic',
        'id': str(t.id), 'name': t.name, 'icon': t.icon, 'description': t.description,
        'image_url': t.image_url, 'category': t.category,
        'is_active': t.is_active, 'created_at': iso(t.created_at), 'updated_at': iso(t.updated_at),
    }
    if t.is_active:
        item['GSI1PK'] = 'TOPIC#ACTIVE'
        item['GSI1SK'] = t.name
    return item


def topic_faculty_item(topic_id, faculty_id):
    return {
        'PK': f'TOPIC#{topic_id}', 'SK': f'FACULTY#{faculty_id}', 'type': 'TopicFaculty',
        'topic_id': str(topic_id), 'faculty_id': str(faculty_id),
        'GSI1PK': f'FACULTY#{faculty_id}', 'GSI1SK': f'TOPIC#{topic_id}',
    }


def challenge_item(c):
    return {
        'PK': f'TOPIC#{c.topic_id}', 'SK': f'CHALLENGE#{c.id}', 'type': 'Challenge',
        'id': str(c.id), 'topic_id': str(c.topic_id), 'title': c.title, 'description': c.description,
        'icon': c.icon, 'persona_name': c.persona_name, 'persona_age': c.persona_age,
        'persona_story': c.persona_story,
        'persona_image': c.persona_image.name if c.persona_image else None,
        'difficulty_level': c.difficulty_level, 'learning_objectives': c.learning_objectives,
        'additional_resources': c.additional_resources,
        'is_active': c.is_active, 'created_at': iso(c.created_at), 'updated_at': iso(c.updated_at),
        'GSI1PK': f'CHALLENGE#{c.id}', 'GSI1SK': 'METADATA',
    }


def roulette_challenge_item(r):
    return {
        'PK': f'ROULETTE#{r.id}', 'SK': 'METADATA', 'type': 'RouletteChallenge',
        'id': str(r.id), 'description': r.description, 'challenge_type': r.challenge_type,
        'difficulty_estimated': r.difficulty_estimated, 'token_reward_min': r.token_reward_min,
        'token_reward_max': r.token_reward_max, 'stages_applicable': r.stages_applicable,
        'is_active': r.is_active, 'created_at': iso(r.created_at), 'updated_at': iso(r.updated_at),
    }


def minigame_item(m):
    return {
        'PK': f'MINIGAME#{m.id}', 'SK': 'METADATA', 'type': 'Minigame',
        'id': str(m.id), 'name': m.name, 'minigame_type': m.type, 'config': m.config,
        'is_active': m.is_active, 'created_at': iso(m.created_at), 'updated_at': iso(m.updated_at),
    }


def learning_objective_item(lo):
    stage_bucket = str(lo.stage_id) if lo.stage_id else 'NONE'
    return {
        'PK': f'STAGE#{stage_bucket}', 'SK': f'LEARNINGOBJ#{lo.id}', 'type': 'LearningObjective',
        'id': str(lo.id), 'stage_id': str(lo.stage_id) if lo.stage_id else None,
        'title': lo.title, 'description': lo.description, 'evaluation_criteria': lo.evaluation_criteria,
        'pedagogical_recommendations': lo.pedagogical_recommendations, 'estimated_time': lo.estimated_time,
        'associated_resources': lo.associated_resources,
        'is_active': lo.is_active, 'created_at': iso(lo.created_at), 'updated_at': iso(lo.updated_at),
        'GSI1PK': f'LEARNINGOBJ#{lo.id}', 'GSI1SK': 'METADATA',
    }


def anagram_word_item(w):
    return {
        'PK': f'ANAGRAMWORD#{w.id}', 'SK': 'METADATA', 'type': 'AnagramWord',
        'id': str(w.id), 'word': w.word, 'scrambled_word': w.scrambled_word,
        'is_active': w.is_active, 'created_at': iso(w.created_at), 'updated_at': iso(w.updated_at),
    }


def chaos_question_item(q):
    return {
        'PK': f'CHAOSQ#{q.id}', 'SK': 'METADATA', 'type': 'ChaosQuestion',
        'id': str(q.id), 'question': q.question,
        'is_active': q.is_active, 'created_at': iso(q.created_at), 'updated_at': iso(q.updated_at),
    }


def general_knowledge_question_item(q):
    return {
        'PK': f'GKQ#{q.id}', 'SK': 'METADATA', 'type': 'GeneralKnowledgeQuestion',
        'id': str(q.id), 'question': q.question,
        'option_a': q.option_a, 'option_b': q.option_b, 'option_c': q.option_c, 'option_d': q.option_d,
        'correct_answer': q.correct_answer,
        'is_active': q.is_active, 'created_at': iso(q.created_at), 'updated_at': iso(q.updated_at),
    }


def activity_duration_metric_item(m):
    return {
        'PK': f'ACTIVITY#{m.activity_id}', 'SK': 'METRIC#DURATION', 'type': 'ActivityDurationMetric',
        'activity_id': str(m.activity_id), 'stage_id': str(m.stage_id),
        'total_completions': m.total_completions, 'total_duration_seconds': num(m.total_duration_seconds),
        'min_duration_seconds': num(m.min_duration_seconds), 'max_duration_seconds': num(m.max_duration_seconds),
        'last_updated': iso(m.last_updated),
    }


def stage_duration_metric_item(m):
    return {
        'PK': f'STAGE#{m.stage_id}', 'SK': 'METRIC#DURATION', 'type': 'StageDurationMetric',
        'stage_id': str(m.stage_id),
        'total_completions': m.total_completions, 'total_duration_seconds': num(m.total_duration_seconds),
        'last_updated': iso(m.last_updated),
    }


def topic_selection_metric_item(m):
    return {
        'PK': f'TOPIC#{m.topic_id}', 'SK': 'METRIC#SELECTION', 'type': 'TopicSelectionMetric',
        'topic_id': str(m.topic_id),
        'selection_count': m.selection_count, 'last_selected_at': iso(m.last_selected_at),
    }


def challenge_selection_metric_item(m):
    return {
        'PK': f'TOPIC#{m.topic_id}', 'SK': f'CHALLENGE#{m.challenge_id}#METRIC#SELECTION',
        'type': 'ChallengeSelectionMetric',
        'challenge_id': str(m.challenge_id), 'topic_id': str(m.topic_id),
        'selection_count': m.selection_count, 'avg_tokens_earned': num(m.avg_tokens_earned),
        'last_selected_at': iso(m.last_selected_at),
        'GSI1PK': f'CHALLENGE#{m.challenge_id}', 'GSI1SK': 'METRIC',
    }


def daily_metrics_snapshot_item(s):
    return {
        'PK': f'SNAPSHOT#{s.date.isoformat()}', 'SK': 'METADATA', 'type': 'DailyMetricsSnapshot',
        'date': s.date.isoformat(), 'games_completed': s.games_completed,
        'new_professors': s.new_professors, 'new_students': s.new_students,
        'total_sessions': s.total_sessions, 'created_at': iso(s.created_at),
        'GSI1PK': 'SNAPSHOT#ALL', 'GSI1SK': s.date.isoformat(),
    }


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = 'Backfills academic/challenges/admin_dashboard RDS data into ContentTable (DynamoDB).'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Print row counts only, write nothing.')
        parser.add_argument('--verify', action='store_true', help='Re-read every written item and diff against the ORM source.')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        verify = options['verify']

        builders = self._collect_items()

        if dry_run:
            for label, items in builders:
                self.stdout.write(f'{label}: {len(items)} row(s)')
            self.stdout.write(self.style.SUCCESS(f'Dry run: {sum(len(i) for _, i in builders)} total row(s), nothing written.'))
            return

        table = get_table()
        total = 0
        with table.batch_writer() as batch:
            for label, items in builders:
                for item in items:
                    clean = {k: v for k, v in item.items() if v is not None}
                    batch.put_item(Item=clean)
                total += len(items)
                self.stdout.write(f'{label}: wrote {len(items)} row(s)')

        self.stdout.write(self.style.SUCCESS(f'Backfill complete: {total} item(s) written to ContentTable.'))

        if verify:
            self._verify(table, builders)

    def _collect_items(self):
        faculties = list(Faculty.objects.all())
        careers = list(Career.objects.select_related('faculty').all())
        courses = list(Course.objects.select_related('career').all())
        faculty_by_career = {c.id: c.faculty_id for c in careers}

        stages = list(Stage.objects.all())
        activity_types = list(ActivityType.objects.all())
        activities = list(Activity.objects.all())
        word_search_options = list(WordSearchOption.objects.select_related('activity').all())

        topics = list(Topic.objects.prefetch_related('faculties').all())
        topic_faculty_pairs = [
            (t.id, f.id) for t in topics for f in t.faculties.all()
        ]
        challenges = list(Challenge.objects.all())

        roulette_challenges = list(RouletteChallenge.objects.all())
        minigames = list(Minigame.objects.all())
        learning_objectives = list(LearningObjective.objects.all())
        anagram_words = list(AnagramWord.objects.all())
        chaos_questions = list(ChaosQuestion.objects.all())
        gk_questions = list(GeneralKnowledgeQuestion.objects.all())

        activity_duration_metrics = list(ActivityDurationMetric.objects.all())
        stage_duration_metrics = list(StageDurationMetric.objects.all())
        topic_selection_metrics = list(TopicSelectionMetric.objects.all())
        challenge_selection_metrics = list(ChallengeSelectionMetric.objects.all())
        daily_snapshots = list(DailyMetricsSnapshot.objects.all())

        return [
            ('Faculty', [faculty_item(f) for f in faculties]),
            ('Career', [career_item(c) for c in careers]),
            ('Course', [course_item(c, faculty_by_career.get(c.career_id)) for c in courses]),
            ('Stage', [stage_item(s) for s in stages]),
            ('ActivityType', [activity_type_item(t) for t in activity_types]),
            ('Activity', [activity_item(a) for a in activities]),
            ('WordSearchOption', [word_search_option_item(o) for o in word_search_options]),
            ('Topic', [topic_item(t) for t in topics]),
            ('TopicFaculty', [topic_faculty_item(tid, fid) for tid, fid in topic_faculty_pairs]),
            ('Challenge', [challenge_item(c) for c in challenges]),
            ('RouletteChallenge', [roulette_challenge_item(r) for r in roulette_challenges]),
            ('Minigame', [minigame_item(m) for m in minigames]),
            ('LearningObjective', [learning_objective_item(lo) for lo in learning_objectives]),
            ('AnagramWord', [anagram_word_item(w) for w in anagram_words]),
            ('ChaosQuestion', [chaos_question_item(q) for q in chaos_questions]),
            ('GeneralKnowledgeQuestion', [general_knowledge_question_item(q) for q in gk_questions]),
            ('ActivityDurationMetric', [activity_duration_metric_item(m) for m in activity_duration_metrics]),
            ('StageDurationMetric', [stage_duration_metric_item(m) for m in stage_duration_metrics]),
            ('TopicSelectionMetric', [topic_selection_metric_item(m) for m in topic_selection_metrics]),
            ('ChallengeSelectionMetric', [challenge_selection_metric_item(m) for m in challenge_selection_metrics]),
            ('DailyMetricsSnapshot', [daily_metrics_snapshot_item(s) for s in daily_snapshots]),
        ]

    def _verify(self, table, builders):
        mismatches = 0
        checked = 0
        for label, items in builders:
            for expected in items:
                checked += 1
                resp = table.get_item(Key={'PK': expected['PK'], 'SK': expected['SK']})
                actual = resp.get('Item')
                if actual is None:
                    self.stdout.write(self.style.ERROR(f'[{label}] MISSING PK={expected["PK"]} SK={expected["SK"]}'))
                    mismatches += 1
                    continue
                for k, v in expected.items():
                    if v is None:
                        continue
                    if actual.get(k) != v:
                        self.stdout.write(self.style.WARNING(
                            f'[{label}] MISMATCH PK={expected["PK"]} SK={expected["SK"]} '
                            f'field={k} expected={v!r} actual={actual.get(k)!r}'
                        ))
                        mismatches += 1
        if mismatches:
            self.stdout.write(self.style.ERROR(f'Verify: {mismatches} mismatch(es) across {checked} item(s).'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Verify: all {checked} item(s) match.'))
