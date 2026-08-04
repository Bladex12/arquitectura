"""
Compatibility shim: Stage/ActivityType/Activity/Topic/Challenge/
RouletteChallenge/WordSearchOption/Minigame/LearningObjective/AnagramWord/
ChaosQuestion/GeneralKnowledgeQuestion used to be Django ORM models.
They're now plain Python classes backed by DynamoDB's ContentTable (see
challenges/dynamodb/ and
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md).

This shim exists so existing call sites (challenges/views.py,
challenges/serializers.py, the six challenges/management/commands/*.py
seed commands, admin_dashboard/views.py, admin_dashboard/services.py, and
game_sessions call sites) keep working with `.objects.get/.filter/
.create/.get_or_create(...)` call shapes.

The real Django ORM class definitions this replaced are frozen in
challenges/legacy_orm_models.py, used only by the one-time RDS->DynamoDB
backfill script.
"""
import random
from typing import Optional, Dict

from django.core.exceptions import ObjectDoesNotExist

from challenges.dynamodb import stage as stage_repo
from challenges.dynamodb import activity_type as activity_type_repo
from challenges.dynamodb import activity as activity_repo
from challenges.dynamodb import word_search_option as wso_repo
from challenges.dynamodb import topic as topic_repo
from challenges.dynamodb import challenge as challenge_repo
from challenges.dynamodb import roulette_challenge as roulette_repo
from challenges.dynamodb import minigame as minigame_repo
from challenges.dynamodb import learning_objective as lo_repo
from challenges.dynamodb import anagram_word as anagram_repo
from challenges.dynamodb import chaos_question as chaos_repo
from challenges.dynamodb import general_knowledge_question as gk_repo


class _ListResult(list):
    """list subclass adding the QuerySet-ish methods actual call sites
    use: .exists(), .first(), .values_list(field), .order_by(field),
    .count() (zero-arg, QuerySet-style -- shadows list.count(value) on
    purpose, no call site here uses the built-in single-value form)."""

    def exists(self):
        return len(self) > 0

    def first(self):
        return self[0] if self else None

    def values_list(self, field, flat=False):
        return [getattr(obj, field) for obj in self]

    def order_by(self, field):
        reverse = field.startswith('-')
        field = field.lstrip('-')
        return _ListResult(sorted(self, key=lambda o: getattr(o, field), reverse=reverse))

    def count(self):
        return len(self)

    def exclude(self, **kwargs):
        def matches(obj):
            return all(getattr(obj, k, None) == v for k, v in kwargs.items())
        return _ListResult(o for o in self if not matches(o))


def _id_of(value):
    if value is None:
        return None
    return getattr(value, 'id', value)


# ---------------------------------------------------------------------------
# Stage
# ---------------------------------------------------------------------------

class Stage:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None, number=None, is_active=None):
            if id is not None or pk is not None:
                item = stage_repo.get_stage(_id_of(id if id is not None else pk))
            elif number is not None:
                item = stage_repo.find_stage_by_number(number)
                if item and is_active is not None and item['is_active'] != is_active:
                    item = None
            else:
                raise ValueError('Stage.objects.get() needs id/pk or number')
            if item is None:
                raise Stage.DoesNotExist('Stage does not exist')
            return Stage(item)

        def filter(self, is_active=None, id__in=None, number=None):
            if id__in is not None:
                items = list(stage_repo.get_stages_by_ids([_id_of(i) for i in id__in]).values())
            else:
                items = stage_repo.list_stages(active_only=is_active is True)
                if is_active is False:
                    items = [i for i in items if not i['is_active']]
            if number is not None:
                items = [i for i in items if i['number'] == number]
            return _ListResult(Stage(i) for i in items)

        def all(self):
            return self.filter()

        def create(self, *, number, name, description=None, objective=None,
                   estimated_duration=None, is_active=True):
            return Stage(stage_repo.create_stage(
                number=number, name=name, description=description, objective=objective,
                estimated_duration=estimated_duration, is_active=is_active,
            ))

        def get_or_create(self, *, number, defaults=None):
            existing = stage_repo.find_stage_by_number(number)
            if existing:
                return Stage(existing), False
            fields = dict(defaults or {})
            fields.setdefault('name', '')
            return Stage(stage_repo.create_stage(number=number, **fields)), True

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.number = item['number']
        self.name = item['name']
        self.description = item.get('description')
        self.objective = item.get('objective')
        self.estimated_duration = item.get('estimated_duration')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')

    def __str__(self):
        return f"Etapa {self.number}: {self.name}"

    def save(self):
        item = stage_repo.update_stage(self.id, {
            'number': self.number, 'name': self.name, 'description': self.description,
            'objective': self.objective, 'estimated_duration': self.estimated_duration,
            'is_active': self.is_active,
        })
        self.updated_at = item['updated_at']


