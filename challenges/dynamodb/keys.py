"""Pure key-formatting functions for the challenges (+ admin_dashboard
metric) entities in ContentTable. No AWS calls -- see
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md
for the full key scheme."""


def metadata_sk():
    return 'METADATA'


def pad(n, width=4):
    return str(n).zfill(width)


# Stage --------------------------------------------------------------------

def stage_pk(stage_id):
    return f'STAGE#{stage_id}'


def stage_all_gsi1pk():
    return 'STAGE#ALL'


# ActivityType ---------------------------------------------------------------

def activity_type_pk(activity_type_id):
    return f'ACTIVITYTYPE#{activity_type_id}'


# Activity -------------------------------------------------------------------

def activity_sk(order_number, activity_id):
    return f'ACTIVITY#{pad(order_number)}#{activity_id}'


def activity_gsi1pk(activity_id):
    return f'ACTIVITY#{activity_id}'


# WordSearchOption -------------------------------------------------------------

def word_search_option_sk(order_number, activity_id, option_id):
    return f'ACTIVITY#{pad(order_number)}#{activity_id}#WSOPTION#{option_id}'


def word_search_option_activity_gsi1pk(activity_id):
    return f'WSOPTION#ACTIVITY#{activity_id}'


# Topic ------------------------------------------------------------------------

def topic_pk(topic_id):
    return f'TOPIC#{topic_id}'


def topic_active_gsi1pk():
    return 'TOPIC#ACTIVE'


def topic_faculty_sk(faculty_id):
    return f'FACULTY#{faculty_id}'


def topic_faculty_gsi1pk(faculty_id):
    return f'FACULTY#{faculty_id}'


# Challenge ----------------------------------------------------------------------

def challenge_sk(challenge_id):
    return f'CHALLENGE#{challenge_id}'


def challenge_gsi1pk(challenge_id):
    return f'CHALLENGE#{challenge_id}'


# Flat catalogs --------------------------------------------------------------------

def roulette_pk(roulette_id):
    return f'ROULETTE#{roulette_id}'


def minigame_pk(minigame_id):
    return f'MINIGAME#{minigame_id}'


def anagram_word_pk(word_id):
    return f'ANAGRAMWORD#{word_id}'


def chaos_question_pk(question_id):
    return f'CHAOSQ#{question_id}'


def gk_question_pk(question_id):
    return f'GKQ#{question_id}'


# LearningObjective ------------------------------------------------------------------

def learning_objective_stage_pk(stage_id):
    return f'STAGE#{stage_id if stage_id else "NONE"}'


def learning_objective_sk(objective_id):
    return f'LEARNINGOBJ#{objective_id}'


def learning_objective_gsi1pk(objective_id):
    return f'LEARNINGOBJ#{objective_id}'


# admin_dashboard metrics -----------------------------------------------------------

def activity_duration_metric_sk():
    return 'METRIC#DURATION'


def stage_duration_metric_sk():
    return 'METRIC#DURATION'


def topic_selection_metric_sk():
    return 'METRIC#SELECTION'


def challenge_selection_metric_sk(challenge_id):
    return f'CHALLENGE#{challenge_id}#METRIC#SELECTION'


def challenge_selection_metric_gsi1pk(challenge_id):
    return f'CHALLENGE#{challenge_id}'


def daily_snapshot_pk(date_iso):
    return f'SNAPSHOT#{date_iso}'


def daily_snapshot_all_gsi1pk():
    return 'SNAPSHOT#ALL'
