'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import { getProfile } from '@/lib/db'
import TimerModal from './Timer'

export default function AppHeader() {
  const router = useRouter()
  const { user } = useAuth()

  const [timerOpen,   setTimerOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null)
  const [program,     setProgram]     = useState<'bizarro' | 'entrenemos'>('bizarro')
  const [profileName, setProfileName] = useState('')

  useEffect(() => {
    if (!user) return
    getProfile(user.id).then(profile => {
      setProfileName(profile?.full_name ?? '')
      setAvatarUrl(profile?.avatar_url ?? null)
      setProgram((profile?.program ?? 'bizarro') as 'bizarro' | 'entrenemos')
    })
  }, [user])

  return (
    <>
      <header className="relative flex items-center justify-between px-6 py-5 border-b border-neutral-900">
        <div className="flex items-center gap-3">
          <Image
            src={program === 'entrenemos' ? '/entrenemos.png' : '/logoBizarro.png'}
            alt={program === 'entrenemos' ? 'Entrenemos' : 'Bizarro'}
            width={32} height={32} className="object-contain"
          />
          <span className="text-white font-black text-xl tracking-tighter">
            {program === 'entrenemos' ? 'ENTRENEMOS' : 'BIZARRO'}
          </span>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-900 rounded-full p-1">
          <button
            onClick={() => router.push('/dashboard')}
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
    </>
  )
}
