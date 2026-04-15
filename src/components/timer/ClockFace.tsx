'use client'

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

export function ClockFace({ display, label, onStart, disabled }: { display: string; label: string; onStart: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
    <div className="relative w-72 h-72">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <circle cx="100" cy="100" r="95" fill="none" stroke="#262626" strokeWidth="1.5" />
        {Array.from({ length: 60 }).map((_, i) => {
          const angle = (i * 360) / 60
          const rad = (angle - 90) * (Math.PI / 180)
          const isMajor = i % 5 === 0
          const r1 = isMajor ? 80 : 85
          const r2 = 93
          const cos = Math.cos(rad)
          const sin = Math.sin(rad)
          return (
            <line
              key={i}
              x1={parseFloat((100 + r1 * cos).toFixed(4))}
              y1={parseFloat((100 + r1 * sin).toFixed(4))}
              x2={parseFloat((100 + r2 * cos).toFixed(4))}
              y2={parseFloat((100 + r2 * sin).toFixed(4))}
              stroke={isMajor ? '#525252' : '#303030'}
              strokeWidth={isMajor ? 2 : 1}
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <p className="text-neutral-400 text-sm uppercase tracking-widest font-mono">{label}</p>
        <p className="text-white font-black text-5xl tabular-nums tracking-tighter leading-none">{display}</p>
        <button onClick={onStart} disabled={disabled} className="mt-1 bg-white text-black font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs disabled:opacity-30 disabled:cursor-not-allowed">
          Listo
        </button>
      </div>
    </div>
    {isIOS && (
      <p className="text-neutral-600 text-xs font-mono text-center">⚠️ Desactiva el modo silencio para escuchar los beeps</p>
    )}
    </div>
  )
}

export function Connector() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-px h-2 bg-neutral-700" />
      <div className="w-px h-2 bg-neutral-600" />
      <div className="w-px h-2 bg-neutral-700" />
    </div>
  )
}
