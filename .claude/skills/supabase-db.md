# Skill: Supabase / Base de Datos — Bizarro

## Cuándo cargar esta skill
Cuando trabajes en:
- src/lib/db.ts
- src/lib/supabase.ts
- src/lib/api-auth.ts
- Cualquier función que haga queries a Supabase
- Nuevas tablas o modificaciones del schema

---

## Cliente Supabase

```typescript
// src/lib/supabase.ts — singleton del cliente público (anon key)
import { supabase } from './supabase'

// Para rutas API que necesiten service role (bypass RLS):
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // NUNCA en cliente, solo server-side
)
```

**Regla:** El cliente anon key respeta RLS. El service role bypasa RLS.
Usar service role SOLO en rutas API server-side, nunca en componentes cliente.

---

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=       # URL pública (safe para cliente)
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Anon key (safe para cliente)
SUPABASE_SERVICE_ROLE_KEY=      # Solo servidor — NUNCA exponer al cliente
```

---

## Schema — Tablas y campos clave

| Tabla | Campos principales |
|---|---|
| `profiles` | id, full_name, role (athlete\|coach), avatar_url, program (slug) |
| `wods` | id, date, title, description, type, block (1-10), program (slug), owner_id |
| `results` | id, wod_id, user_id, score_time, score_rounds, score_weight, score_notes, rx |
| `programs` | id, name, slug, owner_id |
| `athlete_programs` | id, athlete_id, program_id, joined_at |
| `join_requests` | id, athlete_id, program_id, status (pending\|accepted\|rejected) |
| `personal_records` | id, user_id, exercise, weight, achieved_at, wod_id |
| `coach_invites` | token, created_by, used_at |

---

## Funciones en db.ts — Referencia rápida

### Profiles
```typescript
getProfile(userId)                    // perfil por ID
updateProfile(userId, { full_name, avatar_url })
updateProfileProgram(userId, program) // cambia el slug de programa activo
```

### WODs
```typescript
getWodsForWeek(from, to, program)     // WODs de la semana para un programa
getWodsForWeekLibre(userId, from, to) // WODs del atleta libre
createWod(wod: NewWod)
updateWod(id, { title, description, type })
deleteWod(id)
getWodRanking(wodId)                  // resultados + profiles join
```

### Results
```typescript
upsertResult(result: NewResult)       // conflict: wod_id,user_id
getResultsForWods(wodIds)             // solo del usuario autenticado
getResultsForWodsAndUser(wodIds, userId)
getMyResults()                        // historial propio
```

### Personal Records
```typescript
getMyPRs()                            // ordenados por exercise
maybeUpdatePR(userId, exercise, weight, achievedAt, wodId)
// Solo actualiza si weight > PR actual. Retorna { isNewPR: boolean }
```

### Programas y atletas
```typescript
getMyPrograms(userId)                 // programas donde userId es coach
getAthletes(programSlug)              // ⚠️ sin verificación de ownership (ver security.md)
getMyAthletePrograms(userId)          // programas donde userId es atleta
getDiscoverPrograms(userId)           // programas donde NO está inscrito
createProgram(name, slug, userId)
deleteProgram(id)
```

### Solicitudes de unión
```typescript
createJoinRequest(athleteId, programId)   // llama /api/create-join-request
cancelJoinRequest(athleteId, programId)   // llama /api/cancel-join-request
getMyJoinRequests(userId)                 // pendientes y rechazadas del atleta
getPendingJoinRequests(programIds)        // pendientes para el coach
acceptJoinRequest(requestId, ...)         // llama /api/accept-join-request (RPC atómica)
rejectJoinRequest(requestId)              // update directo a rejected
```

---

## Patrones de query correctos

```typescript
// Verificar ownership ANTES de devolver datos sensibles
const { data: program } = await supabase
  .from('programs')
  .select('owner_id')
  .eq('slug', programSlug)
  .single()

if (!program || program.owner_id !== user.id) {
  throw new Error('No autorizado')
}

// Join con foreign key
const { data } = await supabase
  .from('results')
  .select('*, profiles(full_name, avatar_url)')
  .eq('wod_id', wodId)

// Upsert con conflict key explícita
await supabase
  .from('results')
  .upsert({ ...result, user_id: user.id }, { onConflict: 'wod_id,user_id' })
  .select()
  .single()
```

---

## Helper de autorización: api-auth.ts

```typescript
import { getAuthenticatedUser, isProgramOwner } from '@/lib/api-auth'

// En toda ruta API:
const user = await getAuthenticatedUser(req)
if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

const isOwner = await isProgramOwner(user.id, programId)
if (!isOwner) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
```

**NUNCA reimplementar la verificación de sesión desde cero en rutas API.**

---

## RPC PostgreSQL — Transacciones atómicas

```typescript
// accept_join_request: acepta solicitud + añade a athlete_programs en una transacción
const { error } = await supabase.rpc('accept_join_request', {
  p_request_id:   requestId,
  p_athlete_id:   athleteId,
  p_program_id:   programId,
  p_program_slug: programSlug,
})
```

Usar RPC cuando se necesita atomicidad entre varias tablas.

---

## Casos edge documentados

```typescript
// Sesión expirada → supabase devuelve array vacío, NO error
// Siempre verificar user antes de asumir que los datos vacíos son correctos
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')

// maybeUpdatePR puede fallar silenciosamente si el upsert falla
// Siempre verificar el return value si el flujo depende de saber si fue PR
```
