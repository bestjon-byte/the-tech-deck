import { useState, useEffect } from 'react'
import CardFace from './CardFace'
import { playSfx } from '../lib/sfx'
import { rand } from '../lib/looks'

// 🔥 The big fire show when Shithead's pile burns.
// `burn` comes from shared storage ({ at, by, count, why, cards }), so EVERY
// phone at the table sees it — not just the player who burned. A burn that
// already happened before this screen opened (e.g. rejoining) is skipped.
const FX_MS = 2800


const FLAMES = Array.from({ length: 16 }, (_, i) => ({
  left: (i / 15) * 100,
  size: 90 + rand(i) * 110,
  delay: rand(i + 50) * 0.5,
  dur: 0.9 + rand(i + 100) * 0.6,
}))

const EMBERS = Array.from({ length: 46 }, (_, i) => ({
  left: 5 + rand(i + 200) * 90,
  drift: (rand(i + 300) - 0.5) * 160,
  size: 3 + rand(i + 400) * 6,
  delay: 0.15 + rand(i + 500) * 1.2,
  dur: 1.1 + rand(i + 600) * 1.1,
}))

const SMOKE = Array.from({ length: 6 }, (_, i) => ({
  left: 25 + rand(i + 700) * 50,
  delay: 1.0 + rand(i + 800) * 0.6,
}))

export default function BurnFX({ burn }) {
  const [seenAt, setSeenAt] = useState(burn?.at ?? null) // ignore the burn that was already there
  const [active, setActive] = useState(null)
  if (burn?.at && burn.at !== seenAt) {
    setSeenAt(burn.at)
    setActive(burn)
  }

  useEffect(() => {
    if (!active) return
    document.body.classList.add('burn-shake')
    navigator.vibrate?.([60, 40, 120]) // buzz on phones that support it
    playSfx('burn')
    const t = setTimeout(() => setActive(null), FX_MS)
    return () => {
      clearTimeout(t)
      document.body.classList.remove('burn-shake')
    }
  }, [active])

  if (!active) return null
  const cards = active.cards ?? []
  const why = active.why === 'four' ? 'FOUR OF A KIND!' : 'TEN!'

  return (
    <div className="burn-fx" key={active.at} aria-live="polite">
      <div className="burn-flash" />
      <div className="burn-glow" />

      <div className="burn-cards">
        {cards.map((c, i) => (
          <div
            key={c.id}
            className="burn-card"
            style={{ '--i': i, '--n': cards.length }}
          >
            <CardFace label={c.label} red={c.red} />
            <div className="burn-char" />
            <div className="burn-edge" />
          </div>
        ))}
      </div>

      <div className="burn-flames">
        {FLAMES.map((f, i) => (
          <span
            key={i}
            className="burn-flame"
            style={{ left: `${f.left}%`, width: f.size, height: f.size * 1.6, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s` }}
          />
        ))}
      </div>

      {SMOKE.map((s, i) => (
        <span key={i} className="burn-smoke" style={{ left: `${s.left}%`, animationDelay: `${s.delay}s` }} />
      ))}

      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="burn-ember"
          style={{ left: `${e.left}%`, width: e.size, height: e.size, '--dx': `${e.drift}px`, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s` }}
        />
      ))}

      <div className="burn-text">
        <div className="burn-title">BURN!</div>
        <div className="burn-why">{why}</div>
        <div className="burn-sub">🔥 {active.by} torched {active.count} card{active.count === 1 ? '' : 's'}</div>
      </div>
    </div>
  )
}
