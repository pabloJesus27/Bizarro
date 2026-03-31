'use client'

import { useEffect, useState } from 'react'

export function useIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(false)
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isLandscape
}

export default function LandscapeDisplay({
  time,
  label,
  children,
}: {
  time: string
  label: string
  children?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-40 gap-2">
      <p className="text-neutral-600 text-xs uppercase tracking-widest font-mono">{label}</p>
      <p
        className="text-white font-black tabular-nums tracking-tighter leading-none"
        style={{ fontSize: '32vh' }}
      >
        {time}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
