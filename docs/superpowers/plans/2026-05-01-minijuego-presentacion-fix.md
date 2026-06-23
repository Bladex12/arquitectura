# Actividad 1 Split Path Fix — Word Search & Chaos Questions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three root causes that prevent word search and chaos question screens from appearing on student tablets in Etapa 1.

**Architecture:** Backend service fix + seed data command, then frontend retry-lock and session-stage parameter fixes. Auth overrides for `ActivityViewSet` and `SessionStageViewSet` are already in `challenges/views.py` and `game_sessions/views.py` — skip those.

**Tech Stack:** Django management commands, Python services, React/TypeScript tablet pages

---

## File Map

| File | Change |
|------|--------|
| `challenges/services.py` | Filter long words instead of raising ValueError |
| `challenges/management/commands/create_initial_data.py` | Replace 'creatividad' (11 chars) with 'creativos' |
| `challenges/management/commands/create_minigame_data.py` | New: seed AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion |
| `challenges/tests.py` | Add tests for generate_word_search and seed command |
| `frontend/src/pages/tablets/etapa1/Minijuego.tsx` | Fix retry lock + pass sessionStageId from lobby |
| `frontend/src/pages/tablets/etapa1/Presentacion.tsx` | Pass sessionStageId from lobby instead of fetching session-stages |
| `CLAUDE.md` | Document create_minigame_data command |

---

## Task 1: Fix `generate_word_search` — filter long words instead of raising

**Files:**
- Modify: `challenges/services.py:36-44`
- Test: `challenges/tests.py`

- [ ] **Step 1: Write the failing test**

Add to `challenges/tests.py`:

```python
from django.test import TestCase
from challenges.services import generate_word_search


class GenerateWordSearchTest(TestCase):
    def test_long_word_is_filtered_not_raised(self):
        # 'creatividad' has 11 chars — previously raised ValueError
        result = generate_word_search(['creatividad', 'equipo'], seed=42)
        self.assertIsNotNone(result)
        # 'creatividad' must not appear; 'EQUIPO' should be placed
        words_in_result = [w.upper() for w in result['words']]
        self.assertNotIn('CREATIVIDAD', words_in_result)
        self.assertIn('EQUIPO', words_in_result)

    def test_all_long_words_uses_fallback(self):
        # When all words exceed 10 chars, fallback words are used
        result = generate_word_search(['creatividad', 'emprendimiento'], seed=42)
        self.assertIsNotNone(result)
        # Should use fallback words, not an empty/error state
        self.assertGreater(len(result['words']), 0)

    def test_normal_words_work(self):
        result = generate_word_search(['equipo', 'lider'], seed=42)
        self.assertIsNotNone(result)
        words_in_result = [w.upper() for w in result['words']]
        self.assertIn('EQUIPO', words_in_result)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker exec mision_emprende_backend python manage.py test challenges.tests.GenerateWordSearchTest -v 2
```

Expected: FAIL — `test_long_word_is_filtered_not_raised` raises `ValueError`.

- [ ] **Step 3: Implement the fix in `challenges/services.py`**

Find lines 36-44 (current code):
```python
    palabras_filtradas = [w.upper() for w in words if len(w) <= 10]
    if len(palabras_filtradas) < len(words):
        palabras_demasiado_largas = [w for w in words if len(w) > 10]
        raise ValueError(f"Las siguientes palabras exceden 10 caracteres: {', '.join(palabras_demasiado_largas)}")
    
    palabras_usar = palabras_filtradas[:10]  # Máximo 10 palabras
    
    if not palabras_usar:
        raise ValueError("Se requiere al menos una palabra")
```

Replace with:
```python
    palabras_filtradas = [w.upper() for w in words if w and len(w) <= 10]
    if not palabras_filtradas:
        palabras_filtradas = ['EQUIPO', 'MISION', 'IDEAS']
    palabras_usar = palabras_filtradas[:10]  # Máximo 10 palabras
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
docker exec mision_emprende_backend python manage.py test challenges.tests.GenerateWordSearchTest -v 2
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add challenges/services.py challenges/tests.py
git commit -m "fix: filter words >10 chars in generate_word_search instead of raising ValueError"
```

---

## Task 2: Fix 'creatividad' in `create_initial_data.py`

**Files:**
- Modify: `challenges/management/commands/create_initial_data.py:124`

- [ ] **Step 1: Change 'creatividad' to 'creativos'**

Find line 124:
```python
        words_list = ['emprender', 'innovacion', 'creatividad']
```

Replace with:
```python
        words_list = ['emprender', 'innovacion', 'creativos']
```

