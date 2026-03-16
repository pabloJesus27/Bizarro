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

## Pendiente / Conocido

### UX
- `dashboard/page.tsx` línea ~560: mensaje de error del timer dice "Comprueba la API key" — el usuario final no puede hacer nada con eso. Cambiar a mensaje genérico.
- Eliminar atleta es irreversible sin opción de recuperación (`admin/atletas/page.tsx`).
- Estados de carga visualmente inconsistentes entre páginas (algunos usan `w-px h-10 animate-pulse`, otros spinners diferentes).

### Seguridad
- `getAthletes` en `db.ts` no verifica que el caller sea coach del programa — cualquier usuario autenticado podría obtener la lista de atletas de cualquier programa.
- No hay rate limiting en ninguna ruta API (riesgo de fuerza bruta en login/registro).
- `add-athlete/route.ts` usa `listUsers()` completo para buscar por email — ineficiente y permite enumerar usuarios.

### Casos edge
- Si el token de sesión expira a mitad de operación, `db.ts` devuelve array vacío en lugar de error — el usuario ve datos vacíos sin saber por qué.
- `elegir-modo`: si `getProfile` falla, ya tiene `.catch()` con mensaje. Pero `getMyAthletePrograms` dentro del `.then()` puede fallar sin capturarse — envolver en try/catch.
- Resultado guardado localmente en UI pero podría no haberse grabado en BD si `upsertResult` falla silenciosamente (`dashboard/page.tsx`).

### Deuda técnica
- Componentes grandes sin dividir: `timer/page.tsx` (~1200 líneas), `admin/page.tsx` (~700 líneas), `libre/page.tsx` (~700 líneas), `dashboard/page.tsx` (~600 líneas)
- `ResultModal` casi idéntico en `dashboard/page.tsx` y `libre/page.tsx` — candidato a componente compartido en `src/components/`
- Naming inconsistente: `loading` vs `isLoading` mezclados entre páginas
- Estilos de botón inconsistentes: `disabled:opacity-40` vs `disabled:opacity-50`
- Sin tests automatizados
