// ── Sound effects 🔊 ───────────────────────────────────────
// Every sound is made on the spot by the phone's own synthesiser (Web Audio),
// so there are no sound files to download on bad signal.
//   playSfx('snap')   — play a sound (does nothing when muted)
//   isMuted() / setMuted(true) — the 🔊/🔇 button in the top bar
// iPhones only allow sound after the first tap, so we "unlock" audio on the
// first touch.

import { isCalm } from './motion'

const MUTE_KEY = 'tech-deck-muted'
let muted = false
try { muted = localStorage.getItem(MUTE_KEY) === '1' } catch { /* private mode */ }

let ctx = null
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = audio()
    if (c) {
      const s = c.createBufferSource()
      s.buffer = c.createBuffer(1, 1, 22050)
      s.connect(c.destination)
      s.start(0)
    }
    window.removeEventListener('touchend', unlock)
    window.removeEventListener('click', unlock)
  }
  window.addEventListener('touchend', unlock)
  window.addEventListener('click', unlock)
}

// A single note that slides from `freq` to `to`.
function tone(c, { type = 'sine', freq, to, start = 0, dur = 0.2, vol = 0.2 }) {
  const t = c.currentTime + start
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.05)
}

// A burst of hiss (claps, whooshes, crackles).
function noise(c, { start = 0, dur = 0.2, vol = 0.3, freq = 1500, to, filter = 'lowpass' }) {
  const t = c.currentTime + start
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(freq, t)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(c.destination)
  src.start(t)
}

const notes = (c, list, type = 'triangle', vol = 0.18) =>
  list.forEach(([freq, start, dur = 0.25]) => tone(c, { type, freq, start, dur, vol }))

const SOUNDS = {
  pop: (c) => tone(c, { type: 'triangle', freq: 520, to: 900, dur: 0.09, vol: 0.15 }),
  turn: (c) => notes(c, [[660, 0, 0.18], [990, 0.11, 0.3]], 'sine', 0.14),
  slam: (c) => {
    noise(c, { dur: 0.25, vol: 0.5, freq: 900 })
    tone(c, { freq: 170, to: 45, dur: 0.35, vol: 0.55 })
  },
  snap: (c) => {
    noise(c, { dur: 0.09, vol: 0.9, freq: 2500, filter: 'highpass' })
    noise(c, { start: 0.02, dur: 0.3, vol: 0.5, freq: 700 })
    tone(c, { freq: 200, to: 50, dur: 0.3, vol: 0.6 })
    notes(c, [[784, 0.12, 0.12], [1175, 0.2, 0.3]], 'square', 0.07)
  },
  ding: (c) => notes(c, [[880, 0, 0.5], [1320, 0.1, 0.6]], 'sine', 0.2),
  cash: (c) => notes(c, [[988, 0, 0.12], [1319, 0.08, 0.5]], 'square', 0.08),
  fanfare: (c) => notes(c, [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36, 0.6], [784, 0.54, 0.12], [1047, 0.64, 0.8]]),
  buzz: (c) => tone(c, { type: 'sawtooth', freq: 150, to: 80, dur: 0.45, vol: 0.2 }),
  sad: (c) => notes(c, [[392, 0, 0.3], [370, 0.32, 0.3], [349, 0.64, 0.3], [330, 0.96, 0.7]], 'sawtooth', 0.09),
  fish: (c) => {
    tone(c, { freq: 300, to: 1200, dur: 0.14, vol: 0.2 })
    tone(c, { freq: 400, to: 1500, start: 0.12, dur: 0.12, vol: 0.15 })
    noise(c, { start: 0.05, dur: 0.5, vol: 0.25, freq: 600, to: 200 })
  },
  zap: (c) => {
    noise(c, { dur: 0.35, vol: 0.5, freq: 3000, to: 300, filter: 'bandpass' })
    tone(c, { type: 'square', freq: 1400, to: 90, dur: 0.3, vol: 0.12 })
  },
  whoosh: (c) => noise(c, { dur: 0.4, vol: 0.35, freq: 300, to: 3000, filter: 'bandpass' }),
  burn: (c) => {
    noise(c, { dur: 1.4, vol: 0.6, freq: 500, to: 120 })
    noise(c, { start: 0.1, dur: 1.0, vol: 0.2, freq: 4000, filter: 'highpass' })
    tone(c, { freq: 90, to: 40, dur: 0.8, vol: 0.5 })
  },
}

export function playSfx(name) {
  if (muted) return
  try {
    const c = audio()
    if (c) SOUNDS[name]?.(c)
  } catch { /* sound is a bonus — never break the game for it */ }
}

export const isMuted = () => muted
export function setMuted(value) {
  muted = value
  try { localStorage.setItem(MUTE_KEY, value ? '1' : '0') } catch { /* ignore */ }
}

// A little buzz on phones that support it (Android — iPhones ignore this).
// No buzzing in calm mode.
export function buzz(pattern) {
  if (isCalm()) return
  try { navigator.vibrate?.(pattern) } catch { /* ignore */ }
}
