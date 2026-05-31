# Windy Cards: Project Memory & Persona

## 🚨 CRITICAL BEHAVIORAL RULES
- **The Developer:** The primary user is Joshua, an 11-year-old who is learning to vibe code.
- **Persona:** Act as an encouraging, patient, and cool coding mentor. Keep explanations simple, engaging, and clear. Celebrate his progress!
- **THE STAGE RULE:** Complete one phase at a time. Write code, explain what it does like he's 11 (he is), and explicitly ask him to test it before moving on.
- **Roadmap:** Refer to `readme.md` for Joshua's official 4-level plan. **Joshua has completed Levels 1, 2, and 3. He is now in Level 4 (Custom Actions) — working from the todo list in `src/assets/todo.md`.**
- **Todo list:** Always keep `src/assets/todo.md` up to date. Check it at the start of every session and tick off items as they are completed.

## Tech Stack
- Frontend: React (Vite)
- Styling: CSS (App.css) — one shared stylesheet, imported once in `App.jsx`
- Multiplayer: Liveblocks v3 (`@liveblocks/client`, `@liveblocks/react`)
- Liveblocks config: `src/liveblocks.config.js`

## 🧱 Project Structure (building blocks)
The app was refactored from one big `App.jsx` into small reusable pieces so we
can add lots of games. Think of it like a box of LEGO: the games are built out
of shared bricks.

```
src/
  App.jsx               ← thin: routes name → landing → lobby → game
  lib/
    cards.js            ← deck: SUITS/VALUES, buildShuffledDeck, sortCards, rankOf/suitOf
    identity.js         ← localStorage name + room code helpers
  engine/
    turns.js            ← TURNS building block: useTurns, beginTurns, advanceTurn
    table.js            ← deck/hands/discard actions: useCardTable, dealToPlayers, resetTable
  components/           ← reusable UI: CardFace, CardBack, Hand, Opponent, TopBar,
                          TurnBanner, ActionMessage, ErrorBoundary
  screens/              ← NameScreen, LandingScreen, Lobby
  games/
    registry.js         ← THE GAME LIBRARY — one entry per game
    boards/             ← one board per game: FreePlay, GoFish, CrazyEights, Snap, OldMaid, Sevens
    rules/              ← per-game logic: setup + rule helpers (extractBooks, isPlayable, …)
```