# ---------------------------------------------------------------------------
# ActivityType
# ---------------------------------------------------------------------------

class ActivityType:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None, code=None):
            if id is not None or pk is not None:
                item = activity_type_repo.get_activity_type(_id_of(id if id is not None else pk))
            elif code is not None:
                item = activity_type_repo.find_activity_type_by_code(code)
            else:
                raise ValueError('ActivityType.objects.get() needs id/pk or code')
            if item is None:
                raise ActivityType.DoesNotExist('ActivityType does not exist')
            return ActivityType(item)

        def filter(self, is_active=None, id__in=None, code=None):
            if id__in is not None:
                items = list(activity_type_repo.get_activity_types_by_ids([_id_of(i) for i in id__in]).values())
            else:
                items = activity_type_repo.list_activity_types(active_only=is_active is True)
                if is_active is False:
                    items = [i for i in items if not i['is_active']]
            if code is not None:
                items = [i for i in items if i['code'] == code]
            return _ListResult(ActivityType(i) for i in items)

        def all(self):
            return self.filter()

        def create(self, *, code, name, description=None, is_active=True):
            return ActivityType(activity_type_repo.create_activity_type(
                code=code, name=name, description=description, is_active=is_active,
            ))

        def get_or_create(self, *, code, defaults=None):
            existing = activity_type_repo.find_activity_type_by_code(code)
            if existing:
                return ActivityType(existing), False
            fields = dict(defaults or {})
            fields.setdefault('name', code)
            return ActivityType(activity_type_repo.create_activity_type(code=code, **fields)), True

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.code = item['code']
        self.name = item['name']
        self.description = item.get('description')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')

    def __str__(self):
        return self.name

    def save(self):
        item = activity_type_repo.update_activity_type(self.id, {
            'code': self.code, 'name': self.name, 'description': self.description,
            'is_active': self.is_active,
        })
        self.updated_at = item['updated_at']


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------

