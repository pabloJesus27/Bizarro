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

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
RESEND_API_KEY=your_resend_api_key
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
├── app/                  # Rutas (Next.js App Router)
│   ├── dashboard/        # Panel atleta
│   ├── admin/            # Panel coach
│   ├── timer/            # Timer de entrenamiento
│   ├── libre/            # Modo libre (WODs propios)
│   ├── comunidad/        # Comunidades entre atletas
│   └── api/              # API routes
├── components/
│   └── timer/            # Componentes del timer (AMRAP, EMOM, For Time, Tabata, Mix)
└── lib/
    ├── db.ts             # Acceso a Supabase
    ├── types.ts          # Tipos TypeScript
    └── wod-utils.ts      # Utilidades de WODs
```

## Funcionalidades principales

- **Roles:** Coach (crea y gestiona programas) y Atleta (sigue programas, registra resultados)
- **Timer IA:** describe el WOD en texto y la IA genera la configuración del timer automáticamente
- **Carga por imagen:** sube una foto de la pizarra del box y la IA extrae los WODs de la semana
- **Rankings:** clasificación por WOD con soporte para tiempos, rondas y kilos
- **Personal Records:** auto-detecta y guarda PRs al registrar resultados de fuerza
- **Comunidades:** cualquier atleta puede crear una comunidad para compartir WODs con amigos
- **App Android:** empaquetada con Capacitor, apunta a la URL de producción en Vercel

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

La app carga directamente desde la URL de producción en Vercel, por lo que no es necesario regenerar el APK en cada deploy.
