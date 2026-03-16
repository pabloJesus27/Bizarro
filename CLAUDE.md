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

## Estado del proyecto (actualizado 2026-03-16)

- Autenticación completa (login, registro, recuperación, invitaciones)
- Multi-programa funcional (coaches pueden gestionar varios programas)
- Timer con IA (Claude Haiku interpreta el WOD y genera la config)
- Carga de semana por imagen (reconocimiento con IA)
- Sistema de solicitudes de unión con notificaciones por email (Resend)
- Rankings por WOD con paginación
- Personal records
- Manejo de errores revisado (sin console.log en producción, errores visibles al usuario)

## Pendiente / Conocido

- Componentes grandes sin dividir: `timer/page.tsx` (1222 líneas), `admin/page.tsx` (759 líneas), `libre/page.tsx` (733 líneas), `dashboard/page.tsx` (632 líneas)
- Sin tests automatizados
