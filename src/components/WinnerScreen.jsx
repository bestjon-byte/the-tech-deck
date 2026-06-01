import { useContext } from 'react'
import { GameContext } from './GameContext'

// Shown when a game finishes. Pass a title and an optional scoreboard
// (already sorted best-first); the top three get medals. The host also gets
// "Play again" / "Choose game" buttons (wired through GameContext) so a new
// round can start without making a new room.
export default function WinnerScreen({ emoji = '🏆', title, scores, onLeave }) {
  const ctx = useContext(GameContext)
  return (
    <div className="lobby">
      <div className="landing-logo">{emoji}</div>
      <h2>{title}</h2>
      {scores && scores.length > 0 && (
        <div className="score-list">
          {scores.map((s, i) => (
            <div key={s.name} className="score-item">
              <span className="score-medal">{['🥇', '🥈', '🥉'][i] ?? '🃏'}</span>
              <span className="score-name">{s.name}</span>
              <span className="score-books">{s.detail}</span>
            </div>
          ))}
        </div>
      )}

      <div className="lobby-actions">
        {ctx?.isCreator ? (
          <>
            <button className="big-btn create-btn" onClick={ctx.playAgain}>🔄 Play Again</button>
            <button className="big-btn join-btn" onClick={ctx.chooseGame}>🎮 Choose Game</button>
            <button className="big-btn back-btn" onClick={onLeave}>← Leave</button>
          </>
        ) : (
          <>
            <p className="lobby-sub">Waiting for the host to start a new round...</p>
            <button className="big-btn back-btn" onClick={onLeave}>← Leave</button>
          </>
        )}
      </div>
    </div>
  )
}
