"""
Serializers para la app game_sessions

DynamoDB cutover (Task 9): every entity in this file used to be a
serializers.ModelSerializer over a Django ORM instance, relying on lazy FK
traversal for display fields (e.g. `professor.user.get_full_name`). Runtime
game_sessions data now lives in DynamoDB as plain dicts (see
game_sessions/dynamodb/*.py) -- dicts have no FK traversal, so every
serializer below is a plain serializers.Serializer with explicit fields,
and every denormalized "display" field (e.g. professor_name, team_name,
stage_name) is filled in by a companion annotate_<x>_display_fields()
function BEFORE the dict is handed to the serializer. Annotate helpers do
the explicit lookups (into users/academic/challenges ORM apps, which stay
on Django ORM/MySQL unchanged, and/or into game_sessions.dynamodb.* for
other DynamoDB entities like Team/Tablet) -- serializers themselves never
do cross-app lookups internally, except where noted (TeamSerializer.students,
TeamActivityProgressSerializer.selected_topic/selected_challenge), which the
task brief explicitly carves out as unchanged nested-lookup patterns.

Identifier-type note: every synthetic auto-increment `id` the ORM used to
hand out is gone. Where the DynamoDB item carries its own natural
identifying attribute (room_code, team_id, stage_id, tablet_code,
team_session_token), `id` is sourced from that attribute with the matching
field type (CharField for UUID/code-like strings, IntegerField for real
challenges-app ints like stage_id). Where an item has no such attribute
(TeamActivityProgress, TeamRouletteAssignment, TokenTransaction,
TeamBubbleMap, PeerEvaluation, ReflectionEvaluation -- all addressed by a
composite natural key or an append-only ledger key), `id` is sourced from
the DynamoDB item's own `SK`, which plays the same "opaque unique row
identifier" role the ORM's auto-increment id used to play.
"""
from rest_framework import serializers

from users.serializers import StudentSerializer


# ---------------------------------------------------------------------------
# GameSession
# ---------------------------------------------------------------------------

class GameSessionSerializer(serializers.Serializer):
    """Serializes a GameSession dict from game_sessions.dynamodb.game_session.
    Expects display fields already attached via annotate_game_session_display_fields()
    -- this serializer does no cross-app lookups itself."""
    id = serializers.CharField(source='room_code')  # room_code IS the id now
    professor = serializers.IntegerField(source='professor_id')
    professor_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    course = serializers.IntegerField(source='course_id')
    course_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    room_code = serializers.CharField()
    qr_code = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField()
    started_at = serializers.DateTimeField(allow_null=True, required=False)
    ended_at = serializers.DateTimeField(allow_null=True, required=False)
    current_stage = serializers.IntegerField(source='current_stage_id', allow_null=True, required=False)
    current_stage_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    current_stage_number = serializers.IntegerField(read_only=True, default=None, allow_null=True)
    current_activity = serializers.IntegerField(source='current_activity_id', allow_null=True, required=False)
    current_activity_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    current_session_stage = serializers.SerializerMethodField()
    cancellation_reason = serializers.CharField(allow_null=True, required=False)
    cancellation_reason_other = serializers.CharField(allow_null=True, required=False)
    show_results_stage = serializers.IntegerField()
    teams_count = serializers.IntegerField(read_only=True, default=0)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()

    def get_current_session_stage(self, obj):
        """SessionStage has no synthetic id of its own in the new schema --
        it's identified by (room_code, stage_id), and stage_id IS
        SessionStageSerializer's `id` below. So "the currently active
        SessionStage's id" is simply the session's current_stage_id."""
        return obj.get('current_stage_id')


