# Team Identity Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tablet code input with team name + color picker, update team identity in the DB on connect, and sync changes live to the professor's Lobby via safe polling merge.

**Architecture:** `TabletConnection.tablet` becomes nullable (BYOD — no physical tablet). A `team_session_token` (UUID) enables silent reconnection. On connect, `Team.name` and `Team.color` are updated directly; the professor's Lobby polling merges only name/color every 5s, leaving student drag-and-drop state untouched.

**Tech Stack:** Django 5 + DRF, React 18 + TypeScript + Framer Motion + Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `game_sessions/models.py` | `TabletConnection.tablet` → nullable; add `team_session_token` |
| `game_sessions/migrations/` | Auto-generated migration |
| `game_sessions/serializers.py` | Null-safe `tablet_code`; expose `team_session_token` |
| `game_sessions/views.py` | Rewrite `connect` action; add `reconnect` action |
| `frontend/src/services/tabletConnections.ts` | Update `connect` signature; add `reconnect` |
| `frontend/src/pages/tablets/Join.tsx` | Replace step 2 UI entirely |
| `frontend/src/pages/profesor/Lobby.tsx` | Safe name/color merge in polling |

---

## Task 1: Update TabletConnection model

**Files:**
- Modify: `game_sessions/models.py`

- [ ] **Step 1: Add `import uuid` at the top of models.py**

  Open `game_sessions/models.py`. After the existing imports (line 4–7), add:

  ```python
  import uuid
  ```

- [ ] **Step 2: Make `tablet` FK nullable and add `team_session_token`**

  Find the `TabletConnection` class (around line 534). Replace the `tablet` field:

  ```python
  # Before:
  tablet = models.ForeignKey(
      Tablet,
      on_delete=models.RESTRICT,
      related_name='connections',
      verbose_name='Tablet'
  )

  # After:
  tablet = models.ForeignKey(
      Tablet,
      on_delete=models.SET_NULL,
      null=True,
      blank=True,
      related_name='connections',
      verbose_name='Tablet'
  )
  ```

  Then add `team_session_token` immediately after the `tablet` field:

  ```python
  team_session_token = models.UUIDField(
      default=uuid.uuid4,
      editable=False,
      unique=True,
      verbose_name='Token de Sesión de Equipo'
  )
  ```

- [ ] **Step 3: Generate migration**

  ```bash
  docker exec mision_emprende_backend python manage.py makemigrations game_sessions --name tablet_connection_byod
  ```

  Expected output: `Migrations for 'game_sessions': game_sessions/migrations/XXXX_tablet_connection_byod.py`

- [ ] **Step 4: Apply migration**

  ```bash
  docker exec mision_emprende_backend python manage.py migrate
  ```

  Expected output: `Applying game_sessions.XXXX_tablet_connection_byod... OK`

- [ ] **Step 5: Commit**

  ```bash
  git add game_sessions/models.py game_sessions/migrations/
  git commit -m "feat: make TabletConnection.tablet nullable, add team_session_token for BYOD"
  ```

---

## Task 2: Update TabletConnectionSerializer

**Files:**
- Modify: `game_sessions/serializers.py`

- [ ] **Step 1: Make `tablet_code` null-safe**

  Find `TabletConnectionSerializer` (around line 172). Change `tablet_code` from a `CharField` to a `SerializerMethodField`:

  ```python
  # Before:
  tablet_code = serializers.CharField(source='tablet.tablet_code', read_only=True)

  # After:
  tablet_code = serializers.SerializerMethodField()
  ```

  Add the method inside the class (before `get_is_connected`):

  ```python
  def get_tablet_code(self, obj):
      return obj.tablet.tablet_code if obj.tablet else None
  ```

- [ ] **Step 2: Add `team_session_token` to fields list**

  In `class Meta`, update `fields` and `read_only_fields`:

  ```python
  fields = [
      'id', 'tablet', 'tablet_code', 'team', 'team_name', 'game_session',
      'game_session_room_code', 'connected_at', 'disconnected_at', 'last_seen',
      'is_connected', 'team_session_token'
  ]
  read_only_fields = [
      'id', 'tablet_code', 'team_name', 'game_session_room_code',
      'is_connected', 'team_session_token'
  ]
  ```

- [ ] **Step 3: Verify Django can start**

  ```bash
  docker exec mision_emprende_backend python manage.py check
  ```

  Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 4: Commit**

  ```bash
  git add game_sessions/serializers.py
  git commit -m "feat: null-safe tablet_code in serializer, expose team_session_token"
  ```

---

## Task 3: Rewrite `connect` endpoint and add `reconnect`