class Activity:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None, stage=None, stage_id=None, activity_type=None,
                 activity_type_id=None, is_active=None):
            if id is not None or pk is not None:
                item = activity_repo.get_activity(_id_of(id if id is not None else pk))
                if item is None:
                    raise Activity.DoesNotExist('Activity does not exist')
                return Activity(item)
            match = self.filter(stage=stage, stage_id=stage_id, activity_type=activity_type,
                                 activity_type_id=activity_type_id, is_active=is_active).first()
            if match is None:
                raise Activity.DoesNotExist('Activity does not exist')
            return match

        def filter(self, stage=None, stage_id=None, activity_type=None, activity_type_id=None,
                   is_active=None, id__in=None, name__icontains=None):
            if id__in is not None:
                items = list(activity_repo.get_activities_by_ids([_id_of(i) for i in id__in]).values())
            else:
                sid = _id_of(stage) if stage is not None else stage_id
                if sid is not None:
                    items = activity_repo.list_activities_for_stage(sid)
                else:
                    items = activity_repo.list_activities()
                atid = _id_of(activity_type) if activity_type is not None else activity_type_id
                if atid is not None:
                    items = [i for i in items if i['activity_type_id'] == str(atid)]
                if is_active is not None:
                    items = [i for i in items if i['is_active'] == is_active]
                if name__icontains is not None:
                    needle = name__icontains.lower()
                    items = [i for i in items if needle in (i['name'] or '').lower()]
            items = sorted(items, key=lambda i: i['order_number'])
            return _ListResult(Activity(i) for i in items)

        def all(self):
            return _ListResult(Activity(i) for i in activity_repo.list_activities())

        def select_related(self, *_args, **_kwargs):
            return self

        def prefetch_related(self, *_args, **_kwargs):
            return self

        def create(self, *, stage, activity_type, name, order_number, description=None,
                   timer_duration=None, config_data=None, is_active=True):
            return Activity(activity_repo.create_activity(
                stage_id=_id_of(stage), activity_type_id=_id_of(activity_type), name=name,
                order_number=order_number, description=description, timer_duration=timer_duration,
                config_data=config_data, is_active=is_active,
            ))

        def get_or_create(self, *, stage, order_number, defaults=None):
            sid = _id_of(stage)
            existing = activity_repo.find_activity(sid, order_number)
            if existing:
                return Activity(existing), False
            fields = dict(defaults or {})
            fields['activity_type_id'] = _id_of(fields.pop('activity_type', fields.get('activity_type_id')))
            fields.setdefault('name', '')
            fields.pop('order_number', None)
            item = activity_repo.create_activity(stage_id=sid, order_number=order_number, **fields)
            return Activity(item), True

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.stage_id = item['stage_id']
        self.activity_type_id = item['activity_type_id']
        self.name = item['name']
        self.description = item.get('description')
        self.order_number = item['order_number']
        self.timer_duration = item.get('timer_duration')
        self.config_data = item.get('config_data')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')
        self._stage = None
        self._activity_type = None

    def __str__(self):
        return f"{self.stage.name} - {self.name}" if self.stage else self.name

    @property
    def stage(self):
        if self._stage is None and self.stage_id:
            item = stage_repo.get_stage(self.stage_id)
            self._stage = Stage(item) if item else None
        return self._stage

    @stage.setter
    def stage(self, value):
        self._stage = value
        self.stage_id = _id_of(value)

    @property
    def stage_name(self):
        return self.stage.name if self.stage else None

    @property
    def activity_type(self):
        if self._activity_type is None and self.activity_type_id:
            item = activity_type_repo.get_activity_type(self.activity_type_id)
            self._activity_type = ActivityType(item) if item else None
        return self._activity_type

    @activity_type.setter
    def activity_type(self, value):
        self._activity_type = value
        self.activity_type_id = _id_of(value)

    @property
    def activity_type_name(self):
        return self.activity_type.name if self.activity_type else None

    @property
    def word_search_options(self):
        items = wso_repo.list_word_search_options_for_activity(self.id)
        return _ListResult(WordSearchOption(i) for i in items)

    def save(self):
        item = activity_repo.update_activity(self.id, {
            'stage_id': self.stage_id, 'activity_type_id': self.activity_type_id, 'name': self.name,
            'description': self.description, 'order_number': self.order_number,
            'timer_duration': self.timer_duration, 'config_data': self.config_data,
            'is_active': self.is_active,
        })
        self.updated_at = item['updated_at']

    # -- Business logic (ported unchanged from the pre-migration ORM model) --

    def get_word_search_data(self, team_id: Optional[int] = None, session_stage_id: Optional[int] = None) -> Optional[Dict]:
        from challenges.services import generate_word_search

        config = self.config_data or {}

        if self.activity_type.code not in ['minigame', 'minijuego']:
            return None

        options_list = [o for o in self.word_search_options if o.is_active]

        words = []
        seed = None

        if options_list:
            if team_id is not None and session_stage_id is not None:
                seed_string = f"{team_id}_{session_stage_id}_{self.id}"
                seed_value = abs(sum(ord(c) for c in seed_string))
                selected_index = seed_value % len(options_list)
            else:
                selected_index = random.randint(0, len(options_list) - 1)

            selected_option = options_list[selected_index]
            words = selected_option.words if isinstance(selected_option.words, list) else []

            if selected_option.grid and selected_option.word_positions:
                words_list = [w.upper() if isinstance(w, str) else str(w).upper() for w in words] if words else []
                return {
                    'words': words_list,
                    'grid': selected_option.grid,
                    'wordPositions': selected_option.word_positions,
                }

            if seed is None:
                seed = selected_option.id_int * 1000 + (team_id or 0) + (session_stage_id or 0)
        elif config.get('words'):
            words_config = config.get('words', [])
            if isinstance(words_config, list):
                if words_config and isinstance(words_config[0], str):
                    words = words_config
                elif words_config and isinstance(words_config[0], dict):
                    words = [w.get('word', '') for w in words_config if w.get('word')]

            if team_id is not None and session_stage_id is not None:
                seed_string = f"{team_id}_{session_stage_id}_{self.id}"
                seed = abs(sum(ord(c) for c in seed_string))

        if not words:
            return None

        return generate_word_search(words, seed=seed)

    def get_bubble_map_config(self) -> Dict:
        config = self.config_data or {}
        bubble_map_config = config.get('bubble_map', {})

        return {
            'max_answers_per_question': bubble_map_config.get('max_answers_per_question', 4),
            'max_questions': bubble_map_config.get('max_questions', 7),
            'max_question_length': bubble_map_config.get('max_question_length', 60),
            'max_answer_length': bubble_map_config.get('max_answer_length', 30),
        }

    def get_anagram_data(self, count: int = 5, team_id: Optional[int] = None, session_stage_id: Optional[int] = None) -> Optional[Dict]:
        all_words = anagram_repo.list_anagram_words(active_only=True)

        if not all_words:
            return None

        if len(all_words) < count:
            raise ValueError(f'No hay suficientes palabras activas. Se requieren {count} pero solo hay {len(all_words)}')

        if team_id is not None and session_stage_id is not None:
            seed_string = f"{team_id}_{session_stage_id}_{self.id}"
            seed_value = abs(sum(ord(c) for c in seed_string))
            random.seed(seed_value)
            selected_words = random.sample(all_words, count)
            random.seed()
        else:
            selected_words = random.sample(all_words, count)

        return {
            'words': [
                {'word': w['word'], 'anagram': w['scrambled_word']}
                for w in selected_words
            ]
        }

    def get_chaos_data(self, team_id: Optional[int] = None, session_stage_id: Optional[int] = None) -> Optional[Dict]:
        if self.activity_type.code not in ['presentation', 'presentación']:
            return None

        active_questions = chaos_repo.list_chaos_questions(active_only=True)

        if not active_questions:
            return None

        return {
            'available_count': len(active_questions),
            'questions_available': True,
        }

    def get_general_knowledge_data(self, count: int = 5, team_id: Optional[int] = None, session_stage_id: Optional[int] = None) -> Optional[Dict]:
        all_questions = gk_repo.list_general_knowledge_questions(active_only=True)

        if not all_questions:
            return None

        if len(all_questions) < count:
            raise ValueError(f'No hay suficientes preguntas activas. Se requieren {count} pero solo hay {len(all_questions)}')

        if team_id is not None and session_stage_id is not None:
            seed_string = f"{team_id}_{session_stage_id}_{self.id}_gk"
            seed_value = abs(sum(ord(c) for c in seed_string))
            random.seed(seed_value)
            selected_questions = random.sample(all_questions, count)
            random.seed()
        else:
            selected_questions = random.sample(all_questions, count)

        questions_data = []
        for q in selected_questions:
            questions_data.append({
                'id': q['id'],
                'question': q['question'],
                'option_a': q['option_a'],
                'option_b': q['option_b'],
                'option_c': q['option_c'],
                'option_d': q['option_d'],
                'correct_answer': q['correct_answer'],
                'options': [
                    {'label': 'A', 'text': q['option_a']},
                    {'label': 'B', 'text': q['option_b']},
                    {'label': 'C', 'text': q['option_c']},
                    {'label': 'D', 'text': q['option_d']},
                ]
            })

        return {'questions': questions_data}


