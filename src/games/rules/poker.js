import { LiveObject } from '../../liveblocks.config'
import { rankOf, suitOf, buildShuffledDeck } from '../../lib/cards'
import { beginTurns, readPlayerOrder } from '../../engine/turns'
import { announce, clearAnnouncements } from '../../engine/announce'

// ── Texas Hold'em 🤠 ────────────────────────────────────────
// Everyone gets 2 secret cards. 5 shared cards come face up in the middle
// (3 "flop", 1 "turn", 1 "river"), with a round of betting before each. Make
// the best 5-card poker hand from your 2 + the 5 shared — or make everyone
// else fold. Lose all your chips and you're out; last player with chips wins.
//
// All the poker state lives in storage `poker` (a LiveObject):
//   chips      { name: chips in front of them }       (survives between hands)
//   inHand     [names dealt into this hand]
//   folded     [names who folded this hand]
//   bets       { name: chips bet THIS betting round }
//   committed  { name: chips put in the pot this WHOLE hand } (for side pots)
//   currentBet the biggest bet this round — everyone must match it, fold, or be all-in
//   minRaise   the smallest raise allowed (the last raise size, at least the big blind)
//   acted      [names who've acted since the last raise] — a round ends when
//              everyone who can still bet has acted and matched currentBet
//   board      the shared cards · street 'preflop' | 'flop' | 'turn' | 'river'
//   phase      'betting' | 'handOver' | 'gameOver'
//   dealer, sb, bb, handNo, blinds { small, big }, busted [names, first out first]
//   result     what happened at the end of a hand (winners, shown cards…)
// Hole cards are in `hands` like every other game.
// Only the player whose turn it is writes (or the phone moving for a bot), and
// one phone starts the next hand — guarded by handNo, so it can't happen twice.

export const START_CHIPS = 1000
export const START_BLINDS = { small: 10, big: 20 }
export const BLINDS_UP_EVERY = 8 // hands — blinds double, so the game finishes

// ── Hand evaluator ────────────────────────────────────────
const RANK_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 }
export const rankVal = (card) => RANK_VAL[rankOf(card)]
const RANK_NAME = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' }
const plural = (v) => (v === 6 ? 'Sixes' : `${RANK_NAME[v]}s`)

export const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush']

// Score exactly 5 cards. Returns { score: [category, tie-breakers…], name }.
// Bigger score wins — compare with compareScores.
function score5(cards) {
  const vals = cards.map(rankVal).sort((a, b) => b - a)
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]))
  const unique = [...new Set(vals)]
  let straightHigh = 0
  if (unique.length === 5) {
    if (vals[0] - vals[4] === 4) straightHigh = vals[0]
    else if (vals[0] === 14 && vals[1] === 5) straightHigh = 5 // A-2-3-4-5, the "wheel"
  }
  // Group by rank: most copies first, then highest — that order IS the tie-breaker.
  const counts = {}
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1
  const groups = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || b - a)
  const shape = groups.map((g) => counts[g]).join('')

  if (straightHigh && flush) {
    return straightHigh === 14
      ? { score: [9, 14], name: 'Royal Flush' }
      : { score: [8, straightHigh], name: `Straight Flush, ${RANK_NAME[straightHigh]} high` }
  }
  if (shape === '41') return { score: [7, ...groups], name: `Four ${plural(groups[0])}` }
  if (shape === '32') return { score: [6, ...groups], name: `Full House, ${plural(groups[0])} full of ${plural(groups[1])}` }
  if (flush) return { score: [5, ...vals], name: `Flush, ${RANK_NAME[vals[0]]} high` }
  if (straightHigh) return { score: [4, straightHigh], name: `Straight, ${RANK_NAME[straightHigh]} high` }
  if (shape === '311') return { score: [3, ...groups], name: `Three ${plural(groups[0])}` }
  if (shape === '221') return { score: [2, ...groups], name: `Two Pair, ${plural(groups[0])} & ${plural(groups[1])}` }
  if (shape === '2111') return { score: [1, ...groups], name: `Pair of ${plural(groups[0])}` }
  return { score: [0, ...vals], name: `${RANK_NAME[vals[0]]} high` }
}

export function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d) return d
  }
  return 0
}

