import { useState } from 'react'
import { sortCards, sortBySuit } from '../lib/cards'
import CardFace from './CardFace'

// The player's own hand of cards along the bottom of the screen.
// It's flexible so different games can reuse it:
//   onCardClick(card)   — what happens when a card is tapped
//   isHighlighted(card) — return true to make a card glow (optional)
//   isPicked(card)      — return true to give a card the lifted "selected" look (optional)
//   isGlass(card)       — return true to draw a card as see-through glass (optional)
//   showSort            — show the Sort buttons: by Number or by Suit (optional)
//   sortWith(cards)     — how to sort by number, if the game has its own card order (optional, defaults to A→K)
//   hint                — small text shown next to the Sort buttons (optional)
//
// Sorting only changes the order cards are SHOWN on your own screen — it never
// saves anything to Liveblocks. That keeps it instant, and it can't clash with
// another player taking a card from your hand at the same moment (which used
// to copy that card into both hands!). Your choice is remembered on the phone,
// so it carries on into the next game.
const SORT_KEY = 'tech-deck-sort'
function savedSort() {
  try { return localStorage.getItem(SORT_KEY) || 'off' } catch { return 'off' }
}

export default function Hand({ cards, onCardClick, isHighlighted, isPicked, isGlass, showSort, sortWith = sortCards, hint }) {
  const [sortMode, setSortMode] = useState(savedSort) // 'off' | 'number' | 'suit'
  const pickSort = (mode) => {
    const next = sortMode === mode ? 'off' : mode // tap the lit one again to un-sort
    setSortMode(next)
    try { localStorage.setItem(SORT_KEY, next) } catch { /* ignore */ }
  }
  let shown = cards
  if (showSort && sortMode === 'number') shown = sortWith(cards)
  if (showSort && sortMode === 'suit') shown = sortBySuit(cards, sortWith)

  return (
    <div className="hand">
      {cards.length > 0 && (showSort || hint) && (
        <div className="hand-controls">
          {hint && <span className="hand-hint">{hint}</span>}
          {showSort && cards.length > 1 && (
            <div className="sort-group" role="group" aria-label="Sort your hand">
              <span className="sort-label">Sort</span>
              <button className={`action-btn sort-btn${sortMode === 'number' ? ' on' : ''}`} aria-pressed={sortMode === 'number'} onClick={() => pickSort('number')}>
                1 2 3
              </button>
              <button className={`action-btn sort-btn${sortMode === 'suit' ? ' on' : ''}`} aria-pressed={sortMode === 'suit'} onClick={() => pickSort('suit')}>
                ♠<span className="sort-red">♥</span>♣<span className="sort-red">♦</span>
              </button>
            </div>
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
