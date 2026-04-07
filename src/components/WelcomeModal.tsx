'use client'

import { useState } from 'react'

interface Slide {
  icon: string
  title: string
  desc: string
}

const SLIDES: Record<'program' | 'libre' | 'coach', Slide[]> = {
  program: [
    {
      icon: '🏋️',
      title: 'Bienvenido a Bizarro',
      desc: 'Tu gestor de entrenamientos CrossFit junto a tu coach.',
    },
    {
      icon: '📋',
      title: 'Los WODs',
      desc: 'Tu coach publica el entrenamiento cada semana. Consulta el WOD del día y registra tu resultado al terminar.',
    },
    {
      icon: '⚡',
      title: 'Timer con IA',
      desc: 'Pulsa el cronómetro en cualquier WOD. La IA lee la descripción y configura el timer automáticamente.',
    },
    {
      icon: '🎛️',
      title: 'Timer Mix',
      desc: '¿Prefieres configurarlo tú? Usa el timer Mix para crear bloques a medida: AMRAP, For Time, descansos… en el orden que quieras.',
    },
    {
      icon: '🏆',
      title: 'Rankings y PRs',
      desc: 'Compite con tus compañeros en el ranking del día. Tus máximos de fuerza se guardan solos.',
    },
  ],
  coach: [
    {
      icon: '📊',
      title: 'Bienvenido a Bizarro',
      desc: 'Tu panel de control para gestionar entrenamientos CrossFit.',
    },
    {
      icon: '📝',
      title: 'Crea tus WODs',
      desc: 'Añade los WODs de cada día a mano o carga toda la semana desde una foto. La IA los extrae automáticamente.',
    },
    {
      icon: '👥',
      title: 'Gestiona tus atletas',
      desc: 'Invita atletas por email o comparte tu código de programa. Acepta solicitudes de unión desde notificaciones.',
    },
    {
      icon: '🏆',
      title: 'Rankings',
      desc: 'Consulta los rankings de cada WOD y ve cómo progresan tus atletas en tiempo real.',
    },
    {
      icon: '💬',
      title: 'Mensaje semanal',
      desc: 'Escribe un mensaje para tus atletas cada semana. Aparece destacado en su panel junto a los WODs.',
    },
  ],
  libre: [
    {
      icon: '🏋️',
      title: 'Bienvenido a Bizarro',
      desc: 'Tu gestor de entrenamientos CrossFit personal.',
    },
    {
      icon: '📸',
      title: 'Carga tus WODs',
      desc: 'Añade tus entrenamientos a mano o sube una foto y la IA los extrae automáticamente.',
    },
    {
      icon: '🎛️',
      title: 'Timer Mix',
      desc: '¿Tienes un WOD con varias partes? Usa el timer Mix para crear bloques a medida: AMRAP, For Time, descansos… en el orden que quieras.',
    },
    {
      icon: '⚡',
      title: 'Timer con IA',
      desc: 'O déjalo en manos de la IA: lee la descripción del WOD y configura el timer automáticamente.',
    },
    {
      icon: '🏆',
      title: 'PRs',
      desc: 'Tus máximos de fuerza se guardan solos cada vez que registras un resultado de Strength.',
    },
  ],
}

interface Props {
  mode: 'program' | 'libre' | 'coach'
  onClose: () => void
}

export default function WelcomeModal({ mode, onClose }: Props) {
  const [current, setCurrent] = useState(0)
  const slides = SLIDES[mode]
  const isLast = current === slides.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 px-4 pb-6 sm:pb-0">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-sm p-8 flex flex-col gap-6">

        {/* Slide content */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-5xl">{slides[current].icon}</span>
          <h2 className="text-white font-black text-2xl tracking-tight">{slides[current].title}</h2>
          <p className="text-neutral-400 text-sm leading-relaxed font-mono">{slides[current].desc}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-neutral-700'}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {current > 0 && (
            <button
              onClick={() => setCurrent(c => c - 1)}
              className="flex-1 border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl py-3 transition"
            >
              Anterior
            </button>
          )}
          {isLast ? (
            <button
              onClick={onClose}
              className="flex-1 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl py-3 hover:bg-neutral-200 transition"
            >
              ¡Empezar!
            </button>
          ) : (
            <button
              onClick={() => setCurrent(c => c + 1)}
              className="flex-1 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl py-3 hover:bg-neutral-200 transition"
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
