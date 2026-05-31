import { rankOf, suitOf } from '../../lib/cards'
import { dealToPlayers } from '../../engine/table'
import { beginTurns } from '../../engine/turns'

// Set up Crazy Eights: deal hands, flip one starter card onto the discard pile,
// start turns, and clear the chosen-suit + message state.
export function setupCrazyEights({ storage, playerIds, count }) {
  dealToPlayers(storage, playerIds, count)
  beginTurns(storage, playerIds)
  const deck = storage.get('deck')
  const discard = storage.get('discardPile')
  if (deck.length > 0) {
    const starter = deck.get(0)
    deck.delete(0)
    discard.insert(starter, 0)
  }
  storage.set('declaredSuit', '')
  const la = storage.get('lastAction')
  la.set('message', '')
  la.set('id', 0)
}

// ── Crazy Eights rule: can this card be played? ────────────
// You may play a card if it matches the top card's rank or suit. 8s are wild
// and can always be played. After an 8, `declaredSuit` is the suit the player
// chose, so the next card must match that instead of the 8's printed suit.
export function isPlayable(card, topCard, declaredSuit) {
  if (!topCard) return true
  if (rankOf(card) === '8') return true
  const suitToMatch = declaredSuit || suitOf(topCard)
  return rankOf(card) === rankOf(topCard) || suitOf(card) === suitToMatch
}
