# Bizarro — Contexto del Proyecto

## Qué es

Aplicación web de gestión de entrenamientos CrossFit. Permite a coaches crear y gestionar programas de WODs, y a atletas registrar resultados, ver rankings y usar un timer inteligente. Multi-programa y multi-tenant.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript
- **Base de datos:** Supabase (PostgreSQL + Auth)
- **Estilos:** Tailwind CSS v4
- **Email:** Resend
- **IA:** Anthropic SDK (Claude Haiku para generación de timers)
- **Deploy:** Vercel

## Convenciones del proyecto

- Rutas en `src/app/` con App Router
- Componentes cliente llevan `'use client'` en la primera línea
- Nombres de archivos en kebab-case, componentes en PascalCase
- Tipos e interfaces principales en `src/lib/types.ts`
- Todo acceso a Supabase pasa por `src/lib/db.ts` o `src/lib/supabase.ts`
- Credenciales siempre via `process.env`, nunca hardcodeadas
- Sin `console.log` ni `console.error` en producción — los errores se muestran al usuario via estado

## Estructura clave

```
src/
├── app/
│   ├── page.tsx                    # Landing / root redirect
│   ├── login/                      # Login
│   ├── register/                   # Registro (soporta ?invite= para coaches)
│   ├── forgot-password/            # Recuperar contraseña
│   ├── reset-password/             # Reset contraseña
│   ├── dashboard/                  # Panel atleta: WODs semana + resultados + ranking
│   ├── elegir-modo/                # Selección: programa con coach o "por libre"
│   ├── libre/                      # Panel atleta libre: sus propios WODs
│   ├── maximos/                    # Personal records del atleta
│   ├── programaciones/             # Gestión de programas: unirse, solicitar, dejar
│   ├── profile/                    # Editar perfil
│   ├── timer/                      # Timer de entrenamiento (AMRAP, EMOM, For Time, Tabata, Mix)
│   ├── admin/                      # Panel coach: WODs + rankings + invitaciones
│   ├── admin/atletas/              # Gestión de atletas del programa
│   ├── admin/notificaciones/       # Solicitudes de unión pendientes
│   ├── select-program/             # Selección de programa activo (coaches multi-programa)
│   └── api/
│       ├── generate-timer/         # POST: IA genera config de timer desde WOD
│       ├── analyze-week/           # POST: IA analiza imagen y carga WODs de la semana
│       ├── accept-join-request/    # POST: acepta solicitud + envía email bienvenida
│       ├── create-join-request/    # POST: crea solicitud de unión
│       ├── cancel-join-request/    # POST: cancela solicitud
│       ├── leave-program/          # POST: atleta abandona un programa
│       ├── add-athlete/            # POST: agrega atleta por email directo
│       ├── remove-athlete/         # POST: remueve atleta del programa
│       ├── use-invite/             # POST: valida token de invitación coach
│       └── auth/
│           ├── login/              # POST: proxy server-side de login con rate limiting
│           └── check-rate-limit/   # POST: verifica si IP está bloqueada (register/forgot)
├── lib/
│   ├── types.ts                    # Tipos: Wod, Result, Profile, Program, WodType, TimerConfig, MixBlock...
│   ├── db.ts                       # Todas las funciones de acceso a Supabase
│   ├── auth.ts                     # signUp, signIn, signOut, resetPassword
│   ├── supabase.ts                 # Cliente Supabase singleton
│   ├── week-utils.ts               # DAY_SHORT, isSunday, getWeekDates, formatWeekRange, getTodayStr
│   ├── wod-utils.ts                # WOD_TYPES, WOD_TYPE_LABEL, detectPRExercise, parseTime, parseAmrap, parseNumber, sortRanking, getScoreDisplay
│   ├── api-auth.ts                 # getAuthenticatedUser, isProgramOwner
│   ├── auth-rate-limit.ts          # Rate limiting para auth (auth_attempts en Supabase)
│   └── ai-rate-limit.ts            # Rate limiting para endpoints de IA (ai_usage en Supabase)
└── components/
    ├── AppHeader.tsx               # Header atleta con nav, timer modal, perfil
    ├── CoachHeader.tsx             # Header coach con nav y selección de programa
    ├── CoachMessageCard.tsx        # Tarjeta mensaje del coach (desktop, sidebar)
    ├── CoachMessageBubble.tsx      # Burbuja mensaje del coach (móvil, flotante)
    ├── PRCalculator.tsx            # Calculadora de pesos basada en PRs del atleta
    ├── Timer.tsx                   # Modal timer simple
    ├── LoadWeekModal.tsx           # Modal carga WODs desde imagen (incluye mensaje del coach)
    ├── ResultModal.tsx             # Modal registro/edición de resultado (auto-actualiza PR)
    ├── RankingSection.tsx          # Sección ranking con paginación y refreshKey
    ├── timer/                      # Subcomponentes del timer
    │   ├── timer-utils.ts          # fmt(), beep()
    │   ├── ClockFace.tsx           # Cara del reloj (display)
    │   ├── PreStartCountdown.tsx   # Cuenta regresiva antes de empezar
    │   ├── SimpleTimer.tsx         # Timer AMRAP/EMOM
    │   ├── IntervalTimer.tsx       # Timer de intervalos genérico
    │   ├── ForTimeTimer.tsx        # Timer For Time (cuenta arriba)
    │   ├── TabataTimer.tsx         # Timer Tabata
    │   ├── MixTimer.tsx            # Timer Mix (bloques)
    │   ├── AMRAPSetup.tsx          # Config AMRAP
    │   ├── EMOMSetup.tsx           # Config EMOM
    │   ├── ForTimeSetup.tsx        # Config For Time
    │   ├── TabataSetup.tsx         # Config Tabata
    │   └── MixSetup.tsx            # Config Mix
    ├── admin/
    │   └── WodModal.tsx            # Modal crear/editar WOD (coach)
    └── libre/
        └── WodForm.tsx             # Formulario WOD modo libre
```

