'use client'

import { useRef, useState } from 'react'
import HelpModal, { HelpButton } from './HelpModal'
import { useFirstVisit } from '@/hooks/useFirstVisit'
import type { WodType } from '@/lib/types'
import { DAY_SHORT } from '@/lib/week-utils'
import { supabase } from '@/lib/supabase'
import { WOD_TYPE_LABEL } from '@/lib/wod-utils'

interface ParsedWod {
  date: string
  block: number
  title: string
  type: WodType
  description: string
  notes?: string
}

interface Props {
  weekDates: string[]
  selectedDate?: string
  programSlug?: string
  variant?: 'coach' | 'libre'
  forceMode?: 'week' | 'day' | 'wod'
  onConfirm: (wods: ParsedWod[]) => Promise<void>
  onClose: () => void
}

export default function LoadWeekModal({ weekDates, selectedDate, programSlug, variant = 'coach', forceMode, onConfirm, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64,  setImageBase64]  = useState<string>('')
  const [mediaType,    setMediaType]    = useState<string>('image/jpeg')
  const [step,         setStep]         = useState<'upload' | 'preview' | 'message'>('upload')
  const [loadMode,     setLoadMode]     = useState<'week' | 'day' | 'wod'>(forceMode ?? 'week')
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [savingMsg,    setSavingMsg]    = useState(false)
  const [wods,         setWods]         = useState<ParsedWod[]>([])
  const [error,        setError]        = useState('')
  const [message,      setMessage]      = useState('')
  const { show: showHelp, dismiss: dismissHelp, open: openHelp } = useFirstVisit('cargar-imagen')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setMediaType(file.type as string)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setImagePreview(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  async function handleAnalyze() {
    if (!imageBase64) return
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      let res: Response
      if (variant === 'libre') {
        res = await fetch('/api/analyze-libre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ imageBase64, mediaType, mode: loadMode, date: selectedDate, weekDates }),
        })
      } else {
        res = await fetch('/api/analyze-week', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ imageBase64, mediaType, weekDates }),
        })
      }
      const { wods: parsed, error: apiError } = await res.json()
      if (apiError) { setError(apiError); return }
      setWods(parsed)
      setStep('preview')
    } catch {
      setError('Error al analizar la imagen')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      await onConfirm(wods)
      if (variant === 'coach' && programSlug) {
        setStep('message')
      } else {
        onClose()
      }
    } catch {
      setError('Error al guardar los WODs')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveMessage() {
    if (!message.trim()) { onClose(); return }
    setSavingMsg(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/coach-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ program_slug: programSlug, week_start: weekDates[0], content: message }),
      })
    } finally {
      setSavingMsg(false)
      onClose()
    }
  }

  function getDayLabel(date: string): string {
    const d = new Date(date + 'T00:00:00')
    return `${DAY_SHORT[d.getDay()]} ${d.getDate()}`
  }

  const grouped = wods.reduce<Record<string, ParsedWod[]>>((acc, wod) => {
    if (!acc[wod.date]) acc[wod.date] = []
    acc[wod.date].push(wod)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        {showHelp && <HelpModal helpKey="cargar-imagen" onClose={dismissHelp} />}
        <div className="flex items-start justify-between p-6 border-b border-neutral-900">
          <div>
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">
              {step === 'upload' ? 'Subir imagen' : step === 'preview' ? `${wods.length} WODs detectados` : 'Opcional'}
            </p>
            <h2 className="text-white font-black text-xl tracking-tight uppercase">
              {step === 'message' ? 'Indicaciones de la semana' : 'Cargar entrenamiento'}
            </h2>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {step === 'upload' && <HelpButton onClick={openHelp} />}
            <button onClick={onClose} className="text-neutral-500 hover:text-white text-2xl leading-none transition">
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <p className="text-neutral-500 text-sm font-mono">
                Sube una captura de pantalla con la programación de la semana y la IA la interpretará automáticamente.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreview ? (
                <div className="flex flex-col gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="w-full rounded-xl border border-neutral-800 object-contain max-h-64" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-neutral-500 hover:text-white text-xs font-mono transition text-center"
                  >
                    Cambiar imagen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-neutral-700 hover:border-neutral-500 rounded-xl px-4 py-12 flex flex-col items-center gap-3 transition"
                >
                  <span className="text-neutral-500 text-3xl">↑</span>
                  <span className="text-neutral-500 text-sm font-mono">Toca para subir imagen</span>
                </button>
              )}

              {error && <p className="text-red-400 text-sm font-mono">{error}</p>}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-6">
              {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, dayWods]) => (
                  <div key={date}>
                    <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-3">
                      {getDayLabel(date)}
                    </p>
                    <div className="flex flex-col gap-2">
                      {dayWods.sort((a, b) => a.block - b.block).map((wod, i) => (
                        <div key={i} className="border border-neutral-800 rounded-xl px-4 py-3 flex items-start gap-3">
                          <span className="text-neutral-600 font-mono text-xs mt-0.5 w-4 shrink-0">{wod.block}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-neutral-500 text-xs font-mono uppercase tracking-widest">
                                {WOD_TYPE_LABEL[wod.type] ?? wod.type}
                              </span>
                            </div>
                            <p className="text-white text-sm font-bold truncate">{wod.title}</p>
                            <p className="text-neutral-600 text-xs font-mono mt-1 line-clamp-2">{wod.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {error && <p className="text-red-400 text-sm font-mono">{error}</p>}
            </div>
          )}

          {step === 'message' && (
            <div className="flex flex-col gap-4">
              <p className="text-neutral-500 text-sm font-mono">
                Escribe unas indicaciones para tus atletas sobre cómo afrontar esta semana. Es opcional.
              </p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Ej: Esta semana toca intensidad alta en fuerza. Prioriza descanso entre series..."
                rows={5}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-900 flex gap-3">
          {step === 'upload' ? (
            <>
              <button
                onClick={handleAnalyze}
                disabled={!imageBase64 || loading}
                className="flex-1 bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all"
              >
                {loading ? 'Analizando...' : 'Analizar imagen'}
              </button>
            </>
          ) : step === 'preview' ? (
            <>
              <button
                onClick={() => { setStep('upload'); setWods([]); setError('') }}
                className="flex-1 border border-neutral-700 text-white font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-white transition text-sm"
              >
                Volver
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all"
              >
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 border border-neutral-700 text-white font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-white transition text-sm"
              >
                Cerrar sin mensaje
              </button>
              <button
                onClick={handleSaveMessage}
                disabled={savingMsg || !message.trim()}
                className="flex-1 bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all"
              >
                {savingMsg ? 'Guardando...' : 'Guardar y cerrar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
