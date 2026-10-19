import { useContext, useState, useEffect } from 'react'
import { GameContext } from './GameContext'
import { isMuted, setMuted, playSfx } from '../lib/sfx'
import { useCalm, setCalm } from '../lib/motion'
import { useStorage } from '../liveblocks.config'

// The bar across the top of every game board: Leave button, a sound on/off
// button, an animations on/off button (✨ / 🧘 calm mode), a ? help button (which opens the game's instructions), and the room code.
// Leave needs two taps ("Sure?"), so a stray thumb can't drop you out of a game.
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
        {confirmLeave ? 'Leave? Tap again' : '← Leave'}
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
        {stake > 0 && <div className="stakes-badge" title="Playing for chips">💰{stake}</div>}
        <div className="game-code">{roomCode}</div>
      </div>
    </div>
  )
}
