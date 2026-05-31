// A pop-up that explains how to play a game. It reads the `rules` from the
// game's registry entry, so every game gets instructions for free.
//   rules = { objective, howTo: [steps...], win }
export default function HowToPlay({ game, open, onClose }) {
  if (!open || !game?.rules) return null
  const { objective, howTo = [], win } = game.rules
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{game.emoji} How to play {game.name}</div>

        {objective && (
          <div className="rules-block">
            <div className="rules-heading">🎯 Goal</div>
            <p className="rules-text">{objective}</p>
          </div>
        )}

        {howTo.length > 0 && (
          <div className="rules-block">
            <div className="rules-heading">▶️ How it works</div>
            <ol className="rules-steps">
              {howTo.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </div>
        )}

        {win && (
          <div className="rules-block">
            <div className="rules-heading">🏆 Winning</div>
            <p className="rules-text">{win}</p>
          </div>
        )}

        <button className="big-btn create-btn" onClick={onClose}>Got it!</button>
      </div>
    </div>
  )
}
