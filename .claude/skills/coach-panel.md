# Skill: Panel Coach — Bizarro

## Cuándo cargar esta skill
Cuando trabajes en:
- src/app/admin/
- src/app/admin/atletas/
- src/app/admin/notificaciones/
- src/app/select-program/
- src/app/elegir-modo/
- Cualquier funcionalidad exclusiva de coaches (roles, invitaciones, gestión de atletas)

---

## Roles de usuario

```typescript
// profiles.role
'athlete' | 'coach'

// Cómo verificar el rol en componentes cliente
const { user } = useAuth()
const profile = await getProfile(user.id)
if (profile.role !== 'coach') router.push('/dashboard')

// En rutas API: verificar ownership, NO el role directamente
// Un coach solo puede operar sobre sus propios programas
const isOwner = await isProgramOwner(user.id, programId)
```

---

## Multi-programa — Flujo del coach

Un coach puede tener varios programas. El flujo de selección:

```
/admin  →  si hay más de 1 programa activo  →  /select-program
           si hay 1 programa                →  panel directo con ese programa
```

El programa activo del coach se almacena en `profiles.program` (slug).

```typescript
// Obtener programas del coach
const programs = await getMyPrograms(userId)  // src/lib/db.ts

// Cambiar programa activo
await updateProfileProgram(userId, newSlug)   // actualiza profiles.program
```

---

## Gestión de atletas

### Añadir atleta por email
```typescript
// Llama /api/add-athlete (requiere auth + ownership)
await addAthleteByEmail(email, programId, programSlug)

// La ruta API:
// 1. Verifica auth y ownership
// 2. listUsers() para buscar por email ← VULNERABILIDAD CONOCIDA (ver security.md)
// 3. Verifica que tiene perfil y role='athlete'
// 4. Inserta en athlete_programs
// 5. Actualiza profiles.program y profiles.role
```

### Eliminar atleta
```typescript
// Llama /api/remove-athlete (requiere auth + ownership)
await removeAthleteFromProgram(athleteId, programId)
// ⚠️ Irreversible — no hay opción de recuperación (CLAUDE.md pendiente UX)
```

### Ver atletas del programa
```typescript
// ⚠️ getAthletes() en db.ts no verifica ownership (CLAUDE.md pendiente seguridad)
const athletes = await getAthletes(programSlug)
```

---

## Solicitudes de unión

```typescript
// Coach ve solicitudes pendientes de sus programas
const requests = await getPendingJoinRequests(programIds)

// Aceptar → RPC atómica + email de bienvenida via Resend
await acceptJoinRequest(requestId, athleteId, programId, programSlug)

// Rechazar → update directo
await rejectJoinRequest(requestId)
```

El email de bienvenida se envía desde `accept-join-request/route.ts` usando Resend.

---

## Invitaciones de coach

```typescript
// Crear token de invitación (tabla coach_invites)
const token = await createCoachInvite(userId)
// Genera UUID, inserta en coach_invites con created_by

// URL de invitación que se comparte:
`${window.location.origin}/register?invite=${token}`

// El token se valida en /api/use-invite (update atómico para evitar race condition)
// Una vez usado, used_at = now() → no se puede reutilizar
```

---

## WODs — Operaciones del coach

```typescript
// Crear WOD para un programa específico
await createWod({
  date: '2026-03-17',
  title: 'WOD Título',
  description: 'Descripción del WOD',
  type: 'amrap',           // WodType
  block: 1,                // 1-10
  program: programSlug,    // slug del programa
  owner_id: userId
})

// Actualizar solo title, description, type
await updateWod(id, { title, description, type })

// Eliminar
await deleteWod(id)
```

---

## Carga de semana por imagen

```typescript
// POST /api/analyze-week
// Recibe imagen (base64 o URL) con el planning semanal
// Usa IA para extraer WODs → devuelve array de WODs a crear

// Componente: src/components/LoadWeekModal.tsx
```

---

## Variables de entorno requeridas por funcionalidades coach

```
RESEND_API_KEY=          # Email de bienvenida al aceptar solicitudes
SUPABASE_SERVICE_ROLE_KEY= # Rutas API que usan admin client (add-athlete, accept-join-request)
ANTHROPIC_API_KEY=       # Análisis de imagen para cargar semana
```

---

## Rutas API exclusivas de coaches

| Ruta | Función | Verificación |
|---|---|---|
| `/api/add-athlete` | Añadir atleta por email | auth + isProgramOwner |
| `/api/remove-athlete` | Eliminar atleta | auth + isProgramOwner |
| `/api/accept-join-request` | Aceptar solicitud + email | auth + isProgramOwner |
| `/api/use-invite` | Validar token invitación coach | update atómico (sin auth) |
| `/api/analyze-week` | Cargar semana por imagen | auth |

---

## Deuda técnica conocida

- `admin/page.tsx` ~700 líneas — candidato a dividir en componentes
- `admin/atletas/page.tsx` — eliminación de atleta sin confirmación/recuperación
- `getAthletes()` en db.ts sin verificación de ownership del caller
