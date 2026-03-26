'use client'

import { useEffect, useState } from 'react'
import { getWodRanking } from '@/lib/db'
import type { RankingEntry } from '@/lib/db'
import type { Wod, WodType } from '@/lib/types'
import { sortRanking } from '@/lib/wod-utils'

const PAGE_SIZE = 10

function formatScore(entry: RankingEntry, type: WodType): string {
  switch (type) {
    case 'For Time':  return entry.score_time   ?? '—'
    case 'AMRAP':     return entry.score_rounds  ?? '—'
    case 'For Max':   return entry.score_rounds  ?? '—'
    case 'Strength':  return entry.score_weight != null ? `${entry.score_weight} kg` : '—'
    case 'EMOM': {
      const parts = []
      if (entry.score_weight) parts.push(`${entry.score_weight} kg`)
      if (entry.score_rounds) parts.push(entry.score_rounds)
      return parts.join(' · ') || '—'
    }
    default: return entry.score_notes ?? '—'
  }
}

export default function RankingSection({ wod, refreshKey = 0 }: { wod: Wod; refreshKey?: number }) {
  const [entries, setEntries] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(0)

  useEffect(() => {
    setLoading(true)
    setPage(0)
    getWodRanking(wod.id)
      .then(data => setEntries(sortRanking(data, wod.type)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [wod.id, wod.type, refreshKey])

  if (loading) return (
    <div className="mt-10 border-t border-neutral-900 pt-8">
      <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono">Cargando ranking...</p>
    </div>
  )

  if (entries.length === 0) return (
    <div className="mt-10 border-t border-neutral-900 pt-8">
      <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono">Sin resultados aún</p>
    </div>
  )

  const totalPages = Math.ceil(entries.length / PAGE_SIZE)
  const paged = entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="mt-10 border-t border-neutral-900 pt-8">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-5">
        Ranking · {entries.length} {entries.length === 1 ? 'atleta' : 'atletas'}
      </p>
      <div className="flex flex-col gap-3">
        {paged.map((entry, i) => {
          const pos      = page * PAGE_SIZE + i + 1
          const name     = entry.profiles?.full_name ?? 'Atleta'
          const score    = formatScore(entry, wod.type)
          const posLabel = pos.toString().padStart(2, '0')
          return (
            <div key={entry.id} className={`flex items-center gap-4 px-4 py-3 rounded-xl ${pos === 1 ? 'border border-neutral-700 bg-neutral-950' : 'border border-neutral-900'}`}>
              <span className={`font-black font-mono text-sm w-6 ${pos === 1 ? 'text-white' : 'text-neutral-600'}`}>
                {posLabel}
              </span>
              <span className={`flex-1 font-medium text-sm ${pos === 1 ? 'text-white' : 'text-neutral-400'}`}>
                {name}
              </span>
              <span className={`font-black font-mono text-sm ${pos === 1 ? 'text-white' : 'text-neutral-400'}`}>
                {score}
              </span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${entry.rx ? 'border-neutral-700 text-neutral-400' : 'border-neutral-800 text-neutral-600'}`}>
                {entry.rx ? 'RX' : 'SC'}
              </span>
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-neutral-600 hover:text-white text-sm font-mono transition disabled:opacity-30"
          >
            ← Anterior
          </button>
          <span className="text-neutral-700 text-xs font-mono">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-neutral-600 hover:text-white text-sm font-mono transition disabled:opacity-30"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
