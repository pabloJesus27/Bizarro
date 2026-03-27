// En iOS, reproducir un <audio> en el tap del usuario cambia la sesión de audio
// a modo "playback", lo que permite que WebAudio suene aunque el móvil esté en silencio.
// Necesita ser audio audible (no silencio) para que iOS active el modo playback.
export function unlockSilentMode() {
  const a = new Audio('/beep.wav')
  a.volume = 0.001
  a.play().catch(() => {})
}

export function fmt(s: number): string {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  // iOS Safari: speechSynthesis interfiere con WebAudio y suspende el AudioContext
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-ES'
  u.rate = 0.95
  u.volume = 1
  window.speechSynthesis.speak(u)
}

export function beep(ctx: AudioContext, freq = 880, dur = 0.3, vol = 1.0) {
  const play = () => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start()
    osc.stop(ctx.currentTime + dur)
  }
  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {})
  } else {
    play()
  }
}
