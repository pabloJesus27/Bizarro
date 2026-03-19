# Skill: Seguridad — Bizarro

## Cuándo cargar esta skill
Siempre que trabajes en:
- Rutas API (src/app/api/**/route.ts)
- src/lib/db.ts
- src/lib/auth.ts
- src/lib/api-auth.ts
- Cualquier función que acceda a datos de otros usuarios

---

## Vulnerabilidades resueltas (2026-03-17)

Las siguientes vulnerabilidades fueron corregidas en el cambio `security-hardening`:
- create-join-request: auth + ownership ✅
- cancel-join-request: auth + ownership ✅
- generate-timer: auth + validación inputs ✅
- analyze-week: auth + raw eliminado ✅
- getAthletes: ownership check ✅
- error.message expuesto: reemplazado por 'Error interno' ✅

---

## Vulnerabilidades pendientes

### 🟡 IMPORTANTE — use-invite sin verificación de sesión
**Archivo:** src/app/api/use-invite/route.ts
**Problema:** No tiene auth de sesión. Verifica que userId exista pero no que el caller sea ese usuario.
**Por qué NO se puede corregir fácilmente:** Se llama desde `register/page.tsx` justo después
de `signUp()`, antes de confirmar el email — en ese momento no hay sesión activa.
El token de un solo uso + update atómico ya proveen suficiente protección para este caso.

---

### ✅ RESUELTO (2026-03-18) — Rate limiting en rutas IA via Supabase RPC
**Archivos afectados:**
- `supabase/migrations/20260318000000_ai_usage_rate_limit.sql` (nuevo) — tabla `ai_usage` + RPC `check_and_increment_ai_usage`
- `src/lib/ai-rate-limit.ts` (nuevo) — helper `checkAiRateLimit(userId, endpoint, limit)`
- `src/app/api/generate-timer/route.ts` — límite 20/día por usuario
- `src/app/api/analyze-week/route.ts` — límite 5/día por usuario

**Patrón aplicado:** RPC atómica en Supabase (cuenta + inserta en una transacción). Usa `supabaseAdmin` con service role para saltarse RLS en la escritura. Si la RPC falla, falla abierto (permite la request) para no bloquear a usuarios legítimos por errores transitorios.

**Pendiente (manual):**
- T2: Aplicar la migración en el dashboard de Supabase
- T8+T9: Smoke tests manuales

**Rutas aún sin rate limiting:**
- `src/app/api/create-join-request/route.ts` — riesgo de spam de solicitudes
- `src/app/api/add-athlete/route.ts` — usa `listUsers()` completo, caro en Supabase

---

### ✅ RESUELTO (2026-03-18) — Rate limiting en rutas de auth (login, registro, reset password)
**Archivos afectados:**
- `supabase/migrations/20260318010000_auth_rate_limit.sql` (nuevo) — tabla `auth_attempts` + RPC `check_and_record_auth_attempt`
- `src/lib/auth-rate-limit.ts` (nuevo) — helper `checkAuthRateLimit(identifier, action, limit, windowMinutes)`
- `src/app/api/auth/login/route.ts` (nuevo) — proxy de login: verifica rate limit, luego `signInWithPassword` con anon key, devuelve sesión al cliente
- `src/app/api/auth/check-rate-limit/route.ts` (nuevo) — pre-check para register y reset_password
- `src/app/login/page.tsx` — usa el proxy `/api/auth/login` + `supabase.auth.setSession()`
- `src/app/register/page.tsx` — pre-check `/api/auth/check-rate-limit` antes de `signUp()`
- `src/app/forgot-password/page.tsx` — pre-check `/api/auth/check-rate-limit` antes de `resetPasswordRequest()`

**Límites aplicados:**
- Login: 5 intentos / 15 minutos por email
- Registro: 3 intentos / 60 minutos por email
- Reset password: 3 intentos / 60 minutos por email

**Patrón aplicado:**
- Login usa Approach A (proxy): la petición pasa íntegra por la API route que controla el rate limit antes de llamar a Supabase Auth.
- Register y reset usan Approach B (pre-check): la UI consulta primero el endpoint de pre-check; si está limitado, muestra error sin llegar a Supabase.
- `auth_attempts` tabla con RLS habilitado pero sin políticas — solo la RPC SECURITY DEFINER puede escribir.
- Anon key para `signInWithPassword` (service role la bypassaría).
- Fail-open: si la RPC falla, se permite la petición para no bloquear usuarios legítimos.

