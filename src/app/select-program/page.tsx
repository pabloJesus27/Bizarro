'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getProfile } from '@/lib/db'
import { getMyPrograms, createProgram, deleteProgram } from '@/lib/db'
import type { ProgramEntry } from '@/lib/db'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function SelectProgramPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [programs,     setPrograms]     = useState<ProgramEntry[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [loadingData,  setLoadingData]  = useState(true)
  const [creating,     setCreating]     = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [newName,      setNewName]      = useState('')
  const [formError,    setFormError]    = useState('')

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(profile => {
      if (profile?.role !== 'coach') { router.push('/dashboard'); return }
    })

    getMyPrograms(user.id)
      .then(setPrograms)
      .finally(() => setLoadingData(false))
  }, [loading, user, router])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !user) return
    setFormError('')
    setCreating(true)
    try {
      const slug = slugify(newName.trim())
      const program = await createProgram(newName.trim(), slug, user.id)
      setPrograms(prev => [...prev, program])
      setNewName('')
      setShowForm(false)
      router.push(`/admin?program=${program.slug}`)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el programa')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await deleteProgram(id)
      setPrograms(prev => prev.filter(p => p.id !== id))
      setConfirmDeleteId(null)
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  const slugToImage: Record<string, string> = {
    bizarro: '/logoBizarro.png',
    entrenemos: '/entrenemos.png',
  }

  if (loading || loadingData) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6 gap-12">
      <div className="text-center">
        <p className="text-neutral-600 text-xs uppercase tracking-widest font-mono mb-3">Coach</p>
        <h1 className="text-white font-black text-3xl uppercase tracking-tighter">Mis programas</h1>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-6 w-full max-w-2xl justify-center">

        {programs.map(program => (
          <div key={program.id} className="relative group w-full sm:w-48">
            {confirmDeleteId === program.id ? (
              <div className="border border-red-800 rounded-2xl p-6 flex flex-col items-center gap-3 w-full">
                <p className="text-white text-sm font-mono text-center">¿Eliminar <span className="font-black">{program.name}</span>?</p>
                <p className="text-neutral-500 text-xs font-mono text-center">No se puede deshacer</p>
                <button
                  onClick={() => handleDelete(program.id)}
                  disabled={deleting}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs rounded-xl px-3 py-2 transition disabled:opacity-50"
                >
                  {deleting ? '...' : 'Sí, eliminar'}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="w-full border border-neutral-700 text-neutral-400 hover:text-white font-mono text-xs rounded-xl px-3 py-2 transition"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => router.push(`/admin?program=${program.slug}`)}
                  className="group border border-neutral-800 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-white transition-colors w-full"
                >
                  {slugToImage[program.slug] ? (
                    <img
                      src={slugToImage[program.slug]}
                      alt={program.name}
                      className="w-16 h-16 object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center">
                      <span className="text-white font-black text-xl uppercase">
                        {program.name[0]}
                      </span>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-white font-black text-sm uppercase tracking-tight">{program.name}</p>
                  </div>
                  <span className="text-neutral-600 text-xs uppercase tracking-widest font-mono group-hover:text-white transition-colors">
                    Entrar →
                  </span>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDeleteId(program.id) }}
                  className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-neutral-700 hover:text-red-400 transition opacity-0 group-hover:opacity-100 text-sm font-bold"
                  title="Eliminar programa"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}

        {/* Crear nuevo programa */}
        {showForm ? (
          <form
            onSubmit={handleCreate}
            className="border border-neutral-800 rounded-2xl p-8 flex flex-col gap-4 w-full sm:w-48"
          >
            <input
              type="text"
              placeholder="Nombre del programa"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              className="bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white transition"
            />
            {formError && <p className="text-red-400 text-xs font-mono">{formError}</p>}
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-2 text-xs hover:bg-neutral-200 disabled:opacity-50 transition"
            >
              {creating ? 'Creando...' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewName(''); setFormError('') }}
              className="text-neutral-600 hover:text-white text-xs font-mono transition text-center"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="group border-2 border-dashed border-neutral-800 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-neutral-600 transition-colors w-full sm:w-48"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-neutral-700 flex items-center justify-center group-hover:border-neutral-500 transition">
              <span className="text-neutral-600 text-2xl group-hover:text-neutral-400 transition">+</span>
            </div>
            <span className="text-neutral-600 text-xs uppercase tracking-widest font-mono group-hover:text-neutral-400 transition">
              Nuevo programa
            </span>
          </button>
        )}
      </div>
    </main>
  )
}