# ---------------------------------------------------------------------------
# Topic
# ---------------------------------------------------------------------------

class Topic:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            item = topic_repo.get_topic(_id_of(id if id is not None else pk))
            if item is None:
                raise Topic.DoesNotExist('Topic does not exist')
            return Topic(item)

        def filter(self, is_active=None, faculty_id=None, id__in=None):
            if id__in is not None:
                items = list(topic_repo.get_topics_by_ids([_id_of(i) for i in id__in]).values())
            elif faculty_id is not None:
                items = topic_repo.list_topics_for_faculty(faculty_id, active_only=is_active is True)
                if is_active is False:
                    items = [i for i in items if not i['is_active']]
            else:
                items = topic_repo.list_topics(active_only=is_active is True)
                if is_active is False:
                    items = [i for i in items if not i['is_active']]
            return _ListResult(Topic(i) for i in items)

        def all(self):
            return self.filter()

        def prefetch_related(self, *_args, **_kwargs):
            return self

        def create(self, *, name, icon=None, description=None, image_url=None, category=None,
                   is_active=True, faculties=None):
            faculty_ids = [_id_of(f) for f in faculties] if faculties else None
            return Topic(topic_repo.create_topic(
                name=name, icon=icon, description=description, image_url=image_url,
                category=category, is_active=is_active, faculty_ids=faculty_ids,
            ))

        def get_or_create(self, *, name, defaults=None):
            for t in topic_repo.list_topics():
                if t['name'] == name:
                    return Topic(t), False
            fields = dict(defaults or {})
            fields.setdefault('is_active', True)
            return Topic(topic_repo.create_topic(name=name, **fields)), True

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.name = item['name']
        self.icon = item.get('icon')
        self.description = item.get('description')
        self.image_url = item.get('image_url')
        self.category = item.get('category')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')
        self._faculties = None

    def __str__(self):
        return self.name

    @property
    def faculties(self):
        if self._faculties is None:
            from academic.models import Faculty
            ids = topic_repo.list_faculty_ids_for_topic(self.id)
            self._faculties = _ListResult(Faculty.objects.filter(id__in=ids)) if ids else _ListResult()
        return self._faculties

    def save(self):
        item = topic_repo.update_topic(self.id, {
            'name': self.name, 'icon': self.icon, 'description': self.description,
            'image_url': self.image_url, 'category': self.category, 'is_active': self.is_active,
        })
        self.updated_at = item['updated_at']