## Modelo de datos (Supabase)

| Tabla | Campos clave |
|---|---|
| `profiles` | id, full_name, role (athlete\|coach), avatar_url, program (slug) |
| `wods` | id, date, title, description, type, block (1-10), program (slug), owner_id |
| `results` | id, wod_id, user_id, score_time, score_rounds, score_weight, score_notes, rx |
| `programs` | id, name, slug, owner_id |
| `athlete_programs` | id, athlete_id, program_id, joined_at |
| `join_requests` | id, athlete_id, program_id, status (pending\|accepted\|rejected) |
| `personal_records` | id, user_id, exercise, weight, achieved_at, wod_id |
| `coach_invites` | token, created_by, used_at |
| `coach_messages` | id, program_slug, week_start, content, created_by, created_at — UNIQUE(program_slug, week_start) |

## Roles de usuario

**Atleta:** ver WODs de su programa, registrar resultados, ver rankings, usar timer IA, modo libre, gestionar inscripciones, PRs.

**Coach:** crear/editar/eliminar WODs, ver rankings, gestionar atletas, aprobar solicitudes, generar invitaciones, cargar semanas desde imagen, multi-programa.

## Librerías de utilidades

- `src/lib/week-utils.ts` — `DAY_SHORT`, `isSunday`, `getWeekDates`, `formatWeekRange`, `getTodayStr`. Usar siempre desde aquí, nunca redefinir en páginas.
- `src/lib/wod-utils.ts` — `WOD_TYPES` (lista canónica), `WOD_TYPE_LABEL`, `detectPRExercise`, `parseTime`, `parseAmrap`, `parseNumber`, `sortRanking`, `getScoreDisplay`. Idem.
- `src/lib/api-auth.ts` — `getAuthenticatedUser`, `isProgramOwner`. Helper de autorización para rutas API.
- `src/lib/auth-rate-limit.ts` — `checkAuthRateLimit`, `recordAuthAttempt`. Usar en `/api/auth/login` y `/api/auth/check-rate-limit`.
- `src/lib/ai-rate-limit.ts` — `checkAiRateLimit`, `recordAiUsage`. Usar en `/api/generate-timer` y `/api/analyze-week`.
- `src/components/timer/timer-utils.ts` — `fmt()` (formatea segundos), `beep()` (audio feedback). Usar desde cualquier componente de timer.

