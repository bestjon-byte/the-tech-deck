import { legalPlays, identifyCombo, isLegalPlay, cardRank, sortForBigTwo } from '../rules/bigTwo'
import { rankOf } from '../../lib/cards'

// ── Big Two computer player 🤖 ──────────────────────────────
// chooseBigTwoMove() looks at the bot's hand and the table, and returns the
// cards to play (an array) — or null to pass. Three brains:
//
//   🙂 easy   — plays a random legal move, and sometimes passes for no reason.
//   😎 medium — plays its lowest cards first; always beats the trick as
//               cheaply as it can.
//   😈 hard   — plans its hand into combos (straights, pairs…) and doesn't
//               break them up, saves its 2s for later, and blocks anyone who
//               is about to go out.

const TWO = 12 // cardRank of a 2 — the highest card
const ACE = 11

const keyOf = (cards) => identifyCombo(cards).key
const topRank = (cards) => Math.max(...cards.map(cardRank))
const byKey = (a, b) => keyOf(a) - keyOf(b)
const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]

export function chooseBigTwoMove({ hand, trickType, mustStartWith3D, level, oppCounts = [] }) {
  const plays = legalPlays(hand, trickType, mustStartWith3D)
  if (plays.length === 0) return null // nothing beats it — pass

  // Every bot goes out if it can — even the easy one isn't THAT silly.
  const winner = plays.find((p) => p.length === hand.length)
  if (winner) return winner

  if (level === 'easy') return easyMove(plays, trickType)
  if (level === 'hard') return hardMove(hand, plays, trickType, mustStartWith3D, oppCounts)
  return mediumMove(hand, plays, trickType)
}

// 🙂 Random, and lazy: passes a quarter of the time even when it could play.
function easyMove(plays, trickType) {
  if (trickType && Math.random() < 0.25) return null
  if (!trickType) {
    // Mostly leads singles, like a beginner
    const small = plays.filter((p) => p.length <= 2)
    if (small.length && Math.random() < 0.8) return pickRandom(small)
  }
  return pickRandom(plays)
}

// 😎 Get rid of the lowest card first, in the biggest combo it fits in.
function mediumMove(hand, plays, trickType) {
  if (trickType) return [...plays].sort(byKey)[0] // cheapest play that wins
  const lowest = sortForBigTwo(hand)[0]
  const withLowest = plays.filter((p) => p.some((c) => c.id === lowest.id))
  const biggest = Math.max(...withLowest.map((p) => p.length))
  return withLowest.filter((p) => p.length === biggest).sort(byKey)[0]
}

// 😈 The planner.
function hardMove(hand, plays, trickType, mustStartWith3D, oppCounts) {
  const plan = planHand(hand)
  const fewest = Math.min(99, ...oppCounts)
  const danger = fewest <= 2 // someone's about to go out — stop them!

  if (!trickType) {
    if (mustStartWith3D) {
      // Opening: play the planned group holding the 3♦
      const g = plan.find((grp) => isLegalPlay(grp, null, true))
      return g ?? [...plays].sort((a, b) => b.length - a.length || byKey(a, b))[0]
    }
    return hardLead(plan, plays, fewest)
  }

  // Following. Planned groups of the right size that win the trick, cheapest first.
  const fits = plan.filter((g) => isLegalPlay(g, trickType, false)).sort(byKey)
  if (danger) {
    // Block: play the STRONGEST thing that wins, so they can't beat it
    return fits.length ? fits[fits.length - 1] : [...plays].sort(byKey)[plays.length - 1]
  }
  if (fits.length) {
    const g = fits[0]
    // Don't waste a 2 early on — wait until the hand is smaller
    if (topRank(g) === TWO && hand.length > 7 && trickType.size < 5) return null
    return g
  }
  // Nothing fits the plan. Near the end, break a combo if we must.
  if (hand.length <= 5) return [...plays].sort(byKey)[0]
  return null
}

function hardLead(plan, plays, fewest) {
  const ordered = [...plan].sort((a, b) => topRank(a) - topRank(b) || b.length - a.length)
  // Two groups left and one is a near-sure winner (has a 2 or Ace)? Play the
  // strong one first to keep the lead, then go out with the other.
  if (ordered.length === 2 && topRank(ordered[1]) >= ACE) return ordered[1]
  if (fewest === 1) {
    // Someone has ONE card: never lead a low single — lead a combo, or our top single
    const combos = ordered.filter((g) => g.length > 1)
    if (combos.length) return combos[0]
    return ordered[ordered.length - 1]
  }
  // Otherwise dump the weakest group, preferring the ones that shed most cards
  const low = ordered.filter((g) => topRank(g) < ACE)
  const pool = low.length ? low : ordered
  const lowestTop = topRank(pool[0])
  const tied = pool.filter((g) => topRank(g) <= lowestTop + 2)
  return tied.sort((a, b) => b.length - a.length)[0] ?? plays[0]
}

// Split a hand into the combos we'd like to play: 5-card hands that soak up
// loose cards first, then triples, pairs, and leftover singles.
export function planHand(hand) {
  let rest = [...hand]
  const groups = []
  for (let tries = 0; tries < 3 && rest.length >= 5; tries++) {
    const counts = {}
    rest.forEach((c) => { counts[rankOf(c)] = (counts[rankOf(c)] ?? 0) + 1 })
    const loners = (combo) => combo.filter((c) => counts[rankOf(c)] === 1).length
    const fives = legalPlays(rest, null, false).filter((p) => p.length === 5)
    let best = null
    let bestScore = 0
    for (const f of fives) {
      const type = identifyCombo(f).type
      const solid = type === 'fullhouse' || type === 'quad'
      if (!solid && loners(f) < 3) continue // would break up too many pairs
      const score = loners(f) * 10 + (solid ? 15 : 0) - topRank(f) * 0.1
      if (score > bestScore) { best = f; bestScore = score }
    }
    if (!best) break
    groups.push(best)
    const used = new Set(best.map((c) => c.id))
    rest = rest.filter((c) => !used.has(c.id))
  }
  const byRank = {}
  for (const c of sortForBigTwo(rest)) (byRank[rankOf(c)] ??= []).push(c)
  for (const cards of Object.values(byRank)) {
    if (cards.length === 4) groups.push(cards.slice(0, 2), cards.slice(2))
    else groups.push(cards)
  }
  return groups
}
