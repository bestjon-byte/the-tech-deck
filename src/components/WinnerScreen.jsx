import { useContext, useEffect } from 'react'
import { GameContext } from './GameContext'
import { Confetti } from './FXLayer'
import { playSfx } from '../lib/sfx'
import { useCalm } from '../lib/motion'
import { StakesSummary } from './Stakes'

// Shown when a game finishes. Pass a title and an optional scoreboard
// (already sorted best-first); the top three get medals (a score's own
// `medal` wins — e.g. 💩 for the Shithead). The host also gets
// "Play again" / "Choose game" buttons (wired through GameContext) so a new
// round can start without making a new room.
//   rain — an emoji to rain down instead of confetti (Shithead rains 💩)
export default function WinnerScreen({ emoji = '🏆', title, scores, onLeave, rain }) {
  const ctx = useContext(GameContext)
  const calm = useCalm()
  useEffect(() => { playSfx('fanfare') }, [])
  return (
    <div className="lobby winner-screen">
      <Confetti count={rain ? 26 : 70} emoji={rain} loop />
      {!calm && <div className="winner-rays" />}
      <div className="landing-logo winner-trophy">{emoji}</div>
      <h2 className="winner-title">{title}</h2>
      {scores && scores.length > 0 && (
        <div className="score-list">
          {scores.map((s, i) => (
            <div key={s.name} className="score-item" style={{ '--i': i }}>
              <span className="score-medal">{s.medal ?? ['🥇', '🥈', '🥉'][i] ?? '🃏'}</span>
              <span className="score-name">{s.name}</span>
              <span className="score-books">{s.detail}</span>
            </div>
          ))}
        </div>
      )}

      <StakesSummary myId={ctx?.myId} />

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