- [ ] **Step 2: Verify the change is correct**

```bash
docker exec mision_emprende_backend python manage.py create_initial_data
```

Expected: Command runs without error (uses `get_or_create` so safe to re-run).

- [ ] **Step 3: Commit**

```bash
git add challenges/management/commands/create_initial_data.py
git commit -m "fix: replace 'creatividad' (11 chars) with 'creativos' in word search config"
```

---

## Task 3: Create seed command `create_minigame_data`

**Files:**
- Create: `challenges/management/commands/create_minigame_data.py`
- Test: `challenges/tests.py`

- [ ] **Step 1: Write the failing test**

Add to `challenges/tests.py`:

```python
from io import StringIO
from django.core.management import call_command
from challenges.models import AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion


class CreateMinigameDataCommandTest(TestCase):
    def test_creates_anagram_words(self):
        call_command('create_minigame_data', stdout=StringIO())
        self.assertGreaterEqual(AnagramWord.objects.filter(is_active=True).count(), 15)

    def test_creates_chaos_questions(self):
        call_command('create_minigame_data', stdout=StringIO())
        self.assertGreaterEqual(ChaosQuestion.objects.filter(is_active=True).count(), 20)

    def test_creates_general_knowledge_questions(self):
        call_command('create_minigame_data', stdout=StringIO())
        self.assertGreaterEqual(GeneralKnowledgeQuestion.objects.filter(is_active=True).count(), 10)

    def test_idempotent(self):
        call_command('create_minigame_data', stdout=StringIO())
        count_anagram = AnagramWord.objects.count()
        count_chaos = ChaosQuestion.objects.count()
        count_gk = GeneralKnowledgeQuestion.objects.count()
        call_command('create_minigame_data', stdout=StringIO())
        self.assertEqual(AnagramWord.objects.count(), count_anagram)
        self.assertEqual(ChaosQuestion.objects.count(), count_chaos)
        self.assertEqual(GeneralKnowledgeQuestion.objects.count(), count_gk)

    def test_anagram_words_have_scrambled(self):
        call_command('create_minigame_data', stdout=StringIO())
        for word in AnagramWord.objects.filter(is_active=True):
            self.assertIsNotNone(word.scrambled_word)
            self.assertNotEqual(word.scrambled_word, '')

    def test_general_knowledge_correct_answer_valid(self):
        call_command('create_minigame_data', stdout=StringIO())
        for q in GeneralKnowledgeQuestion.objects.filter(is_active=True):
            self.assertIn(q.correct_answer, [0, 1, 2, 3])
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker exec mision_emprende_backend python manage.py test challenges.tests.CreateMinigameDataCommandTest -v 2
```

Expected: FAIL — `create_minigame_data` command not found.

- [ ] **Step 3: Create the management command**

Create `challenges/management/commands/create_minigame_data.py`:

