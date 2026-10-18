import { dealAll } from '../../engine/table'
import { beginTurns } from '../../engine/turns'
import { clearAnnouncements } from '../../engine/announce'

// Set up Snap: deal the whole deck out as face-down stacks and start turns.
export function setupSnap({ storage, playerIds }) {
  dealAll(storage, playerIds)
  beginTurns(storage, playerIds)
  storage.get('snap').set('winner', '') // no snap claimed yet
  clearAnnouncements(storage)
}
