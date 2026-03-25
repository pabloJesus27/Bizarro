'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { getProfile, updateProfile } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

const AVATAR_STYLES = [
  { id: 'initials',   label: 'Iniciales' },
  { id: 'adventurer', label: 'Aventurero' },
  { id: 'avataaars',  label: 'Avatar' },
  { id: 'bottts',     label: 'Robot' },
  { id: 'fun-emoji',  label: 'Emoji' },
  { id: 'pixel-art',  label: 'Pixel' },
]

function buildAvatarUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [profile,      setProfile]      = useState<Profile | null>(null)
  const [fullName,     setFullName]     = useState('')
  const [avatarUrl,    setAvatarUrl]    = useState('')
  const [avatarStyle,  setAvatarStyle]  = useState('initials')
  const [avatarSeed,   setAvatarSeed]   = useState('')
  const [tab,          setTab]          = useState<'foto' | 'generado'>('foto')
  const [uploading,    setUploading]    = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(p => {
      if (!p) return
      setProfile(p)
      setFullName(p.full_name ?? '')
      setAvatarUrl(p.avatar_url ?? '')

      if (p.avatar_url) {
        const match = p.avatar_url.match(/9\.x\/([^/]+)\/svg\?seed=(.+)/)
        if (match) {
          setTab('generado')
          setAvatarStyle(match[1])
          setAvatarSeed(decodeURIComponent(match[2]))
        } else {
          setTab('foto')
        }
      }
      setLoading(false)
    })
  }, [authLoading, user, router])

  const generatedUrl = buildAvatarUrl(avatarStyle, avatarSeed || fullName || 'atleta')
  const previewUrl   = tab === 'foto' ? avatarUrl : generatedUrl

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
    if (!ext || !allowedExts.includes(ext) || !file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes (jpg, png, webp, gif)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5 MB')
      return
    }

    const path = `${user.id}/avatar.${ext}`

    setUploading(true)
    setError('')
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Añadir timestamp para evitar caché del navegador
      const url = `${data.publicUrl}?t=${Date.now()}`
      setAvatarUrl(url)
      setTab('foto')
    } catch (err: unknown) {
      setError('No se pudo subir la imagen. Inténtalo de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !fullName.trim()) return
    setError('')
    setSaving(true)
    try {
      const avatar_url = tab === 'foto' ? avatarUrl : generatedUrl
      await updateProfile(user.id, { full_name: fullName.trim(), avatar_url })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setError('No se pudo guardar el perfil. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-neutral-900">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-neutral-600 hover:text-white text-sm font-mono transition"
        >
          ← Volver
        </button>
        <span className="text-neutral-700 text-xs uppercase tracking-widest font-mono">Mi perfil</span>
        <div className="w-16" />
      </header>

      <div className="flex-1 px-6 py-10 max-w-md mx-auto w-full">

        {/* Avatar preview */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="relative w-24 h-24">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Avatar"
                width={96}
                height={96}
                className="rounded-full object-cover w-24 h-24"
                unoptimized
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-neutral-800 flex items-center justify-center">
                <span className="text-white text-2xl font-black">{getInitials(fullName || '?')}</span>
              </div>
            )}
          </div>
          <p className="text-white font-black text-xl tracking-tight">{fullName || 'Sin nombre'}</p>
          {profile?.role && (
            <span className="text-neutral-600 text-xs uppercase tracking-widest font-mono">
              {profile.role === 'coach' ? 'Coach' : 'Atleta'}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Nombre */}
          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-2 font-mono">
              Nombre
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
            />
          </div>

          {/* Avatar tabs */}
          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-3 font-mono">
              Avatar
            </label>

            <div className="flex gap-1 bg-neutral-900 rounded-full p-1 mb-4 w-fit">
              <button
                type="button"
                onClick={() => setTab('foto')}
                className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                  tab === 'foto' ? 'bg-white text-black' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Foto
              </button>
              <button
                type="button"
                onClick={() => setTab('generado')}
                className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                  tab === 'generado' ? 'bg-white text-black' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Generado
              </button>
            </div>

            {tab === 'foto' ? (
              <div className="flex flex-col gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border border-neutral-700 text-white font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-white transition text-sm disabled:opacity-50"
                >
                  {uploading ? 'Subiendo...' : 'Subir foto'}
                </button>
                {avatarUrl && !avatarUrl.includes('dicebear') && (
                  <p className="text-neutral-600 text-xs font-mono text-center">Foto cargada</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2">
                  {AVATAR_STYLES.map(style => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setAvatarStyle(style.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition ${
                        avatarStyle === style.id
                          ? 'border-white bg-neutral-900'
                          : 'border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      <Image
                        src={buildAvatarUrl(style.id, avatarSeed || fullName || 'atleta')}
                        alt={style.label}
                        width={40}
                        height={40}
                        className="rounded-full"
                        unoptimized
                      />
                      <span className="text-neutral-500 text-xs font-mono">{style.label}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-neutral-600 text-xs font-mono mb-2">
                    Variación
                  </label>
                  <input
                    type="text"
                    placeholder={fullName || 'Escribe algo para variar el diseño'}
                    value={avatarSeed}
                    onChange={e => setAvatarSeed(e.target.value)}
                    className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all"
          >
            {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </main>
  )
}
