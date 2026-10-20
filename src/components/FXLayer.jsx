import { useState, useEffect } from 'react'
import { useStorage } from '../liveblocks.config'
import { playSfx, buzz } from '../lib/sfx'
import CardFace from './CardFace'
import CardBack from './CardBack'
import { rand } from '../lib/looks'
import { useCalm } from '../lib/motion'

// ── ✨ Special effects ─────────────────────────────────────
// FXLayer sits on top of every game board. When a move is announced with an
// effect (engine/announce.js), every phone plays it once. Kinds of effect:
//
//   slam   — a huge title that slams onto the screen: { title, sub, emoji,
//            tone, cards, confetti, shake, big }. `who` + `titleMe`/`subMe`
//            give that player their own wording ("YOU got it!")
//   fly    — cards flying between players: { from, to, count | cards }
//            (a player's name, or '@pile' / '@deck' for spots on the table)
//   bubble — a speech bubble over a player: { at, text }
//   ask    — Go Fish's "Got any 7s?" → YES! / GO FISH! show
//
// All of them let taps through, so nobody's turn is ever blocked.
// In calm mode (✨ off in the top bar) titles and bubbles still show, but
// nothing flies, spins, shakes or rains down.

const DURATION = { slam: 1900, fly: 1500, bubble: 1900, ask: 3600, shake: 700 }
function durationOf(spec) {
  if (spec.kind === 'slam' && spec.big) return 2700
  if (spec.kind === 'ask' && spec.books?.length) return 4300
  return (DURATION[spec.kind] ?? 2000) + (spec.delay ?? 0) * 1000
}

// Where on screen is a player (or a spot on the table)? Opponents are found by
// their seat (`data-seat`), spots by `data-spot`, and you are your hand.
function pointOf(who, myId) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const centre = (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  if (who === myId) {
    const hand = document.querySelector('.hand')
    if (hand) {
      const r = hand.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: Math.min(vh - 80, r.bottom - 70) }
    }
    return { x: vw / 2, y: vh - 90 }
  }
  if (typeof who === 'string' && who.startsWith('@')) {
    const spot = document.querySelector(`[data-spot="${who.slice(1)}"]`)
    return spot ? centre(spot) : { x: vw / 2, y: vh * 0.42 }
  }
  const seat = [...document.querySelectorAll('[data-seat]')].find((el) => el.dataset.seat === who)
  return seat ? centre(seat) : { x: vw / 2, y: 110 }
}

// Shake the table for a moment.
function useShake(on) {
  const calm = useCalm()
  useEffect(() => {
    if (!on || calm) return
    document.body.classList.add('fx-shake')
    const t = setTimeout(() => document.body.classList.remove('fx-shake'), 650)
    return () => { clearTimeout(t); document.body.classList.remove('fx-shake') }
  }, [on, calm])
}

// Play a sound when an effect appears (optionally a little later).
function useSound(name, delay = 0) {
  useEffect(() => {
    if (!name) return
    if (!delay) { playSfx(name); return }
    const t = setTimeout(() => playSfx(name), delay)
    return () => clearTimeout(t)
  }, [name, delay])
}

const PALETTE = ['#FF9F0A', '#30D158', '#0A84FF', '#FF375F', '#BF5AF2', '#FFD60A', '#64D2FF']

