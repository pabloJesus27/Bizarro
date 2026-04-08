'use client'

import { useEffect, useState } from 'react'
import type { PersonalRecord } from '@/lib/db'

// All detectable exercise names
const DETECTABLE = [
  'Clean & Jerk', 'Clean and Jerk', 'Cluster',
  'Hang Power Snatch', 'Hang Power Clean',
  'Power Snatch', 'Power Clean',
  'Hang Snatch', 'Hang Clean',
  'Muscle Snatch', 'Muscle Clean',
  'Squat Snatch', 'Squat Clean',
  'Tall Clean',
  'Overhead Squat',
  'Shoulder Press',
  'Split Jerk', 'Push Jerk', 'Push Press',
  'Strict Press', 'Bench Press',
  'Front Squat', 'Back Squat',
  'Deadlift', 'Pull Ups',
  'Snatch', 'Clean', 'Jerk',
]

// Snatch family — always reference Snatch PR
const SNATCH_FAMILY = new Set([
  'snatch', 'squat snatch', 'power snatch',
  'hang snatch', 'hang power snatch', 'muscle snatch',
])

// Clean family — reference Clean PR alone, or Clean & Jerk PR in a complex
const CLEAN_FAMILY = new Set([
  'clean', 'squat clean', 'power clean',
  'hang clean', 'hang power clean', 'muscle clean', 'tall clean',
])

// Exercises that, when combined with a clean-family movement, form a complex → Clean & Jerk PR
const CLEAN_COMPLEX_EXTRAS = new Set([
  'push press', 'push jerk', 'split jerk', 'jerk',
  'strict press', 'shoulder press', 'front squat',
])

const CLEAN_JERK_EXPLICIT = new Set(['clean & jerk', 'clean and jerk'])

interface DetectedEntry {
  label: string  // shown in the button
  prKey: string  // PR exercise name to look up
}

function extractEntries(text: string): DetectedEntry[] {
  // Sort by length descending to avoid partial matches (e.g. "clean" inside "power clean")
  const sorted = [...DETECTABLE].sort((a, b) => b.length - a.length)
  const found: string[] = []
  let remaining = text.toLowerCase()
  for (const ex of sorted) {
    if (remaining.includes(ex.toLowerCase())) {
      found.push(ex)
      remaining = remaining.replaceAll(ex.toLowerCase(), '')
    }
  }

  // Restore original DETECTABLE order
  const ordered = DETECTABLE.filter(ex => found.includes(ex))

  const hasSnatchFamily     = ordered.some(ex => SNATCH_FAMILY.has(ex.toLowerCase()))
  const hasOHS              = ordered.some(ex => ex.toLowerCase() === 'overhead squat')
  const hasCleanFamily      = ordered.some(ex => CLEAN_FAMILY.has(ex.toLowerCase()))
  const hasCleanComplexExtra = ordered.some(ex => CLEAN_COMPLEX_EXTRAS.has(ex.toLowerCase()))

  const isSnatchComplex = hasSnatchFamily && hasOHS
  const isCleanComplex  = hasCleanFamily && hasCleanComplexExtra

  const seen: Set<string> = new Set()
  const entries: DetectedEntry[] = []

  for (const ex of ordered) {
    const exLower = ex.toLowerCase()

    // Explicit Clean & Jerk
    if (CLEAN_JERK_EXPLICIT.has(exLower)) {
      if (!seen.has('Clean & Jerk')) {
        seen.add('Clean & Jerk')
        entries.push({ label: 'Clean & Jerk', prKey: 'Clean & Jerk' })
      }
      continue
    }

    // Snatch family → always Snatch PR (deduplicated)
    if (SNATCH_FAMILY.has(exLower)) {
      if (!seen.has('Snatch')) {
        seen.add('Snatch')
        entries.push({ label: ex, prKey: 'Snatch' })
      }
      continue
    }

    // Overhead Squat — part of snatch complex → skip (snatch entry already covers it)
    //                — alone → own PR
    if (exLower === 'overhead squat') {
      if (!isSnatchComplex && !seen.has('Overhead Squat')) {
        seen.add('Overhead Squat')
        entries.push({ label: 'Overhead Squat', prKey: 'Overhead Squat' })
      }
      continue
    }

    // Clean family — in complex → collapse to Clean & Jerk; alone → Clean PR
    if (CLEAN_FAMILY.has(exLower)) {
      if (isCleanComplex) {
        if (!seen.has('Clean & Jerk')) {
          seen.add('Clean & Jerk')
          entries.push({ label: 'Clean & Jerk', prKey: 'Clean & Jerk' })
        }
      } else {
        if (!seen.has('Clean')) {
          seen.add('Clean')
          entries.push({ label: ex, prKey: 'Clean' })
        }
      }
      continue
    }

    // Clean complex extras — in complex → skip (collapsed above); alone → own PR
    if (CLEAN_COMPLEX_EXTRAS.has(exLower)) {
      if (!isCleanComplex && !seen.has(ex)) {
        seen.add(ex)
        entries.push({ label: ex, prKey: ex })
      }
      continue
    }

    // Everything else (Back Squat, Deadlift, Bench Press…) → own PR
    if (!seen.has(ex)) {
      seen.add(ex)
      entries.push({ label: ex, prKey: ex })
    }
  }

  return entries
}

