// ── The card table: shared deck / hands / discard actions ──
//
// These are the moves almost every card game needs. Games pick the ones they
// want instead of writing them again. Pure helpers (resetTable, dealToPlayers)
// run inside a setup mutation; useCardTable() hands a board the live actions.

import { useMutation } from '../liveblocks.config'
import { buildShuffledDeck, sortCards } from '../lib/cards'

// Clear the table back to empty. Run this first when (re)starting a game.
export function resetTable(storage) {
  const deck = storage.get('deck')
  const discard = storage.get('discardPile')
  const order = storage.get('playerOrder')
  while (deck.length > 0) deck.delete(0)
  while (discard.length > 0) discard.delete(0)
  while (order.length > 0) order.delete(0)
}

// Deal `count` cards to each player. Whatever is left becomes the draw pile.
// Pass your own `deck` to deal from a custom set of cards (defaults to a fresh
// shuffled 52).
export function dealToPlayers(storage, playerIds, count, deck = buildShuffledDeck()) {
  const deckList = storage.get('deck')
  const hands = storage.get('hands')
  let i = 0
  for (const playerId of playerIds) {
    hands.set(String(playerId), deck.slice(i, i + count))
    i += count
  }
  deck.slice(i).forEach((card) => deckList.push(card))
}

// Deal the WHOLE deck out, one card at a time, round-robin. Nothing is left in
// the draw pile — used by games where everyone holds a stack (Snap, Sevens...).
export function dealAll(storage, playerIds, deck = buildShuffledDeck()) {
  const hands = storage.get('hands')
  const piles = playerIds.map(() => [])
  deck.forEach((card, i) => piles[i % playerIds.length].push(card))
  playerIds.forEach((id, i) => hands.set(String(id), piles[i]))
}

// All the common in-game actions a board might need. Each takes the player id
// of whoever is acting, so the same action works for any player.
export function useCardTable() {
  const drawCard = useMutation(({ storage }, id) => {
    const deck = storage.get('deck')
    if (deck.length === 0) return
    const card = deck.get(0)
    deck.delete(0)
    const hands = storage.get('hands')
    hands.set(id, [...(hands.get(id) ?? []), card])
  }, [])

  const playCard = useMutation(({ storage }, { id, cardId }) => {
    const hands = storage.get('hands')
    const discard = storage.get('discardPile')
    const hand = hands.get(id) ?? []
    const card = hand.find((c) => c.id === cardId)
    if (!card) return
    hands.set(id, hand.filter((c) => c.id !== cardId))
    discard.insert(card, 0)
  }, [])

  const undoPlay = useMutation(({ storage }, id) => {
    const discard = storage.get('discardPile')
    if (discard.length === 0) return
    const card = discard.get(0)
    discard.delete(0)
    const hands = storage.get('hands')
    hands.set(id, [...(hands.get(id) ?? []), card])
  }, [])

  const shuffleDiscardIntoDeck = useMutation(({ storage }) => {
    const deck = storage.get('deck')
    const discard = storage.get('discardPile')
    if (discard.length <= 1) return
    const cardsToShuffle = []
    for (let i = 1; i < discard.length; i++) cardsToShuffle.push(discard.get(i))
    while (discard.length > 1) discard.delete(1)
    cardsToShuffle.sort(() => Math.random() - 0.5).forEach((card) => deck.push(card))
  }, [])

  const sortHand = useMutation(({ storage }, id) => {
    const hands = storage.get('hands')
    hands.set(id, sortCards(hands.get(id) ?? []))
  }, [])

  return { drawCard, playCard, undoPlay, shuffleDiscardIntoDeck, sortHand }
}
