import CardFace from './CardFace'

// The player's own hand of cards along the bottom of the screen.
// It's flexible so different games can reuse it:
//   onCardClick(card)   — what happens when a card is tapped
//   isHighlighted(card) — return true to make a card glow (optional)
//   isGlass(card)       — return true to draw a card as see-through glass (optional)
//   showSort / onSort   — show a Sort button and what it does (optional)
//   hint                — small text shown next to the Sort button (optional)
export default function Hand({ cards, onCardClick, isHighlighted, isGlass, showSort, onSort, hint }) {
  return (
    <div className="hand">
      {cards.length > 1 && (showSort || hint) && (
        <div className="hand-controls">
          {hint && <span className="hand-hint">{hint}</span>}
          {showSort && <button className="action-btn sort-btn" onClick={onSort}>Sort</button>}
        </div>
      )}
      <div className="hand-scroll">
        <div className="hand-inner">
          {cards.map((card) => (
            <CardFace
              key={card.id}
              label={card.label}
              red={card.red}
              highlight={isHighlighted ? isHighlighted(card) : false}
              glass={isGlass ? isGlass(card) : false}
              onClick={onCardClick ? () => onCardClick(card) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
