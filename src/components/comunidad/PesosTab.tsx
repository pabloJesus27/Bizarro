'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

// ── Exercise detection (mirrors PRCalculator logic) ──────

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

const SNATCH_FAMILY        = new Set(['snatch', 'squat snatch', 'power snatch', 'hang snatch', 'hang power snatch', 'muscle snatch'])
const CLEAN_FAMILY         = new Set(['clean', 'squat clean', 'power clean', 'hang clean', 'hang power clean', 'muscle clean', 'tall clean'])
const CLEAN_COMPLEX_EXTRAS = new Set(['push press', 'push jerk', 'split jerk', 'jerk', 'strict press', 'shoulder press', 'front squat'])
const CLEAN_JERK_EXPLICIT  = new Set(['clean & jerk', 'clean and jerk'])

interface Entry { label: string; prKey: string }

function extractEntries(text: string): Entry[] {
  const sorted = [...DETECTABLE].sort((a, b) => b.length - a.length)
  const found: string[] = []
  let remaining = text.toLowerCase()
  for (const ex of sorted) {
    if (remaining.includes(ex.toLowerCase())) {
      found.push(ex)
      remaining = remaining.replaceAll(ex.toLowerCase(), '')
    }
  }
  const ordered = DETECTABLE.filter(ex => found.includes(ex))

  const hasSnatchFamily      = ordered.some(ex => SNATCH_FAMILY.has(ex.toLowerCase()))
  const hasOHS               = ordered.some(ex => ex.toLowerCase() === 'overhead squat')
  const hasCleanFamily       = ordered.some(ex => CLEAN_FAMILY.has(ex.toLowerCase()))
  const hasCleanComplexExtra = ordered.some(ex => CLEAN_COMPLEX_EXTRAS.has(ex.toLowerCase()))
  const isSnatchComplex      = hasSnatchFamily && hasOHS
  const isCleanComplex       = hasCleanFamily && hasCleanComplexExtra

  const seen = new Set<string>()
  const entries: Entry[] = []

  for (const ex of ordered) {
    const exLower = ex.toLowerCase()
    if (CLEAN_JERK_EXPLICIT.has(exLower)) {
      if (!seen.has('Clean & Jerk')) { seen.add('Clean & Jerk'); entries.push({ label: 'Clean & Jerk', prKey: 'Clean & Jerk' }) }
    } else if (SNATCH_FAMILY.has(exLower)) {
      if (!seen.has('Snatch')) { seen.add('Snatch'); entries.push({ label: ex, prKey: 'Snatch' }) }
    } else if (exLower === 'overhead squat') {
      if (!isSnatchComplex && !seen.has('Overhead Squat')) { seen.add('Overhead Squat'); entries.push({ label: 'Overhead Squat', prKey: 'Overhead Squat' }) }
    } else if (CLEAN_FAMILY.has(exLower)) {
      if (isCleanComplex) {
        if (!seen.has('Clean & Jerk')) { seen.add('Clean & Jerk'); entries.push({ label: 'Clean & Jerk', prKey: 'Clean & Jerk' }) }
      } else {
        if (!seen.has('Clean')) { seen.add('Clean'); entries.push({ label: ex, prKey: 'Clean' }) }
      }
    } else if (CLEAN_COMPLEX_EXTRAS.has(exLower)) {
      if (!isCleanComplex && !seen.has(ex)) { seen.add(ex); entries.push({ label: ex, prKey: ex }) }
    } else if (!seen.has(ex)) {
      seen.add(ex); entries.push({ label: ex, prKey: ex })
    }
  }
  return entries
}

function calcWeight(rm: number, pct: number): string {
  return String(Math.round(rm * pct / 100 * 2) / 2)
}

const PERCENTAGES = [50, 60, 70, 75, 80, 85, 90, 95, 100]

// ── Types ────────────────────────────────────────────────

interface Member {
  athlete_id: string
  name:       string
  avatar_url: string | null
  weight:     number | null
}

interface Props {
  wodText:       string
  communitySlug: string
  session:       Session | null
}