def annotate_game_session_display_fields(session_dict, teams=None):
    """Mutates and returns session_dict with display fields fetched from
    each owning app's own ORM (users/academic/challenges stay on Django
    ORM/MySQL, unchanged by the DynamoDB cutover). Call once per session
    before serializing -- batch professor/course lookups across a list
    with .filter(id__in=...) when serializing many sessions to avoid N+1.

    Pass teams (a list of Team dicts, e.g. from
    game_sessions.dynamodb.team.list_teams) to fill teams_count; omitted,
    teams_count defaults to 0.
    """
    from users.models import Professor
    from academic.models import Course
    from challenges.models import Stage, Activity

    try:
        professor = Professor.objects.select_related('user').get(id=session_dict['professor_id'])
        session_dict['professor_name'] = professor.user.get_full_name() or professor.user.username
    except Professor.DoesNotExist:
        session_dict['professor_name'] = None

    try:
        course = Course.objects.get(id=session_dict['course_id'])
        session_dict['course_name'] = course.name
    except Course.DoesNotExist:
        session_dict['course_name'] = None

    current_stage_id = session_dict.get('current_stage_id')
    if current_stage_id:
        try:
            stage = Stage.objects.get(id=current_stage_id)
            session_dict['current_stage_name'] = stage.name
            session_dict['current_stage_number'] = stage.number
        except Stage.DoesNotExist:
            session_dict['current_stage_name'] = None
            session_dict['current_stage_number'] = None
    else:
        session_dict['current_stage_name'] = None
        session_dict['current_stage_number'] = None

    current_activity_id = session_dict.get('current_activity_id')
    if current_activity_id:
        try:
            activity = Activity.objects.get(id=current_activity_id)
            session_dict['current_activity_name'] = activity.name
        except Activity.DoesNotExist:
            session_dict['current_activity_name'] = None
    else:
        session_dict['current_activity_name'] = None

    session_dict['teams_count'] = len(teams) if teams is not None else 0

    return session_dict


class GameSessionCreateSerializer(serializers.Serializer):
    """Serializer para crear una Sesión de Juego. Validates the shape of the
    creation payload before calling game_sessions.dynamodb.game_session.create_session
    (which enforces room_code uniqueness itself via a ConditionExpression)."""
    professor = serializers.IntegerField()
    course = serializers.IntegerField()
    room_code = serializers.CharField()


# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------

class TeamSerializer(serializers.Serializer):
    """Serializes a Team dict from game_sessions.dynamodb.team. No annotate
    helper needed -- game_session_room_code needs no cross-app lookup (the
    Team item already carries room_code as a plain field), and `students`
    is an explicit carved-out exception (see brief) doing its own batched
    users-app query directly in the SerializerMethodField below, same as
    students_count."""
    id = serializers.CharField(source='team_id', read_only=True)
    game_session = serializers.CharField(source='room_code')
    game_session_room_code = serializers.CharField(source='room_code', read_only=True)
    name = serializers.CharField()
    color = serializers.CharField()
    tokens_total = serializers.IntegerField(read_only=True, default=0)
    students = serializers.SerializerMethodField()
    student_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    students_count = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_students(self, obj):
        from users.models import Student

        student_ids = obj.get('student_ids') or []
        students = Student.objects.filter(id__in=student_ids)
        return StudentSerializer(students, many=True).data

    def get_students_count(self, obj):
        return len(obj.get('student_ids') or [])

    def validate_student_ids(self, value):
        from users.models import Student

        existing_ids = set(Student.objects.filter(id__in=value).values_list('id', flat=True))
        missing_ids = [student_id for student_id in value if student_id not in existing_ids]
        if missing_ids:
            raise serializers.ValidationError(
                f"Los siguientes estudiantes no existen: {missing_ids}"
            )
        return value


# ---------------------------------------------------------------------------
# TeamPersonalization
# ---------------------------------------------------------------------------

class TeamPersonalizationSerializer(serializers.Serializer):
    """TeamPersonalization is not a separate DynamoDB entity -- its fields
    are embedded directly on the Team item as personalization_team_name /
    personalization_members_know_each_other (see
    game_sessions.dynamodb.team.create_team). This is a thin wrapper
    exposing those two fields (plus the team's own id/name/timestamps)
    from a Team dict. No annotate helper needed -- everything comes from
    the same Team dict, no cross-app lookup required."""
    team = serializers.CharField(source='team_id')
    team_name_display = serializers.CharField(source='name', read_only=True)
    team_name = serializers.CharField(
        source='personalization_team_name', allow_null=True, required=False
    )
    team_members_know_each_other = serializers.BooleanField(
        source='personalization_members_know_each_other', allow_null=True, required=False
    )
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


# ---------------------------------------------------------------------------
# SessionStage
# ---------------------------------------------------------------------------