```python
"""
Seed AnagramWord, ChaosQuestion, and GeneralKnowledgeQuestion records.
Safe to run multiple times (uses get_or_create).
"""
from django.core.management.base import BaseCommand
from challenges.models import AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion


ANAGRAM_WORDS = [
    'empresa', 'cliente', 'proyecto', 'mercado', 'producto',
    'impacto', 'usuario', 'capital', 'equipo', 'startup',
    'recursos', 'negocio', 'problema', 'servicio', 'valor',
]

CHAOS_QUESTIONS = [
    '¿Cuál sería tu superpoder si pudieras elegir uno?',
    '¿Qué harías si tuvieras un día libre sin límites?',
    'Si pudieras vivir en cualquier época histórica, ¿cuál elegirías y por qué?',
    '¿Qué habilidad te gustaría aprender en una semana?',
    '¿Cuál es tu mayor miedo y cómo lo enfrentarías?',
    '¿Si pudieras cambiar una cosa del mundo, qué sería?',
    '¿Qué harías si ganarás un millón de dólares mañana?',
    '¿Cuál es tu talento secreto que pocos conocen?',
    '¿Si fueras un animal, cuál serías y por qué?',
    '¿Qué canción describe mejor tu vida en este momento?',
    '¿Cuál es el consejo más valioso que has recibido?',
    '¿Qué lugar del mundo te gustaría visitar y por qué?',
    '¿Si pudieras tener cena con alguien famoso, quién sería?',
    '¿Qué invento cambiaría más tu vida cotidiana?',
    '¿Cuál es la cosa más loca que has hecho por diversión?',
    '¿Qué libro, película o serie recomendarías a todos?',
    '¿Si pudieras dominar un idioma instantáneamente, cuál sería?',
    '¿Qué trabajo harías aunque no te pagaran?',
    '¿Cuál es tu recuerdo favorito de la infancia?',
    '¿Qué es lo primero que haces cuando te levantas por la mañana?',
]

GENERAL_KNOWLEDGE_QUESTIONS = [
    {
        'question': '¿Qué significa MVP en emprendimiento?',
        'option_a': 'Minimum Viable Product',
        'option_b': 'Maximum Value Proposition',
        'option_c': 'Most Valuable Player',
        'option_d': 'Minimum Viable Process',
        'correct_answer': 0,
    },
    {
        'question': '¿Qué es el Design Thinking?',
        'option_a': 'Metodología centrada en el usuario para resolver problemas',
        'option_b': 'Software de diseño gráfico',
        'option_c': 'Técnica de programación orientada a objetos',
        'option_d': 'Estrategia de marketing digital',
        'correct_answer': 0,
    },
    {
        'question': '¿Qué es un "pitch" en el contexto empresarial?',
        'option_a': 'Un campo de fútbol',
        'option_b': 'Presentación breve de una idea de negocio',
        'option_c': 'Un tipo de contrato laboral',
        'option_d': 'Una herramienta de análisis financiero',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es el modelo Canvas de negocio?',
        'option_a': 'Un programa de contabilidad',
        'option_b': 'Herramienta para visualizar y diseñar modelos de negocio',
        'option_c': 'Una metodología de programación',
        'option_d': 'Un tipo de contrato de sociedad',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es el "bootstrapping" en emprendimiento?',
        'option_a': 'Técnica de programación web',
        'option_b': 'Financiar un negocio con recursos propios sin inversores externos',
        'option_c': 'Estrategia de marketing en redes sociales',
        'option_d': 'Proceso de contratación de empleados',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué significa B2B en negocios?',
        'option_a': 'Back to Basics',
        'option_b': 'Business to Business (empresa a empresa)',
        'option_c': 'Brand to Brand',
        'option_d': 'Budget to Budget',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es una startup?',
        'option_a': 'Una empresa consolidada con más de 50 años',
        'option_b': 'Empresa emergente con alto potencial de crecimiento escalable',
        'option_c': 'Un organismo gubernamental',
        'option_d': 'Una organización sin fines de lucro',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es el "networking" en emprendimiento?',
        'option_a': 'Configurar una red de computadoras',
        'option_b': 'Construcción y cultivo de relaciones profesionales',
        'option_c': 'Vender productos por internet',
        'option_d': 'Analizar la competencia del mercado',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es la propuesta de valor de un negocio?',
        'option_a': 'El precio de venta del producto',
        'option_b': 'La descripción clara de cómo se resuelve el problema del cliente',
        'option_c': 'El número de empleados de la empresa',
        'option_d': 'El lugar donde opera la empresa',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es el "pivot" en una startup?',
        'option_a': 'El fundador principal de la empresa',
        'option_b': 'Cambio estratégico en el modelo de negocio basado en aprendizaje',
        'option_c': 'Una ronda de inversión inicial',
        'option_d': 'El primer producto lanzado al mercado',
        'correct_answer': 1,
    },
]


class Command(BaseCommand):
    help = 'Crea datos iniciales para AnagramWord, ChaosQuestion y GeneralKnowledgeQuestion'

    def handle(self, *args, **options):
        self._create_anagram_words()
        self._create_chaos_questions()
        self._create_general_knowledge_questions()
        self.stdout.write(self.style.SUCCESS('Datos del minijuego creados exitosamente.'))

    def _create_anagram_words(self):
        created_count = 0
        for word in ANAGRAM_WORDS:
            _, created = AnagramWord.objects.get_or_create(
                word=word,
                defaults={'is_active': True}
            )
            if created:
                created_count += 1
        self.stdout.write(f'  AnagramWord: {created_count} nuevas, {len(ANAGRAM_WORDS) - created_count} ya existían')

    def _create_chaos_questions(self):
        created_count = 0
        for question_text in CHAOS_QUESTIONS:
            _, created = ChaosQuestion.objects.get_or_create(
                question=question_text,
                defaults={'is_active': True}
            )
            if created:
                created_count += 1
        self.stdout.write(f'  ChaosQuestion: {created_count} nuevas, {len(CHAOS_QUESTIONS) - created_count} ya existían')

    def _create_general_knowledge_questions(self):
        created_count = 0
        for q in GENERAL_KNOWLEDGE_QUESTIONS:
            _, created = GeneralKnowledgeQuestion.objects.get_or_create(
                question=q['question'],
                defaults={
                    'option_a': q['option_a'],
                    'option_b': q['option_b'],
                    'option_c': q['option_c'],
                    'option_d': q['option_d'],
                    'correct_answer': q['correct_answer'],
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
        self.stdout.write(f'  GeneralKnowledgeQuestion: {created_count} nuevas, {len(GENERAL_KNOWLEDGE_QUESTIONS) - created_count} ya existían')
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
docker exec mision_emprende_backend python manage.py test challenges.tests.CreateMinigameDataCommandTest -v 2
```

