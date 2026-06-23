# Diseño: Identidad de Equipo en Login de Tablet + Sincronización Lobby

**Fecha:** 2026-04-13  
**Estado:** Aprobado  
**Contexto de negocio:** La universidad migra de tablets físicas a BYOD (dispositivos personales de alumnos). El concepto de "Código de Tablet" físico es obsoleto. Los alumnos ahora definen la identidad de su equipo (nombre + color) al unirse a la sesión.

---

## Objetivo

1. Reemplazar el input "Código de Tablet" en `TabletJoin` por un nombre de equipo libre + selector de color.
2. Al conectarse, el backend actualiza directamente `Team.name` y `Team.color` con los valores del alumno.
3. El Lobby del profesor refleja esos cambios en el siguiente ciclo de polling (≤5s) sin romper el drag-and-drop de estudiantes.
4. Soportar reconexión silenciosa BYOD via `team_session_token` guardado en `localStorage`.

---

## Sección 1: Cambios de Modelo Django

### `TabletConnection` (game_sessions/models.py)

| Campo | Cambio |
|-------|--------|
| `tablet` (FK → Tablet) | `null=True, blank=True` — ya no es requerido |
| `team_session_token` | Nuevo `UUIDField(default=uuid.uuid4, editable=False)` |

**Una sola migración** cubre ambos cambios. No se elimina el FK para preservar el historial de conexiones con tablet física.

---

## Sección 2: Endpoint de Conexión (Backend)

### Modificación de `TabletConnectionViewSet.connect`

**Antes:** `room_code` + `tablet_code` → lookup en tabla `Tablet`  
**Después:** `room_code` + `team_name` + `team_color`

**Flujo nuevo:**
1. Buscar `GameSession` por `room_code` (igual que antes)
2. Verificar que la sesión esté en estado `waiting`
3. Encontrar el primer `Team` sin conexión activa (igual que antes)
4. `team.name = team_name`, `team.color = team_color` → `team.save()`
5. Crear `TabletConnection(tablet=None, team=team, game_session=game_session)`
6. Devolver `{connection, team, game_session, team_session_token}`

**Reconexión (nuevo action `reconnect`):**
- Acepta: `team_session_token`
- Encuentra `TabletConnection` por token
- Si `disconnected_at` no es null, la reactiva (`disconnected_at = None`)
- Devuelve mismos datos que connect
- El frontend lo llama en mount si hay token en localStorage

### Serializer

`TabletConnectionSerializer` debe incluir `team_session_token` en la respuesta.

---

## Sección 3: Frontend — TabletJoin (`Join.tsx`)

### Estado

| Estado eliminado | Estado nuevo |
|-----------------|--------------|
| `tabletCode: string` | `teamName: string` |
| — | `teamColor: string` (hex) |

### Paleta de colores (6 opciones)

| Color | Hex | Nombre backend |
|-------|-----|----------------|
| Azul | `#3B82F6` | `Azul` |
| Rojo | `#EF4444` | `Rojo` |
| Verde | `#10B981` | `Verde` |
| Amarillo | `#F59E0B` | `Amarillo` |
| Morado | `#8B5CF6` | `Morado` |
| Naranja | `#F97316` | `Naranja` |

### UI del Step 2

- Label del paso: "Tablet" → "**Equipo**"
- Input texto: label `NOMBRE DEL EQUIPO`, placeholder `Ej: Los Innovadores`, estado `teamName`
- Selector color: fila de 6 botones circulares (40px), el seleccionado muestra un anillo exterior + checkmark
- CTA habilitado cuando: `teamName.trim().length >= 2 && teamColor !== ''`
- En mount: si `localStorage.team_session_token` existe → llamar `reconnect` silenciosamente y navegar directo si tiene éxito

### Submit

```typescript
await tabletConnectionsAPI.connect(roomCode, teamName, teamColor)
// Guarda en localStorage:
localStorage.setItem('team_session_token', data.team_session_token)
localStorage.setItem('tabletConnectionId', data.connection.id)
localStorage.setItem('teamId', data.team.id)
localStorage.setItem('gameSessionId', data.game_session.id)
localStorage.setItem('roomCode', data.game_session.room_code)
```

### Servicio actualizado (`tabletConnections.ts`)

```typescript
connect(roomCode, teamName, teamColor)  // body: { room_code, team_name, team_color }
reconnect(teamSessionToken)              // body: { team_session_token }
```

---

## Sección 4: Frontend — Lobby del Profesor (`Lobby.tsx`)

### Problema actual

`localTeams` se inicializa UNA sola vez desde el backend (`initializedRef.current`). Los polls subsecuentes nunca actualizan nombre ni color, por lo que el cambio de identidad del equipo nunca se refleja.

### Solución: merge seguro en polling

```typescript
// Dentro de loadLobby, después de setLobbyData(data):
if (!initializedRef.current) {
  // Primera carga: inicialización completa (sin cambios)
  initializedRef.current = true;
  const initTeams = data.teams.map(team => ({
    backendId: team.id,
    name: team.name,
    hex: getTeamColorHex(team.color),
    students: team.students ?? [],
  }));
  setLocalTeams(initTeams);
  setNumberOfTeams(data.teams.length);
} else {
  // Polls subsecuentes: SOLO actualiza name y hex, preserva students
  setLocalTeams(prev => prev.map(localTeam => {
    const backendTeam = data.teams.find(t => t.id === localTeam.backendId);
    if (!backendTeam) return localTeam;
    return { ...localTeam, name: backendTeam.name, hex: getTeamColorHex(backendTeam.color) };
  }));
}
```

**Garantía:** El drag-and-drop del profesor (`.students`) nunca se sobrescribe. Solo `name` y `hex` se sincronizan.

---

## Archivos a modificar

### Backend
- `game_sessions/models.py` — `TabletConnection`: tablet nullable + team_session_token
- `game_sessions/views.py` — `TabletConnectionViewSet.connect` + nuevo action `reconnect`
- `game_sessions/serializers.py` — incluir `team_session_token` en serializer
- `game_sessions/migrations/` — nueva migración auto-generada

### Frontend
- `frontend/src/pages/tablets/Join.tsx` — reemplazar step 2 completo
- `frontend/src/services/tabletConnections.ts` — actualizar `connect`, agregar `reconnect`
- `frontend/src/pages/profesor/Lobby.tsx` — merge seguro en polling

---

## Casos límite

- **Sesión en estado `running`:** El endpoint de `connect` sigue bloqueando nuevas conexiones (comportamiento actual preservado). El `reconnect` vía token sí permite reconectar.
- **Token inválido en localStorage:** Si `reconnect` falla (404/400), se limpia el token y se muestra el formulario normal.
- **Dos alumnos eligen el mismo color:** Permitido. El constraint es uno por equipo, no uno por color.
- **Profesor cambia nombre de equipo manualmente (futuro):** La próxima vez que un alumno se conecte, sobrescribirá el nombre. Aceptable en el alcance actual.