class SessionStageSerializer(serializers.Serializer):
    """Serializes a SessionStage dict from game_sessions.dynamodb.stage_progress.
    Expects display fields already attached via annotate_session_stage_display_fields()."""
    id = serializers.IntegerField(source='stage_id')  # stage_id IS the id now
    game_session = serializers.CharField(source='room_code')
    game_session_room_code = serializers.CharField(source='room_code', read_only=True)
    stage = serializers.IntegerField(source='stage_id')
    stage_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    stage_number = serializers.IntegerField(read_only=True, default=None, allow_null=True)
    status = serializers.CharField()
    started_at = serializers.DateTimeField(allow_null=True, required=False)
    completed_at = serializers.DateTimeField(allow_null=True, required=False)
    presentation_order = serializers.JSONField(allow_null=True, required=False)
    # Used to be a plain int FK-less field pointing at a Team's pk; Team ids
    # are UUID4 strings now, so this becomes a CharField.
    current_presentation_team_id = serializers.CharField(allow_null=True, required=False)
    presentation_state = serializers.CharField()
    presentation_timestamps = serializers.JSONField(allow_null=True, required=False)


def annotate_session_stage_display_fields(stage_dict):
    """Mutates and returns stage_dict with stage_name/stage_number fetched
    from challenges.models.Stage (stays on Django ORM/MySQL)."""
    from challenges.models import Stage

    try:
        stage = Stage.objects.get(id=stage_dict['stage_id'])
        stage_dict['stage_name'] = stage.name
        stage_dict['stage_number'] = stage.number
    except Stage.DoesNotExist:
        stage_dict['stage_name'] = None
        stage_dict['stage_number'] = None

    return stage_dict


# ---------------------------------------------------------------------------
# TeamActivityProgress
# ---------------------------------------------------------------------------

class TeamActivityProgressSerializer(serializers.Serializer):
    """Serializes a TeamActivityProgress dict from
    game_sessions.dynamodb.stage_progress.upsert_progress/get_progress.
    Expects display fields already attached via
    annotate_team_activity_progress_display_fields(). No standalone id
    attribute exists on this item (it's addressed by the composite
    (team_id, activity_id) key).

    `id` is NOT sourced from the item's own SK ("TEAM#<team_id>#PROGRESS#
    <activity_id>") like most other Task 9 serializers -- Task 15 found
    that raw SK is unusable as a URL path segment: '#' is the URL fragment
    delimiter, so any client building "/team-activity-progress/<id>/" from
    it (e.g. teamActivityProgressAPI.update(progress.id, ...) in
    frontend/src/services/teamActivityProgress.ts) has everything from the
    first '#' onward silently stripped before the request is even sent --
    confirmed empirically via APIClient, which received a PATH_INFO
    truncated to "/team-activity-progress/TEAM" (see task-15-report.md).
    `id` is instead a colon-joined "<team_id>:<activity_id>" -- team_id is
    a UUID4 (no colons), activity_id is a plain int, and ':' is not a URL
    reserved character, so this survives a real HTTP round-trip.
    TeamActivityProgressViewSet._parse_progress_pk (game_sessions/views.py)
    is the corresponding parser.

    selected_topic/selected_challenge remain SerializerMethodFields doing
    a direct lookup by plain int id, unchanged in spirit from the old
    FK-traversal version (per brief)."""
    id = serializers.SerializerMethodField()

    def get_id(self, obj):
        return f"{obj['team_id']}:{obj['activity_id']}"

    team = serializers.CharField(source='team_id')
    team_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    session_stage = serializers.IntegerField(read_only=True, default=None, allow_null=True)
    stage_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    activity = serializers.IntegerField(source='activity_id')
    activity_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    status = serializers.CharField()
    started_at = serializers.DateTimeField(allow_null=True, required=False)
    completed_at = serializers.DateTimeField(allow_null=True, required=False)
    progress_percentage = serializers.IntegerField()
    response_data = serializers.JSONField(allow_null=True, required=False)
    selected_topic = serializers.SerializerMethodField()
    selected_challenge = serializers.SerializerMethodField()
    prototype_image_url = serializers.CharField(allow_null=True, required=False)
    pitch_intro_problem = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    pitch_solution = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    pitch_value = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    pitch_impact = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    pitch_closing = serializers.CharField(allow_null=True, required=False, allow_blank=True)

    def get_selected_topic(self, obj):
        """Devolver el tema completo si está seleccionado"""
        topic_id = obj.get('selected_topic_id')
        if not topic_id:
            return None
        from challenges.models import Topic
        from challenges.serializers import TopicSerializer

        try:
            topic = Topic.objects.get(id=topic_id)
        except Topic.DoesNotExist:
            return None
        return TopicSerializer(topic).data

    def get_selected_challenge(self, obj):
        """Devolver el desafío completo si está seleccionado"""
        challenge_id = obj.get('selected_challenge_id')
        if not challenge_id:
            return None
        from challenges.models import Challenge
        from challenges.serializers import ChallengeSerializer

        try:
            challenge = Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return None
        return ChallengeSerializer(challenge).data


