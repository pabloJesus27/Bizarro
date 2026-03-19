'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth'

const SLUG_IMAGES: Record<string, string> = {
  bizarro: '/logoBizarro.png',
  entrenemos: '/entrenemos.png',
}

interface CoachHeaderProps {
  activeTab: 'home' | 'atletas' | 'notificaciones'
  pendingCount: number
  programSlug: string
  programName: string
  profileName: string
  avatarUrl: string | null
}

export default function CoachHeader({
  activeTab,
  pendingCount,
  programSlug,
  programName,
  profileName,
  avatarUrl,
}: CoachHeaderProps) {
  const router = useRouter()
  const [profileOpen, setProfileOpen] = useState(false)

  async function handleLogout() {
    setProfileOpen(false)
    await signOut()
    router.push('/login')
  }

  const img = SLUG_IMAGES[programSlug]

  return (
    <header className="relative flex items-center justify-between px-6 py-5 border-b border-neutral-900">
      {/* Left: program logo + name */}
      <div className="flex items-center gap-3">
        {img
          ? <Image src={img} alt={programName} width={48} height={48} className="object-contain" />
          : (
            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
              <span className="text-white font-black text-sm uppercase">{programName[0]}</span>
            </div>
          )
        }
        <span className="text-white font-black text-xl tracking-tighter">{programName.toUpperCase()}</span>
      </div>

      {/* Center: nav tabs */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-900 rounded-full p-1">
        <button
          onClick={() => router.push(`/admin?program=${programSlug}`)}
          className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
            activeTab === 'home'
              ? 'text-white'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          Home
        </button>
        <button
          onClick={() => router.push(`/admin/atletas?program=${programSlug}`)}
          className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
            activeTab === 'atletas'
              ? 'text-white'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          Mis atletas
        </button>
        <button
          onClick={() => router.push(`/admin/notificaciones?program=${programSlug}`)}
          className={`relative px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
            activeTab === 'notificaciones'
              ? 'bg-white text-black'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          Notificaciones
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-black">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Right: back to programs + profile dropdown */}
      <div className="flex items-center gap-5">
        <button
          onClick={() => router.push('/select-program')}
          className="text-neutral-600 hover:text-white text-sm transition font-mono"
        >
          ← Programas
        </button>

        <div className="relative flex items-center">
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            {avatarUrl
              ? <Image src={avatarUrl} alt="avatar" width={28} height={28} className="rounded-full object-cover" unoptimized />
              : (
                <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center">
                  <span className="text-white text-xs font-black">{profileName[0]?.toUpperCase()}</span>
                </div>
              )
            }
            <span className="text-white text-sm font-mono">{profileName.split(' ')[0]}</span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+12px)] bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]">
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