**Files:**
- Modify: `game_sessions/views.py` (around line 4648)

- [ ] **Step 1: Replace the entire `connect` action**

  Find and replace the full `connect` method in `TabletConnectionViewSet` (lines ~4648–4784):

  ```python
  @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
  def connect(self, request):
      """
      Conectar un equipo a una sesión de juego (BYOD)
      No requiere autenticación.

      Requiere:
      - room_code: Código de la sala
      - team_name: Nombre del equipo (mín. 2 caracteres)
      - team_color: Color del equipo (Azul, Rojo, Verde, Amarillo, Morado, Naranja)
      """
      room_code = request.data.get('room_code')
      team_name = str(request.data.get('team_name', '')).strip()
      team_color = str(request.data.get('team_color', '')).strip()

      if not room_code or not team_name or not team_color:
          return Response(
              {'error': 'Se requiere room_code, team_name y team_color'},
              status=status.HTTP_400_BAD_REQUEST
          )

      if len(team_name) < 2:
          return Response(
              {'error': 'El nombre del equipo debe tener al menos 2 caracteres'},
              status=status.HTTP_400_BAD_REQUEST
          )

      room_code = str(room_code).strip().upper()

      try:
          game_session = GameSession.objects.get(room_code=room_code)

          if game_session.status not in ['lobby', 'running']:
              return Response(
                  {
                      'error': 'La sesión ya ha finalizado',
                      'status': game_session.status,
                  },
                  status=status.HTTP_403_FORBIDDEN
              )

          if game_session.status == 'running':
              return Response(
                  {'error': 'No se pueden conectar nuevos equipos. El juego ya ha comenzado. Usa tu token de reconexión.'},
                  status=status.HTTP_400_BAD_REQUEST
              )

          # Buscar primer equipo sin conexión activa
          teams = game_session.teams.all()
          available_team = None

          for team in teams:
              has_active_connection = TabletConnection.objects.filter(
                  team=team,
                  game_session=game_session,
                  disconnected_at__isnull=True
              ).exists()

              if not has_active_connection:
                  available_team = team
                  break

          if not available_team:
              return Response(
                  {'error': 'Todos los equipos ya tienen un dispositivo conectado'},
                  status=status.HTTP_400_BAD_REQUEST
              )

          # Actualizar identidad del equipo con los datos del alumno
          available_team.name = team_name
          available_team.color = team_color
          available_team.save()

          # Crear conexión sin tablet física (BYOD)
          connection = TabletConnection.objects.create(
              tablet=None,
              team=available_team,
              game_session=game_session
          )

          serializer = TabletConnectionSerializer(connection)
          team_serializer = TeamSerializer(available_team)

          return Response({
              'connection': serializer.data,
              'team': team_serializer.data,
              'game_session': {
                  'id': game_session.id,
                  'room_code': game_session.room_code,
                  'status': game_session.status
              },
              'team_session_token': str(connection.team_session_token),
              'message': 'Conectado exitosamente'
          }, status=status.HTTP_201_CREATED)

      except GameSession.DoesNotExist:
          return Response(
              {'error': 'Código de sala inválido'},
              status=status.HTTP_404_NOT_FOUND
          )
      except Exception as e:
          return Response(
              {'error': f'Error inesperado: {str(e)}'},
              status=status.HTTP_500_INTERNAL_SERVER_ERROR
          )
  ```

- [ ] **Step 2: Add `reconnect` action immediately after the `disconnect` action**

  Find the `disconnect` action (around line 4786). After its closing `}`, add:

  ```python
  @action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])
  def reconnect(self, request):
      """
      Reconectar a una sesión usando el team_session_token.
      No requiere autenticación (BYOD).

      Requiere:
      - team_session_token: UUID devuelto al conectarse originalmente
      """
      token = request.data.get('team_session_token')

      if not token:
          return Response(
              {'error': 'Se requiere team_session_token'},
              status=status.HTTP_400_BAD_REQUEST
          )

      try:
          connection = TabletConnection.objects.select_related('team', 'game_session').get(
              team_session_token=token
          )

          game_session = connection.game_session

          if game_session.status not in ['lobby', 'running']:
              return Response(
                  {'error': 'La sesión ha finalizado'},
                  status=status.HTTP_403_FORBIDDEN
              )

          # Reactivar conexión si estaba desconectada
          if connection.disconnected_at is not None:
              connection.disconnected_at = None
              connection.save()

          team = connection.team
          serializer = TabletConnectionSerializer(connection)
          team_serializer = TeamSerializer(team)

          return Response({
              'connection': serializer.data,
              'team': team_serializer.data,
              'game_session': {
                  'id': game_session.id,
                  'room_code': game_session.room_code,
                  'status': game_session.status
              },
              'team_session_token': str(connection.team_session_token),
              'message': 'Reconectado exitosamente'
          }, status=status.HTTP_200_OK)

      except TabletConnection.DoesNotExist:
          return Response(
              {'error': 'Token de sesión inválido o expirado'},
              status=status.HTTP_404_NOT_FOUND
          )
      except Exception as e:
          return Response(
              {'error': f'Error inesperado: {str(e)}'},
              status=status.HTTP_500_INTERNAL_SERVER_ERROR
          )
  ```

