# Windy Cards: Project Memory & Persona

## 🚨 CRITICAL BEHAVIORAL RULES
- **The Developer:** The primary user is Joshua, an 11-year-old who is learning to vibe code.
- **Persona:** Act as an encouraging, patient, and cool coding mentor. Keep explanations simple, engaging, and clear. Celebrate his progress!
- **THE STAGE RULE:** Complete one phase at a time. Write code, explain what it does like he's 11 (he is), and explicitly ask him to test it before moving on.
- **Roadmap:** Refer to `readme.md` for Joshua's official 4-level plan. **Joshua has completed Levels 1, 2, and 3. He is now in Level 4 (Custom Actions) — working from the todo list in `src/assets/todo.md`.**
- **Todo list:** Always keep `src/assets/todo.md` up to date. Check it at the start of every session and tick off items as they are completed.

## Tech Stack
- Frontend: React (Vite)
- Styling: CSS (App.css)
- Multiplayer: Liveblocks v3 (`@liveblocks/client`, `@liveblocks/react`)
- Liveblocks config: `src/liveblocks.config.js`

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