// The best 5-card hand from any 5–7 cards: { score, name, cards }.
// Tries every 5-card combination (at most 21), which is plenty fast.
export function bestHand(cards) {
  if (cards.length < 5) return null
  let best = null
  const n = cards.length
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const five = [cards[a], cards[b], cards[c], cards[d], cards[e]]
      const s = score5(five)
      if (!best || compareScores(s.score, best.score) > 0) best = { ...s, cards: five }
    }
  return best
}

// What you've got with fewer than 5 cards (just your 2 before the flop).
export function describeStart(hole) {
  if (hole.length < 2) return ''
  const [a, b] = hole.map(rankVal).sort((x, y) => y - x)
  if (a === b) return `Pair of ${plural(a)}`
  return `${RANK_NAME[a]} high${suitOf(hole[0]) === suitOf(hole[1]) ? ' · suited' : ''}`
}

// ── Seats ────────────────────────────────────────────────
// The next player after `from` (going round the table) who passes `ok`.
export function nextSeat(order, from, ok) {
  const n = order.length
  const start = order.indexOf(from)
  for (let step = 1; step <= n; step++) {
    const p = order[(start + step + n) % n]
    if (ok(p)) return p
  }
  return null
}

// Read the whole poker object out of storage as plain values (in a mutation).
function read(storage) {
  return storage.get('poker').toJSON()
}

const sum = (obj) => Object.values(obj ?? {}).reduce((a, b) => a + b, 0)
export const potOf = (pk) => sum(pk?.committed)

// Who can still bet: in the hand, not folded, with chips left.
export function canAct(pk, p) {
  return (pk.inHand ?? []).includes(p) && !(pk.folded ?? []).includes(p) && (pk.chips?.[p] ?? 0) > 0
}
const stillIn = (pk) => (pk.inHand ?? []).filter((p) => !(pk.folded ?? []).includes(p))

// ── Setting up ───────────────────────────────────────────
export function setupPoker({ storage, playerIds }) {
  const chips = {}
  for (const p of playerIds) chips[p] = START_CHIPS
  storage.set('poker', new LiveObject({
    chips,
    blinds: START_BLINDS,
    handNo: 0,
    dealer: playerIds[Math.floor(Math.random() * playerIds.length)] ?? '',
    busted: [],
    phase: 'handOver',
  }))
  beginTurns(storage, playerIds)
  clearAnnouncements(storage)
  startHand(storage, { first: true })
}

// Shuffle up and deal: move the dealer button, post the blinds, 2 cards each.
export function startHand(storage, { first = false } = {}) {
  const pkObj = storage.get('poker')
  const pk = read(storage)
  const order = readPlayerOrder(storage)
  const chips = { ...pk.chips }
  const alive = order.filter((p) => (chips[p] ?? 0) > 0)
  if (alive.length < 2) {
    pkObj.set('phase', 'gameOver')
    storage.set('currentTurn', '')
    return
  }

  const handNo = (pk.handNo ?? 0) + 1
  let blinds = pk.blinds ?? START_BLINDS
  const blindsUp = handNo > 1 && (handNo - 1) % BLINDS_UP_EVERY === 0
  if (blindsUp) blinds = { small: blinds.small * 2, big: blinds.big * 2 }

  const isAlive = (p) => alive.includes(p)
  const dealer = first && isAlive(pk.dealer) ? pk.dealer : nextSeat(order, pk.dealer, isAlive)
  // Heads-up (2 players) the dealer posts the small blind and acts first before the flop.
  const sb = alive.length === 2 ? dealer : nextSeat(order, dealer, isAlive)
  const bb = nextSeat(order, sb, isAlive)

  // Deal 2 each, starting left of the dealer like a real dealer would.
  const deck = buildShuffledDeck()
  const handsObj = storage.get('hands')
  for (const p of order) handsObj.set(p, [])
  let seat = dealer
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < alive.length; i++) {
      seat = nextSeat(order, seat, isAlive)
      handsObj.set(seat, [...(handsObj.get(seat) ?? []), deck.pop()])
    }
  }
  const deckList = storage.get('deck')
  while (deckList.length > 0) deckList.delete(0)
  deck.forEach((c) => deckList.push(c))

  const bets = {}
  const committed = {}
  const post = (p, amount) => {
    const paid = Math.min(amount, chips[p])
    chips[p] -= paid
    bets[p] = (bets[p] ?? 0) + paid
    committed[p] = (committed[p] ?? 0) + paid
  }
  post(sb, blinds.small)
  post(bb, blinds.big)

  pkObj.set('chips', chips)
  pkObj.set('blinds', blinds)
  pkObj.set('handNo', handNo)
  pkObj.set('dealer', dealer)
  pkObj.set('sb', sb)
  pkObj.set('bb', bb)
  pkObj.set('inHand', alive)
  pkObj.set('folded', [])
  pkObj.set('bets', bets)
  pkObj.set('committed', committed)
  pkObj.set('currentBet', Math.max(bets[sb], bets[bb]))
  pkObj.set('minRaise', blinds.big)
  pkObj.set('acted', [])
  pkObj.set('board', [])
  pkObj.set('street', 'preflop')
  pkObj.set('phase', 'betting')
  pkObj.set('result', null)

  const now = read(storage)
  // First to act: left of the big blind (heads-up that's the dealer/small blind).
  const firstUp = nextSeat(order, bb, (p) => canAct(now, p))
  storage.set('currentTurn', firstUp ?? '')

  const msg = `Hand ${handNo} · ${dealer} deals · blinds ${blinds.small}/${blinds.big}`
  announce(storage, msg, blindsUp ? { kind: 'slam', tone: 'red', emoji: '📈', title: 'BLINDS UP!', sub: `Now ${blinds.small} / ${blinds.big}`, burst: false } : null)
  // Somebody might already be all-in from posting a blind — keep things moving.
  if (!firstUp || !needsToAct(now, firstUp)) settleRound(storage, bb)
}