# ---------------------------------------------------------------------------
# Challenge
# ---------------------------------------------------------------------------

class Challenge:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            item = challenge_repo.get_challenge(_id_of(id if id is not None else pk))
            if item is None:
                raise Challenge.DoesNotExist('Challenge does not exist')
            return Challenge(item)

        def filter(self, topic=None, topic_id=None, is_active=None, id__in=None):
            if id__in is not None:
                items = list(challenge_repo.get_challenges_by_ids([_id_of(i) for i in id__in]).values())
            else:
                tid = _id_of(topic) if topic is not None else topic_id
                if tid is not None:
                    items = challenge_repo.list_challenges_for_topic(tid)
                else:
                    items = challenge_repo.list_challenges()
                if is_active is not None:
                    items = [i for i in items if i['is_active'] == is_active]
            return _ListResult(Challenge(i) for i in items)

        def all(self):
            return self.filter()

        def select_related(self, *_args, **_kwargs):
            return self

        def create(self, *, topic, title, **fields):
            return Challenge(challenge_repo.create_challenge(topic_id=_id_of(topic), title=title, **fields))

        def get_or_create(self, *, topic, title, defaults=None):
            tid = _id_of(topic)
            for c in challenge_repo.list_challenges_for_topic(tid):
                if c['title'] == title:
                    return Challenge(c), False
            fields = dict(defaults or {})
            return Challenge(challenge_repo.create_challenge(topic_id=tid, title=title, **fields)), True

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.topic_id = item['topic_id']
        self.title = item['title']
        self.description = item.get('description')
        self.icon = item.get('icon')
        self.persona_name = item.get('persona_name')
        self.persona_age = item.get('persona_age')
        self.persona_story = item.get('persona_story')
        self.persona_image = item.get('persona_image')
        self.difficulty_level = item.get('difficulty_level', 'medium')
        self.learning_objectives = item.get('learning_objectives')
        self.additional_resources = item.get('additional_resources')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')
        self._topic = None

    def __str__(self):
        return f"{self.title} - {self.topic.name}" if self.topic else self.title

    @property
    def topic(self):
        if self._topic is None and self.topic_id:
            item = topic_repo.get_topic(self.topic_id)
            self._topic = Topic(item) if item else None
        return self._topic

    @topic.setter
    def topic(self, value):
        self._topic = value
        self.topic_id = _id_of(value)

    @property
    def topic_name(self):
        return self.topic.name if self.topic else None

    def save(self):
        item = challenge_repo.update_challenge(self.id, {
            'topic_id': self.topic_id, 'title': self.title, 'description': self.description,
            'icon': self.icon, 'persona_name': self.persona_name, 'persona_age': self.persona_age,
            'persona_story': self.persona_story, 'persona_image': self.persona_image,
            'difficulty_level': self.difficulty_level, 'learning_objectives': self.learning_objectives,
            'additional_resources': self.additional_resources, 'is_active': self.is_active,
        })
        self.updated_at = item['updated_at']

    def refresh_from_db(self):
        item = challenge_repo.get_challenge(self.id)
        if item is None:
            raise Challenge.DoesNotExist('Challenge does not exist')
        self.__init__(item)


