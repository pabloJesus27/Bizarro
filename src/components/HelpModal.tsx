'use client'

import { useState } from 'react'

interface Slide {
  icon: string
  title: string
  desc: string
}

export const HELP_SLIDES: Record<string, Slide[]> = {
  'dashboard-atleta': [
    { icon: '📋', title: 'Tu semana', desc: 'Los WODs de tu coach aparecen aquí organizados por día. Pulsa cualquiera para ver los detalles y registrar tu resultado.' },
    { icon: '⚡', title: 'Timer con IA', desc: 'Pulsa ⚡ en cualquier WOD y la IA leerá la descripción y configurará el timer automáticamente. Sin tocar nada más.' },
    { icon: '🏆', title: 'Ranking y PRs', desc: 'Compite con tus compañeros en el ranking del día. Tus máximos de fuerza se guardan solos al registrar un Strength.' },
  ],
  'dashboard-libre': [
    { icon: '✦', title: 'Tus entrenamientos', desc: 'Añade tus WODs a mano o sube una foto de la pizarra y la IA los extrae automáticamente.' },
    { icon: '⚡', title: 'Timer con IA', desc: 'Pulsa ⚡ en cualquier WOD y la IA configurará el timer automáticamente según la descripción.' },
    { icon: '🏆', title: 'PRs', desc: 'Tus máximos de fuerza se guardan solos cada vez que registras un resultado de Strength.' },
  ],
  'admin': [
    { icon: '📊', title: 'Tu panel de control', desc: 'Aquí gestionas los WODs de tu programa. Crea, edita y organiza los entrenamientos de tus atletas por día y bloque.' },
    { icon: '📸', title: 'Carga desde imagen', desc: 'Sube una foto de la pizarra y la IA extrae todos los WODs de la semana automáticamente. Revísalos antes de guardar.' },
    { icon: '💬', title: 'Mensaje semanal', desc: 'Escribe un mensaje para tus atletas cada semana. Aparece destacado en su panel junto a los WODs.' },
  ],
  'timer-manual': [
    { icon: '⏱️', title: 'Elige tu timer', desc: 'Selecciona el tipo de timer según tu WOD. Cada uno está pensado para un formato diferente.' },
    { icon: '🔄', title: 'AMRAP', desc: 'As Many Rounds As Possible. Marca el tiempo y haz el máximo de rondas posible.' },
    { icon: '🏁', title: 'For Time', desc: 'Completa el trabajo lo más rápido posible. El timer cuenta hacia arriba.' },
    { icon: '📅', title: 'EMOM', desc: 'Every Minute On the Minute. Cada minuto nuevo empieza una ronda.' },
    { icon: '🔁', title: 'Tabata', desc: 'Intervalos de trabajo y descanso alternados. Configura el tiempo de cada fase y el número de rondas.' },
    { icon: '🎛️', title: 'Mix', desc: 'Combina varios tipos en bloques. Perfecto para WODs con varias partes en el orden que quieras.' },
  ],
  'pr-calculator': [
    { icon: '🧮', title: 'Calculadora de pesos', desc: 'Basada en tus PRs de fuerza, calcula automáticamente el peso a usar para cada porcentaje de intensidad.' },
    { icon: '💡', title: '¿Cómo se usa?', desc: 'Selecciona el ejercicio y el porcentaje — verás el peso exacto que deberías mover hoy según tu máximo registrado.' },
  ],
  'resultado-prs': [
    { icon: '📝', title: 'Registra tu resultado', desc: 'Anota tu tiempo, rondas o kilos al terminar el WOD. Tus resultados quedan guardados y aparecen en el ranking.' },
    { icon: '🏅', title: 'PRs automáticos', desc: 'En WODs de Strength, si superas tu máximo anterior el PR se guarda automáticamente. No tienes que hacer nada.' },
  ],
  'cargar-imagen': [
    { icon: '📸', title: 'Carga desde imagen', desc: 'Sube una foto de la pizarra o del programa y la IA extrae los WODs automáticamente.' },
    { icon: '✅', title: 'Revisa antes de guardar', desc: 'La IA puede cometer errores. Revisa los WODs extraídos y corrígelos si es necesario antes de confirmar.' },
  ],
  'comunidad': [
    { icon: '⬡', title: 'Tu comunidad', desc: 'Comparte entrenamientos con tu grupo. Los WODs aparecen aquí para todos los miembros.' },
    { icon: '👥', title: 'Únete o crea', desc: 'Puedes unirte a una comunidad existente o crear la tuya para compartir WODs con amigos.' },
  ],
  'mis-atletas': [
    { icon: '👥', title: 'Gestiona tus atletas', desc: 'Aquí ves todos los atletas de tu programa. Puedes añadirles, ver su actividad y eliminarles si es necesario.' },
    { icon: '✉️', title: 'Cómo invitar', desc: 'Añade atletas por email directamente desde aquí. También puedes compartir el nombre de tu programa para que soliciten unirse.' },
  ],
}

interface Props {
  helpKey: string
  onClose: () => void
}

export default function HelpModal({ helpKey, onClose }: Props) {
  const [current, setCurrent] = useState(0)
  const slides = HELP_SLIDES[helpKey] ?? []
  const isLast = current === slides.length - 1

  if (!slides.length) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 px-4 pb-6 sm:pb-0">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-sm p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-5xl">{slides[current].icon}</span>
          <h2 className="text-white font-black text-2xl tracking-tight">{slides[current].title}</h2>
          <p className="text-neutral-400 text-sm leading-relaxed font-mono">{slides[current].desc}</p>
        </div>

        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-neutral-700'}`} />
          ))}
        </div>

        <div className="flex gap-3">
          {current > 0 && (
            <button onClick={() => setCurrent(c => c - 1)} className="flex-1 border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl py-3 transition">
              Anterior
            </button>
          )}
          {isLast ? (
            <button onClick={onClose} className="flex-1 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl py-3 hover:bg-neutral-200 transition">
              ¡Entendido!
            </button>
          ) : (
            <button onClick={() => setCurrent(c => c + 1)} className="flex-1 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl py-3 hover:bg-neutral-200 transition">
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Botón ? reutilizable
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded-full border border-neutral-700 text-neutral-500 hover:border-neutral-400 hover:text-white text-xs font-mono transition flex items-center justify-center"
      aria-label="Ayuda"
    >
      ?
    </button>
  )
}