def annotate_team_activity_progress_display_fields(progress_dict, team=None):
    """Mutates and returns progress_dict with team_name (via
    game_sessions.dynamodb.team.get_team, since Team is itself a DynamoDB
    entity now) and activity_name/stage_name/session_stage (via
    challenges.models.Activity, which stays on Django ORM/MySQL).

    The TeamActivityProgress item has no stored session_stage_id -- each
    Activity belongs to exactly one Stage, so the owning stage is derived
    from the activity itself. session_stage is set to that stage's id,
    consistent with SessionStageSerializer.id also being stage_id.

    Pass team (a pre-fetched Team dict) to avoid a per-item DynamoDB
    lookup when annotating many progress rows for the same team.
    """
    from challenges.models import Activity
    from game_sessions.dynamodb.team import get_team

    if team is None:
        team = get_team(progress_dict['room_code'], progress_dict['team_id'])
    progress_dict['team_name'] = team['name'] if team else None

    try:
        activity = Activity.objects.select_related('stage').get(id=progress_dict['activity_id'])
        progress_dict['activity_name'] = activity.name
        progress_dict['stage_name'] = activity.stage.name
        progress_dict['session_stage'] = activity.stage_id
    except Activity.DoesNotExist:
        progress_dict['activity_name'] = None
        progress_dict['stage_name'] = None
        progress_dict['session_stage'] = None

    return progress_dict


# ---------------------------------------------------------------------------
# Tablet
# ---------------------------------------------------------------------------

class TabletSerializer(serializers.Serializer):
    """Serializes a Tablet catalog dict from game_sessions.dynamodb.catalog.
    Trivial passthrough -- no cross-app lookups, no annotate helper needed.
    tablet_code is the item's own natural key now, so id is sourced from it."""
    id = serializers.CharField(source='tablet_code')
    tablet_code = serializers.CharField()
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


# ---------------------------------------------------------------------------
# TabletConnection
# ---------------------------------------------------------------------------

class TabletConnectionSerializer(serializers.Serializer):
    """Serializes a TabletConnection dict from
    game_sessions.dynamodb.tablet_connection. Expects display fields
    already attached via annotate_tablet_connection_display_fields().
    team_session_token is the item's own unique key now (there's no
    separate autoincrement id anymore), so id is sourced from it."""
    id = serializers.CharField(source='team_session_token')
    tablet = serializers.CharField(source='tablet_id', allow_null=True, required=False)
    tablet_code = serializers.CharField(read_only=True, default=None, allow_null=True)
    team = serializers.CharField(source='team_id')
    team_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    game_session = serializers.CharField(source='room_code')
    # room_code is already a plain field on the item -- no lookup needed, unlike before.
    game_session_room_code = serializers.CharField(source='room_code', read_only=True)
    connected_at = serializers.DateTimeField()
    disconnected_at = serializers.DateTimeField(allow_null=True, required=False)
    last_seen = serializers.DateTimeField()
    is_connected = serializers.SerializerMethodField()
    team_session_token = serializers.CharField()
    current_screen = serializers.CharField(allow_blank=True, required=False)

    def get_is_connected(self, obj):
        return obj.get('disconnected_at') is None


