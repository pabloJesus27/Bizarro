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
  const [drawerOpen,  setDrawerOpen]  = useState(false)

  async function handleLogout() {
    setProfileOpen(false)
    await signOut()
    router.push('/login')
  }

  const img = SLUG_IMAGES[programSlug]

  return (
    <>
    <header className="relative flex items-center justify-between px-6 py-5 border-b border-neutral-900">
      {/* Left: hamburger (móvil) + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="lg:hidden text-neutral-500 hover:text-white transition mr-1"
          aria-label="Abrir menú"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect y="3" width="22" height="2" rx="1" fill="currentColor"/>
            <rect y="10" width="22" height="2" rx="1" fill="currentColor"/>
            <rect y="17" width="22" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
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

      {/* Center: nav tabs — solo desktop */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-1 bg-neutral-900 rounded-full p-1">
        <button
          onClick={() => router.push(`/admin?program=${programSlug}`)}
          className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
            activeTab === 'home' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          Home
        </button>
        <button
          onClick={() => router.push(`/admin/atletas?program=${programSlug}`)}
          className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
            activeTab === 'atletas' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          Mis atletas
        </button>
        <button
          onClick={() => router.push(`/admin/notificaciones?program=${programSlug}`)}
          className={`relative px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
            activeTab === 'notificaciones' ? 'bg-white text-black' : 'text-neutral-500 hover:text-neutral-300'
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

      {/* Right: profile dropdown */}
      <div className="flex items-center gap-5">
        <button
          onClick={() => router.push('/select-program')}
          className="hidden lg:block text-neutral-600 hover:text-white text-sm transition font-mono"
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
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-[calc(100%+12px)] bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition"
                >
                  Salir
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>

    {/* Drawer móvil */}
    {drawerOpen && (
      <>
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setDrawerOpen(false)} />
        <div className="fixed left-0 top-0 h-full w-64 bg-neutral-950 border-r border-neutral-800 z-50 flex flex-col lg:hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-900">
            <span className="text-white font-black text-lg tracking-tight uppercase">Menú</span>
            <button onClick={() => setDrawerOpen(false)} className="text-neutral-500 hover:text-white text-2xl leading-none transition">&times;</button>
          </div>
          <nav className="flex flex-col p-4 gap-1">
            <button
              onClick={() => { setDrawerOpen(false); router.push(`/admin?program=${programSlug}`) }}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
            >
              Home
            </button>
            <button
              onClick={() => { setDrawerOpen(false); router.push(`/admin/atletas?program=${programSlug}`) }}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
            >
              Mis atletas
            </button>
            <button
              onClick={() => { setDrawerOpen(false); router.push(`/admin/notificaciones?program=${programSlug}`) }}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-neutral-900 transition flex items-center justify-between"
            >
              Notificaciones
              {pendingCount > 0 && (
                <span className="w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-black">{pendingCount}</span>
              )}
            </button>
            <button
              onClick={() => { setDrawerOpen(false); router.push('/select-program') }}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
            >
              ← Programas
            </button>
          </nav>
        </div>
      </>
    )}
    </>
  )
}
