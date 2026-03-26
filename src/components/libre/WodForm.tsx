'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createLibreWod, updateWod } from '@/lib/db'
import type { Wod, WodType, NewWod } from '@/lib/types'
import { WOD_TYPE_LABEL, WOD_TYPES } from '@/lib/wod-utils'

export default function WodForm({ date, block, wod, onSaved, onCancel }: {
  date:     string
  block:    number
  wod?:     Wod
  onSaved:  (wod: Wod) => void
  onCancel?: () => void
}) {
  const { user } = useAuth()
  const [title,       setTitle]       = useState(wod?.title       ?? '')
  const [type,        setType]        = useState<WodType>(wod?.type ?? 'For Time')
  const [description, setDescription] = useState(wod?.description ?? '')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const isEdit = !!wod

  const dayFormatted = new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('El título es obligatorio'); return }
    if (!user) return
    setError('')
    setLoading(true)
    try {
      const saved = isEdit
        ? await updateWod(wod.id, { title, type, description })
        : await createLibreWod({ date, block, title, type, description } as Omit<NewWod, 'program'>, user.id)
      onSaved(saved)
    } catch (err: unknown) {
      setError('No se pudo guardar el WOD. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">
            {dayFormatted} · Bloque {block}
          </p>
          <h2 className="text-white font-black text-xl tracking-tight uppercase">
            {isEdit ? 'Editar WOD' : 'Nuevo WOD'}
          </h2>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-neutral-500 hover:text-white text-2xl leading-none transition ml-4">
            &times;
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Tipo</label>
          <div className="flex flex-wrap gap-2">
            {WOD_TYPES.map(t => (
              <button
                key={t} type="button" onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                  type === t ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-500 hover:border-neutral-500'
                }`}
              >
                {WOD_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Título</label>
          <input
            type="text" placeholder="Ej: Fran, Back Squat..." value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
          />
        </div>

        <div>
          <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Descripción</label>
          <textarea
            placeholder={`Ej:\n21-15-9\nThrusters (42.5 kg)\nPull-ups`} value={description}
            onChange={e => setDescription(e.target.value)} rows={6}
            className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition resize-none font-mono text-sm"
          />
        </div>

        {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all"
        >
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear WOD'}
        </button>
      </form>
    </div>
  )
}