// ── Betting ──────────────────────────────────────────────
function needsToAct(pk, p) {
  if (!canAct(pk, p)) return false
  return !(pk.acted ?? []).includes(p) || (pk.bets?.[p] ?? 0) < (pk.currentBet ?? 0)
}

// What a player is allowed to do right now (for the buttons and the bots).
export function optionsFor(pk, p) {
  const chips = pk.chips?.[p] ?? 0
  const bet = pk.bets?.[p] ?? 0
  const toCall = Math.max(0, (pk.currentBet ?? 0) - bet)
  const maxTo = bet + chips // "raise to" if you shove everything in
  const minTo = Math.min((pk.currentBet ?? 0) + (pk.minRaise ?? 0), maxTo)
  return {
    toCall: Math.min(toCall, chips),
    canCheck: toCall === 0,
    canRaise: chips > toCall, // you have chips beyond what calling needs
    minTo,
    maxTo,
    bet,
    chips,
  }
}

// One betting action. kind: 'fold' | 'check' | 'call' | 'raise' (amount = the
// total you're raising TO this round). Refuses anything that isn't your turn
// or isn't allowed.
export function doAction(storage, { id, kind, amount }) {
  if (storage.get('currentTurn') !== id) return
  const pkObj = storage.get('poker')
  const pk = read(storage)
  if (pk.phase !== 'betting' || !canAct(pk, id)) return
  const opt = optionsFor(pk, id)
  const chips = { ...pk.chips }
  const bets = { ...pk.bets }
  const committed = { ...pk.committed }
  let acted = [...(pk.acted ?? [])]
  const pay = (n) => {
    chips[id] -= n
    bets[id] = (bets[id] ?? 0) + n
    committed[id] = (committed[id] ?? 0) + n
  }
  let msg
  let fx

  if (kind === 'fold') {
    pkObj.set('folded', [...(pk.folded ?? []), id])
    msg = `${id} folded`
    fx = { kind: 'bubble', at: id, text: '🏳️ Fold' }
  } else if (kind === 'check') {
    if (!opt.canCheck) return
    msg = `${id} checked`
    fx = { kind: 'bubble', at: id, text: '👊 Check' }
  } else if (kind === 'call') {
    if (opt.toCall === 0) return
    pay(opt.toCall)
    const allIn = chips[id] === 0
    msg = allIn ? `${id} called ${opt.toCall} — ALL IN!` : `${id} called ${opt.toCall}`
    fx = allIn ? allInFx(id) : { kind: 'bubble', at: id, text: `📞 Call ${opt.toCall}` }
  } else if (kind === 'raise') {
    if (!opt.canRaise) return
    const to = Math.round(Number(amount))
    if (!(to >= opt.minTo && to <= opt.maxTo)) return
    const raiseBy = to - (pk.currentBet ?? 0)
    pay(to - opt.bet)
    if (raiseBy >= (pk.minRaise ?? 0)) pkObj.set('minRaise', raiseBy)
    pkObj.set('currentBet', Math.max(pk.currentBet ?? 0, to))
    acted = [] // a raise means everyone else has to answer it
    const allIn = chips[id] === 0
    const word = (pk.currentBet ?? 0) === 0 ? 'bet' : 'raised to'
    msg = allIn ? `${id} is ALL IN for ${to}!` : `${id} ${word} ${to}`
    fx = allIn ? allInFx(id) : { kind: 'bubble', at: id, text: (pk.currentBet ?? 0) === 0 ? `💰 Bet ${to}` : `⬆️ Raise to ${to}` }
  } else {
    return
  }

  acted.push(id)
  pkObj.set('chips', chips)
  pkObj.set('bets', bets)
  pkObj.set('committed', committed)
  pkObj.set('acted', acted)
  announce(storage, msg, fx)
  settleRound(storage, id)
}

