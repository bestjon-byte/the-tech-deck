import { useState } from 'react'
import { sortCards } from '../lib/cards'
import CardFace from './CardFace'

// The player's own hand of cards along the bottom of the screen.
// It's flexible so different games can reuse it:
//   onCardClick(card)   — what happens when a card is tapped
//   isHighlighted(card) — return true to make a card glow (optional)
//   isPicked(card)      — return true to give a card the lifted "selected" look (optional)
//   isGlass(card)       — return true to draw a card as see-through glass (optional)
//   showSort            — show a Sort button (optional)
//   sortWith(cards)     — how to sort, if the game has its own card order (optional, defaults to A→K)
//   hint                — small text shown next to the Sort button (optional)
//
// Sorting only changes the order cards are SHOWN on your own screen — it never
// saves anything to Liveblocks. That keeps it instant, and it can't clash with
// another player taking a card from your hand at the same moment (which used
// to copy that card into both hands!).
export default function Hand({ cards, onCardClick, isHighlighted, isPicked, isGlass, showSort, sortWith = sortCards, hint }) {
  const [sorted, setSorted] = useState(false)
  const shown = sorted ? sortWith(cards) : cards

  return (
    <div className="hand">
      {cards.length > 1 && (showSort || hint) && (
        <div className="hand-controls">
          {hint && <span className="hand-hint">{hint}</span>}
          {showSort && (
            <button className="action-btn sort-btn" onClick={() => setSorted(!sorted)}>
              {sorted ? 'Sorted ✓' : 'Sort'}
            </button>
          )}
        </div>
      )}
      <div className="hand-scroll">
        <div className="hand-inner">
          {shown.map((card) => (
            <CardFace
              key={card.id}
              label={card.label}
              red={card.red}
              highlight={isHighlighted ? isHighlighted(card) : false}
              picked={isPicked ? isPicked(card) : false}
              glass={isGlass ? isGlass(card) : false}
              onClick={onCardClick ? () => onCardClick(card) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
