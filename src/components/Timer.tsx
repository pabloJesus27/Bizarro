'use client'

import { useRouter } from 'next/navigation'

export default function TimerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()

  function select(t: string) {
    onClose()
    router.push('/timer?type=' + t)
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[72px] bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {(['amrap', 'fortime', 'emom', 'tabata', 'mix'] as const).map(t => (
          <button
            key={t}
            onClick={() => select(t)}
            className="w-full px-3 py-1.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition border-b border-neutral-900 last:border-0"
          >
            {t === 'fortime' ? 'For Time' : t === 'mix' ? 'Mix' : t.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
