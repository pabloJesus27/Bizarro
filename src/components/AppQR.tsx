'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'

export default function AppQR() {
  const [url, setUrl] = useState('')
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setUrl(window.location.href)
    setCanShare(!!navigator.share)
  }, [])

  if (!url) return null

  const handleShare = () => {
    navigator.share({ title: 'Bizarro', text: 'Tu tracker de WODs CrossFit', url })
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white p-4 rounded-xl">
        <QRCodeSVG value={url} size={160} bgColor="#ffffff" fgColor="#000000" level="H" />
      </div>
      <p className="text-neutral-600 font-mono text-xs uppercase tracking-widest">Comparte la app</p>

      {canShare && (
        <button
          onClick={handleShare}
          className="border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl px-5 py-3 transition"
        >
          Compartir enlace →
        </button>
      )}
    </div>
  )
}
