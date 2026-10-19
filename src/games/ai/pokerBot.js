import { rankOf, suitOf } from '../../lib/cards'
import { bestHand, rankVal, optionsFor, potOf } from '../rules/poker'

// ── 🤖 Poker bot brain ─────────────────────────────────────
// choosePokerMove(pk, botId, hole, level) → { kind, amount? }
// It guesses how strong its hand is (0 = rubbish, 1 = monster), compares that
// with how much it costs to stay in, and adds a little randomness so it isn't
// totally predictable:
//   🙂 easy   — a "calling station": calls too much, hardly ever raises
//   😎 medium — plays its strength: raises good hands, folds bad ones
//   😈 hard   — raises more hands, bets bigger, calls lighter, bluffs now and then

// Before the flop: pairs and big cards are good, suited/connected helps a bit.
function startingStrength(hole) {
  const [a, b] = hole.map(rankVal).sort((x, y) => y - x)
  let s = (a + b - 4) / 24 * 0.55 // 0 … 0.55 from card height
  if (a === b) s = 0.5 + (a - 2) / 12 * 0.5 // 22 = 0.5 … AA = 1
  if (suitOf(hole[0]) === suitOf(hole[1])) s += 0.06
  if (a - b === 1) s += 0.04
  return Math.min(1, s)
}

// After the flop: what hand have we made, and does it use our own cards?
function madeStrength(hole, board) {
  const best = bestHand([...hole, ...board])
  const cat = best.score[0]
  const usesMine = best.cards.some((c) => hole.some((h) => h.id === c.id))
  if (!usesMine) return 0.15 // the board is doing all the work — everyone has it
  const BASE = [0.12, 0.42, 0.66, 0.76, 0.84, 0.88, 0.94, 0.98, 1, 1]
  let s = BASE[cat]
  if (cat === 1) {
    // a pair of the top board card (or a pocket pair above it) is much better than a small pair
    const pairVal = best.score[1]
    const topBoard = Math.max(...board.map(rankVal))
    if (pairVal >= topBoard) s += 0.14
    else if (pairVal < topBoard - 3) s -= 0.1
  }
  if (cat === 0 && hole.some((c) => rankOf(c) === 'A')) s += 0.08
  // a flush draw (4 of a suit) has some hope left
  const suits = {}
  for (const c of [...hole, ...board]) suits[suitOf(c)] = (suits[suitOf(c)] ?? 0) + 1
  if (board.length < 5 && Object.values(suits).some((n) => n === 4) && cat < 4) s += 0.1
  return Math.min(1, s)
}

const STYLE = {
  medium: { raise: 0.66, size: 0.6, margin: 0.08, bluff: 0 },
  hard: { raise: 0.62, size: 0.75, margin: 0.04, bluff: 0.06 },
}

const roundTo = (x, step) => Math.max(step, Math.round(x / step) * step)

export function choosePokerMove(pk, botId, hole, level = 'medium') {
  const board = pk.board ?? []
  const o = optionsFor(pk, botId)
  const pot = potOf(pk)
  const big = pk.blinds?.big ?? 20
  const noise = { easy: 0.25, medium: 0.12, hard: 0.08 }[level] ?? 0.12
  const strength = (board.length ? madeStrength(hole, board) : startingStrength(hole)) + (Math.random() - 0.5) * noise
  const price = o.toCall / (pot + o.toCall || 1) // how much of the final pot we'd be paying
  const check = o.canCheck ? { kind: 'check' } : null
  const call = o.toCall > 0 ? { kind: 'call' } : null

  const raiseTo = (fraction) => {
    const want = o.bet + o.toCall + roundTo(pot * fraction, big / 2)
    return { kind: 'raise', amount: Math.max(o.minTo, Math.min(o.maxTo, want)) }
  }

  if (level === 'easy') {
    if (o.canRaise && strength > 0.85 && Math.random() < 0.5) return raiseTo(0.5)
    if (check) return check
    if (strength > 0.25 || price < 0.2 || Math.random() < 0.3) return call
    return { kind: 'fold' }
  }

  // How each level plays: raise with hands above `raise`, bet `size` × the pot,
  // call when strength beats the price by `margin`, bluff now and then.
  const style = STYLE[level] ?? STYLE.medium
  const bluff = board.length >= 3 && o.canCheck && Math.random() < style.bluff
  if (o.canRaise && (strength > style.raise || bluff)) {
    // monsters sometimes just call, to look weak
    if (strength > 0.9 && Math.random() < 0.2 && call) return call
    return raiseTo(strength > 0.9 ? style.size * 1.5 : style.size)
  }
  if (check) return check
  if (strength > price + style.margin) return call
  return { kind: 'fold' }
}