- [ ] **Step 3: Verify Django can start**

  ```bash
  docker exec mision_emprende_backend python manage.py check
  ```

  Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 4: Commit**

  ```bash
  git add game_sessions/views.py
  git commit -m "feat: rewrite connect endpoint for BYOD (team_name/color), add reconnect action"
  ```

---

## Task 4: Update frontend service

**Files:**
- Modify: `frontend/src/services/tabletConnections.ts`

- [ ] **Step 1: Rewrite the file**

  Replace the entire content of `frontend/src/services/tabletConnections.ts`:

  ```typescript
  import { api } from './api';

  export const tabletConnectionsAPI = {
    connect: async (roomCode: string, teamName: string, teamColor: string) => {
      const response = await api.post('/sessions/tablet-connections/connect/', {
        room_code: roomCode,
        team_name: teamName,
        team_color: teamColor,
      });
      return response.data;
    },

    reconnect: async (teamSessionToken: string) => {
      const response = await api.post('/sessions/tablet-connections/reconnect/', {
        team_session_token: teamSessionToken,
      });
      return response.data;
    },

    getStatus: async (connectionId: string) => {
      const response = await api.get(
        `/sessions/tablet-connections/status/?connection_id=${connectionId}`
      );
      return response.data;
    },

    disconnect: async (connectionId: number) => {
      const response = await api.post(
        `/sessions/tablet-connections/${connectionId}/disconnect/`
      );
      return response.data;
    },
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/services/tabletConnections.ts
  git commit -m "feat: update tabletConnectionsAPI — team_name/color connect, add reconnect"
  ```

---

## Task 5: Rewrite Join.tsx step 2

**Files:**
- Modify: `frontend/src/pages/tablets/Join.tsx`

- [ ] **Step 1: Replace the state declarations**

  Find these lines near the top of `TabletJoin`:

  ```typescript
  const [tabletCode, setTabletCode] = useState('');
  ```

  Replace with:

  ```typescript
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('');
  ```

  Also add the color palette constant right before the `TabletJoin` component (after the `CountUp` component, before the `export function TabletJoin`):

  ```typescript
  const TEAM_COLORS = [
    { hex: '#3B82F6', name: 'Azul' },
    { hex: '#EF4444', name: 'Rojo' },
    { hex: '#10B981', name: 'Verde' },
    { hex: '#F59E0B', name: 'Amarillo' },
    { hex: '#8B5CF6', name: 'Morado' },
    { hex: '#F97316', name: 'Naranja' },
  ] as const;
  ```

- [ ] **Step 2: Add silent reconnect in useEffect**

  Find the existing `useEffect` (around line 137). Add a silent reconnect check at the very start, before the `fromUrl` logic:

  ```typescript
  useEffect(() => {
    // Silent reconnect for BYOD: if token exists in localStorage, try to rejoin
    const savedToken = localStorage.getItem('team_session_token');
    if (savedToken) {
      tabletConnectionsAPI
        .reconnect(savedToken)
        .then((data) => {
          localStorage.setItem('tabletConnectionId', String(data.connection.id));
          localStorage.setItem('teamId', String(data.team.id));
          localStorage.setItem('gameSessionId', String(data.game_session.id));
          localStorage.setItem('roomCode', String(data.game_session.room_code));
          navigate(`/tablet/lobby?connection_id=${data.connection.id}`);
        })
        .catch(() => {
          // Token expired or session ended — clear it and show form normally
          localStorage.removeItem('team_session_token');
        });
    }

    const fromUrl = searchParams.get('room_code');
    if (fromUrl) {
      setRoomCode(fromUrl.toUpperCase());
      setStep('tablet');
    }
    const parts = window.location.pathname.split('/');
    const idx = parts.indexOf('join');
    if (idx !== -1 && parts[idx + 1]?.length === 6) {
      setRoomCode(parts[idx + 1].toUpperCase());
      setStep('tablet');
    }
  }, [searchParams]);
  ```

