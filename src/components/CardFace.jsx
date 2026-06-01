import { rankOf, suitOf } from '../lib/cards'

// A real-looking playing card, face up. Used everywhere a card is shown.
//   highlight — give it a glow (e.g. the rank you've selected in Go Fish)
//   picked    — a "lifted" look for a chosen card
//   glass     — a see-through "pane of glass" look (Shithead's invisible 3s)
export default function CardFace({ label, red, onClick, highlight, picked, glass }) {
  const value = rankOf({ label })
  const suit = suitOf({ label })
  return (
    <div
      className={`card${red ? ' red' : ''}${highlight ? ' card-highlight' : ''}${picked ? ' card-picked' : ''}${glass ? ' card-glass' : ''}`}
      onClick={onClick}
    >
      <div className="card-corner card-tl">
        <div className="card-val">{value}</div>
        <div className="card-suit-sm">{suit}</div>
      </div>
      <div className="card-center-suit">{suit}</div>
      <div className="card-corner card-br">
        <div className="card-val">{value}</div>
        <div className="card-suit-sm">{suit}</div>
      </div>
    </div>
  )
}