// ── Component ────────────────────────────────────────────

export default function PesosTab({ wodText, communitySlug, session }: Props) {
  const entries = extractEntries(wodText)

  const [selectedEntry,  setSelectedEntry]  = useState<Entry | null>(entries[0] ?? null)
  const [members,        setMembers]        = useState<Member[]>([])
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  useEffect(() => {
    const e = extractEntries(wodText)
    setSelectedEntry(e[0] ?? null)
  }, [wodText])

  useEffect(() => {
    if (!selectedEntry || !session) return
    setLoading(true)
    setError(null)
    fetch(`/api/community-prs?slug=${communitySlug}&exercise=${encodeURIComponent(selectedEntry.prKey)}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) { setError(data.error); return }
        const withPR = (data.members as Member[]).filter(m => m.weight !== null)
        setMembers(data.members)
        setSelectedIds(new Set(withPR.map((m: Member) => m.athlete_id)))
      })
      .catch(() => setError('Error al cargar los pesos'))
      .finally(() => setLoading(false))
  }, [selectedEntry, communitySlug, session])

  if (entries.length === 0) return (
    <div className="flex-1 flex items-center justify-center p-6">
      <p className="text-neutral-700 text-xs font-mono uppercase tracking-widest">Este WOD no tiene ejercicios de fuerza</p>
    </div>
  )

  const visibleMembers = members.filter(m => m.weight !== null)
  const selected       = visibleMembers.filter(m => selectedIds.has(m.athlete_id))

  function toggleMember(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex-1 p-6 overflow-x-auto">

      {/* Selector de ejercicio */}
      {entries.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {entries.map(e => (
            <button
              key={e.prKey}
              onClick={() => setSelectedEntry(e)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-widest transition ${
                selectedEntry?.prKey === e.prKey
                  ? 'bg-white text-black'
                  : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex gap-1.5 py-8 justify-center">
          <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" />
          <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" />
        </div>
      )}

      {error && <p className="text-red-400 text-xs font-mono">{error}</p>}

      {!loading && !error && (
        <>
          {/* Checkboxes de miembros */}
          {visibleMembers.length === 0 ? (
            <p className="text-neutral-700 text-xs font-mono uppercase tracking-widest mb-6">
              Ningún miembro tiene PR para {selectedEntry?.label}
            </p>
          ) : (
            <div className="flex flex-wrap gap-3 mb-6">
              {visibleMembers.map(m => (
                <button
                  key={m.athlete_id}
                  onClick={() => toggleMember(m.athlete_id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition border ${
                    selectedIds.has(m.athlete_id)
                      ? 'border-white text-white'
                      : 'border-neutral-800 text-neutral-500 hover:border-neutral-600'
                  }`}
                >
                  {m.avatar_url
                    ? <Image src={m.avatar_url} alt="" width={16} height={16} className="rounded-full object-cover" unoptimized />
                    : <div className="w-4 h-4 rounded-full bg-neutral-700 flex items-center justify-center"><span className="text-[9px] font-black">{m.name[0]?.toUpperCase()}</span></div>
                  }
                  {m.name.split(' ')[0]}
                  <span className="text-neutral-600">{m.weight}kg</span>
                </button>
              ))}
            </div>
          )}

          {/* Tabla de porcentajes */}
          {selected.length > 0 && (
            <table className="text-xs font-mono w-auto">
              <thead>
                <tr>
                  <th className="text-neutral-600 text-left pr-6 pb-2 font-mono font-normal uppercase tracking-widest">%</th>
                  {selected.map(m => (
                    <th key={m.athlete_id} className="text-neutral-400 text-right pr-6 pb-2 font-mono font-normal">
                      {m.name.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERCENTAGES.map(pct => (
                  <tr key={pct} className="border-t border-neutral-900">
                    <td className="text-neutral-500 py-2 pr-6">{pct}%</td>
                    {selected.map(m => (
                      <td key={m.athlete_id} className="text-white font-black text-right pr-6 py-2 tabular-nums">
                        {calcWeight(m.weight!, pct)} kg
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
