'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import type { CommunityMember } from '@/lib/db'
import type { Community } from '@/lib/types'

export default function CommunityPanel({ communitySlug, onClose }: {
  communitySlug?: string
  onClose: () => void
}) {
  const { user, session } = useAuth()
  const router = useRouter()

  const [community,     setCommunity]     = useState<Community | null>(null)
  const [members,       setMembers]       = useState<CommunityMember[]>([])
  const [inviteEmail,   setInviteEmail]   = useState('')
  const [inviteLink,    setInviteLink]    = useState<string | null>(null)
  const [inviteError,   setInviteError]   = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [membersError,  setMembersError]  = useState<string | null>(null)
  const [createName,    setCreateName]    = useState('')
  const [createError,   setCreateError]   = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    if (!communitySlug || !session) { setLoading(false); return }
    setMembersError(null)
    fetch(`/api/community-members?slug=${communitySlug}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
      .then(async res => {
        const data = await res.json()
        if (res.ok) {
          setCommunity(data.community)
          setMembers(data.members)
        } else {
          setMembersError(`Error ${res.status}: ${data.error}`)
        }
      })
      .finally(() => setLoading(false))
  }, [communitySlug, session])

  const isOwner = !!user && community?.owner_id === user.id

  async function handleCreate() {
    if (!session || !createName.trim()) return
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/create-community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: createName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error); return }
      onClose()
      router.push(`/comunidad/${data.slug}`)
    } catch {
      setCreateError('Error al crear la comunidad')
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleInvite() {
    if (!session || !inviteEmail.trim() || !community) return
    setInviteLoading(true)
    setInviteError(null)
    setInviteLink(null)
    try {
      const res = await fetch('/api/invite-community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ communitySlug: community.slug, email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setInviteError(data.error); return }
      setInviteLink(`${window.location.origin}/unirse-comunidad?token=${data.token}`)
      setInviteEmail('')
    } catch {
      setInviteError('Error al generar la invitación')
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleDelete() {
    if (!session || !community) return
    const res = await fetch('/api/delete-community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ communityId: community.id }),
    })
    if (res.ok) { onClose(); router.push('/elegir-modo') }
  }

  if (loading) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:right-0 sm:top-0 sm:w-80 bg-neutral-950 border-t sm:border-t-0 sm:border-l border-neutral-800 z-50 flex flex-col max-h-[85vh] sm:max-h-full overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-900 flex-shrink-0">
          <span className="text-white font-black text-sm uppercase tracking-tight">
            {community ? community.name : 'Mi comunidad'}
          </span>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-2xl leading-none transition">&times;</button>
        </div>

        <div className="flex flex-col gap-6 p-6 flex-1 overflow-y-auto">

          {/* Sin comunidad: formulario de creación */}
          {!community && (
            <div>
              <p className="text-neutral-400 text-xs font-mono mb-4">
                Crea una comunidad para compartir tus WODs con hasta 10 amigos.
              </p>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Nombre de la comunidad"
                  className="bg-neutral-900 border border-neutral-800 text-white text-sm font-mono px-3 py-2 rounded-lg focus:outline-none focus:border-neutral-600 placeholder:text-neutral-600"
                />
                {createError && <p className="text-red-400 text-xs font-mono">{createError}</p>}
                <button
                  onClick={handleCreate}
                  disabled={createLoading || !createName.trim()}
                  className="py-2 bg-white text-black text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50 transition hover:bg-neutral-200"
                >
                  {createLoading ? '...' : 'Crear comunidad'}
                </button>
              </div>
            </div>
          )}

          {/* Con comunidad: miembros */}
          {community && (
            <div>
              <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-3">
                Miembros ({members.length}/10)
              </p>
              {membersError && <p className="text-red-400 text-xs font-mono mb-2">{membersError}</p>}
              <div className="flex flex-col gap-2">
                {members.map(m => (
                  <div key={m.athlete_id} className="flex items-center gap-3">
                    {m.profiles.avatar_url ? (
                      <Image src={m.profiles.avatar_url} alt="" width={28} height={28} className="rounded-full object-cover" unoptimized />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center">
                        <span className="text-white text-xs font-black">{m.profiles.full_name?.[0]?.toUpperCase() ?? '?'}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-white text-sm font-mono truncate">{m.profiles.full_name ?? 'Sin nombre'}</span>
                      {community.owner_id === m.athlete_id && (
                        <span className="text-neutral-600 text-xs font-mono flex-shrink-0">creador</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invitar (solo owner con comunidad) */}
          {community && isOwner && (
            <div>
              <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-3">Invitar</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="email@ejemplo.com"
                  className="flex-1 bg-neutral-900 border border-neutral-800 text-white text-sm font-mono px-3 py-2 rounded-lg focus:outline-none focus:border-neutral-600 placeholder:text-neutral-600"
                />
                <button
                  onClick={handleInvite}
                  disabled={inviteLoading || !inviteEmail.trim()}
                  className="flex-shrink-0 px-3 py-2 bg-white text-black text-sm font-black rounded-lg disabled:opacity-50 transition hover:bg-neutral-200"
                >
                  {inviteLoading ? '…' : '→'}
                </button>
              </div>
              {inviteError && <p className="text-red-400 text-xs font-mono mt-2">{inviteError}</p>}
              {inviteLink && (
                <div className="mt-3 p-3 bg-neutral-900 rounded-lg">
                  <p className="text-neutral-500 text-xs font-mono mb-2">Copia y comparte este link:</p>
                  <p className="text-white text-xs font-mono break-all mb-2">{inviteLink}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteLink)}
                    className="text-neutral-400 hover:text-white text-xs font-mono uppercase tracking-widest transition"
                  >
                    Copiar →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Eliminar comunidad (solo owner) */}
          {community && isOwner && (
            <div className="mt-auto pt-4 border-t border-neutral-900">
              {deleteConfirm ? (
                <div className="flex flex-col gap-2">
                  <p className="text-neutral-400 text-xs font-mono">¿Seguro? Se eliminarán la comunidad y todos sus WODs.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      className="flex-1 py-2 bg-red-900 text-red-300 text-xs font-mono uppercase tracking-widest rounded-lg hover:bg-red-800 transition"
                    >
                      Eliminar
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 py-2 bg-neutral-900 text-neutral-400 text-xs font-mono uppercase tracking-widest rounded-lg hover:bg-neutral-800 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="text-neutral-600 hover:text-red-400 text-xs font-mono uppercase tracking-widest transition"
                >
                  Eliminar comunidad
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