Expected: PASS (6 tests).

- [ ] **Step 5: Run the seed command manually to verify output**

```bash
docker exec mision_emprende_backend python manage.py create_minigame_data
```

Expected output:
```
  AnagramWord: 15 nuevas, 0 ya existían
  ChaosQuestion: 20 nuevas, 0 ya existían
  GeneralKnowledgeQuestion: 10 nuevas, 0 ya existían
Datos del minijuego creados exitosamente.
```

- [ ] **Step 6: Commit**

```bash
git add challenges/management/commands/create_minigame_data.py challenges/tests.py
git commit -m "feat: add create_minigame_data seed command for AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion"
```

---

## Task 4: Fix retry lock in `Minijuego.tsx`

**Files:**
- Modify: `frontend/src/pages/tablets/etapa1/Minijuego.tsx:261-262` and `:664-669`

The bug: `minigameDataLoadedRef.current = true` is set at line 262 **before** the `try` block begins at line 264. When the backend returns a 500 error, the `catch` block runs but `minigameDataLoadedRef.current` stays `true`. All subsequent polling calls see `minigameDataLoadedRef.current === true` and skip the load forever. The fix is to remove the premature assignment and reset to `false` in the catch block.

- [ ] **Step 1: Remove the premature `minigameDataLoadedRef.current = true` at line 262**

Find in `frontend/src/pages/tablets/etapa1/Minijuego.tsx`:
```typescript
    loadingMinijuegoRef.current = true;
    minigameDataLoadedRef.current = true;
    setLoading(true);
    try {
```

Replace with:
```typescript
    loadingMinijuegoRef.current = true;
    setLoading(true);
    try {
```

- [ ] **Step 2: Add `minigameDataLoadedRef.current = false` in the catch block**

Find (near line 664):
```typescript
    } catch (error: any) {
      console.error('Error loading minijuego activity:', error);
      toast.error('Error al cargar la actividad: ' + (error.message || 'Error desconocido'));
      setLoading(false);
    } finally {
      loadingMinijuegoRef.current = false;
    }
```

Replace with:
```typescript
    } catch (error: any) {
      console.error('Error loading minijuego activity:', error);
      toast.error('Error al cargar la actividad: ' + (error.message || 'Error desconocido'));
      minigameDataLoadedRef.current = false;
      setLoading(false);
    } finally {
      loadingMinijuegoRef.current = false;
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: Build completes without TypeScript errors in `Minijuego.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/tablets/etapa1/Minijuego.tsx
git commit -m "fix: reset minigameDataLoadedRef on fetch failure to allow polling retries"
```

---

## Task 5: Pass `sessionStageId` from lobby data in `Minijuego.tsx` and `Presentacion.tsx`

**Files:**
- Modify: `frontend/src/pages/tablets/etapa1/Minijuego.tsx`
- Modify: `frontend/src/pages/tablets/etapa1/Presentacion.tsx`

Currently both files make an extra `fetch` to `/sessions/session-stages/` to get the session stage ID. This fetch is unauthenticated and adds latency. The lobby data (`gameData` from `sessionsAPI.getLobby`) already includes `current_session_stage` — pass it directly.

### Minijuego.tsx changes

- [ ] **Step 1: Replace the session-stages fetch in `loadGameState` (lines 172-183)**

Find:
```typescript
      // Obtener session_stage
      if (!currentSessionStageId) {
        const stagesResponse = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/session-stages/?game_session=${statusData.game_session.id}`
        );
        if (stagesResponse.ok) {
          const stagesData = await stagesResponse.json();
          const stages = Array.isArray(stagesData.results) ? stagesData.results : (Array.isArray(stagesData) ? stagesData : []);
          if (stages.length > 0) {
            setCurrentSessionStageId(stages[0].id);
          }
        }
      }
```

Replace with:
```typescript
      // Obtener session_stage desde lobby data (ya disponible, sin fetch extra)
      if (!currentSessionStageId && gameData.current_session_stage) {
        setCurrentSessionStageId(gameData.current_session_stage);
      }
```

- [ ] **Step 2: Update the `loadMinijuegoActivity` call in `loadGameState` (line ~210)**

Find:
```typescript
        await loadMinijuegoActivity(gameData.current_activity, statusData.team.id, statusData.game_session.id);
```

Replace with:
```typescript
        await loadMinijuegoActivity(gameData.current_activity, statusData.team.id, gameData.current_session_stage);
```

- [ ] **Step 3: Update `loadMinijuegoActivity` signature and remove internal fetch**

Find the function declaration and the internal session-stages fetch block:
```typescript
  const loadMinijuegoActivity = async (activityId: number, teamId: number, gameSessionIdParam?: number) => {
```

Replace with:
```typescript
  const loadMinijuegoActivity = async (activityId: number, teamId: number, sessionStageIdParam?: number | null) => {
```

Then find the internal session-stages fetch block inside the function (inside the `try` block):
```typescript
      // Verificar progreso existente para determinar qué parte mostrar
      // Primero intentar obtener session_stage_id
      let sessionStageId: number | null = null;
      const sessionIdToUse = gameSessionIdParam || gameSessionId;
      if (sessionIdToUse) {
        try {
          const stagesResponse = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/session-stages/?game_session=${sessionIdToUse}`
          );
          if (stagesResponse.ok) {
            const stagesData = await stagesResponse.json();
            const stages = Array.isArray(stagesData.results) ? stagesData.results : (Array.isArray(stagesData) ? stagesData : []);
            if (stages.length > 0) {
              sessionStageId = stages[0].id;
            }
          }
        } catch (e) {
          console.error('Error getting session stage:', e);
        }
      }
