import { STAKES } from './stakesRules'

// ── 👀 Who's out (and can watch someone else's hand)? ───────
// isOut(root, name) for each game where players drop out before the end.
// Anyone who isn't in the game at all (just in the room) can always watch.
// Games where the first player out ends it (Sevens, Crazy Eights) have no
// "out" players, so only room watchers can spectate there.
const handOf = (root, p) => root.hands?.[p] ?? []

const OUT = {
  shithead: (root, p) => (root.shed?.finished ?? []).includes(p),
  bigtwo: (root, p) => (root.bigTwo?.finished ?? []).includes(p),
  knockout: (root, p) => Array.isArray(root.whist?.alive) && !root.whist.alive.includes(p),
  poker: (root, p) => (root.poker?.busted ?? []).includes(p),
  oldmaid: (root, p) => handOf(root, p).length === 0,
  snap: (root, p) => handOf(root, p).length === 0,
  gofish: (root, p) => handOf(root, p).length === 0 && (root.deck ?? []).length === 0,
}

export function isOut(gameId, root, p) {
  if (!(root.playerOrder ?? []).includes(p)) return true // watching the room, not playing
  return OUT[gameId]?.(root, p) ?? false
}

// Is the game finished? (Then there's nothing left to watch.)
export function isOver(gameId, root) {
  if (gameId === 'poker') return root.poker?.phase === 'gameOver'
  const settle = STAKES[gameId]?.settle
  return settle ? settle(root) !== null : false
}
