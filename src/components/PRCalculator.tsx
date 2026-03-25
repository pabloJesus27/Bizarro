'use client'

import { useEffect, useState } from 'react'
import type { PersonalRecord } from '@/lib/db'


const ALL_EXERCISES = [
  'Back Squat', 'Front Squat', 'Overhead Squat', 'Deadlift',
  'Bench Press', 'Strict Press', 'Push Press', 'Pull Ups',
  'Clean', 'Power Clean', 'Hang Power Clean',
  'Snatch', 'Power Snatch', 'Hang Power Snatch', 'Clean & Jerk',
]

function extractPercentages(text: string): number[] {
  const matches = [...text.matchAll(/(\d+)\s*%/g)]
  const pcts = [...new Set(matches.map(m => parseInt(m[1])))].filter(p => p > 0 && p <= 100)
  return pcts.sort((a, b) => a - b)
}

function extractExercises(text: string): string[] {
  const sorted = [...ALL_EXERCISES].sort((a, b) => b.length - a.length)
  const detected: string[] = []
  let remaining = text.toLowerCase()
  for (const ex of sorted) {
    if (remaining.includes(ex.toLowerCase())) {
      detected.push(ex)
      remaining = remaining.replaceAll(ex.toLowerCase(), '')
    }
  }
  return ALL_EXERCISES.filter(ex => detected.includes(ex))
}

function calcWeight(rm: number, pct: number): string {
  return String(Math.round(rm * pct / 100 * 2) / 2)
}

interface Props {
  prs: PersonalRecord[]
  wodText: string
}

export default function PRCalculator({ prs, wodText }: Props) {
  const detectedExercises = extractExercises(wodText)

  const [selected, setSelected] = useState<string | null>(detectedExercises[0] ?? null)

  useEffect(() => {
    const detected = extractExercises(wodText)
    setSelected(detected[0] ?? null)
  }, [wodText])

  const percentages = extractPercentages(wodText)

  if (detectedExercises.length === 0 || percentages.length === 0) return null

  const pr = selected ? prs.find(p => p.exercise.toLowerCase() === selected.toLowerCase()) : undefined

  return (
    <div className="border border-neutral-800 rounded-xl p-4 w-44 shrink-0">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-3">% PR</p>

      <div className="flex flex-col gap-0.5 mb-3">
        {(detectedExercises.length > 0 ? detectedExercises : ALL_EXERCISES).map(ex => (
          <button
            key={ex}
            onClick={() => setSelected(s => s === ex ? null : ex)}
            className={`text-left text-[11px] font-mono px-2 py-1 rounded-lg transition ${
              selected === ex ? 'bg-neutral-800 text-white' : 'text-neutral-600 hover:text-neutral-400'
            }`}
          >
            {ex}
          </button>
        ))}
      </div>

      {selected && (
        <div className="border-t border-neutral-800 pt-3">
          {pr ? (
            <>
              <p className="text-neutral-600 text-[11px] font-mono mb-2">1RM · {pr.weight} kg</p>
              <div className="flex flex-col gap-1.5">
                {percentages.map(pct => (
                  <div key={pct} className="flex items-center justify-between">
                    <span className="text-neutral-500 text-xs font-mono">{pct}%</span>
                    <span className="text-white font-black text-sm tabular-nums">{calcWeight(pr.weight, pct)} kg</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-neutral-600 text-[11px] font-mono leading-relaxed">
              {prs.length === 0
                ? 'Sin PRs cargados. Recarga la página o ve a Máximos para añadirlos.'
                : `Sin PR para ${selected}. Ve a Máximos para añadirlo.`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
