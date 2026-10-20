import { LiveObject } from '../../liveblocks.config'
import { SUITS, rankOf, suitOf, nCards } from '../../lib/cards'
import { dealToPlayers } from '../../engine/table'
import { beginTurns, readPlayerOrder } from '../../engine/turns'
import { announce, clearAnnouncements } from '../../engine/announce'

// ── Black Jack 🖤 ──────────────────────────────────────────
// Like Crazy Eights / Uno: match the suit or number of the top card and be
// the first to get rid of your hand. The magic cards:
//   2          — next player picks up 2 (they can pass it on with another pick-up card)
//   Black Jack — next player picks up 7 (stacks with 2s and other Black Jacks)
//   Red Jack   — cancels the whole pick-up waiting for you
//   3          — invisible: play it on anything, the card underneath still counts
//   7          — reverses the direction of play
//   8          — the next player misses a go
//   Ace        — wild: play it on anything and choose the next suit
// You can play several cards of the same number in one go (two 2s = pick up 4).
//
// State in `blackJack`: { dir: 1 | -1, pickup: cards waiting to be picked up,
// suit: the suit an Ace asked for ('' = none) }. The pile is `discardPile`
// with the top card at index 0 (like Crazy Eights).

const TRICKS = ['2', '3', '7', '8', 'J', 'A']
export const PICKUP_2 = 2
export const PICKUP_BLACK_JACK = 7

export const isBlackJack = (c) => rankOf(c) === 'J' && !c.red
export const isRedJack = (c) => rankOf(c) === 'J' && c.red
export const isInvisible = (c) => !!c && rankOf(c) === '3'
const isTrick = (c) => TRICKS.includes(rankOf(c))

// Set up: deal 7 each (5 when the table's too big for 7), flip a plain
// starter card — magic cards go back under the deck — and start turns.
export function setupBlackJack({ storage, playerIds, count }) {
  dealToPlayers(storage, playerIds, count)
  beginTurns(storage, playerIds)
  const deck = storage.get('deck')
  const discard = storage.get('discardPile')
  for (let guard = 0; guard < deck.length; guard++) {
    if (!isTrick(deck.get(0))) break
    const magic = deck.get(0) // a magic card can't start the game — bury it
    deck.delete(0)
    deck.push(magic)
  }
  if (deck.length > 0) { // (only magic cards left? then it's just a plain card)
    discard.insert(deck.get(0), 0)
    deck.delete(0)
  }
  storage.set('blackJack', new LiveObject({ dir: 1, pickup: 0, suit: '' }))
  clearAnnouncements(storage)
}

// The card you actually have to match: the top of the pile, looking straight
// through any invisible 3s. `pile` is a plain array, top card first.
export function effectiveTop(pile) {
  return pile.find((c) => !isInvisible(c)) ?? null
}

// Can this card START a play? (Any more cards in the same go just have to be
// the same number as it.) `table` = { top, suit, pickup }.
export function canStart(card, { top, suit, pickup }) {
  const r = rankOf(card)
  if (pickup > 0) return r === '2' || r === 'J' // pass it on, or a Red Jack cancels it
  if (r === '3' || r === 'A') return true
  if (!top) return true
  return r === rankOf(top) || suitOf(card) === (suit || suitOf(top))
}

// Is `cards` (in the order they'll be laid down) a legal play?
export function isLegalPlay(cards, table) {
  if (cards.length === 0 || !canStart(cards[0], table)) return false
  const r = rankOf(cards[0])
  return cards.every((c) => rankOf(c) === r)
}

// Every card in the hand that could start a play.
export function startableCards(hand, table) {
  return hand.filter((c) => canStart(c, table))
}

// What a play does. Returns the new pick-up total, how many players miss a
// go, and whether play reverses. Red Jacks count first, so J♥ + J♠ on a
// pick-up cancels it and then hits the next player with 7.
export function effectsOf(cards, pickup) {
  const r = rankOf(cards[0])
  let total = pickup
  if (r === '2') total += PICKUP_2 * cards.length
  if (r === 'J') {
    if (cards.some(isRedJack)) total = 0
    total += PICKUP_BLACK_JACK * cards.filter(isBlackJack).length
  }
  return {
    pickup: total,
    cancelled: r === 'J' && pickup > 0 && cards.some(isRedJack),
    skips: r === '8' ? cards.length : 0,
    reverse: r === '7' && cards.length % 2 === 1, // two 7s turn it round and back again
  }
}