```

Replace with:
```typescript
      const sessionStageId: number | null = sessionStageIdParam ?? currentSessionStageId ?? null;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: Build completes without TypeScript errors in `Minijuego.tsx`.

### Presentacion.tsx changes

- [ ] **Step 5: Replace the session-stages fetch in `loadGameState` (lines 179-191)**

Find:
```typescript
      // Obtener session_stage
      let sessionStageIdToUse = currentSessionStageId;
      if (!sessionStageIdToUse) {
        try {
          const stagesData = await sessionsAPI.getSessionStages(statusData.game_session.id);
          const stages = Array.isArray(stagesData) ? stagesData : [stagesData];
          if (stages.length > 0) {
            sessionStageIdToUse = stages[0].id;
            setCurrentSessionStageId(sessionStageIdToUse);
          }
        } catch (error) {
          console.error('Error loading session stages:', error);
        }
      }
```

Replace with:
```typescript
      // Obtener session_stage desde lobby data (ya disponible, sin fetch extra)
      let sessionStageIdToUse = currentSessionStageId;
      if (!sessionStageIdToUse && gameData.current_session_stage) {
        sessionStageIdToUse = gameData.current_session_stage;
        setCurrentSessionStageId(sessionStageIdToUse);
      }
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: Build completes without TypeScript errors in `Presentacion.tsx`. If `sessionsAPI.getSessionStages` is now unused in this file, TypeScript may warn — check that it's not imported solely for this call. If the import is now unused, remove it.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/tablets/etapa1/Minijuego.tsx frontend/src/pages/tablets/etapa1/Presentacion.tsx
git commit -m "fix: pass sessionStageId from lobby data instead of fetching session-stages separately"
```

---

## Task 6: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add `create_minigame_data` to the seed commands section**

Find in `CLAUDE.md`:
```
### Seed game data

```bash
docker exec mision_emprende_backend python manage.py create_initial_data
docker exec mision_emprende_backend python manage.py create_stage3
docker exec mision_emprende_backend python manage.py create_stage4
```
```

Replace with:
```
### Seed game data

```bash
docker exec mision_emprende_backend python manage.py create_initial_data
docker exec mision_emprende_backend python manage.py create_stage3
docker exec mision_emprende_backend python manage.py create_stage4
docker exec mision_emprende_backend python manage.py create_minigame_data
```
```

(`create_minigame_data` seeds AnagramWord, ChaosQuestion, and GeneralKnowledgeQuestion records needed for Etapa 1 split path.)

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add create_minigame_data to seed commands in CLAUDE.md"
```

---

## Final Verification

After all tasks are complete, verify end-to-end:

- [ ] `GET /api/challenges/activities/{id}/?team_id=X&session_stage_id=Y` (no auth header) returns 200
- [ ] `GET /api/challenges/chaos-questions/random/` returns a question (not 404)
- [ ] `GET /api/challenges/anagram-words/random/` returns words (not empty)
- [ ] Student tablet on Minijuego path sees word search grid (not spinner) after backend is running with seeded data
- [ ] Student tablet on Presentacion path sees chaos question when button is pressed