const allInFx = (id) => ({ kind: 'slam', tone: 'fire', emoji: '🔥', title: 'ALL IN!', who: id, sub: `${id} pushes every chip in!`, subMe: 'Every chip is in! 😬', shake: true, sound: 'zap' })

// After every action: is the hand over? Is this betting round over? Who's next?
function settleRound(storage, lastId) {
  const pkObj = storage.get('poker')
  const order = readPlayerOrder(storage)
  let pk = read(storage)

  // Everybody else folded → last one standing takes the pot (no cards shown).
  const live = stillIn(pk)
  if (live.length === 1) {
    finishHand(storage, { foldWin: live[0] })
    return
  }

  const next = nextSeat(order, lastId, (p) => needsToAct(pk, p))
  if (next) {
    storage.set('currentTurn', next)
    return
  }

  // Round over. If at most one player can still bet, nobody can be raised any
  // more — deal the rest of the board and show down.
  const bettors = live.filter((p) => canAct(pk, p))
  if (bettors.length <= 1 || pk.street === 'river') {
    dealOut(storage, 5)
    finishHand(storage, {})
    return
  }

  // Next street: burn one, then flop 3 / turn 1 / river 1.
  const street = { preflop: 'flop', flop: 'turn', turn: 'river' }[pk.street]
  dealOut(storage, { flop: 3, turn: 4, river: 5 }[street])
  pkObj.set('street', street)
  pkObj.set('bets', {})
  pkObj.set('currentBet', 0)
  pkObj.set('minRaise', pk.blinds?.big ?? START_BLINDS.big)
  pkObj.set('acted', [])
  pk = read(storage)
  storage.set('currentTurn', nextSeat(order, pk.dealer, (p) => canAct(pk, p)) ?? '')
  const name = { flop: 'The flop', turn: 'The turn', river: 'The river' }[street]
  announce(storage, `${name}: ${pk.board.slice(street === 'flop' ? 0 : -1).map((c) => c.label).join(' ')}`)
}

// Deal shared cards until there are `upTo` on the board (burning one first each street).
function dealOut(storage, upTo) {
  const pkObj = storage.get('poker')
  const deckList = storage.get('deck')
  const board = [...(pkObj.get('board') ?? [])]
  const take = () => { const c = deckList.get(0); deckList.delete(0); return c }
  while (board.length < upTo && deckList.length > 1) {
    take() // burn
    const n = board.length === 0 ? 3 : 1
    for (let i = 0; i < n && board.length < upTo; i++) board.push(take())
  }
  pkObj.set('board', board)
}

// Split the chips into a main pot + side pots. Someone all-in for less can
// only win the part of the pot they could match.
export function buildPots(committed, live) {
  const left = { ...committed }
  const pots = []
  for (let guard = 0; guard < 20; guard++) {
    const contenders = live.filter((p) => (left[p] ?? 0) > 0)
    if (contenders.length === 0) break
    const level = Math.min(...contenders.map((p) => left[p]))
    let amount = 0
    for (const p of Object.keys(left)) {
      const take = Math.min(left[p], level)
      amount += take
      left[p] -= take
    }
    pots.push({ amount, eligible: contenders })
  }
  // Chips from folded players above every live player's level join the last pot.
  const stray = sum(left)
  if (stray && pots.length) pots[pots.length - 1].amount += stray
  return pots
}

