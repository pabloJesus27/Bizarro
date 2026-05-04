# Bizarro

Plataforma de gestión de entrenamientos CrossFit. Permite a coaches crear y publicar programas de WODs, y a atletas registrar resultados, comparar rankings y usar un timer inteligente generado por IA.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript
- **Base de datos:** Supabase (PostgreSQL + Auth)
- **Estilos:** Tailwind CSS v4
- **IA:** Anthropic SDK (Claude para generación de timers y carga de WODs por imagen)
- **Email:** Resend
- **Deploy:** Vercel
- **App Android:** Capacitor

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Anthropic](https://console.anthropic.com) (para funciones de IA)
- Cuenta en [Resend](https://resend.com) (para emails)

## Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto (ver `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
RESEND_API_KEY=your_resend_api_key
APP_MIN_VERSION=1.0.0
APP_DOWNLOAD_URL=https://tu-url-de-descarga.apk
```

## Instalación

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Comandos

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run test       # Tests unitarios (Vitest)
npm run lint       # Linter
```

## Estructura del proyecto

```
src/
├── app/                        # Rutas (Next.js App Router)
│   ├── dashboard/              # Panel atleta: WODs semana + resultados + ranking
│   ├── admin/                  # Panel coach: WODs + rankings + atletas + invitaciones
│   ├── admin/atletas/          # Gestión de atletas del programa
│   ├── admin/notificaciones/   # Solicitudes de unión pendientes
│   ├── timer/                  # Timer de entrenamiento (AMRAP, EMOM, For Time, Tabata, Mix)
│   ├── libre/                  # Modo libre: WODs propios del atleta
│   ├── comunidad/[slug]/       # Panel de comunidad entre atletas
│   ├── elegir-modo/            # Selección: programa con coach o modo libre
│   ├── elegir-programa/        # Selección de programa para atletas
│   ├── select-program/         # Selección de programa activo para coaches multi-programa
│   ├── maximos/                # Personal records del atleta
│   ├── programaciones/         # Gestión de inscripciones: unirse, solicitar, dejar
│   ├── unirse-comunidad/       # Unirse a una comunidad por invitación
│   ├── profile/                # Editar perfil
│   └── api/                    # API routes
│       ├── generate-timer/     # IA genera config de timer desde descripción del WOD
│       ├── analyze-libre/      # IA analiza imagen y carga WODs (semana, día o WOD único)
│       ├── coach-message/      # Mensaje semanal del coach para su programa
│       ├── create-community/   # Crea una comunidad nueva
│       ├── delete-community/   # Elimina una comunidad
│       ├── invite-community/   # Genera invitación a una comunidad
│       ├── join-community/     # Atleta se une a una comunidad
│       ├── community-members/  # Lista miembros de una comunidad
│       ├── community-prs/      # PRs de los miembros de una comunidad
│       ├── remove-community-member/ # Expulsa miembro de una comunidad
│       ├── program-prs/        # PRs de los atletas de un programa
│       ├── accept-join-request/ # Acepta solicitud de unión + email bienvenida
│       ├── create-join-request/ # Crea solicitud de unión a un programa
│       ├── cancel-join-request/ # Cancela solicitud de unión
│       ├── leave-program/      # Atleta abandona un programa
│       ├── add-athlete/        # Coach agrega atleta directamente por email
│       ├── remove-athlete/     # Coach elimina atleta del programa
│       ├── use-invite/         # Valida token de invitación de coach
│       ├── app-version/        # Versión mínima requerida de la APK Android
│       └── auth/
│           ├── login/          # Proxy server-side de login con rate limiting
│           └── check-rate-limit/ # Pre-check rate limit para registro y recuperación
├── components/
│   ├── timer/                  # Componentes del timer (AMRAP, EMOM, For Time, Tabata, Mix)
│   ├── admin/                  # Componentes del panel coach
│   ├── libre/                  # Componentes del modo libre
│   └── comunidad/              # Componentes de comunidades
└── lib/
    ├── db.ts                   # Acceso a Supabase
    ├── types.ts                # Tipos TypeScript
    ├── wod-utils.ts            # Utilidades de WODs
    ├── week-utils.ts           # Utilidades de semanas
    ├── api-auth.ts             # Helpers de autorización para API routes
    ├── auth-rate-limit.ts      # Rate limiting de autenticación
    └── ai-rate-limit.ts        # Rate limiting de endpoints de IA
```

## Funcionalidades principales

- **Roles:** Coach (crea y gestiona programas) y Atleta (sigue programas, registra resultados)
- **Timer IA:** describe el WOD en texto y la IA genera la configuración del timer automáticamente
- **Pantalla activa:** el timer evita que el móvil se suspenda durante el entrenamiento (WakeLock en Android, truco de vídeo en iOS/Safari)
- **Carga por imagen:** sube una foto de la pizarra y la IA extrae los WODs (semana completa, día o WOD individual)
- **Rankings:** clasificación por WOD con soporte para tiempos, rondas y kilos
- **Personal Records:** auto-detecta y guarda PRs al registrar resultados de fuerza
- **Comunidades:** cualquier atleta puede crear una comunidad para compartir WODs con amigos, con rankings y PRs propios
- **Mensajes del coach:** el coach puede publicar un mensaje semanal visible para todos sus atletas
- **Multi-programa:** los coaches pueden gestionar varios programas simultáneamente
- **App Android:** empaquetada con Capacitor, apunta a la URL de producción en Vercel; `app-version` controla la versión mínima requerida

## Base de datos

Las migraciones están en `supabase/migrations/`. Para aplicarlas necesitas la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase db push
```

## Tests

```bash
npm run test
```

62 tests unitarios en `src/__tests__/` cubriendo utilidades de WODs, semanas y timer.

## App Android

El proyecto incluye configuración de Capacitor para generar un APK Android:

```bash
npx cap sync android    # Sincronizar assets
# Luego abrir android/ en Android Studio y generar el APK
```

La app carga directamente desde la URL de producción en Vercel, por lo que no es necesario regenerar el APK en cada deploy web. El endpoint `/api/app-version` permite forzar actualizaciones cuando hay cambios incompatibles en la APK.
