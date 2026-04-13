'use client'

import { useEffect, useState } from 'react'
import { APP_VERSION } from '@/lib/version'

function parseVersion(v: string): number[] {
  return v.split('.').map(Number)
}

function isOutdated(current: string, min: string): boolean {
  const c = parseVersion(current)
  const m = parseVersion(min)
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    const cv = c[i] ?? 0
    const mv = m[i] ?? 0
    if (cv < mv) return true
    if (cv > mv) return false
  }
  return false
}

export default function AppUpdateModal() {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  useEffect(() => {
    let isNative = false
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Capacitor } = require('@capacitor/core')
      isNative = Capacitor.isNativePlatform()
    } catch {
      return
    }
    if (!isNative) return

    fetch('/api/app-version')
      .then(r => r.json())
      .then(({ minVersion, downloadUrl }) => {
        if (isOutdated(APP_VERSION, minVersion)) {
          setDownloadUrl(downloadUrl)
        }
      })
      .catch(() => {})
  }, [])

  if (!downloadUrl) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 text-center">
        <div className="mb-3 text-3xl">🔄</div>
        <h2 className="mb-2 text-lg font-bold text-white">Actualización disponible</h2>
        <p className="mb-6 text-sm text-zinc-400">
          Hay una nueva versión de la app. Descárgala para seguir usando Bizarro.
        </p>
        <a
          href={downloadUrl}
          className="block w-full rounded-xl bg-white py-3 text-sm font-semibold text-black"
        >
          Descargar actualización
        </a>
      </div>
    </div>
  )
}
