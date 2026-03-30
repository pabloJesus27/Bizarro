export function keepAudioContextAlive(_ctx: AudioContext) {
  // No-op
}

export function flash(color = 'rgba(255,255,255,0.5)') {
  if (typeof document === 'undefined') return
  const div = document.createElement('div')
  div.style.cssText = `position:fixed;inset:0;background:${color};z-index:9999;pointer-events:none;opacity:1;transition:opacity 0.35s`
  document.body.appendChild(div)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    div.style.opacity = '0'
    setTimeout(() => div.remove(), 400)
  }))
}

export function beepWarning(ctx: AudioContext) {
  speak('Diez segundos')
  flash('rgba(255,140,0,0.55)')
  const play = () => {
    [0, 200, 400].forEach(delay => {
      setTimeout(() => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.8, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
        osc.start()
        osc.stop(ctx.currentTime + 0.1)
      }, delay)
    })
  }
  if (ctx.state === 'suspended') { ctx.resume().then(play).catch(() => {}) } else { play() }
}

export function beepGo(ctx: AudioContext) {
  flash('rgba(0,220,100,0.55)')
  const play = () => {
    [880, 1100].forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(1.0, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      }, i * 200)
    })
  }
  if (ctx.state === 'suspended') { ctx.resume().then(play).catch(() => {}) } else { play() }
}

export function fmt(s: number): string {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-ES'
  u.rate = 0.95
  u.volume = 1
  window.speechSynthesis.speak(u)
}

export function beep(ctx: AudioContext, freq = 880, dur = 0.3, vol = 1.0) {
  flash('rgba(255,255,255,0.4)')
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
