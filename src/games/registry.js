// ── The game library ───────────────────────────────────────
//
// Every game in The Tech Deck is described by one entry in the GAMES list
// below. The lobby builds its game-mode buttons from this list, the game screen
// picks which board to show, and the "How to play" pop-up reads each game's
// `rules` — so adding a new game is just:
//
//   1. Write a board component in  games/boards/
//   2. (If it needs custom dealing/rules) add a setup + rules helper in games/rules/
//   3. Add an entry here
//
// ...with NO changes needed to the lobby, the router, or anything else.
//
// Each entry can have:
//   id        — short key, also stored in Liveblocks as `gameMode`
//   name      — shown on the lobby button
//   emoji     — little icon for the button + turn banner
//   Board     — the React component that plays the game
//   deal      — how many cards each player starts with:
//                 { pickable: true,  default, min, max }   → host chooses (shows the +/- picker)
//                 { pickable: false, perPlayer: (n)=>count } → fixed by player count
//                 { all: true }                            → the game deals the whole deck itself
//   setup     — runs (inside a mutation) when the game starts. Gets
//               ({ storage, playerIds, count }). Deals the cards and sets up any
//               extra state (turns, books...).
//   lobbyHint — OPTIONAL (playerCount) => string shown under the buttons.
//   rules     — { objective, howTo: [steps], win } shown in the How-to-play pop-up.

import { dealToPlayers } from '../engine/table'
import { beginTurns } from '../engine/turns'

import FreePlayBoard from './boards/FreePlayBoard'
import GoFishBoard from './boards/GoFishBoard'
import CrazyEightsBoard from './boards/CrazyEightsBoard'
import SnapBoard from './boards/SnapBoard'
import OldMaidBoard from './boards/OldMaidBoard'
import SevensBoard from './boards/SevensBoard'

import { setupCrazyEights } from './rules/crazyEights'
import { setupSnap } from './rules/snap'
import { setupOldMaid } from './rules/oldMaid'
import { setupSevens } from './rules/sevens'

export const GAMES = [
  {
    id: 'freeplay',
    name: 'Free Play',
    emoji: '🃏',
    Board: FreePlayBoard,
    deal: { pickable: true, default: 5, min: 1, max: 13 },
    setup({ storage, playerIds, count }) {
      dealToPlayers(storage, playerIds, count)
    },
    rules: {
      objective: 'A normal deck of cards to play however you like — no rules built in!',
      howTo: [
        'Tap the deck to draw a card into your hand.',
        'Tap a card in your hand to play it to the middle.',
        'Use Undo to take back the top card, Shuffle to mix the pile back in, and Sort to tidy your hand.',
      ],
      win: "There's no winner — use it to play any real-life card game you like!",
    },
  },
  {
    id: 'gofish',
    name: 'Go Fish',
    emoji: '🎣',
    Board: GoFishBoard,
    deal: { pickable: false, perPlayer: (n) => (n <= 2 ? 7 : 5) },
    setup({ storage, playerIds, count }) {
      dealToPlayers(storage, playerIds, count)
      beginTurns(storage, playerIds)
      const booksObj = storage.get('books')
      for (const pid of playerIds) booksObj.set(pid, [])
      const la = storage.get('lastAction')
      la.set('message', '')
      la.set('id', 0)
    },
    lobbyHint: (n) => `${n <= 2 ? 7 : 5} cards each · ask for matching ranks · first to collect all their sets wins`,
    rules: {
      objective: "Collect 'books' — all four cards of the same number (four Kings, four 7s…).",
      howTo: [
        "On your turn, tap a number you're holding, then tap a player to ask them for it.",
        'If they have any, you get them all — and you go again!',
        "If they don't, you 'Go Fish' and draw from the deck.",
        'Four of a kind are laid down automatically as a book.',
      ],
      win: 'When all 13 books are laid down, whoever collected the most wins!',
    },
  },
  {
    id: 'crazy8s',
    name: 'Crazy Eights',
    emoji: '🎵',
    Board: CrazyEightsBoard,
    deal: { pickable: false, perPlayer: (n) => (n <= 2 ? 7 : 5) },
    setup: setupCrazyEights,
    lobbyHint: () => 'Match the suit or number · 8s are wild · first to empty their hand wins',
    rules: {
      objective: 'Be the first to get rid of all your cards.',
      howTo: [
        'On your turn, play a card that matches the suit OR number of the top card.',
        "Can't play? Tap the deck to draw — that ends your turn.",
        '8s are wild — play one any time, then choose the next suit everyone must follow.',
      ],
      win: 'The first player with an empty hand wins!',
    },
  },
  {
    id: 'snap',
    name: 'Snap',
    emoji: '👏',
    Board: SnapBoard,
    deal: { all: true },
    setup: setupSnap,
    lobbyHint: () => 'Flip cards to the middle · smash SNAP when two match · fastest wins the pile',
    rules: {
      objective: 'Win all the cards by being fastest to spot a match.',
      howTo: [
        'Your cards stay face down. On your turn, tap Flip to turn your top card onto the middle.',
        'Watch the middle — when the top two cards are the same number, smash SNAP!',
        'The fastest snapper wins the whole middle pile.',
        "Run out of cards and you're out.",
      ],
      win: 'The last player still holding cards wins!',
    },
  },
  {
    id: 'oldmaid',
    name: 'Old Maid',
    emoji: '🙅',
    Board: OldMaidBoard,
    deal: { all: true },
    setup: setupOldMaid,
    lobbyHint: () => 'Throw away pairs · take a hidden card from the next player · avoid the lonely Queen',
    rules: {
      objective: "Don't get stuck holding the lonely Queen at the end.",
      howTo: [
        'Any pairs in your hand are thrown away automatically.',
        'On your turn, take one hidden card from the next player.',
        "If it matches a card you have, that pair is thrown away too.",
        "Empty your hand and you're safe!",
      ],
      win: 'Whoever is left holding the single Queen (the Old Maid) loses — everyone else wins!',
    },
  },
  {
    id: 'sevens',
    name: 'Sevens',
    emoji: '🔢',
    Board: SevensBoard,
    deal: { all: true },
    setup: setupSevens,
    lobbyHint: () => 'Play the 7s, then build up and down each suit · pass if you\'re stuck',
    rules: {
      objective: 'Be the first to play all your cards onto the table.',
      howTo: [
        "The 7 of each suit starts that suit's row.",
        'Add cards next to a row: 8, 9, 10… going up, or 6, 5, 4… going down.',
        'If you have no card you can play, you must Pass.',
      ],
      win: 'The first player to empty their hand wins!',
    },
  },
]

// Look up a game by its id (falls back to the first game).
export function getGame(id) {
  return GAMES.find((g) => g.id === id) ?? GAMES[0]
}

// How many cards to deal each player for this game, given the player count.
export function dealCountFor(game, playerCount, pickedCount) {
  if (game.deal.pickable) return pickedCount
  if (game.deal.perPlayer) return game.deal.perPlayer(playerCount)
  return 0 // deal.all games ignore this — their setup deals everything
}