function finishHand(storage, { foldWin }) {
  const pkObj = storage.get('poker')
  const pk = read(storage)
  const order = readPlayerOrder(storage)
  const chips = { ...pk.chips }
  const handsObj = storage.get('hands')
  const live = stillIn(pk)
  const pot = potOf(pk)
  const fx = []
  let result
  let msg

  if (foldWin) {
    chips[foldWin] += pot
    result = { foldWin, pot, winners: [{ name: foldWin, amount: pot }] }
    msg = `🏆 ${foldWin} wins ${pot} — everyone else folded`
    fx.push({ kind: 'slam', tone: 'gold', emoji: '💰', title: `+${pot}`, burst: false, who: foldWin, sub: `${foldWin} takes the pot`, subMe: 'Everyone folded — the pot is yours!', sound: 'cash' })
  } else {
    const board = pk.board ?? []
    const shown = {}
    const hands = {}
    for (const p of live) {
      shown[p] = handsObj.get(p) ?? []
      hands[p] = bestHand([...shown[p], ...board])
    }
    const won = {}
    const pots = buildPots(pk.committed ?? {}, live)
    for (const pot of pots) {
      // A bet nobody could match just goes back to whoever made it.
      if (pot.eligible.length === 1) { chips[pot.eligible[0]] += pot.amount; continue }
      let best = []
      for (const p of pot.eligible) {
        const c = best.length ? compareScores(hands[p].score, hands[best[0]].score) : 1
        if (c > 0) best = [p]
        else if (c === 0) best.push(p)
      }
      // Split evenly; any odd chip goes to the first winner left of the dealer.
      best.sort((a, b) => seatFrom(order, pk.dealer, a) - seatFrom(order, pk.dealer, b))
      const share = Math.floor(pot.amount / best.length)
      best.forEach((p, i) => { won[p] = (won[p] ?? 0) + share + (i === 0 ? pot.amount - share * best.length : 0) })
    }
    for (const p of Object.keys(won)) chips[p] += won[p]
    const winners = Object.keys(won).sort((a, b) => won[b] - won[a]).map((p) => ({ name: p, amount: won[p], hand: hands[p].name, cards: hands[p].cards }))
    const top = winners[0]
    result = { pot, shown, hands: Object.fromEntries(live.map((p) => [p, hands[p].name])), winners }
    const split = winners.length > 1 && winners[1].amount === top.amount
    msg = split
      ? `🤝 Split pot! ${winners.filter((w) => w.amount === top.amount).map((w) => w.name).join(' & ')} — ${top.hand}`
      : `🏆 ${top.name} wins ${top.amount} with ${top.hand}`
    const category = HAND_NAMES[hands[top.name].score[0]]
    const big = hands[top.name].score[0] >= 6
    fx.push({
      kind: 'slam', tone: big ? 'rainbow' : 'gold', emoji: big ? '🤯' : '🏆', title: split ? 'SPLIT POT!' : `${category.toUpperCase()}!`,
      cards: top.cards, confetti: big, big, who: top.name, sound: 'fanfare',
      sub: `${top.name} wins ${top.amount}`, subMe: `You win ${top.amount}! 🤑`,
    })
  }

  // Anyone with no chips left is out.
  const busted = [...(pk.busted ?? [])]
  for (const p of pk.inHand ?? []) {
    if (chips[p] === 0 && !busted.includes(p)) {
      busted.push(p)
      fx.push({ kind: 'bubble', at: p, text: '💸 Busted!' })
    }
  }

  pkObj.set('chips', chips)
  pkObj.set('busted', busted)
  pkObj.set('bets', {})
  pkObj.set('result', { ...result, at: Date.now() })
  pkObj.set('phase', 'handOver')
  storage.set('currentTurn', '')
  announce(storage, msg, fx)
}

const seatFrom = (order, dealer, p) => (order.indexOf(p) - order.indexOf(dealer) + order.length - 1) % order.length

// Start the next hand — exactly once, even if two phones ask at the same time.
export function nextHand(storage, handNo) {
  const pkObj = storage.get('poker')
  if (pkObj.get('phase') !== 'handOver' || pkObj.get('handNo') !== handNo) return
  startHand(storage)
}
