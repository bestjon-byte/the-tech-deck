// ── Turns: a reusable building block for ANY turn-based game ──
//
// Before, "whose turn is it?" was tangled up inside Go Fish. Now any game can
// share turns the same way:
//
//   • At deal time, call  beginTurns(storage, playerIds)   to set the order.
//   • Inside the board, call  useTurns(myId)  to read whose turn it is.
//   • When a player's go is over, call  advanceTurn(storage, theirId).
//
// The turn order and the current player live in Liveblocks storage
// (`playerOrder` and `currentTurn`) so every player sees the same thing.

import { useStorage } from '../liveblocks.config'

// Pure helper: given the order of players and who just went, who's next?
// Wraps back to the start after the last player.
export function getNextTurn(playerOrder, currentId) {
  const idx = playerOrder.indexOf(currentId)
  if (idx === -1) return playerOrder[0] ?? ''
  return playerOrder[(idx + 1) % playerOrder.length]
}

// Read the playerOrder LiveList out as a plain array (used inside mutations).
export function readPlayerOrder(storage) {
  const list = storage.get('playerOrder')
  const order = []
  for (let i = 0; i < list.length; i++) order.push(list.get(i))
  return order
}

// Set the turn order and start with the first player. Call this when dealing.
export function beginTurns(storage, playerIds) {
  const list = storage.get('playerOrder')
  while (list.length > 0) list.delete(0)
  playerIds.forEach((id) => list.push(id))
  storage.set('currentTurn', playerIds[0] ?? '')
}

// Move the turn on to the next player. Call this from inside a mutation when
// a player's turn is finished.
export function advanceTurn(storage, currentId) {
  const order = readPlayerOrder(storage)
  storage.set('currentTurn', getNextTurn(order, currentId))
}

// Like advanceTurn, but skips players that shouldSkip(id) returns true for —
// e.g. players who have been knocked out. Won't loop forever.
export function advanceTurnWhile(storage, currentId, shouldSkip) {
  const order = readPlayerOrder(storage)
  let next = getNextTurn(order, currentId)
  for (let guard = 0; guard < order.length && shouldSkip(next); guard++) {
    next = getNextTurn(order, next)
  }
  storage.set('currentTurn', next)
}

// Hook for boards: tells you the turn order, whose turn it is, whether it's
// YOUR turn, and the list of everyone else (in turn order).
export function useTurns(myId) {
  const currentTurn = useStorage((root) => root.currentTurn ?? '')
  const playerOrder = useStorage((root) => root.playerOrder ?? [])
  return {
    currentTurn,
    playerOrder,
    isMyTurn: currentTurn === myId,
    otherPlayers: playerOrder.filter((p) => p !== myId),
  }
}
