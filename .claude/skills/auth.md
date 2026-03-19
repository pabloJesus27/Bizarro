# Skill: Autenticación — Bizarro

## Cuándo cargar esta skill
Cuando trabajes en:
- src/app/login/
- src/app/register/
- src/app/forgot-password/
- src/app/reset-password/
- src/context/AuthContext.tsx
- src/lib/auth.ts
- Cualquier página que redirija según el estado de sesión

---

## Arquitectura de autenticación

Supabase Auth gestiona toda la autenticación. Hay tres capas:

```
src/lib/supabase.ts     → cliente singleton de Supabase
src/lib/auth.ts         → funciones: signUp, signIn, signOut,
                          resetPasswordRequest, updatePassword
src/context/AuthContext → proveedor global: user, session, loading
```

### AuthContext — lo que expone

```typescript
interface AuthContextType {
  user: User | null      // objeto User de Supabase
  session: Session | null
  loading: boolean       // true mientras carga la sesión inicial
}

// Hook para usar en componentes cliente
const { user, session, loading } = useAuth()
```

---

## Reglas obligatorias

### En componentes cliente
```typescript
// SIEMPRE usar useAuth(), nunca acceder a supabase.auth directamente
const { user, loading } = useAuth()

// SIEMPRE proteger rutas esperando a que loading sea false
useEffect(() => {
  if (loading) return                        // esperar
  if (!user) { router.push('/login'); return } // redirigir
  // cargar datos del usuario
}, [loading, user, router])
```

### En rutas API (server-side)
```typescript
// SIEMPRE usar getUser(), nunca getSession() para verificar auth
// getSession() puede estar desactualizada; getUser() valida con el servidor
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}
```

---

## Flujos de autenticación implementados

### Registro estándar (atleta)
```
1. signUp(email, password, fullName)
2. Supabase crea usuario + dispara trigger → crea fila en profiles
3. Avatar inicial: DiceBear initials
   https://api.dicebear.com/9.x/initials/svg?seed=NombreCompleto
4. Redirigir a /elegir-modo
```

### Registro con invitación de coach
```
1. URL contiene ?invite=TOKEN
2. Validar token en /api/use-invite (update atómico, evita race condition)
3. signUp con role: 'coach' en metadata
4. Token se marca como usado (used_at = now())
```

### Recuperación de contraseña
```
1. resetPasswordRequest(email)
   → redirectTo: window.location.origin + '/reset-password'
2. Supabase envía email con magic link
3. Usuario llega a /reset-password con token en URL
4. updatePassword(newPassword)
```

---

## Avatar — DiceBear API

Los avatares generados usan DiceBear v9:
```typescript
// Formato de URL
`https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`

// Estilos disponibles en el proyecto
'initials' | 'adventurer' | 'avataaars' | 'bottts' | 'fun-emoji' | 'pixel-art'

// Avatar por defecto al registrarse
`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(fullName)}`
```

---

## Errores conocidos y cómo manejarlos

```typescript
// Sesión expirada → supabase devuelve null, no error
// Siempre comprobar null antes de operar
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login') // no mostrar datos vacíos

// Error de credenciales en signIn → Supabase lanza error
// Mostrar mensaje genérico al usuario, no el error interno
try {
  await signIn(email, password)
} catch {
  setError('Email o contraseña incorrectos')
}
```

---

## Patrón de loading state en páginas protegidas

```typescript
// Estado de carga consistente en todo el proyecto
if (authLoading || loading) {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-px h-10 bg-white animate-pulse" />
    </main>
  )
}
```