# ---------------------------------------------------------------------------
# RouletteChallenge
# ---------------------------------------------------------------------------

class RouletteChallenge:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            item = roulette_repo.get_roulette_challenge(_id_of(id if id is not None else pk))
            if item is None:
                raise RouletteChallenge.DoesNotExist('RouletteChallenge does not exist')
            return RouletteChallenge(item)

        def filter(self, is_active=None, challenge_type=None):
            items = roulette_repo.list_roulette_challenges(active_only=is_active is True)
            if is_active is False:
                items = [i for i in items if not i['is_active']]
            if challenge_type is not None:
                items = [i for i in items if i['challenge_type'] == challenge_type]
            return _ListResult(RouletteChallenge(i) for i in items)

        def all(self):
            return self.filter()

        def create(self, **fields):
            return RouletteChallenge(roulette_repo.create_roulette_challenge(**fields))

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.description = item['description']
        self.challenge_type = item['challenge_type']
        self.difficulty_estimated = item.get('difficulty_estimated', 5)
        self.token_reward_min = item.get('token_reward_min', 0)
        self.token_reward_max = item.get('token_reward_max', 0)
        self.stages_applicable = item.get('stages_applicable')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')

    def __str__(self):
        return f"{self.description[:50]}... ({self.challenge_type})"

    def save(self):
        item = roulette_repo.update_roulette_challenge(self.id, {
            'description': self.description, 'challenge_type': self.challenge_type,
            'difficulty_estimated': self.difficulty_estimated, 'token_reward_min': self.token_reward_min,
            'token_reward_max': self.token_reward_max, 'stages_applicable': self.stages_applicable,
            'is_active': self.is_active,
        })
        self.updated_at = item['updated_at']


# ---------------------------------------------------------------------------
# WordSearchOption
# ---------------------------------------------------------------------------

class WordSearchOption:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def filter(self, activity=None, activity_id=None, is_active=None):
            aid = _id_of(activity) if activity is not None else activity_id
            if aid is None:
                raise ValueError('WordSearchOption.objects.filter() needs activity or activity_id')
            items = wso_repo.list_word_search_options_for_activity(aid, active_only=is_active is True)
            if is_active is False:
                items = [i for i in items if not i['is_active']]
            return _ListResult(WordSearchOption(i) for i in items)

        def select_related(self, *_args, **_kwargs):
            return self

        def create(self, *, activity_id, name, words, grid=None, word_positions=None, seed=None, is_active=True):
            return WordSearchOption(wso_repo.create_word_search_option(
                activity_id=activity_id, name=name, words=words, grid=grid,
                word_positions=word_positions, seed=seed, is_active=is_active,
            ))

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.activity_id = item['activity_id']
        self.name = item['name']
        self.words = item.get('words')
        self.grid = item.get('grid')
        self.word_positions = item.get('word_positions')
        self.seed = item.get('seed')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')
        self._activity = None

    def __str__(self):
        return f"{self.name} ({self.activity.name})" if self.activity else self.name

    @property
    def id_int(self):
        # Legacy get_word_search_data() fallback-seed math assumed an
        # integer pk; UUID4 ids aren't numeric, so hash down to an int.
        return abs(hash(self.id)) % 1_000_000

    @property
    def activity(self):
        if self._activity is None and self.activity_id:
            item = activity_repo.get_activity(self.activity_id)
            self._activity = Activity(item) if item else None
        return self._activity


# ---------------------------------------------------------------------------
# Minigame
# ---------------------------------------------------------------------------