def annotate_tablet_connection_display_fields(connection_dict, team=None, tablet=None):
    """Mutates and returns connection_dict with tablet_code (via
    game_sessions.dynamodb.catalog.get_tablet) and team_name (via
    game_sessions.dynamodb.team.get_team) -- both DynamoDB entities now,
    not ORM FKs. Pass pre-fetched team/tablet dicts to avoid a per-item
    lookup when annotating many connections in the same room."""
    from game_sessions.dynamodb.catalog import get_tablet
    from game_sessions.dynamodb.team import get_team

    team_id = connection_dict.get('team_id')
    if team_id:
        if team is None:
            team = get_team(connection_dict['room_code'], team_id)
        connection_dict['team_name'] = team['name'] if team else None
    else:
        connection_dict['team_name'] = None

    tablet_id = connection_dict.get('tablet_id')
    if tablet_id:
        if tablet is None:
            tablet = get_tablet(tablet_id)
        connection_dict['tablet_code'] = tablet['tablet_code'] if tablet else None
    else:
        connection_dict['tablet_code'] = None

    return connection_dict


# ---------------------------------------------------------------------------
# TeamRouletteAssignment
# ---------------------------------------------------------------------------

class TeamRouletteAssignmentSerializer(serializers.Serializer):
    """Serializes a TeamRouletteAssignment dict from
    game_sessions.dynamodb.bubble_roulette. Expects display fields already
    attached via annotate_team_roulette_assignment_display_fields(). No
    standalone id attribute exists on this item (addressed by the
    composite (team_id, stage_id) key).

    `id` is NOT sourced from the item's own SK ("TEAM#<team_id>#ROULETTE#
    <stage_id>") -- Task 15 found that raw SK is unusable as a URL path
    segment ('#' is the URL fragment delimiter, silently truncating any
    client-built "/roulette-assignments/<id>/" request at the first '#')
    and fixed the same dormant issue on TeamActivityProgressSerializer;
    this serializer had the identical issue (flagged, unfixed, by a prior
    task's audit) and is fixed here the same way: `id` is a colon-joined
    "<team_id>:<session_stage_id>" -- team_id is a UUID4 (no colons),
    session_stage_id is a plain int, and ':' is not a URL reserved
    character. TeamRouletteAssignmentViewSet._parse_pk (game_sessions/
    views.py) is the corresponding parser."""
    id = serializers.SerializerMethodField()

    def get_id(self, obj):
        return f"{obj['team_id']}:{obj['stage_id']}"

    team = serializers.CharField(source='team_id')
    team_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    session_stage = serializers.IntegerField(source='stage_id')
    roulette_challenge = serializers.IntegerField(source='roulette_challenge_id')
    challenge_description = serializers.CharField(read_only=True, default=None, allow_null=True)
    challenge_type = serializers.CharField(read_only=True, default=None, allow_null=True)
    status = serializers.CharField()
    token_reward = serializers.IntegerField()
    assigned_at = serializers.DateTimeField()
    accepted_at = serializers.DateTimeField(allow_null=True, required=False)
    rejected_at = serializers.DateTimeField(allow_null=True, required=False)
    completed_at = serializers.DateTimeField(allow_null=True, required=False)
    validated_by = serializers.IntegerField(source='validated_by_id', allow_null=True, required=False)
    validated_by_name = serializers.CharField(read_only=True, default=None, allow_null=True)


def annotate_team_roulette_assignment_display_fields(assignment_dict, team=None):
    """Mutates and returns assignment_dict with team_name (via
    game_sessions.dynamodb.team.get_team), challenge_description/
    challenge_type (via challenges.models.RouletteChallenge) and
    validated_by_name (via users.models.Professor) -- the latter two stay
    on Django ORM/MySQL. Pass a pre-fetched team dict to avoid a per-item
    DynamoDB lookup when annotating many assignments for the same team."""
    from challenges.models import RouletteChallenge
    from users.models import Professor
    from game_sessions.dynamodb.team import get_team

    if team is None:
        team = get_team(assignment_dict['room_code'], assignment_dict['team_id'])
    assignment_dict['team_name'] = team['name'] if team else None

    try:
        roulette_challenge = RouletteChallenge.objects.get(id=assignment_dict['roulette_challenge_id'])
        assignment_dict['challenge_description'] = roulette_challenge.description
        assignment_dict['challenge_type'] = roulette_challenge.challenge_type
    except RouletteChallenge.DoesNotExist:
        assignment_dict['challenge_description'] = None
        assignment_dict['challenge_type'] = None

    validated_by_id = assignment_dict.get('validated_by_id')
    if validated_by_id:
        try:
            professor = Professor.objects.select_related('user').get(id=validated_by_id)
            assignment_dict['validated_by_name'] = professor.user.get_full_name() or professor.user.username
        except Professor.DoesNotExist:
            assignment_dict['validated_by_name'] = None
    else:
        assignment_dict['validated_by_name'] = None

    return assignment_dict