// Who's next: walk `steps` seats from `from` in direction `dir`.
export function seatAfter(order, from, dir, steps = 1) {
  const n = order.length
  const i = order.indexOf(from)
  if (n === 0) return ''
  if (i < 0) return order[0]
  return order[(((i + dir * steps) % n) + n) % n]
}

// Draw `n` cards for a player, shuffling the pile back into the deck if it
// runs out (keeping the top card, and any 3s sitting on it, on the table).
// Returns the cards drawn (fewer than `n` if there truly are none left).
export function drawCards(storage, id, n) {
  const deck = storage.get('deck')
  const discard = storage.get('discardPile')
  const handsObj = storage.get('hands')
  const drawn = []
  for (let k = 0; k < n; k++) {
    if (deck.length === 0) {
      let keep = 0 // how many cards stay on the pile: the 3s on top + the real card
      while (keep < discard.length && isInvisible(discard.get(keep))) keep++
      keep++
      const recycled = []
      for (let i = keep; i < discard.length; i++) recycled.push(discard.get(i))
      while (discard.length > keep) discard.delete(keep)
      recycled.sort(() => Math.random() - 0.5).forEach((c) => deck.push(c))
    }
    if (deck.length === 0) break
    drawn.push(deck.get(0))
    deck.delete(0)
  }
  if (drawn.length) handsObj.set(id, [...(handsObj.get(id) ?? []), ...drawn])
  return drawn
}

// ── Moves (run inside mutations — by players AND bots) ─────
const isRed = (suit) => suit === '♥' || suit === '♦'

// Read the table inside a mutation: the pile (top first) and what's waiting.
export function readTable(storage) {
  const bj = storage.get('blackJack')
  const discard = storage.get('discardPile')
  const pile = []
  for (let i = 0; i < discard.length; i++) pile.push(discard.get(i))
  return { top: effectiveTop(pile), suit: bj.get('suit') ?? '', pickup: bj.get('pickup') ?? 0, dir: bj.get('dir') ?? 1 }
}

export function gameOver(storage) {
  const handsObj = storage.get('hands')
  return readPlayerOrder(storage).some((p) => (handsObj.get(p) ?? []).length === 0)
}

// Pass the turn on one seat in the current direction.
function passTurn(storage, id) {
  const dir = storage.get('blackJack').get('dir') ?? 1
  storage.set('currentTurn', seatAfter(readPlayerOrder(storage), id, dir))
}

