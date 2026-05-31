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

## Current Game State (Levels 1–3 complete)

### Screens / Flow
1. **Name screen** — first launch only, name saved to `localStorage` as `windy-player-name`
2. **Landing screen** — "Hey [name]! Ready to play?" with Create, Join, and Rejoin last game buttons
3. **Lobby** — shows room code, player list by name, deal count picker (1–13), Start Game button
4. **Game board** — the actual card game

### Liveblocks Shared State (storage)
- `deck` — `LiveList` of remaining draw pile cards (shared by all players)
- `discardPile` — `LiveList` of played cards, top card shown (shared)
- `hands` — `LiveObject` keyed by player name → array of cards (each player's private hand)
- `gameStarted` — boolean; when `true`, rejoining players skip the lobby and jump straight to the game

### Player Identity
- Player name entered once, saved in `localStorage` (`windy-player-name`)
- Name is used as the stable player ID in `hands` storage — survives disconnects
- Last room code saved in `localStorage` (`windy-last-room`) for the Rejoin button
- Presence broadcasts `{ playerId: playerName }` so other players can see names

### Game Features
- 52-card shuffled deck dealt at Start Game
- Cards stored as `{ id, label, red }` — **never use label as key**
- Red suits (♥ ♦) render in red, black suits (♠ ♣) in black
- Draw pile: click to draw into your private hand
- Discard pile: click a hand card to play it; shows top card
- Undo button (purple): takes the top discard card back into your hand
- Shuffle button (orange): shuffles discard pile (minus top card) back into draw pile
- Sort button (teal): sorts your hand by suit then value
- Opponent card backs: other players' hands shown face-down with name + card count
- Room code badge (top-right corner of game): orange pill showing current room code
- Leave button (top-left): returns to landing screen
- Error boundary: catches crashes, shows reload button

## Liveblocks API Key
- Public key stored in `.env.local` as `VITE_LIVEBLOCKS_PUBLIC_KEY`
- Secret key also in `.env.local` as `LIVEBLOCKS_SECRET_KEY` (not used by frontend)

## Commands Guide
- Dev Server: `npm run dev`
- Access on phone: `http://192.168.1.35:5173` (same Wi-Fi required)