# ---------------------------------------------------------------------------
# TokenTransaction
# ---------------------------------------------------------------------------

class TokenTransactionSerializer(serializers.Serializer):
    """Serializes a TokenTransaction dict from
    game_sessions.dynamodb.token_transaction. Expects display fields
    already attached via annotate_token_transaction_display_fields(). This
    is an append-only ledger item with no standalone id attribute --
    `id` is sourced from the item's own SK."""
    id = serializers.CharField(source='SK', read_only=True)
    team = serializers.CharField(source='team_id')
    team_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    game_session = serializers.CharField(source='room_code')
    game_session_room_code = serializers.CharField(source='room_code', read_only=True)
    session_stage = serializers.IntegerField(source='session_stage_id', allow_null=True, required=False)
    stage_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    stage_number = serializers.IntegerField(read_only=True, default=None, allow_null=True)
    amount = serializers.IntegerField()
    source_type = serializers.CharField()
    # NOT an IntegerField (as it was under the ORM, where TokenTransaction.
    # source_id was a plain IntegerField): the Task 15/16 token-award
    # convention (see TeamActivityProgressViewSet._award_tokens) and this
    # task's roulette-assignment award both write source_id as a composite
    # string like "<team_id>:<activity_id>:<reason_tag>" or
    # "<team_id>:<session_stage_id>", never a bare int. This field was
    # dormant (never exercised end-to-end) until this task ported
    # TokenTransactionViewSet off the ORM -- IntegerField.to_representation
    # would raise on any 'activity'/'roulette_challenge' transaction's
    # string source_id.
    source_id = serializers.CharField(allow_null=True, required=False)
    reason = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    awarded_by = serializers.IntegerField(source='awarded_by_id', allow_null=True, required=False)
    awarded_by_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    created_at = serializers.DateTimeField()


def annotate_token_transaction_display_fields(tx_dict, team=None):
    """Mutates and returns tx_dict with team_name (via
    game_sessions.dynamodb.team.get_team), stage_name/stage_number (via
    challenges.models.Stage, keyed by session_stage_id -- which holds the
    same challenges.Stage id that SessionStageSerializer.id exposes) and
    awarded_by_name (via users.models.Professor). Pass a pre-fetched team
    dict to avoid a per-item DynamoDB lookup when annotating many
    transactions for the same team."""
    from challenges.models import Stage
    from users.models import Professor
    from game_sessions.dynamodb.team import get_team

    if team is None:
        team = get_team(tx_dict['room_code'], tx_dict['team_id'])
    tx_dict['team_name'] = team['name'] if team else None

    session_stage_id = tx_dict.get('session_stage_id')
    if session_stage_id:
        try:
            stage = Stage.objects.get(id=session_stage_id)
            tx_dict['stage_name'] = stage.name
            tx_dict['stage_number'] = stage.number
        except Stage.DoesNotExist:
            tx_dict['stage_name'] = None
            tx_dict['stage_number'] = None
    else:
        tx_dict['stage_name'] = None
        tx_dict['stage_number'] = None

    awarded_by_id = tx_dict.get('awarded_by_id')
    if awarded_by_id:
        try:
            professor = Professor.objects.select_related('user').get(id=awarded_by_id)
            tx_dict['awarded_by_name'] = professor.user.get_full_name() or professor.user.username
        except Professor.DoesNotExist:
            tx_dict['awarded_by_name'] = None
    else:
        tx_dict['awarded_by_name'] = None

    return tx_dict


# ---------------------------------------------------------------------------
# TeamBubbleMap
# ---------------------------------------------------------------------------

class TeamBubbleMapSerializer(serializers.Serializer):
    """Serializes a TeamBubbleMap dict from game_sessions.dynamodb.bubble_roulette.
    Expects display fields already attached via
    annotate_team_bubble_map_display_fields(). No standalone id attribute
    exists on this item (addressed by the composite (team_id, stage_id)
    key) -- `id` is sourced from the item's own SK."""
    id = serializers.CharField(source='SK', read_only=True)
    team = serializers.CharField(source='team_id')
    team_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    session_stage = serializers.IntegerField(source='stage_id')
    stage_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    map_data = serializers.JSONField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


