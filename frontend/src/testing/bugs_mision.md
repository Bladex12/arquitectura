# Reporte de Bugs — Flujo Tablet Etapa 1

Auditoría realizada el 2026-04-28. Metodología: lectura directa de código (sin ejecución), rastreo de data flow desde Lobby → Instructivo.

---

## BUG-1 — Ruta del Instructivo no sigue el patrón `etapa1/`

**Severidad:** Alta (Bloqueante)
**Flujo:** Tablet - Etapa 1
**Archivos:**
- `frontend/src/App.tsx` línea 104
- `frontend/src/pages/tablets/Lobby.tsx` líneas 371, 379
- `frontend/src/pages/tablets/etapa1/VideoInstitucional.tsx` línea 65

**Descripción:** La ruta estaba definida como `/tablet/instructivo` mientras TODOS los demás recursos de Etapa 1 usan el patrón `/tablet/etapa1/<nombre>` (ej. `/tablet/etapa1/video-institucional`, `/tablet/etapa1/personalizacion`). Al no existir un catch-all, navegar a `/tablet/etapa1/instructivo` produce pantalla blanca porque React Router no encuentra ningún match y renderiza nada.

**Comportamiento esperado:** El estudiante debería ver el video del instructivo y el mensaje de espera al acceder a `/tablet/etapa1/instructivo`.

**Comportamiento actual:** El router de React no encuentra la ruta → pantalla blanca (sin error visible, sin redirect).

**Fix aplicado:**
```tsx
// App.tsx
<Route path="/tablet/etapa1/instructivo" element={<TabletInstructivo />} />

// Lobby.tsx (2 instancias)
redirectUrl = `/tablet/etapa1/instructivo?connection_id=${connectionId}`;

// VideoInstitucional.tsx (2 instancias)
window.location.href = `/tablet/etapa1/instructivo?connection_id=${connId}`;
```

**Estado:** RESUELTO

---

## BUG-2 — Sin ruta catch-all: URLs no definidas = pantalla blanca silenciosa

**Severidad:** Media
**Flujo:** Tablet - General
**Archivos:**
- `frontend/src/App.tsx` (faltaba catch-all al final de `<Routes>`)

**Descripción:** El bloque `<Routes>` cerraba en línea 120 sin ningún `<Route path="*">`. Cualquier URL no definida (typo, link roto, URL obsoleta) produce pantalla completamente blanca sin ningún indicador de error para el usuario. Esto amplificó el BUG-1 haciéndolo silencioso y difícil de diagnosticar.

**Comportamiento esperado:** URLs no reconocidas deben redirigir a un estado conocido (/tablet/join).

**Comportamiento actual:** Pantalla blanca sin feedback al usuario.

**Fix aplicado:**
```tsx
// App.tsx — última línea antes de </Routes>
<Route path="*" element={<Navigate to="/tablet/join" replace />} />
```

**Estado:** RESUELTO

---

## BUG-3 — URL del video instructivo es un placeholder roto

**Severidad:** Alta
**Flujo:** Tablet - Etapa 1
**Archivos:**
- `frontend/src/pages/tablets/etapa1/Instructivo.tsx` línea 24

**Descripción:** La constante `videoUrl` tenía el valor `'https://www.youtube.com/embed/VIDEO_ID_AQUI'`. YouTube rechaza esta URL mostrando un error dentro del iframe (pantalla negra con mensaje de error). El resto del componente renderiza correctamente, pero el área del video queda inutilizable.

**Comportamiento esperado:** El iframe muestra el video explicativo del juego, o un placeholder limpio si el video aún no está configurado.

**Comportamiento actual:** El iframe carga `youtube.com/embed/VIDEO_ID_AQUI` → YouTube devuelve error → pantalla negra con texto de error dentro de la tarjeta.

**Fix aplicado:**
```tsx
// Instructivo.tsx
const videoUrl = ''; // TODO: Reemplazar con el ID real del video de YouTube

// El iframe se renderiza condicionalmente:
{videoUrl ? (
  <iframe src={`${videoUrl}?autoplay=0...`} ... />
) : (
  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
    Video próximamente
  </div>
)}
```

**Acción pendiente:** Reemplazar `videoUrl = ''` con `videoUrl = 'https://www.youtube.com/embed/<ID_REAL>'` una vez disponible el video.

**Estado:** RESUELTO PROVISIONALMENTE (placeholder limpio hasta tener el ID del video)

---

## BUG-4 — Border-radius de tarjeta usa `rounded-3xl` (24px) en lugar de `rounded-[2.5rem]` (40px)

**Severidad:** Baja (Estética)
**Flujo:** Tablet - Etapa 1
**Archivos:**
- `frontend/src/pages/tablets/etapa1/Instructivo.tsx` línea 160

**Descripción:** La tarjeta principal del Instructivo usaba `rounded-3xl` (1.5rem / 24px). La estética Mission Launchpad — usada consistentemente en Lobby y VideoInstitucional — especifica `rounded-[2.5rem]` (40px) para las tarjetas principales. El resultado era un radio de borde notablemente más pequeño que el resto del diseño.

**Comportamiento esperado:** Tarjeta con radio de 40px, coherente con el sistema de diseño Mission Launchpad.

**Comportamiento actual:** Tarjeta con radio de 24px, visualmente inconsistente.

**Fix aplicado:**
```tsx
// Antes
className="bg-white rounded-3xl shadow-sm ..."
// Después
className="bg-white rounded-[2.5rem] shadow-sm ..."
```

**Estado:** RESUELTO

---

## Resumen

| Bug | Severidad | Estado |
|-----|-----------|--------|
| BUG-1: Ruta `/tablet/instructivo` no sigue patrón `etapa1/` | Alta (Bloqueante) | RESUELTO |
| BUG-2: Sin catch-all → pantalla blanca en URLs no definidas | Media | RESUELTO |
| BUG-3: URL del video es placeholder roto `VIDEO_ID_AQUI` | Alta | RESUELTO PROVISIONALMENTE |
| BUG-4: `rounded-3xl` en lugar de `rounded-[2.5rem]` | Baja | RESUELTO |

✓ Debugging de Etapa 1 completado — 4 bugs encontrados
