// ── Card building blocks ──────────────────────────────────
// Everything about a deck of cards lives here so every game can share it.
// A card is always the shape: { id, label, red }
//   id    — a unique number (use this as the React key, NEVER the label)
//   label — like "10♥" or "A♠" (value + suit stuck together)
//   red   — true for ♥ and ♦ so they can be drawn in red

export const SUITS = ['♠', '♥', '♦', '♣']
export const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const SUIT_ORDER = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 }
const VALUE_ORDER = { 'A': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '10': 9, 'J': 10, 'Q': 11, 'K': 12 }

// The rank ("10") and suit ("♥") of a card label. Handy because "10" is two
// characters, so we can't just grab the first/last letter everywhere.
export function rankOf(card) { return card.label.slice(0, -1) }
export function suitOf(card) { return card.label.slice(-1) }

// Make a full 52-card deck and shuffle it.
export function buildShuffledDeck() {
  const deck = []
  let id = 0
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ id: id++, label: value + suit, red: suit === '♥' || suit === '♦' })
    }
  }
  return deck.sort(() => Math.random() - 0.5)
}

// Sort a hand by value (A→K), then by suit as a tie-breaker.
export function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const valA = rankOf(a), valB = rankOf(b)
    if ((VALUE_ORDER[valA] ?? 0) !== (VALUE_ORDER[valB] ?? 0)) return (VALUE_ORDER[valA] ?? 0) - (VALUE_ORDER[valB] ?? 0)
    return SUIT_ORDER[suitOf(a)] - SUIT_ORDER[suitOf(b)]
  })
}

// Sort by a game's own card values (e.g. Aces high), suit as a tie-breaker.
//   sortByValue(cards, (card) => myValue(card))
export function sortByValue(cards, valueOf) {
  return [...cards].sort((a, b) => (valueOf(a) - valueOf(b)) || (SUIT_ORDER[suitOf(a)] - SUIT_ORDER[suitOf(b)]))
}

// Group a hand into suits (♠ ♥ ♣ ♦ — black/red/black/red so the groups are easy
// to tell apart), each suit in number order. `byRank` is the game's own
// number sort, so Aces-high games keep their Aces at the top of each suit.
const SUIT_GROUP = { '♠': 0, '♥': 1, '♣': 2, '♦': 3 }
export function sortBySuit(cards, byRank = sortCards) {
  return byRank(cards).sort((a, b) => SUIT_GROUP[suitOf(a)] - SUIT_GROUP[suitOf(b)]) // sort is stable, so number order stays inside each suit
}

// "1 card" / "5 cards"
export const nCards = (n) => `${n} card${n === 1 ? '' : 's'}`
