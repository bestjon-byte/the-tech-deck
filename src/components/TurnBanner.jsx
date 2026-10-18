import { useEffect } from 'react'
import { playSfx, buzz } from '../lib/sfx'

// Shows whose turn it is. Any turn-based game can drop this in.
//   isMyTurn    — true if it's the local player's turn
//   currentTurn — the name of whoever's turn it is
//   emoji       — a little icon for the game (e.g. 🎣)
//   text        — optional: say something else instead (e.g. "Swap cards")
// When it becomes YOUR turn the banner pops and plays a little chime.
export default function TurnBanner({ isMyTurn, currentTurn, emoji = '🎲', text }) {
  useEffect(() => {
    if (!isMyTurn) return
    playSfx('turn')
    buzz(30)
  }, [isMyTurn])

  return (
    <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`}>
      {/* the key makes the pop animation replay whenever the turn changes */}
      <span key={`${isMyTurn}-${currentTurn}`} className="turn-text">
        {text ?? (isMyTurn ? `${emoji} Your turn!` : `⏳ ${currentTurn}'s turn…`)}
      </span>
    </div>
  )
}