// Play one card, or several of the same number. Used by players AND bots.
export function doPlay(storage, { id, cardIds, suit }) {
  if (storage.get('currentTurn') !== id || gameOver(storage)) return
  const bj = storage.get('blackJack')
  const handsObj = storage.get('hands')
  const discard = storage.get('discardPile')
  const hand = handsObj.get(id) ?? []
  const cards = cardIds.map((cid) => hand.find((c) => c.id === cid)).filter(Boolean)
  const table = readTable(storage)
  if (cards.length !== cardIds.length || !isLegalPlay(cards, table)) return

  const played = new Set(cardIds)
  handsObj.set(id, hand.filter((c) => !played.has(c.id)))
  cards.forEach((c) => discard.insert(c, 0)) // the last card laid ends up on top

  const r = rankOf(cards[0])
  const eff = effectsOf(cards, table.pickup)
  bj.set('pickup', eff.pickup)
  if (r === 'A') bj.set('suit', SUITS.includes(suit) ? suit : suitOf(cards[cards.length - 1]))
  else if (r !== '3') bj.set('suit', '') // a 3 is invisible, so an Ace's suit still stands
  let dir = bj.get('dir') ?? 1
  if (eff.reverse) { dir = -dir; bj.set('dir', dir) }

  const order = readPlayerOrder(storage)
  const left = (handsObj.get(id) ?? []).length
  const skipped = []
  for (let k = 1; k <= eff.skips; k++) skipped.push(seatAfter(order, id, dir, k))
  const next = eff.reverse && order.length === 2 ? id : seatAfter(order, id, dir, 1 + eff.skips)

  const label = cards.length > 1 ? cards.map((c) => c.label).join(' ') : cards[0].label
  const fx = []
  let msg = `${id} played ${label}`
  if (left > 0) {
    if (eff.cancelled && eff.pickup === 0) {
      fx.push({ kind: 'slam', tone: 'green', emoji: '🛡️', title: 'BLOCKED!', cards, burst: false, who: id, sub: `${id}'s Red Jack cancels the pick-up of ${table.pickup}`, subMe: `Your Red Jack cancels the pick-up of ${table.pickup}!` })
      msg += ` — pick-up cancelled!`
    } else if (eff.pickup > table.pickup || eff.cancelled) {
      const black = r === 'J'
      fx.push({
        kind: 'slam', tone: black ? 'purple' : 'red', emoji: black ? '🖤' : '✌️', title: black ? 'BLACK JACK!' : `PICK UP ${eff.pickup}!`,
        cards, shake: black, sound: black ? 'slam' : undefined, who: next,
        sub: `${next} picks up ${eff.pickup}… unless they've got a 2 or a Jack!`, subMe: `Pick up ${eff.pickup} — or fight back with a 2 or a Jack!`,
      })
      msg += ` — ${next} must pick up ${eff.pickup}`
    }
    if (r === '3') fx.push({ kind: 'bubble', at: '@pile', text: '👻 Invisible!' })
    if (eff.reverse) {
      fx.push({ kind: 'slam', tone: 'blue', emoji: '🔄', title: 'REVERSE!', burst: false, sub: order.length === 2 ? `${id} goes again` : 'Play changes direction', subMe: order.length === 2 ? 'You go again!' : 'Play changes direction', who: id })
      msg += order.length === 2 ? ' — reverse, goes again' : ' — reverse!'
    }
    if (skipped.length) {
      skipped.forEach((p) => fx.push({ kind: 'bubble', at: p, text: '⏭ Miss a go!' }))
      msg += ` — ${[...new Set(skipped)].join(', ')} misses a go`
    }
    if (r === 'A') {
      const s = bj.get('suit')
      fx.push({ kind: 'slam', tone: 'rainbow', title: 'ACE!', emoji: s, red: isRed(s), sound: 'zap', who: id, sub: `${id} changed the suit to ${s}`, subMe: `You changed the suit to ${s}` })
      msg += ` and changed the suit to ${s}`
    }
    if (left === 1) fx.push({ kind: 'bubble', at: id, text: '☝️ Last card!' })
  }
  announce(storage, msg, fx.length ? fx : null)

  // Out of cards = the win (the board spots it); otherwise the turn moves on.
  if (left > 0) storage.set('currentTurn', next)
}

// Take what you're owed: the whole pick-up if there is one, otherwise 1 card.
export function doTake(storage, id, why = '') {
  if (storage.get('currentTurn') !== id || gameOver(storage)) return
  const bj = storage.get('blackJack')
  const owed = bj.get('pickup') ?? 0
  const drawn = drawCards(storage, id, owed || 1)
  bj.set('pickup', 0)
  if (owed > 0) {
    announce(storage, `😩 ${id} picked up ${nCards(drawn.length)}`, [
      { kind: 'slam', tone: 'brown', emoji: '😩', title: `+${drawn.length}!`, burst: false, sound: 'sad', who: id, sub: `${id} picks up ${nCards(drawn.length)}`, subMe: `You pick up ${nCards(drawn.length)}` },
      { kind: 'fly', from: '@deck', to: id, count: drawn.length, sound: null },
    ])
  } else if (drawn.length) {
    announce(storage, `${id} ${why ? `${why} and ` : ''}drew a card`, { kind: 'fly', from: '@deck', to: id })
  } else {
    announce(storage, `${id} couldn't move and passed`, { kind: 'bubble', at: id, text: '😶 Pass' })
  }
  passTurn(storage, id)
}

// Black Jack card points, used for the 💰 chips payout: magic cards hurt.
export function cardPoints(card) {
  const r = rankOf(card)
  if (isBlackJack(card)) return 5
  if (r === '2' || r === 'A' || r === 'J' || r === '8' || r === '7' || r === '3') return 2
  return 1
}
