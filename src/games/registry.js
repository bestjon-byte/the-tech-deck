// ── The game library ───────────────────────────────────────
//
// Every game in The Tech Deck is described by one entry in the GAMES list
// below. The lobby builds its game-mode buttons from this list, and the game
// screen picks which board to show from it — so adding a new game is just:
//
//   1. Write a board component in  games/boards/
//   2. Add an entry here
//
// ...with NO changes needed to the lobby, the router, or anything else.
//
// Each entry can have:
//   id        — short key, also stored in Liveblocks as `gameMode`
//   name      — shown on the lobby button
//   emoji     — little icon for the button + turn banner
//   Board     — the React component that plays the game
//   deal      — how many cards each player starts with:
//                 { pickable: true,  default, min, max }  → host chooses (shows the +/- picker)
//                 { pickable: false, perPlayer: (n) => count } → fixed by player count
//   setup     — OPTIONAL extra setup run when the game starts, inside a mutation.
//               Gets ({ storage, playerIds }). Use it to start turns, etc.
//   lobbyHint — OPTIONAL (playerCount) => string shown under the buttons.

import FreePlayBoard from './boards/FreePlayBoard'
import GoFishBoard from './boards/GoFishBoard'
import { beginTurns } from '../engine/turns'

export const GAMES = [
  {
    id: 'freeplay',
    name: 'Free Play',
    emoji: '🃏',
    Board: FreePlayBoard,
    deal: { pickable: true, default: 5, min: 1, max: 13 },
  },
  {
    id: 'gofish',
    name: 'Go Fish',
    emoji: '🎣',
    Board: GoFishBoard,
    deal: { pickable: false, perPlayer: (n) => (n <= 2 ? 7 : 5) },
    setup({ storage, playerIds }) {
      // Go Fish is turn-based, so hand turn-taking to the shared engine...
      beginTurns(storage, playerIds)
      // ...then do the Go-Fish-only setup: an empty pile of books per player.
      const booksObj = storage.get('books')
      for (const pid of playerIds) booksObj.set(pid, [])
      const lastActionObj = storage.get('lastAction')
      lastActionObj.set('message', '')
      lastActionObj.set('id', 0)
    },
    lobbyHint: (n) => `${n <= 2 ? 7 : 5} cards each · ask for matching ranks · first to collect all their sets wins`,
  },
]

// Look up a game by its id (falls back to the first game).
export function getGame(id) {
  return GAMES.find((g) => g.id === id) ?? GAMES[0]
}

// How many cards to deal each player for this game, given the player count.
export function dealCountFor(game, playerCount, pickedCount) {
  return game.deal.pickable ? pickedCount : game.deal.perPlayer(playerCount)
}