### Games in the library
`Free Play` 🃏 · `Go Fish` 🎣 · `Crazy Eights` 🎵 · `Snap` 👏 · `Old Maid` 🙅 · `Sevens` 🔢
Each shows its own instructions via the **How to play** pop-up (`components/HowToPlay.jsx`):
the lobby has an "ℹ️ How to play" link, and every game board has a **?** button in its
top bar (wired automatically through `GameContext` — boards don't need to do anything).

### Key idea: turns are NOT baked into Go Fish any more
Whose-turn-is-it lives in `engine/turns.js`. Any turn-based game:
- calls `beginTurns(storage, playerIds)` once when dealing (done via the game's `setup`),
- reads `useTurns(myId)` → `{ currentTurn, playerOrder, isMyTurn, otherPlayers }`,
- calls `advanceTurn(storage, id)` inside a mutation when a turn ends.

## ➕ How to add a new game
1. **Make a board** in `src/games/boards/MyGameBoard.jsx`. Build it from the
   shared components (`CardFace`, `Hand`, `TopBar`, `TurnBanner`, `WinnerScreen`, …)
   and hooks (`useCardTable`, and `useTurns` + `advanceTurn` if it's turn-based).
2. **Put logic in** `src/games/rules/myGame.js` — a `setupMyGame({ storage, playerIds, count })`
   that **deals the cards** (`dealToPlayers` or `dealAll`) and sets up any extra
   state, plus pure rule helpers (e.g. "is this move legal?").
3. **Add one entry** to `GAMES` in `src/games/registry.js`:
   ```js
   {
     id: 'mygame', name: 'My Game', emoji: '🎲', Board: MyGameBoard,
     deal: { all: true },               // or { pickable:true, default,min,max } or { pickable:false, perPlayer:(n)=>5 }
     setup: setupMyGame,                // deals cards + sets up turns/state
     lobbyHint: (n) => 'short summary',  // optional
     rules: { objective: '...', howTo: ['step', 'step'], win: '...' }, // shown in How-to-play
   }
   ```
That's it — the lobby button, deal picker, game screen, and instructions all
pick it up automatically. No edits to the lobby, router, or `App.jsx` needed.

### Per-game shared state
The Liveblocks storage has fixed slots (`deck`, `discardPile`, `hands`,
`playerOrder`, `currentTurn`, `books`, `lastAction`, `declaredSuit`). Games reuse
these: e.g. Snap uses `hands` as face-down stacks + `discardPile` as the middle;
Sevens uses `discardPile` as the table. `lastAction` ({message,id}) is the shared
"what just happened" toast (see `ActionMessage`). If a future game needs a new
field, add it to `initialStorage` in `App.jsx`.

## Screens / Flow
1. **Name screen** — first launch only, name saved to `localStorage` as `windy-player-name`
2. **Landing screen** — "Hey [name]! Ready to play?" with Create, Join, and Rejoin last game buttons
3. **Lobby** — room code, player list, game mode picker (host only), Start Game button (host only)
4. **Game board** — Free Play or Go Fish depending on mode selected in lobby

## Lobby Rules
- **Only the room creator** sees game mode controls and the Start Game button
- Joiners see "Waiting for the host to start..." — no controls to avoid race conditions
- `isCreator` is tracked in `App` state: `true` for `handleCreate`, `false` for `handleJoin`
- Navigation to game screen is driven entirely by `useEffect` watching `gameStarted` in storage — no direct `onStart()` call from `handleStart` to prevent double-navigation

## Liveblocks Shared State (storage)
- `deck` — `LiveList` of remaining draw pile cards
- `discardPile` — `LiveList` of played cards, top card shown
- `hands` — `LiveObject` keyed by player name → array of cards (each player's private hand)
- `gameStarted` — boolean; `true` means game is running (lobby skipped on rejoin)
- `gameMode` — string: `'freeplay'` or `'gofish'`
- `currentTurn` — string: player name whose turn it is (Go Fish only)
- `playerOrder` — `LiveList` of player names in turn order (Go Fish only)
- `books` — `LiveObject` keyed by player name → array of rank strings laid down (Go Fish only)
- `lastAction` — `LiveObject` `{ message, id }` — broadcast last move text to all players (Go Fish only)

## Player Identity
- Player name entered once, saved in `localStorage` (`windy-player-name`)
- Name is the stable player ID in `hands` storage — survives disconnects
- Last room code saved in `localStorage` (`windy-last-room`) for the Rejoin button
- Presence broadcasts `{ playerId: playerName }` so other players can see names

## Free Play Features
- 52-card shuffled deck dealt at Start Game; host picks cards-per-player (1–13)
- Cards stored as `{ id, label, red }` — **never use label as key**
- Red suits (♥ ♦) render in red, black suits (♠ ♣) in black
- Draw pile: click to draw into your hand
- Discard pile: click a hand card to play it; shows top card
- Undo button (purple): takes the top discard card back into your hand
- Shuffle button (orange): shuffles discard pile (minus top card) back into draw pile
- Sort button (teal): sorts hand by value (A→K), suit as tiebreaker
- Opponent card backs: other players' hands shown face-down with name + card count
- Room code badge (top-right): orange pill
- Leave button (top-left): returns to landing screen
- Error boundary: catches crashes, shows reload button

## Go Fish Features
- Accessed via "🎣 Go Fish" in the lobby game mode picker
- Deal: 7 cards each (2 players) or 5 cards each (3+ players) — automatic, no picker
- Turn-based: `currentTurn` in storage controls whose turn it is
- **On your turn:** tap a rank button (or tap a card in hand) to select a rank → tap a player → tap "Ask →"
- **Got it:** all matching cards transfer from target to asker; asker goes again
- **Go Fish:** asker draws from deck; if drawn card matches rank, asker goes again
- **Books:** collecting all 4 of a rank auto-lays them down; shown as green chips
- **Action messages** show last move to all players — drawn card is NOT revealed (privacy)
- **Win condition:** all 13 books laid down → winner screen with 🥇🥈🥉 scoreboard
- Sort button available in hand (same sort as Free Play)
- Opponents show book count (📚) instead of card backs

## Liveblocks Badge
- Liveblocks injects `<div id="liveblocks-badge">` into the DOM on free plans
- Hidden via `#liveblocks-badge { display: none !important; }` in App.css

## Liveblocks API Key
- Public key stored in `.env.local` as `VITE_LIVEBLOCKS_PUBLIC_KEY`
- Secret key also in `.env.local` as `LIVEBLOCKS_SECRET_KEY` (not used by frontend)

## Deployment
- **Hosted on:** Vercel — project name `the-tech-deck`
- **Live URL:** https://the-tech-deck.vercel.app
- **GitHub repo:** https://github.com/bestjon-byte/the-tech-deck — connected to Vercel for auto-deploys
- **Deploy by pushing to main** — Vercel picks it up automatically
- **Environment variables:** `VITE_LIVEBLOCKS_PUBLIC_KEY` must be set in Vercel project settings — it is NOT in the repo

### Deploy
```bash
git add src/App.jsx src/App.css   # (whatever files changed)
git commit -m "description of change"
git push                           # Vercel auto-deploys on push to main
```

## Commands Guide
- Dev Server: `npm run dev`
- Access on phone: `http://192.168.1.35:5173` (same Wi-Fi required)
- Build for production: `npm run build`
