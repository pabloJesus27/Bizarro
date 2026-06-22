'use client'

import { useEffect, useState } from 'react'

export function useIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(false)
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight)
    const onOrientationChange = () => setTimeout(check, 150)
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', onOrientationChange)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', onOrientationChange)
    }
  }, [])
  return isLandscape
}

export default function LandscapeDisplay({
  time,
  label,
  children,
  onBack,
}: {
  time: string
  label: string
  children?: React.ReactNode
  onBack?: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-40 gap-2">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute text-neutral-600 hover:text-white text-sm font-mono transition"
          style={{ top: 'calc(1.5rem + env(safe-area-inset-top))', left: 'calc(1.5rem + env(safe-area-inset-left))' }}
        >
          ← Volver
        </button>
      )}
      <p className="text-neutral-600 text-xs uppercase tracking-widest font-mono">{label}</p>
      <p
        className="font-black tabular-nums tracking-tighter leading-none"
        style={{ fontSize: '50vh', color: '#6BBF00' }}
      >
        {time}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