class Minigame:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            item = minigame_repo.get_minigame(_id_of(id if id is not None else pk))
            if item is None:
                raise Minigame.DoesNotExist('Minigame does not exist')
            return Minigame(item)

        def filter(self, is_active=None):
            items = minigame_repo.list_minigames(active_only=is_active is True)
            if is_active is False:
                items = [i for i in items if not i['is_active']]
            return _ListResult(Minigame(i) for i in items)

        def all(self):
            return self.filter()

        def create(self, **fields):
            return Minigame(minigame_repo.create_minigame(**fields))

    objects = _Manager()

    MINIGAME_TYPE_CHOICES = [('word_search', 'Sopa de Letras'), ('puzzle', 'Puzzle'), ('other', 'Otro')]

    def __init__(self, item):
        self.id = item['id']
        self.name = item['name']
        self.type = item['type']
        self.config = item.get('config')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')

    def __str__(self):
        return self.name

    def get_type_display(self):
        return dict(self.MINIGAME_TYPE_CHOICES).get(self.type, self.type)

    def save(self):
        item = minigame_repo.update_minigame(self.id, {
            'name': self.name, 'type': self.type, 'config': self.config, 'is_active': self.is_active,
        })
        self.updated_at = item['updated_at']


# ---------------------------------------------------------------------------
# LearningObjective
# ---------------------------------------------------------------------------

class LearningObjective:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            item = lo_repo.get_learning_objective(_id_of(id if id is not None else pk))
            if item is None:
                raise LearningObjective.DoesNotExist('LearningObjective does not exist')
            return LearningObjective(item)

        def filter(self, stage=None, stage_id=None, is_active=None):
            sid = _id_of(stage) if stage is not None else stage_id
            if sid is not None:
                items = lo_repo.list_learning_objectives_for_stage(sid, active_only=is_active is True)
            else:
                items = lo_repo.list_learning_objectives(active_only=is_active is True)
            if is_active is False:
                items = [i for i in items if not i['is_active']]
            return _ListResult(LearningObjective(i) for i in items)

        def all(self):
            return self.filter()

        def select_related(self, *_args, **_kwargs):
            return self

        def create(self, *, stage=None, **fields):
            return LearningObjective(lo_repo.create_learning_objective(stage_id=_id_of(stage), **fields))

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.stage_id = item.get('stage_id')
        self.title = item['title']
        self.description = item.get('description')
        self.evaluation_criteria = item.get('evaluation_criteria')
        self.pedagogical_recommendations = item.get('pedagogical_recommendations')
        self.estimated_time = item.get('estimated_time')
        self.associated_resources = item.get('associated_resources')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')
        self._stage = None

    def __str__(self):
        return f"{self.title} - {self.stage.name if self.stage else 'General'}"

    @property
    def stage(self):
        if self._stage is None and self.stage_id:
            item = stage_repo.get_stage(self.stage_id)
            self._stage = Stage(item) if item else None
        return self._stage

    @stage.setter
    def stage(self, value):
        self._stage = value
        self.stage_id = _id_of(value)

    @property
    def stage_name(self):
        return self.stage.name if self.stage else None

    @property
    def stage_number(self):
        return self.stage.number if self.stage else None

    def save(self):
        item = lo_repo.update_learning_objective(self.id, {
            'stage_id': self.stage_id, 'title': self.title, 'description': self.description,
            'evaluation_criteria': self.evaluation_criteria,
            'pedagogical_recommendations': self.pedagogical_recommendations,
            'estimated_time': self.estimated_time, 'associated_resources': self.associated_resources,
            'is_active': self.is_active,
        })
        self.updated_at = item['updated_at']


# ---------------------------------------------------------------------------
# AnagramWord
# ---------------------------------------------------------------------------

class AnagramWord:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            item = anagram_repo.get_anagram_word(_id_of(id if id is not None else pk))
            if item is None:
                raise AnagramWord.DoesNotExist('AnagramWord does not exist')
            return AnagramWord(item)

        def filter(self, is_active=None):
            items = anagram_repo.list_anagram_words(active_only=is_active is True)
            if is_active is False:
                items = [i for i in items if not i['is_active']]
            return _ListResult(AnagramWord(i) for i in items)

        def all(self):
            return self.filter()

        def create(self, *, word, is_active=True):
            return AnagramWord(anagram_repo.create_anagram_word(word=word, is_active=is_active))

        def get_or_create(self, *, word, defaults=None):
            for w in anagram_repo.list_anagram_words():
                if w['word'] == word:
                    return AnagramWord(w), False
            fields = dict(defaults or {})
            fields.setdefault('is_active', True)
            return AnagramWord(anagram_repo.create_anagram_word(word=word, **fields)), True

        def count(self):
            return len(anagram_repo.list_anagram_words())

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.word = item['word']
        self.scrambled_word = item.get('scrambled_word')
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')

    def __str__(self):
        return self.word

    def save(self):
        item = anagram_repo.update_anagram_word(self.id, {'word': self.word, 'is_active': self.is_active})
        self.scrambled_word = item['scrambled_word']
        self.updated_at = item['updated_at']


