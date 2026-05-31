// Shown when a game finishes. Pass a title and an optional scoreboard
// (already sorted best-first); the top three get medals.
export default function WinnerScreen({ emoji = '🏆', title, scores, onLeave }) {
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
      <button className="big-btn back-btn" onClick={onLeave}>Back to Menu</button>
    </div>
  )
}
