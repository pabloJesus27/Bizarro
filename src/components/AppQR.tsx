'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'

export default function AppQR() {
  const [url, setUrl] = useState('')

  useEffect(() => {
    setUrl(window.location.href)
  }, [])

  if (!url) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-4 rounded-xl">
        <QRCodeSVG value={url} size={160} bgColor="#ffffff" fgColor="#000000" level="H" />
      </div>
      <p className="text-neutral-600 font-mono text-xs uppercase tracking-widest">Comparte la app</p>
    </div>
  )
}
