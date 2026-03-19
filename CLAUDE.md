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
│       ├── accept-join-request/    # POST: acepta solicitud + envía email bienvenida
│       ├── create-join-request/    # POST: crea solicitud de unión
│       ├── cancel-join-request/    # POST: cancela solicitud
│       ├── add-athlete/            # POST: agrega atleta por email directo
│       ├── remove-athlete/         # POST: remueve atleta del programa
│       └── use-invite/             # POST: valida token de invitación coach
├── lib/
│   ├── types.ts                    # Tipos: Wod, Result, Profile, Program, WodType...
│   ├── db.ts                       # Todas las funciones de acceso a Supabase
│   ├── auth.ts                     # signUp, signIn, signOut, resetPassword
│   └── supabase.ts                 # Cliente Supabase singleton
└── components/
    ├── AppHeader.tsx               # Header atleta con nav, timer modal, perfil
    ├── Timer.tsx                   # Modal timer simple
    └── LoadWeekModal.tsx           # Modal carga WODs desde imagen
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

## Roles de usuario

**Atleta:** ver WODs de su programa, registrar resultados, ver rankings, usar timer IA, modo libre, gestionar inscripciones, PRs.

**Coach:** crear/editar/eliminar WODs, ver rankings, gestionar atletas, aprobar solicitudes, generar invitaciones, cargar semanas desde imagen, multi-programa.

## Librerías de utilidades

- `src/lib/week-utils.ts` — `DAY_SHORT`, `isSunday`, `getWeekDates`, `formatWeekRange`. Usar siempre desde aquí, nunca redefinir en páginas.
- `src/lib/wod-utils.ts` — `parseTime`, `parseAmrap`, `parseNumber`, `sortRanking`. Idem.
- `src/lib/api-auth.ts` — `getAuthenticatedUser`, `isProgramOwner`. Helper de autorización para rutas API.

## Estado del proyecto (actualizado 2026-03-16)

- Autenticación completa (login, registro, recuperación, invitaciones)
- Multi-programa funcional (coaches pueden gestionar varios programas)
- Timer con IA (Claude Haiku interpreta el WOD y genera la config)
- Carga de semana por imagen (reconocimiento con IA)
- Sistema de solicitudes de unión con notificaciones por email (Resend)
- Rankings por WOD con paginación
- Personal records
- Seguridad de rutas API: add-athlete, remove-athlete, accept-join-request verifican sesión y ownership
- accept-join-request usa RPC PostgreSQL (transacción atómica)
- use-invite: update atómico para evitar race condition
- Manejo de errores revisado (sin console.log en producción, errores visibles al usuario)
- Código duplicado centralizado en week-utils.ts y wod-utils.ts

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

## Pendiente / Conocido

### UX

### Deuda técnica
- Componentes grandes sin dividir: `timer/page.tsx` (~1200 líneas), `admin/page.tsx` (~700 líneas), `libre/page.tsx` (~700 líneas), `dashboard/page.tsx` (~600 líneas)
- Naming inconsistente: `loading` vs `isLoading` mezclados entre páginas
- Estilos de botón inconsistentes: `disabled:opacity-40` vs `disabled:opacity-50`
- Sin tests automatizados