- [ ] **Step 3: Update `handleConnect`**

  Replace the entire `handleConnect` function:

  ```typescript
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedRoom = roomCode.trim().toUpperCase();
    const trimmedName = teamName.trim();

    if (!trimmedRoom || !trimmedName || !teamColor) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const data = await tabletConnectionsAPI.connect(trimmedRoom, trimmedName, teamColor);
      localStorage.setItem('team_session_token', String(data.team_session_token));
      localStorage.setItem('tabletConnectionId', String(data.connection.id));
      localStorage.setItem('teamId', String(data.team.id));
      localStorage.setItem('gameSessionId', String(data.game_session.id));
      localStorage.setItem('roomCode', String(data.game_session.room_code));

      toast.success(data.message || '¡Conectado exitosamente!', {
        description: 'Redirigiendo al lobby…',
      });
      setTimeout(() => navigate(`/tablet/lobby?connection_id=${data.connection.id}`), 1000);
    } catch (error: any) {
      toast.error('No pudimos conectar', {
        description:
          error.response?.data?.error ||
          error.message ||
          'Verifica los datos e intenta nuevamente',
      });
      setLoading(false);
    }
  };
  ```

- [ ] **Step 4: Replace step indicator label**

  Find the step indicator array:

  ```typescript
  {['Sesión', 'Tablet'].map((label, i) => (
  ```

  Change to:

  ```typescript
  {['Sesión', 'Equipo'].map((label, i) => (
  ```

- [ ] **Step 5: Replace the entire step 2 JSX block**

  Find the `step === 'tablet'` branch (the `motion.div` with `key="step-tablet"`, around line 349). Replace it entirely:

  ```tsx
  <motion.div
    key="step-tablet"
    initial={{ x: 30, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: -30, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    className="space-y-5"
  >
    {/* Confirmed session code chip */}
    <div className="flex items-center gap-2 bg-[#F5F0E8] rounded-xl px-4 py-2.5">
      <div className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
      <span className="text-xs text-[#1B1B2F]/50 font-medium">Sesión</span>
      <span
        className="text-sm font-black text-[#1B1B2F] tracking-widest ml-auto"
        style={{ fontFamily: 'Unbounded, sans-serif' }}
      >
        {roomCode}
      </span>
      <button
        type="button"
        onClick={() => setStep('code')}
        className="text-[#FF3D2E] text-xs font-bold ml-2 hover:underline"
      >
        cambiar
      </button>
    </div>

    {/* Team name input */}
    <div>
      <label
        htmlFor="teamName"
        className="block text-xs font-bold uppercase tracking-[0.15em] text-[#1B1B2F]/60 mb-3"
      >
        Nombre del Equipo
      </label>
      <input
        id="teamName"
        type="text"
        placeholder="Ej: Los Innovadores"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        disabled={loading}
        autoFocus
        maxLength={50}
        className="
          w-full h-14 sm:h-16 px-5 rounded-2xl border-2 border-[#1B1B2F]/10
          text-lg font-bold text-[#1B1B2F]
          bg-white focus:outline-none focus:border-[#FF3D2E] focus:ring-4
          focus:ring-[#FF3D2E]/10 transition-all placeholder:text-[#1B1B2F]/25
          placeholder:font-normal placeholder:text-sm
        "
      />
    </div>

    {/* Color picker */}
    <div>
      <label className="block text-xs font-bold uppercase tracking-[0.15em] text-[#1B1B2F]/60 mb-3">
        Color del Equipo
      </label>
      <div className="flex gap-3 flex-wrap">
        {TEAM_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => setTeamColor(c.name)}
            disabled={loading}
            title={c.name}
            className="relative w-10 h-10 rounded-full transition-transform hover:scale-110 focus:outline-none"
            style={{ backgroundColor: c.hex }}
          >
            {teamColor === c.name && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ boxShadow: `0 0 0 3px white, 0 0 0 5px ${c.hex}` }}
              >
                <svg className="w-4 h-4 text-white drop-shadow" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </motion.div>
            )}
          </button>
        ))}
      </div>
      {teamColor && (
        <p className="text-xs text-[#1B1B2F]/40 mt-2 ml-1">
          Color seleccionado: {teamColor}
        </p>
      )}
    </div>

    {/* CTA button */}
    <motion.button
      type="submit"
      disabled={loading || teamName.trim().length < 2 || !teamColor}
      whileTap={{ scale: 0.96 }}
      className={`
        w-full h-16 sm:h-20 rounded-2xl font-black text-lg sm:text-xl
        transition-all duration-200 relative overflow-hidden
        flex items-center justify-center gap-3 shadow-xl
        ${
          !loading && teamName.trim().length >= 2 && teamColor
            ? 'bg-[#FF3D2E] text-white hover:bg-[#e03426] hover:shadow-2xl cursor-pointer'
            : 'bg-[#FF3D2E]/30 text-white/50 cursor-not-allowed'
        }
      `}
      style={{ fontFamily: 'Unbounded, sans-serif', letterSpacing: '0.03em' }}
    >
      {/* Shimmer */}
      {!loading && teamName.trim().length >= 2 && teamColor && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
        />
      )}

      {loading ? (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 rounded-full"
            style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
          />
          <span>Conectando…</span>
        </>
      ) : (
        <>
          <span>Entrar a la Misión</span>
          <motion.span
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="text-2xl"
          >
            🚀
          </motion.span>
        </>
      )}
    </motion.button>
  </motion.div>
  ```

