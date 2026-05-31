import { dealAll } from '../../engine/table'
import { beginTurns } from '../../engine/turns'

// Set up Snap: deal the whole deck out as face-down stacks and start turns.
export function setupSnap({ storage, playerIds }) {
  dealAll(storage, playerIds)
  beginTurns(storage, playerIds)
  const la = storage.get('lastAction')
  la.set('message', '')
  la.set('id', 0)
}