function extractPercentages(text: string): number[] {
  const matches = [...text.matchAll(/(\d+)\s*%/g)]
  const pcts = [...new Set(matches.map(m => parseInt(m[1])))].filter(p => p > 0 && p <= 100)
  return pcts.sort((a, b) => a - b)
}

function calcWeight(rm: number, pct: number): string {
  return String(Math.round(rm * pct / 100 * 2) / 2)
}

export function hasPRContent(wodText: string): boolean {
  return extractEntries(wodText).length > 0 && extractPercentages(wodText).length > 0
}

export function getFirstPRKey(wodText: string): string | null {
  return extractEntries(wodText)[0]?.prKey ?? null
}

interface Props {
  prs: PersonalRecord[]
  wodText: string
  onClose?: () => void
}

export default function PRCalculator({ prs, wodText, onClose }: Props) {
  const entries     = extractEntries(wodText)
  const percentages = extractPercentages(wodText)

  const [selected, setSelected] = useState<DetectedEntry | null>(entries[0] ?? null)

  useEffect(() => {
    const e = extractEntries(wodText)
    setSelected(e[0] ?? null)
  }, [wodText])

  if (entries.length === 0 || percentages.length === 0) return null

  const pr = selected
    ? prs.find(p => p.exercise.toLowerCase() === selected.prKey.toLowerCase())
    : undefined

  const rmLabel = selected ? `1RM · ${pr?.weight ?? '—'} kg` : ''

  return (
    <div className="border border-neutral-800 rounded-xl px-4 py-3 w-full bg-black">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Ejercicio + 1RM */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-neutral-500 text-[11px] font-mono uppercase tracking-widest">% PR</span>
          <span className="text-neutral-700 text-[11px] font-mono">·</span>
          <span className="text-neutral-400 text-[11px] font-mono">{selected?.prKey}</span>
          {pr && (
            <>
              <span className="text-neutral-700 text-[11px] font-mono">·</span>
              <span className="text-neutral-600 text-[11px] font-mono">1RM {pr.weight} kg</span>
            </>
          )}
        </div>

        {/* Porcentajes */}
        {pr ? (
          <div className="flex items-center gap-4 flex-wrap">
            {percentages.map(pct => (
              <div key={pct} className="flex items-center gap-1.5">
                <span className="text-neutral-600 text-[11px] font-mono">{pct}%</span>
                <span className="text-white font-black text-sm tabular-nums">{calcWeight(pr.weight, pct)} kg</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-700 text-[11px] font-mono">
            {prs.length === 0 ? 'Ve a Máximos para añadir tus PRs.' : `Sin PR para ${selected?.prKey}.`}
          </p>
        )}
      </div>
    </div>
  )
}