def annotate_team_bubble_map_display_fields(bubble_map_dict, team=None):
    """Mutates and returns bubble_map_dict with team_name (via
    game_sessions.dynamodb.team.get_team) and stage_name (via
    challenges.models.Stage). Pass a pre-fetched team dict to avoid a
    per-item DynamoDB lookup when annotating many bubble maps for the
    same team."""
    from challenges.models import Stage
    from game_sessions.dynamodb.team import get_team

    if team is None:
        team = get_team(bubble_map_dict['room_code'], bubble_map_dict['team_id'])
    bubble_map_dict['team_name'] = team['name'] if team else None

    try:
        stage = Stage.objects.get(id=bubble_map_dict['stage_id'])
        bubble_map_dict['stage_name'] = stage.name
    except Stage.DoesNotExist:
        bubble_map_dict['stage_name'] = None

    return bubble_map_dict


# ---------------------------------------------------------------------------
# PeerEvaluation
# ---------------------------------------------------------------------------

class PeerEvaluationSerializer(serializers.Serializer):
    """Serializes a PeerEvaluation dict from game_sessions.dynamodb.evaluations.
    Expects display fields already attached via
    annotate_peer_evaluation_display_fields(). No standalone id attribute
    exists on this item (addressed by the composite (evaluator_team_id,
    evaluated_team_id) key) -- `id` is sourced from the item's own SK."""
    id = serializers.CharField(source='SK', read_only=True)
    evaluator_team = serializers.CharField(source='evaluator_team_id')
    evaluator_team_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    evaluated_team = serializers.CharField(source='evaluated_team_id')
    evaluated_team_name = serializers.CharField(read_only=True, default=None, allow_null=True)
    game_session = serializers.CharField(source='room_code')
    game_session_room_code = serializers.CharField(source='room_code', read_only=True)
    criteria_scores = serializers.JSONField()
    total_score = serializers.IntegerField()
    tokens_awarded = serializers.IntegerField()
    feedback = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    submitted_at = serializers.DateTimeField()


def annotate_peer_evaluation_display_fields(evaluation_dict, evaluator_team=None, evaluated_team=None):
    """Mutates and returns evaluation_dict with evaluator_team_name/
    evaluated_team_name (via game_sessions.dynamodb.team.get_team). Pass
    pre-fetched team dicts to avoid per-item DynamoDB lookups when
    annotating many evaluations in the same room."""
    from game_sessions.dynamodb.team import get_team

    room_code = evaluation_dict['room_code']
    if evaluator_team is None:
        evaluator_team = get_team(room_code, evaluation_dict['evaluator_team_id'])
    if evaluated_team is None:
        evaluated_team = get_team(room_code, evaluation_dict['evaluated_team_id'])

    evaluation_dict['evaluator_team_name'] = evaluator_team['name'] if evaluator_team else None
    evaluation_dict['evaluated_team_name'] = evaluated_team['name'] if evaluated_team else None

    return evaluation_dict


# ---------------------------------------------------------------------------
# ReflectionEvaluation
# ---------------------------------------------------------------------------

class ReflectionEvaluationSerializer(serializers.Serializer):
    """Serializes a ReflectionEvaluation dict from
    game_sessions.dynamodb.evaluations. No annotate helper needed --
    faculty/career are (and always were) plain text fields on the item,
    not FKs, and game_session_room_code needs no lookup since room_code is
    already a plain field on the item. No standalone id attribute exists
    on this item -- `id` is sourced from the item's own SK (which embeds a
    real uuid4 for this entity, per game_sessions.dynamodb.keys.reflection_sk)."""
    id = serializers.CharField(source='SK', read_only=True)
    game_session = serializers.CharField(source='room_code')
    game_session_room_code = serializers.CharField(source='room_code', read_only=True)
    student_name = serializers.CharField()
    student_email = serializers.CharField()
    faculty = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    career = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    value_areas = serializers.JSONField(required=False)
    satisfaction = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    entrepreneurship_interest = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    comments = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    created_at = serializers.DateTimeField()
