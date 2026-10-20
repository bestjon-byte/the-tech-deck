import { rankOf, suitOf, SUITS } from '../../lib/cards'
import { startableCards, isBlackJack, isRedJack } from '../rules/blackJack'

// ── Black Jack computer player 🤖 ───────────────────────────
// chooseBlackJackMove() returns { cards, suit } to play (cards in the order
// they go down; `suit` only matters for an Ace) — or null to draw / pick up.
//
//   🙂 easy   — plays any card it can, sometimes draws for no reason.
//   😎 medium — gets rid of plain cards first and keeps its Aces + Red Jacks
//               for when it's stuck.
//   😈 hard   — like medium, but thinks one move ahead: plays the card that
//               leaves it the most follow-ups, saves its pick-up cards to hit
//               whoever is about to win, and (2 players) uses 7s and 8s as
//               free extra goes.

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]
const MAGIC_COST = { A: 6, J: 5, '2': 4, '8': 3, '3': 3, '7': 2 } // how much a bot likes to keep each card

// The suit the bot holds most of (ties → random), ignoring the cards it's playing.
function bestSuit(hand, playing) {
  const ids = new Set(playing.map((c) => c.id))
  const counts = Object.fromEntries(SUITS.map((s) => [s, 0]))
  for (const c of hand) if (!ids.has(c.id) && rankOf(c) !== 'A') counts[suitOf(c)]++
  const most = Math.max(...Object.values(counts))
  return pickRandom(SUITS.filter((s) => counts[s] === most))
}

// One option per card that can start a play: that card, then every other
// card of the same number (Red Jacks before Black ones, so a cancel lands first).
function options(hand, table) {
  return startableCards(hand, table).map((first) => {
    const rest = hand.filter((c) => c.id !== first.id && rankOf(c) === rankOf(first))
    rest.sort((a, b) => Number(isBlackJack(a)) - Number(isBlackJack(b)))
    return [first, ...rest]
  })
}

// After playing `o`, how many of the bot's other cards could go on top of it?
function followUps(hand, o) {
  const top = o[o.length - 1]
  if (rankOf(top) === 'A' || rankOf(top) === '3') return 2 // it picks the suit / can see through
  const ids = new Set(o.map((c) => c.id))
  return hand.filter((c) => !ids.has(c.id) && (rankOf(c) === rankOf(top) || suitOf(c) === suitOf(top))).length
}

export function chooseBlackJackMove({ hand, table, level, nextCount = 7, players = 3 }) {
  const opts = options(hand, table)
  if (opts.length === 0) return null

  const finish = opts.find((o) => o.length === hand.length) // can go out? always do it
  if (finish) return { cards: finish, suit: bestSuit(hand, finish) }

  if (level === 'easy') {
    if (table.pickup === 0 && Math.random() < 0.15) return null
    const pick = pickRandom(opts)
    const one = Math.random() < 0.5 ? [pick[0]] : pick // forgets about the matching cards half the time
    return { cards: one, suit: pickRandom(SUITS) }
  }

  // A pick-up is coming: pass it on if we can, otherwise cancel it with a Red Jack.
  if (table.pickup > 0) {
    const passOn = opts.filter((o) => rankOf(o[0]) === '2' || isBlackJack(o[0]))
    if (passOn.length) {
      // Keep Red Jacks out of a pass-on (they'd cancel our own attack).
      const best = passOn.map((o) => o.filter((c) => !isRedJack(c))).sort((a, b) => b.length - a.length)[0]
      return { cards: best, suit: '' }
    }
    const red = opts.find((o) => isRedJack(o[0]))
    if (red) return { cards: [red[0]], suit: '' }
    return null
  }

  const danger = nextCount <= 2 // next player is nearly out
  const score = (o) => {
    const r = rankOf(o[0])
    let s = -(MAGIC_COST[r] ?? 0) * 2 + o.length // plain cards first, and the more the better
    if (r === 'J' && o.some(isRedJack) && !o.some(isBlackJack)) s -= 6 // a Red Jack is a shield — keep it
    if (level === 'hard') {
      if (danger && (r === '2' || r === '8' || isBlackJack(o[0]))) s += 20 // hit them!
      if (r === '3') s -= 4 // a 3 can go on anything — save it for when stuck
      if (players === 2 && (r === '8' || (r === '7' && o.length % 2 === 1))) s += 12 // heads-up these mean "go again"
      s += followUps(hand, o) * 4
    }
    return s
  }
  let best = [...opts].sort((a, b) => score(b) - score(a))[0]
  if (rankOf(best[0]) === '7' && best.length % 2 === 0 && level === 'hard') best = best.slice(0, -1) // keep it odd so it actually reverses
  return { cards: best, suit: bestSuit(hand, best) }
}
