import { useContext, useState, useEffect, useRef } from 'react'
import { GameContext } from './GameContext'
import { isMuted, setMuted, playSfx } from '../lib/sfx'
import { useCalm, setCalm } from '../lib/motion'
import { useBank, bankToBring } from '../lib/bank'
import { useStorage } from '../liveblocks.config'

// The bar across the top of every game board: Leave button, a sound on/off
// button, an animations on/off button (✨ / 🧘 calm mode), a ? help button (which opens the game's instructions),
// your 💰 chips, and the room code.
// Leave needs two taps ("Leave?"), so a stray thumb can't drop you out of a game.
export default function TopBar({ roomCode, onLeave }) {
  const ctx = useContext(GameContext)
  const [muted, setMutedState] = useState(isMuted)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const calm = useCalm()
  const stake = useStorage((root) => root.stakes?.unit ?? 0)

  useEffect(() => {
    if (!confirmLeave) return
    const t = setTimeout(() => setConfirmLeave(false), 2500)
    return () => clearTimeout(t)
  }, [confirmLeave])

  function toggleSound() {
    setMuted(!muted)
    setMutedState(!muted)
    if (muted) playSfx('pop') // a little blip so you know sound is back on
  }

  return (
    <div className="top-bar">
      <button
        className={`leave-btn${confirmLeave ? ' confirm' : ''}`}
        onClick={() => (confirmLeave ? onLeave() : setConfirmLeave(true))}
      >
        {confirmLeave ? 'Leave?' : '← Leave'}
      </button>
      <div className="top-bar-right">
        <button className="help-btn" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="help-btn" onClick={() => setCalm(!calm)} aria-label={calm ? 'Turn animations on' : 'Turn animations off'}>
          {calm ? '🧘' : '✨'}
        </button>
        {ctx?.openHelp && (
          <button className="help-btn" onClick={ctx.openHelp} aria-label="How to play">?</button>
        )}
        {!ctx?.game?.bank && <ChipsPill stake={stake} />}
        <div className="game-code">{roomCode}</div>
      </div>
    </div>
  )
}

// 💰 How many chips this phone has (lib/bank.js), live. When a payout lands the
// new total shows with a +50 / −20 popping out of it. Playing for chips? The
// stake per point sits underneath. Poker hides it: its dock shows your stack.
function ChipsPill({ stake }) {
  useBank() // re-render when the bank changes
  const chips = bankToBring()
  const last = useRef(chips)
  const [change, setChange] = useState(null) // { amount, key }

  useEffect(() => {
    const amount = chips - last.current
    last.current = chips
    if (!amount) return
    setChange({ amount, key: Date.now() })
    const t = setTimeout(() => setChange(null), 2200)
    return () => clearTimeout(t)
  }, [chips])

  return (
    <div className={`chips-pill${change ? (change.amount > 0 ? ' up' : ' down') : ''}`} aria-label={`You have ${chips.toLocaleString()} chips`}>
      <span className="chips-total">💰 {shortChips(chips)}</span>
      {stake > 0 && <span className="chips-stake">{stake}/pt</span>}
      {change && (
        <span key={change.key} className="chips-change">
          {change.amount > 0 ? '+' : '−'}{Math.abs(change.amount).toLocaleString()}
        </span>
      )}
    </div>
  )
}

// 12,345 fits; 123,456 → 123k; 1,234,567 → 1.2m (the top bar is narrow)
function shortChips(n) {
  if (n < 100000) return n.toLocaleString()
  if (n < 1000000) return `${Math.floor(n / 1000)}k`
  return `${Math.floor(n / 100000) / 10}m`
}
