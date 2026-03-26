'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import { getProfile, getProgramBySlug } from '@/lib/db'
import TimerModal from './Timer'

export default function AppHeader({ homeRoute, showChangeProgram = true }: {
  homeRoute?: string
  showChangeProgram?: boolean
} = {}) {
  const router = useRouter()
  const { user } = useAuth()

  const [timerOpen,   setTimerOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [drawerOpen,     setDrawerOpen]     = useState(false)
  const [timerExpanded,  setTimerExpanded]  = useState(false)
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null)
  const [program,     setProgram]     = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')
  const [programName, setProgramName] = useState<string | null>(null)

  const slugImages: Record<string, string> = {
    bizarro: '/logoBizarro.png',
    entrenemos: '/entrenemos.png',
  }

  useEffect(() => {
    if (!user) return
    getProfile(user.id).then(async profile => {
      setProfileName(profile?.full_name ?? '')
      setAvatarUrl(profile?.avatar_url ?? null)
      const slug = profile?.program ?? 'bizarro'
      if (profile?.program && profile.program !== 'libre' && !slugImages[profile.program]) {
        const p = await getProgramBySlug(profile.program)
        if (p) setProgramName(p.name)
      }
      setProgram(slug)
    })
  }, [user])

  return (
    <>
      <header className="relative flex items-center justify-between px-6 py-5 border-b border-neutral-900">
        <div className="flex items-center gap-3 h-10">
          {/* Hamburger — solo móvil */}
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
          {program && program !== 'libre' && (() => {
            const img = slugImages[program]
            const displayName = img ? program : (programName ?? null)
            if (!displayName) return null
            return (
              <>
                {img ? (
                  <Image src={img} alt={displayName} width={40} height={40} className="object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center">
                    <span className="text-white font-black text-lg uppercase">{displayName[0]}</span>
                  </div>
                )}
                <span className="text-white font-black text-xl tracking-tighter">{displayName}</span>
              </>
            )
          })()}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-1 bg-neutral-900 rounded-full p-1">
          <button
            onClick={() => homeRoute ? router.push(homeRoute) : router.push(program === 'libre' ? '/libre' : `/dashboard?program=${program ?? 'bizarro'}`)}
            className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition text-neutral-500 hover:text-neutral-300"
          >
            Home
          </button>
          <button
            onClick={() => setTimerOpen(v => !v)}
            className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${timerOpen ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Timer
          </button>
          <button
            onClick={() => router.push('/maximos')}
            className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition text-neutral-500 hover:text-neutral-300"
          >
            Mis PRs
          </button>
          <button
            onClick={() => router.push('/programaciones')}
            className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition text-neutral-500 hover:text-neutral-300"
          >
            Programaciones
          </button>
        </div>
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
              )}
            <span className="text-white text-sm font-mono">{profileName.split(' ')[0]}</span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+12px)] bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[140px]">
              {showChangeProgram && (
              <button
                onClick={() => { setProfileOpen(false); router.push('/elegir-modo') }}
                className="w-full px-4 py-2.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition border-b border-neutral-900"
              >
                Cambiar programa
              </button>
            )}
              <button
                onClick={() => { setProfileOpen(false); router.push('/profile') }}
                className="w-full px-4 py-2.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition border-b border-neutral-900"
              >
                Editar perfil
              </button>
              <button
                onClick={async () => { setProfileOpen(false); await signOut(); router.push('/login') }}
                className="w-full px-4 py-2.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </header>
      {timerOpen && <TimerModal onClose={() => setTimerOpen(false)} />}

      {/* Drawer móvil */}
      {drawerOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Panel */}
          <div className="fixed left-0 top-0 h-full w-64 bg-neutral-950 border-r border-neutral-800 z-50 flex flex-col lg:hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-900">
              <span className="text-white font-black text-lg tracking-tight uppercase">Menú</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-neutral-500 hover:text-white text-2xl leading-none transition"
              >
                &times;
              </button>
            </div>
            <nav className="flex flex-col p-4 gap-1">
              <button
                onClick={() => { setDrawerOpen(false); homeRoute ? router.push(homeRoute) : router.push(program === 'libre' ? '/libre' : `/dashboard?program=${program ?? 'bizarro'}`) }}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
              >
                Home
              </button>
              <button
                onClick={() => setTimerExpanded(v => !v)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-neutral-900 transition flex items-center justify-between"
              >
                Timer
                <span className="text-neutral-600 text-xs">{timerExpanded ? '▲' : '▼'}</span>
              </button>
              {timerExpanded && (
                <div className="flex flex-col pl-4">
                  {(['amrap', 'fortime', 'emom', 'tabata', 'mix'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setDrawerOpen(false); setTimerExpanded(false); router.push('/timer?type=' + t) }}
                      className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-widest text-neutral-500 hover:text-white hover:bg-neutral-900 transition"
                    >
                      {t === 'fortime' ? 'For Time' : t === 'mix' ? 'Mix' : t.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setDrawerOpen(false); router.push('/maximos') }}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
              >
                Mis PRs
              </button>
              <button
                onClick={() => { setDrawerOpen(false); router.push('/programaciones') }}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-mono uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
              >
                Programaciones
              </button>
            </nav>
          </div>
        </>
      )}
    </>
  )
}