// Paper confetti (or raining emoji, e.g. 💩) falling down the screen.
export function Confetti({ count = 60, emoji, loop = false }) {
  const calm = useCalm()
  if (calm) return null
  return (
    <div className={`confetti${loop ? ' loop' : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={emoji ? 'confetti-emoji' : 'confetti-bit'}
          style={{
            left: `${rand(i + 1) * 100}%`,
            background: emoji ? undefined : PALETTE[i % PALETTE.length],
            animationDelay: `${rand(i + 40) * (loop ? 3 : 0.5)}s`,
            animationDuration: `${(loop ? 2.6 : 1.6) + rand(i + 80) * 1.4}s`,
            '--drift': `${(rand(i + 120) - 0.5) * 160}px`,
            '--spin': `${360 + rand(i + 160) * 720}deg`,
            width: emoji ? undefined : 6 + rand(i + 200) * 6,
            height: emoji ? undefined : 9 + rand(i + 240) * 8,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  )
}

function Slam({ spec, myId }) {
  const { tone = 'gold', emoji, red, cards, burst = true, confetti, shake, big, who } = spec
  const isMe = who && who === myId
  const title = (isMe && spec.titleMe) || spec.title
  const sub = (isMe && spec.subMe) || spec.sub
  const calm = useCalm()
  useShake(shake)
  useSound(spec.sound === undefined ? 'slam' : spec.sound) // sound: null = silent
  useEffect(() => { if (shake) buzz([40, 30, 80]) }, [shake])
  return (
    <div className={`fx fx-slam tone-${tone}${big ? ' big' : ''}`}>
      <div className="fx-dim" />
      {burst && !calm && <div className="fx-burst" />}
      <div className="fx-slam-box">
        {emoji && <div className={`fx-emoji${red ? ' red' : ''}`}>{emoji}</div>}
        <div className="fx-title">{title}</div>
        {cards?.length > 0 && (
          <div className="fx-cards">
            {cards.map((c, i) => (
              <div key={c.id ?? i} className="fx-card" style={{ '--i': i, '--n': cards.length }}>
                <CardFace label={c.label} red={c.red} />
              </div>
            ))}
          </div>
        )}
        {sub && <div className="fx-sub">{sub}</div>}
      </div>
      {confetti && <Confetti />}
    </div>
  )
}

function Fly({ spec, myId }) {
  const calm = useCalm()
  // Work out the start and end points once, when the effect appears.
  const [path] = useState(() => ({ a: pointOf(spec.from, myId), b: pointOf(spec.to, myId) }))
  useSound(spec.sound === undefined ? 'whoosh' : spec.sound, (spec.delay ?? 0) * 1000)
  const faces = spec.cards ?? null
  const n = faces ? faces.length : Math.min(spec.count ?? 1, 8)
  const { a, b } = path
  if (calm) return null
  return (
    <div className="fx fx-fly mini-cards">
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="fly-card"
          style={{
            left: a.x,
            top: a.y,
            '--dx': `${b.x - a.x}px`,
            '--dy': `${b.y - a.y}px`,
            '--rot': `${(rand(i + 7) - 0.5) * 50}deg`,
            animationDelay: `${(spec.delay ?? 0) + i * 0.08}s`,
          }}
        >
          {faces ? <CardFace label={faces[i].label} red={faces[i].red} /> : <CardBack />}
        </div>
      ))}
    </div>
  )
}

function Bubble({ spec, myId }) {
  const [p] = useState(() => pointOf(spec.at, myId))
  useSound(spec.sound === undefined ? 'pop' : spec.sound)
  return (
    <div className="fx">
      <div className={`fx-bubble${p.y < 200 ? ' below' : ''}`} style={{ left: p.x, top: p.y }}>{spec.text}</div>
    </div>
  )
}

// 🎣 Go Fish: the question pops up for everyone, then the answer stamps down.
function Ask({ spec, myId }) {
  const { asker, target, rank, result, cards = [], books = [] } = spec
  const askerName = asker === myId ? 'You' : asker
  const targetName = target === myId ? 'YOU' : target
  const resultSound = { got: 'cash', fish: 'fish', lucky: 'fish', empty: 'fish' }[result]
  useSound('pop')
  useSound(resultSound, 1050)
  useSound(result === 'lucky' ? 'ding' : null, 1900)
  useSound(books.length ? 'fanfare' : null, 2300)

  let stamp = 'GO FISH! 🎣'
  if (result === 'got') stamp = `YES! ${cards.length}× ${rank} ✋`
  if (result === 'empty') stamp = 'GO FISH! (pond is empty)'

  return (
    <div className={`fx fx-ask result-${result}`}>
      <div className="fx-dim soft" />
      <div className="ask-bubble">
        <div className="ask-who"><b>{askerName}</b> {asker === myId ? 'ask' : 'asks'} <b>{targetName}</b></div>
        <div className="ask-q">Got any <span className="ask-rank">{rank}</span>s?</div>
        <div className={`ask-stamp stamp-${result === 'got' ? 'yes' : 'no'}`}>{stamp}</div>
        {result === 'lucky' && <div className="ask-stamp stamp-lucky">LUCKY CATCH! It's a {rank}! 🍀</div>}
      </div>
      {result !== 'got' && (
        <div className="fish-water">
          <span className="fish-swim">🐟</span>
          <span className="fish-swim two">🐠</span>
        </div>
      )}
      {result === 'got' && <Fly spec={{ from: target, to: asker, cards, delay: 1.1, sound: null }} myId={myId} />}
      {result !== 'got' && result !== 'empty' && <Fly spec={{ from: '@pond', to: asker, count: 1, delay: 1.4, sound: null }} myId={myId} />}
      {books.length > 0 && (
        <>
          <div className="ask-book">📚 BOOK! Four {books.join('s & four ')}s</div>
          <Confetti count={40} />
        </>
      )}
    </div>
  )
}

function Shake() {
  useShake(true)
  return null
}

const KINDS = { slam: Slam, fly: Fly, bubble: Bubble, ask: Ask, shake: Shake }

export default function FXLayer({ myId }) {
  const fx = useStorage((root) => root.lastAction?.fx ?? null)
  // Ignore an effect that was already there when this screen opened (e.g.
  // after rejoining) — only NEW moves get the show.
  const [seenKey, setSeenKey] = useState(fx?.key ?? null)
  const [active, setActive] = useState(null)
  if (fx?.key && fx.key !== seenKey) {
    setSeenKey(fx.key)
    setActive(fx)
  }

  const mine = (active?.show ?? []).filter((s) => KINDS[s.kind] && (!s.to || s.to === myId))
  const longest = mine.reduce((m, s) => Math.max(m, durationOf(s)), 0)
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setActive(null), longest || 1)
    return () => clearTimeout(t)
  }, [active, longest])

  if (!active) return null
  return (
    <div className="fx-layer" key={active.key}>
      {mine.map((spec, i) => {
        const Kind = KINDS[spec.kind]
        return <Kind key={i} spec={spec} myId={myId} />
      })}
    </div>
  )
}

// For boards that trigger an effect themselves (like Snap's instant SNAP!).
export function FXShow({ spec, myId }) {
  const Kind = KINDS[spec.kind]
  return Kind ? <div className="fx-layer"><Kind spec={spec} myId={myId} /></div> : null
}