**Pendiente (manual):**
- Aplicar la migración en el dashboard de Supabase
- Configurar pg_cron para limpiar rows >24h (ver comentario en migration)
- Smoke tests manuales

---

### ✅ RESUELTO (2026-03-17) — remove-athlete separado en dos endpoints
**Archivos afectados:**
- `src/app/api/remove-athlete/route.ts` — ahora solo para coaches: verifica `isProgramOwner(user.id, programId)`. Si no es owner: 403.
- `src/app/api/leave-program/route.ts` (nuevo) — para atletas que salen voluntariamente: verifica `user.id === athleteId`. Si no coincide: 403.
- `src/lib/db.ts` — nueva función `leaveProgram()` que llama a `/api/leave-program`.
- `src/app/programaciones/page.tsx` — usa `leaveProgram()` en lugar de `/api/remove-athlete`.

**Por qué:** IDOR — antes `remove-athlete` permitía a cualquier atleta autenticado expulsar a otro atleta. La separación en dos endpoints con verificaciones distintas elimina la ambigüedad y el riesgo de bypass futuro.

---

### ✅ RESUELTO (2026-03-17) — getAthletes sin verificación de ownership
**Archivo:** src/lib/db.ts — función getAthletes()
**Solución aplicada:** La función obtiene el usuario autenticado con `supabase.auth.getUser()`, consulta el programa por slug para obtener `owner_id`, y lanza `Error('No autorizado')` si `program.owner_id !== user.id`. La firma y el tipo de retorno (`Promise<Profile[]>`) no cambiaron. El caller en `admin/atletas/page.tsx` ya maneja errores mediante el `.then(...).finally(...)` que detiene el loading — el error de 'No autorizado' hará que la lista quede vacía sin exponer detalles internos al usuario.

---

## Reglas obligatorias para TODA ruta API

```typescript
// 1. SIEMPRE verificar sesión al inicio
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}

// 2. SIEMPRE verificar ownership antes de operar sobre recursos
// de otros usuarios (programas, atletas, WODs)

// 3. NUNCA devolver errores internos al cliente
// MAL:
return NextResponse.json({ error: error.message }, { status: 500 })
// BIEN:
console.error('[add-athlete]', error) // solo en servidor
return NextResponse.json({ error: 'Error interno' }, { status: 500 })

// 4. SIEMPRE validar y sanitizar inputs antes de usarlos
if (!email || typeof email !== 'string' || !email.includes('@')) {
  return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
}
```

---

## Casos edge de seguridad documentados

### Sesión expirada a mitad de operación (RESUELTO 2026-03-18)
**Patrón aplicado:** `getResultsForWods` y `getMyPRs` en `db.ts` lanzan `throw new Error('SESSION_EXPIRED')` si `user` es null — nunca devuelven array vacío.

Los callers (`dashboard/page.tsx`, `libre/page.tsx`, `maximos/page.tsx`) tienen `.catch()` que detecta `err.message === 'SESSION_EXPIRED'` y redirige a `/login` via `router.push`. Para cualquier otro error, muestran un mensaje genérico al usuario via estado React.

**Orden obligatorio de la cadena de promesas:**
```typescript
promise
  .then(...)
  .catch(err => {
    if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
      router.push('/login')
    } else {
      setError('Mensaje genérico para el usuario.')
    }
  })
  .finally(() => setLoading(false))
```

### upsertResult puede fallar silenciosamente
**Archivo:** dashboard/page.tsx
**Problema:** El resultado se muestra en UI como guardado
pero upsertResult puede haber fallado sin que el usuario lo sepa.
**Solución:** Siempre esperar confirmación de la BD antes
de actualizar el estado local de la UI.

---

## Helper de autorización existente

`src/lib/api-auth.ts` ya tiene:
- `getAuthenticatedUser()` — obtiene usuario verificado
- `isProgramOwner()` — verifica ownership de programa

**SIEMPRE usar estos helpers en rutas API.**
**NUNCA reimplementar la verificación de sesión desde cero.**
