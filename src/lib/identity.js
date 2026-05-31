// ── Who am I + which room? ─────────────────────────────────
// Small helpers that remember the player's name and last room code on this
// device using the browser's localStorage, so they don't have to retype them.

export function getSavedName() { return localStorage.getItem('windy-player-name') || '' }
export function saveName(name) { localStorage.setItem('windy-player-name', name) }
export function getLastRoom() { return localStorage.getItem('windy-last-room') || '' }
export function saveLastRoom(code) { localStorage.setItem('windy-last-room', code) }

// Make a random 4-letter room code. We skip I and O so they don't get mixed
// up with the numbers 1 and 0.
export function makeRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
}