## Estado del proyecto (actualizado 2026-03-26)

- Autenticación completa (login, registro, recuperación, invitaciones)
- Multi-programa funcional (coaches pueden gestionar varios programas)
- Timer con IA (Claude Sonnet 4.6 interpreta el WOD y genera la config)
- Carga de semana por imagen (reconocimiento con IA, incluye mensaje del coach)
- Sistema de solicitudes de unión con notificaciones por email (Resend)
- Rankings por WOD con paginación; se refresca automáticamente al guardar resultado
- Personal records con auto-actualización al guardar resultado de Strength
- Calculadora de pesos por porcentaje de PR (`PRCalculator`) en el dashboard
- Mensajes del coach por semana y programa (`coach_messages`), visibles en dashboard
- Tipos de WOD: Warmup, Strength, Gymnastics, Core, Mobility, For Time, AMRAP, EMOM, For Max, Other
- Seguridad de rutas API: add-athlete, remove-athlete, accept-join-request, use-invite verifican sesión y ownership
- use-invite: JWT obligatorio — no acepta userId del cliente; update atómico anti-race-condition
- add-athlete: busca email en auth.users via admin API (profiles no tiene columna email)
- accept-join-request usa RPC PostgreSQL (transacción atómica)
- Manejo de errores revisado (sin console.log en producción, errores visibles al usuario)
- Rate limiting en login (proxy server-side, 5/15min) y register/forgot-password (pre-check, 3/60min)
- Refactor de componentes: subcomponentes extraídos a `src/components/timer/`, `src/components/admin/`, `src/components/libre/`
- `WOD_TYPES` y `getTodayStr` centralizados — no redefinir en páginas
- Tests unitarios con Vitest: 62 tests en `wod-utils.test.ts`, `week-utils.test.ts`, `timer-utils.test.ts`

## Comportamiento según tipo de tarea

Identifica la intención del usuario por sus palabras clave y aplica el comportamiento correspondiente:

| Si el usuario dice... | Comportamiento a aplicar |
|---|---|
| "construye", "implementa", "crea", "añade" | Constructor: código listo para producción, tipos TS, validación, sin console.log |
| "revisa", "audita", "comprueba seguridad" | Escudo: verificar auth, ownership, inputs, errores expuestos |
| "hay un bug", "no funciona", "investiga", "por qué" | Detective: causa raíz primero, corrección mínima |
| "optimiza", "refactoriza", "está muy grande" | Optimizador: queries, rerenders, código duplicado |
| "antes de implementar", "cómo lo harías", "diseña" | Arquitecto: plan sin código, flujo de datos, riesgos |
| "documenta", "explica este código" | Narrador: JSDoc + contexto para otros desarrolladores |

Combina siempre con la skill del área correspondiente antes de actuar.

---

## Memoria persistente (Engram)

Tienes acceso a memoria persistente via MCP (Engram).

**Al iniciar cada sesión:** llama a `mem_context` para recuperar el estado anterior.

**Guarda automáticamente cuando:**
- Se resuelve un bug o vulnerabilidad
- Se toma una decisión de arquitectura
- Se descubre un patrón nuevo relevante para el proyecto
- Se completa una feature significativa

**Formato obligatorio al guardar:**
```
what:    qué se hizo
why:     por qué era necesario
where:   archivo(s) afectado(s) con ruta
learned: qué aprender de esto para el futuro
```

**Al terminar la sesión:** llama a `mem_session_end` para guardar el resumen.

**Nunca guardes** en Engram lo que ya está en skills o CLAUDE.md — evita duplicar contexto estático.

---

## Mantenimiento de Skills

Cuando resuelvas un bug, vulnerabilidad o caso edge documentado en `.claude/skills/`:
- Elimina el problema de la skill si está completamente resuelto
- Añade el nuevo patrón aprendido si es relevante para el futuro
- Actualiza ejemplos de código si el patrón correcto ha cambiado

Aplica esto siempre al final de cada tarea, sin que el usuario tenga que pedírtelo.