- [ ] **Step 6: Run TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -40
  ```

  Expected: no errors related to `tabletCode`, `teamName`, or `teamColor`.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/pages/tablets/Join.tsx
  git commit -m "feat: replace tablet code input with team name + color picker (BYOD)"
  ```

---

## Task 6: Safe name/color merge in Lobby polling

**Files:**
- Modify: `frontend/src/pages/profesor/Lobby.tsx`

- [ ] **Step 1: Update `getTeamColorHex` to match the picker palette**

  Find `getTeamColorHex` in `Lobby.tsx` (around line 155). Replace the color map values so they match the picker exactly:

  ```typescript
  const getTeamColorHex = (color: string) => {
    const colorMap: Record<string, string> = {
      Azul:     '#3B82F6',
      Rojo:     '#EF4444',
      Verde:    '#10B981',
      Amarillo: '#F59E0B',
      Morado:   '#8B5CF6',
      Naranja:  '#F97316',
      Rosa:     '#EC4899',
      Cian:     '#06B6D4',
      Gris:     '#6B7280',
      Marrón:   '#795548',
    };
    return colorMap[color] || '#667eea';
  };
  ```

- [ ] **Step 2: Update the `loadLobby` function**

  Find this block inside `loadLobby` (around line 185–195):

  ```typescript
  // Initialize local teams only on first load — polling never resets them
  if (!initializedRef.current) {
    initializedRef.current = true;
    const initTeams: LocalTeam[] = data.teams.map((team) => ({
      backendId: team.id,
      name: team.name,
      hex: getTeamColorHex(team.color),
      students: team.students ?? [],
    }));
    setLocalTeams(initTeams);
    setNumberOfTeams(data.teams.length);
  }
  ```

  Replace with:

  ```typescript
  if (!initializedRef.current) {
    // First load: full initialization
    initializedRef.current = true;
    const initTeams: LocalTeam[] = data.teams.map((team) => ({
      backendId: team.id,
      name: team.name,
      hex: getTeamColorHex(team.color),
      students: team.students ?? [],
    }));
    setLocalTeams(initTeams);
    setNumberOfTeams(data.teams.length);
  } else {
    // Subsequent polls: ONLY sync name and color — never touch students (preserves drag-and-drop)
    setLocalTeams((prev) =>
      prev.map((localTeam) => {
        const backendTeam = data.teams.find((t) => t.id === localTeam.backendId);
        if (!backendTeam) return localTeam;
        return {
          ...localTeam,
          name: backendTeam.name,
          hex: getTeamColorHex(backendTeam.color),
        };
      })
    );
  }
  ```

- [ ] **Step 3: Run TypeScript check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -40
  ```

  Expected: no new errors.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/profesor/Lobby.tsx
  git commit -m "feat: safe name/color merge in Lobby polling — preserves drag-and-drop state"
  ```

---

## End-to-End Test Checklist

Once all tasks are done, verify these flows manually in the browser:

1. **New connection:** Open `/tablet/join`, enter 6-char room code → step 2 shows Name input + 6 color buttons. Fill name (≥2 chars), pick a color → "Entrar a la Misión" activates. Submit → navigates to tablet lobby. `localStorage.team_session_token` is set.

2. **Lobby sync:** In the professor's Lobby, the team card that just connected shows the custom name and selected color within ≤5 seconds.

3. **Drag-and-drop preserved:** After a team connects and updates its name, drag a student between teams in the Lobby — the next poll must NOT reset the student positions.

4. **Silent reconnect:** On the connected tablet, hard-refresh the page (`F5`). The student should be redirected directly to the lobby without seeing the form again.

5. **Expired token:** Manually remove the `team_session_token` from localStorage, then refresh → form appears normally.
