# Skill: Timer con IA — Bizarro

## Cuándo cargar esta skill
Cuando trabajes en:
- src/app/timer/
- src/app/api/generate-timer/
- src/components/Timer.tsx
- Cualquier componente que invoque generación de timer o navegue a /timer

---

## Arquitectura del Timer

```
Timer.tsx (modal)
  └─→ /timer?type=X     (navega con query param)

dashboard/page.tsx
  └─→ genera config con /api/generate-timer (Claude Haiku)
  └─→ abre /timer con config en localStorage o query

src/app/api/generate-timer/route.ts
  └─→ Anthropic SDK (claude-haiku-4-5-20251001)
  └─→ interpreta el WOD → devuelve JSON de config
```

---

## Tipos de Timer — Contratos de datos

```typescript
type TimerConfig =
  | { type: 'amrap';    totalSeconds: number }
  | { type: 'emom';     totalSeconds: number }
  | { type: 'fortime';  capSeconds: number }       // capSeconds=0 = sin time cap
  | { type: 'tabata';   workSeconds: number; restSeconds: number; rounds: number }
  | { type: 'mix';      blocks: MixBlock[] }
  | { type: 'interval'; totalSeconds: number; intervalSeconds: number; workLabel: string; restLabel: string; startWithRest: boolean }
  | { type: 'countdown'; totalSeconds: number }

type MixBlock = { label: string; seconds: number }
```

---

## Ruta API: /api/generate-timer

**Método:** POST
**Auth:** No requiere autenticación (endpoint público)
**Modelo:** `claude-haiku-4-5-20251001`
**Variable de entorno:** `ANTHROPIC_API_KEY`

```typescript
// Request body
{ title: string, description: string, type: string }

// Response: TimerConfig JSON directo (sin wrapper)
// Ejemplo:
{ "type": "amrap", "totalSeconds": 1200 }

// Error de parsing:
{ "error": "parse_error" } // status 500
```

### Lógica de selección de tipo (prompt al modelo)

- WOD con **un solo bloque simple** → `amrap` / `emom` / `fortime` / `tabata`
- WOD **complejo** (varios bloques, fases, intervalos, AMRAP+descanso+AMRAP) → `mix`

Ejemplos de WODs → mix:
- "AMRAP 5 min, descanso 3 min, AMRAP 5 min" → 3 blocks
- "30" trabajo / 30" descanso x 8 rondas" → 16 blocks alternos
- "Cada 3 min x 5 series" → 5 blocks de 180s

---

## Reglas al trabajar con el Timer

### Añadir un nuevo tipo de timer
1. Añadir la variante al union type `TimerConfig` en `timer/page.tsx`
2. Actualizar el prompt en `generate-timer/route.ts` con la nueva opción
3. Implementar el componente de renderizado en `timer/page.tsx`
4. Añadir el tipo al modal `Timer.tsx` si el usuario puede seleccionarlo manualmente

### Notación CrossFit en el prompt
```
X" = X segundos  (ej: 30" = 30 seg)
X' = X minutos   (ej: 5' = 5 min)
```
El modelo entiende esta notación — no modificar el prompt sin tener en cuenta esto.

### Patrón "durante X min, cada Y min"
```
bloques = (X * 60) / (Y * 60)  →  N bloques de Y*60 segundos
```
Ejemplo: "Durante 20 min, cada 2'30''" → (20*60)/(2*60+30) = 8 bloques de 150s

---

## Errores conocidos

```typescript
// El modelo devuelve a veces JSON envuelto en ```json ... ```
// El route.ts ya lo limpia:
const clean = text.replace(/```json\n?|\n?```/g, '').trim()

// Si falla el parse → { error: 'parse_error' }
// En dashboard/page.tsx el error dice "Comprueba la API key" — pendiente de cambiar
// a mensaje genérico para el usuario final (CLAUDE.md línea ~120)
```

---

## Variables de entorno necesarias

```
ANTHROPIC_API_KEY=sk-ant-...   # Requerida para /api/generate-timer
```