# ---------------------------------------------------------------------------
# ChaosQuestion
# ---------------------------------------------------------------------------

class ChaosQuestion:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            item = chaos_repo.get_chaos_question(_id_of(id if id is not None else pk))
            if item is None:
                raise ChaosQuestion.DoesNotExist('ChaosQuestion does not exist')
            return ChaosQuestion(item)

        def filter(self, is_active=None, id__in=None):
            items = chaos_repo.list_chaos_questions(active_only=is_active is True)
            if is_active is False:
                items = [i for i in items if not i['is_active']]
            if id__in is not None:
                wanted = {str(i) for i in id__in}
                items = [i for i in items if i['id'] in wanted]
            return _ListResult(ChaosQuestion(i) for i in items)

        def all(self):
            return self.filter()

        def create(self, *, question, is_active=True):
            return ChaosQuestion(chaos_repo.create_chaos_question(question=question, is_active=is_active))

        def get_or_create(self, *, question, defaults=None):
            for q in chaos_repo.list_chaos_questions():
                if q['question'] == question:
                    return ChaosQuestion(q), False
            fields = dict(defaults or {})
            fields.setdefault('is_active', True)
            return ChaosQuestion(chaos_repo.create_chaos_question(question=question, **fields)), True

        def count(self):
            return len(chaos_repo.list_chaos_questions())

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.question = item['question']
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')

    def __str__(self):
        return self.question[:50] + '...' if len(self.question) > 50 else self.question

    def save(self):
        item = chaos_repo.update_chaos_question(self.id, {'question': self.question, 'is_active': self.is_active})
        self.updated_at = item['updated_at']


# ---------------------------------------------------------------------------
# GeneralKnowledgeQuestion
# ---------------------------------------------------------------------------

class GeneralKnowledgeQuestion:
    class DoesNotExist(ObjectDoesNotExist):
        pass

    class _Manager:
        def get(self, id=None, pk=None):
            item = gk_repo.get_general_knowledge_question(_id_of(id if id is not None else pk))
            if item is None:
                raise GeneralKnowledgeQuestion.DoesNotExist('GeneralKnowledgeQuestion does not exist')
            return GeneralKnowledgeQuestion(item)

        def filter(self, is_active=None):
            items = gk_repo.list_general_knowledge_questions(active_only=is_active is True)
            if is_active is False:
                items = [i for i in items if not i['is_active']]
            return _ListResult(GeneralKnowledgeQuestion(i) for i in items)

        def all(self):
            return self.filter()

        def create(self, **fields):
            return GeneralKnowledgeQuestion(gk_repo.create_general_knowledge_question(**fields))

        def get_or_create(self, *, question, defaults=None):
            for q in gk_repo.list_general_knowledge_questions():
                if q['question'] == question:
                    return GeneralKnowledgeQuestion(q), False
            fields = dict(defaults or {})
            return GeneralKnowledgeQuestion(gk_repo.create_general_knowledge_question(question=question, **fields)), True

        def count(self):
            return len(gk_repo.list_general_knowledge_questions())

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.question = item['question']
        self.option_a = item['option_a']
        self.option_b = item['option_b']
        self.option_c = item['option_c']
        self.option_d = item['option_d']
        self.correct_answer = item['correct_answer']
        self.is_active = item.get('is_active', True)
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')

    def __str__(self):
        return self.question[:50] + '...' if len(self.question) > 50 else self.question

    def save(self):
        item = gk_repo.update_general_knowledge_question(self.id, {
            'question': self.question, 'option_a': self.option_a, 'option_b': self.option_b,
            'option_c': self.option_c, 'option_d': self.option_d, 'correct_answer': self.correct_answer,
            'is_active': self.is_active,
        })
        self.updated_at = item['updated_at']
