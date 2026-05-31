import { useContext } from 'react'
import { GameContext } from './GameContext'

// The bar across the top of every game board: Leave button, a ? help button
// (which opens the game's instructions), and the room code.
export default function TopBar({ roomCode, onLeave }) {
  const ctx = useContext(GameContext)
  return (
    <div className="top-bar">
      <button className="leave-btn" onClick={onLeave}>← Leave</button>
      <div className="top-bar-right">
        {ctx?.openHelp && (
          <button className="help-btn" onClick={ctx.openHelp} title="How to play">?</button>
        )}
        <div className="game-code">Room: {roomCode}</div>
      </div>
    </div>
  )
}
