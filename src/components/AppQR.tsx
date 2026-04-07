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
      <div className="bg-white p-3 rounded-xl">
        <QRCodeSVG value={url} size={100} bgColor="#ffffff" fgColor="#000000" />
      </div>
      <p className="text-neutral-600 font-mono text-xs uppercase tracking-widest">Comparte la app</p>
      <p className="text-neutral-700 font-mono text-xs">{url}</p>
    </div>
  )
}