---

## Skills disponibles

Carga la skill correspondiente antes de trabajar en cada área:

| Área | Skill |
|---|---|
| Rutas API, vulnerabilidades, autorización | `.claude/skills/security.md` |
| Login, registro, sesión, AuthContext, avatares | `.claude/skills/auth.md` |
| Timer con IA, tipos de timer, /api/generate-timer | `.claude/skills/timer-ia.md` |
| Queries Supabase, db.ts, schema, RPC | `.claude/skills/supabase-db.md` |
| Panel coach, atletas, invitaciones, multi-programa | `.claude/skills/coach-panel.md` |

---

---

<!-- BEGIN:agent-teams-lite -->
## Agent Teams Lite

Orquestación liviana. El agente actúa con sentido común: lee, analiza y edita directamente cuando la tarea es simple; delega a sub-agentes cuando la tarea es compleja o requiere aislamiento de contexto. El humano decide antes de las fases críticas.

### Cuándo actuar directamente vs. delegar

| Tipo de tarea | Acción |
|---|---|
| Pregunta, explicación, análisis corto | Responde directamente |
| Fix de bug puntual, edición de 1-3 archivos | Lee y edita directamente |
| Feature mediana con múltiples archivos | Edita directamente con plan previo si es necesario |
| Feature sustancial o cambio arquitectónico | SDD: `/sdd-new {nombre}` |
| Tarea que requiere contexto aislado o paralelismo | Lanza sub-agente |

**Regla práctica:** si puedes resolver la tarea leyendo los archivos relevantes y editando sin perder el hilo, hazlo. Delega cuando la tarea es tan grande que fragmentarla protege el contexto.

### Human Gates (aprobación obligatoria antes de)

Detente y muestra el plan al usuario antes de:
- Implementar una feature nueva de más de 2-3 archivos
- Aplicar un refactor estructural
- Cualquier cambio en esquema de base de datos o rutas API
- Deploy o merge a producción

Para tasks pequeñas (fix de bug, corrección tipográfica, ajuste de estilo) no es necesario el gate.

### Skills: carga selectiva

Carga solo la skill del área donde vas a trabajar. No cargues todas al inicio.

```
Área activa → carga su skill → trabaja → descarta
```

Si la tarea toca varias áreas, carga las skills una a una conforme avanzas, no todas a la vez.

### SDD (Spec-Driven Development)

SDD solo para cambios sustanciales: features nuevas complejas, refactors grandes, decisiones de arquitectura.

**No uses SDD para:** bugs, fixes, ajustes de UI, cambios en 1-2 archivos.

#### Comandos SDD
- `/sdd-new <cambio>` — exploración + propuesta
- `/sdd-continue [cambio]` — siguiente artefacto pendiente
- `/sdd-ff [cambio]` — propuesta → spec → diseño → tareas (fast forward)
- `/sdd-apply [cambio]` — implementación por lotes
- `/sdd-verify [cambio]` — verificación contra spec
- `/sdd-archive [cambio]` — cierre y archivado

#### Flujo de artefactos
```
propuesta → spec ──→ tareas → apply → verify → archive
                ↑
              diseño
```

Cada artefacto se guarda en Engram con topic key `sdd/{cambio}/{fase}`.

### Sub-agentes: cuándo usarlos

Lanza un sub-agente cuando:
- La tarea requiere contexto fresco (no contaminar la conversación actual)
- Se pueden ejecutar dos fases en paralelo (ej. spec + diseño simultáneos)
- La tarea es tan larga que completarla inline agotaría el contexto

Cuando lances un sub-agente, incluye en el prompt:
- Contexto relevante de Engram (búscalo tú antes de delegar)
- La skill correspondiente: `SKILL: Carga \`{ruta-skill}\` antes de empezar.`
- Instrucción de guardar en Engram si hace descubrimientos importantes

<!-- END:agent-teams-lite -->

---

## Pendiente / Conocido

### Features no implementadas
- Búsqueda de atletas por nombre en el panel de atletas
- Ranking global de PRs entre atletas
- Plantillas de WODs reutilizables

### UX

### Deuda técnica
