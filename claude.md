# The Tech Deck: Project Memory & Persona

A multiplayer card-game app for phones ("cards that can't blow away in the wind").
Players sit together, each on their own iPhone/iPad, and share a room via
Liveblocks. Live at **https://the-tech-deck.vercel.app**.

## 🚨 CRITICAL BEHAVIORAL RULES
- **The Developer:** The primary user is Joshua, an 11-year-old who is learning to vibe code. His dad (Jon) also runs sessions — same project, same rules.
- **Persona:** Act as an encouraging, patient, and cool coding mentor. Keep explanations simple, engaging, and clear. Celebrate his progress!
- **THE STAGE RULE:** Complete one phase at a time. Write code, explain what it does like he's 11 (he is), and explicitly ask him to test it before moving on.
- **Roadmap:** `readme.md` has Joshua's original 4-level plan. **Levels 1–3 are done. He's in Level 4 (Custom Actions)** — building a library of card games, working from the todo list.
- **Todo list:** `src/assets/todo.md`. Check it at the start of every session, tick items off as they're done, add new ideas when Joshua mentions them.
- **How changes ship (Jon's sessions):** work goes on a `claude/...` branch. **When a piece of work is finished and there are no unanswered questions, push it straight to `main` (= the live site) — don't wait to be asked.** Lint + build + test first, then fast-forward `main` and push, confirm the live site shows the new short hash, and **finish by telling Jon the new build reference** (the short hash on the landing screen, e.g. `v54598c5`) so he can check the phones are on it. If there IS an open question that changes what gets built, push the branch only and ask.
- **Phones only:** The game is only ever *played* on iPhones/iPads (often on mobile data with poor signal). There is never a laptop at the table — so every fix must work on the live site on a phone, and Joshua tests by opening the live site, not localhost.

## ✅ Start-of-session checklist
1. **`git fetch && git status`** — work also happens in Claude cloud sessions that push `claude/...` branches and merge PRs on GitHub. If local `main` is behind `origin/main`, update it (`git pull`) **before** changing anything. (Once, a whole review was done on a 5-month-old copy and nearly overwrote 7 games!)
2. Read `src/assets/todo.md`.
3. `npm install` if `package.json` changed, then `npm run lint` and `npm run build` should both be clean.

## Tech Stack
- React 19 + Vite
- One shared stylesheet: `src/App.css` (plus Vite's leftover `src/index.css`, imported in `main.jsx` — `App.css` overrides it)
- Multiplayer: Liveblocks v3 via `createRoomContext` in `src/liveblocks.config.js` (client `throttle: 16` for fast sends)
- Hosted on Vercel, auto-deploys from `main`

## 🧱 Project Structure
```
src/
  App.jsx               ← routes name → landing → lobby → game; RoomProvider + initialStorage live here
  liveblocks.config.js  ← Liveblocks client + hooks (useStorage, useMutation, useOthers, useStatus, useSyncStatus…)
  lib/
    cards.js            ← SUITS/VALUES, buildShuffledDeck, sortCards, rankOf/suitOf
    identity.js         ← localStorage name + last room, makeRoomCode
    keepAwake.js        ← useKeepAwake(): screen wake lock in lobby + games
    sfx.js              ← playSfx('snap') — synthesised sounds (Web Audio) + mute (top bar 🔊). One recorded clip: playSfx('winner') = 🎙️ British "We have a winner!" (public/sounds, made with Piper TTS) + fanfare, on every WinnerScreen
    looks.js            ← rand(i) (stable "random"), hueOf(name, seat) seat colours
    bank.js             ← 💰 chip bank saved on the PHONE (localStorage `tech-deck-bank`), used by poker AND playing-for-chips: bankToBring/setBank/useBank, banksInRoom(me, others). Shown on the landing screen
    motion.js           ← calm mode (✨/🧘 top-bar button): isCalm/setCalm/useCalm, puts `calm` on <html> → App.css stops all animation
  engine/
    turns.js            ← useTurns, beginTurns, advanceTurn, advanceTurnWhile, readPlayerOrder, seatsAfter(order, me)
    table.js            ← useCardTable (draw/play/undo/shuffle), dealToPlayers, dealAll, resetTable
    inCharge.js         ← useInCharge(): which ONE phone does an automatic move (see Multiplayer rules)
    bots.js             ← 🤖 computer players: useBots, useBotTurn (one human phone moves for the bots), BOT_LEVELS
    announce.js         ← announce(storage, message, fx) — the toast + special effect for a move; useActionMessage()
    stakes.js           ← 💰 playing for chips: resetStakes, tallyStake (count passes/mis-snaps), payTo; StakesKeeper/StakesSummary live in components/Stakes.jsx
    spectate.js         ← 👀 spectator requests: requestWatch / answerWatch / stopWatching / watchState (storage `watch`)
    autoPass.js         ← useAutoPass(): when the current player has no legal move, one phone passes for them after 2.2s
  components/           ← CardFace, CardBack, Hand, Opponent (+CardFan, OpponentBacks), TopBar, TurnBanner,
                          ActionMessage, WinnerScreen, HowToPlay, BurnFX, FXLayer, AutoPassNotice,
                          ConnectionBanner, ErrorBoundary, GameContext (myId, game, isCreator, openHelp, playAgain, chooseGame),
                          Stakes.jsx (StakesKeeper + StakesSummary — 💰 chips payout), Spectate.jsx (👀 spectator mode),
                          ChipTable.jsx (💰 chip leaderboard pop-up — portalled to <body>, the top bar's backdrop-filter traps fixed children)
  screens/              ← NameScreen, LandingScreen (shows version tag), Lobby
  games/
    registry.js         ← THE GAME LIBRARY — one entry per game (lobby + router + rules read it)
    boards/             ← one board component per game
    rules/              ← per-game setup + pure rule helpers (poker.js = the whole Hold'em engine)
    spectateRules.js    ← 👀 who counts as "out" per game (isOut) + isOver
    stakesRules.js      ← 💰 each game's play-for-chips payout rules (STAKES.<gameId>)
    ai/                 ← bot brains (bigTwoBot.js, pokerBot.js, blackJackBot.js), e.g. bigTwoBot.js chooseBigTwoMove({ hand, trickType, level… }) → cards or null (pass)
  assets/todo.md        ← Joshua's todo list
```
`src/assets/hero.png`, `react.svg`, `vite.svg` are unused Vite leftovers.

## 🎮 Games (11)
| Game | Players' cards | Notes |
|---|---|---|
| 🃏 Free Play | host picks 1–13 each | No rules: draw, play, Undo, Shuffle. Uses `useCardTable` + `OpponentBacks` |
| 🎣 Go Fish | 7 (2p) / 5 (3+p) | Books in `books` storage; game over at 13 books |
| 🎵 Crazy Eights | 7 / 5 | 8s wild → `declaredSuit`; recycles discard when deck empties |
| 👏 Snap | whole deck | Each phone times its own player's reaction (card landing on THAT screen → finger down) and writes its own `snap['claim:Name'] = { match, ms }` (match = top card id). First claim starts a 🥁 drumroll; after `SNAP_WINDOW_MS` (2s) the in-charge phone awards the pile to the lowest `ms` and writes `snap.result` (winner + everyone's times) for the reveal. (It used to be one shared `snap.winner` key — last write won, so the SLOWEST snap to reach the server took the pile.) Mis-snap costs 5 cards; if nobody can flip and there's no match, the last flipper keeps the pile (wins) |
| 🙅 Old Maid | whole deck minus Q♣ | Pairs auto-removed; take a hidden card from next holder |
| 🔢 Sevens | whole deck | `discardPile` is the table; pass if no move |
| 🎩 Knockout Whist | 7,6,5…1 per round | State in `whist`; dog's life; trick winner's phone (or in-charge fallback) clears the trick after 1.6s; the card winning a trick in progress glows green (WINNING tag, via `whistTrickWinner`) |
| 💩 Shithead | 3 down + 3 up + 3 hand | State in `shed` (per-player keys `fu:Name`, `ready:Name`, `outWith:Name` = the card(s) they went out with); 2 reset, 3 glass, 7 lower, 10/four-of-a-kind burn → `shed.lastBurn` makes every phone play `BurnFX` 🔥 |
| 2️⃣ Big Two | 13 (4p) / 17 (2–3p) | State in `bigTwo`; 3♦ opens (set aside for 3 players); `legalPlays()` lists every legal move → smart highlights; `leftAtWin` records everyone's cards when the first player goes out (for chips) |
| 🖤 Black Jack | 7 (≤6p) / 5 (7–8p) | Uno with a normal deck. State in `blackJack` `{ dir, pickup, suit }`; pile = `discardPile` (top at index 0). 2 = pick up 2, Black Jack = pick up 7 (2s and Black Jacks stack onto each other), Red Jack cancels a pick-up, 3 invisible (`effectiveTop` sees through it), 7 reverses (2 players: go again), 8 skips, Ace wild + choose suit. Several cards of the same number in one go. Moves (`doPlay`/`doTake`) live in `rules/blackJack.js` so bots + tests share them. Bots: `ai/blackJackBot.js` (Hard beats Medium ~58%, Easy ~76%) |
| 🤠 Texas Hold'em | 2 hole cards per hand | State in `poker` (chips, bets, committed, board, dealer/sb/bb, result — see top of `rules/poker.js`). Betting + side pots + hand evaluator (`bestHand`) all in `rules/poker.js`; `doAction` for every bet; one phone (`useInCharge` on the dealer) deals the next hand, guarded by `handNo`. All-in with nobody left to bet → phase `runout`: cards face up, live win % (`equity()`, seeded so every phone agrees), and the same phone deals each street on a timer via `runoutStep(handNo, boardLen)` (RUNOUT_MS in the board; drumroll before the river; RIVER MIRACLE! if a 70%+ favourite loses). Players sit down with their whole 💰 bank (`lib/bank.js`, saved per PHONE): each phone shares it in presence (`bank`, via `BankPresence` in App.jsx), the lobby/Play Again pass `banks` to `setup`, and each phone saves its own stack back after every hand. Broke or new → fresh 1000 (bots always 1000). Blinds 10/20 doubling every 8 hands. Bots: `ai/pokerBot.js`. **Leave mid-hand = fold** (`leaveHand`): your bet stays in the pot and your bank keeps only what's in front of you. Your 2 cards + chips + buttons are a sticky bottom dock (`.poker-dock`), not a `Hand` |

Every game has "How to play" text in its registry `rules` (ℹ️ in the lobby, **?** in the game's top bar).

## ➕ How to add a new game
1. **Board:** `src/games/boards/MyGameBoard.jsx`, built from shared components (`Hand`, `CardFace`, `TopBar`, `TurnBanner`, `ActionMessage`, `Opponent`, `WinnerScreen`) and hooks (`useTurns` + `advanceTurn` if turn-based).
2. **Rules:** `src/games/rules/myGame.js` — `setupMyGame({ storage, playerIds, count })` deals (`dealToPlayers` / `dealAll`) and sets up state, plus pure rule helpers.
3. **Register:** add an entry to `GAMES` in `src/games/registry.js`:
   ```js
   {
     id: 'mygame', name: 'My Game', emoji: '🎲', Board: MyGameBoard,
     deal: { all: true },               // or { pickable:true, default,min,max } or { pickable:false, perPlayer:(n)=>5 }
     setup: setupMyGame,
     lobbyHint: (n) => 'short summary',  // optional
     rules: { objective: '...', howTo: ['step', 'step'], win: '...' },
   }
   ```
4. Want computer players? Add `bots: { max: 4 }` to the registry entry, write a brain in `games/ai/`, and in the board call `useBotTurn({ myId, currentTurn, playerOrder, act, active, watch })` with `act` = a `useMutation` that re-checks the turn and plays for the bot (see `BigTwoBoard`). Lobby "Add a computer player" buttons + Play Again pick it up.
5. Moves should call `announce(storage, 'Sam played 8♥', fx)` (never set `lastAction` by hand). For bling, pass an `fx` (see below). If a player can be stuck with no legal move, add `useAutoPass` + `<AutoPassNotice>` (see Sevens).
6. Needs its own shared state? Add a `LiveObject` slot to `initialStorage` in `App.jsx` (like `whist`, `shed`, `bigTwo`).
7. Playable for chips? Add an entry to `games/stakesRules.js` (`summary` + `settle(root)`, points summing to zero) and `stakes: STAKES.mygame` in the registry. Count things during play with `tallyStake(storage, 'key:Name')`.

The lobby button, deal picker, game screen, help pop-up and Play Again all pick it up automatically.

## 💰 Playing for chips (stakes)
Host picks Off / 1 / 5 / 10 / 25 chips per point in the lobby (games with `stakes` in the registry; not Free Play or poker). Each game's payout rules are in `games/stakesRules.js` — `settle(root)` returns null until the game is over, then `{ points, lines }` (points must sum to zero). `StakesKeeper` (in GameHost): one phone saves `stakes.result`, then every phone adds its own share to its bank once (game id remembered in localStorage `tech-deck-settled`). `WinnerScreen` shows the payout. Losses are capped at each loser's bank (`capToBanks` in `engine/stakes.js`) and the winners share only what was really paid, so chips are never made from nothing (bots pay in full). **Where chips show:** home screen (yours), lobby (everyone's, every game — from presence `bank`), top bar 💰 pill in every game (yours; gold with ×stake when playing for chips; tap → leaderboard of everyone in the room), opponent seats when playing for chips (Hold'em seats show table stacks instead), winner screen (payout + your new total). `chipText()` in lib/bank.js shortens big numbers (12.3k). Big Two records `bigTwo.leftAtWin` when the first player goes out; Snap/Sevens count `miss:Name` / `pass:Name` with `tallyStake`.

## 👀 Spectator mode
Mounted once in GameHost (`components/Spectate.jsx`), so it works in every game. A player who's out (`games/spectateRules.js`: Shithead/Big Two finished, Whist knocked out, Hold'em busted, Old Maid/Snap empty hand, Go Fish empty hand + empty pond — or anyone in the room who isn't playing) gets a **👀 Watch a hand** button → picks a player → that player gets a "wants to watch your hand" card with **Let them watch / No**. Approved: the viewer sees that player's `hands[name]` live at the bottom and their seat glows blue; the player sees "👀 Joshua is watching · Stop". Bots never need asking. Storage `watch`: `req:Viewer` (viewer writes) / `ans:Viewer` (target writes, matched by request id); `resetTable` wipes it each game. Sevens, Crazy Eights and Black Jack end when the first player goes out, so only room watchers can spectate there. New game where players drop out? Add an `isOut` rule.

## ⚠️ Multiplayer rules (read before touching game logic)
Liveblocks resolves clashes by **last write wins, per key**. Two phones changing the same key at nearly the same moment → one change is silently lost. Poor signal makes this much more likely. So:
1. **Never re-save a whole hand from a phone that isn't changing it.** Sorting is display-only: `Hand` has its own Sort buttons — by number or by suit (`showSort`, optional `sortWith` = the game's number order; mode saved in localStorage `tech-deck-sort`) and never writes to storage. (Sort used to write the hand and copied cards in Old Maid / Go Fish.)
2. **Only the acting player writes during their turn**, and mutations should re-check `storage.get('currentTurn') === id` before acting (Big Two, Whist, Shithead do).
3. **Automatic moves** (things that happen after a timer, not a tap) must be done by exactly one phone — use `useInCharge(myId, preferredPlayer, order)`. The preferred phone does it if online, otherwise the first online player; only while connected, so a phone waking up with stale cards can't redo it.
4. **Bots** have no phone: `useBotTurn` picks one human phone (via `useInCharge`) to make their moves after a short "thinking" delay.
5. Prefer **per-player keys** for things everyone does at once (Shithead's `fu:Name`, `ready:Name`).
6. Known remaining race: Free Play — two players tapping the draw pile at the same instant can both get the same card (deck is a `LiveList`, hands are whole arrays). A proper fix is a "one saved spot per card" model; a prototype exists on local branch `stale-tidy-rewrite` (built on an old version, don't merge — reuse the idea).

## ✨ Special effects (FXLayer)
`announce(storage, message, fx)` stores the effect in `lastAction.fx` (with a unique key); `FXLayer` (mounted once in `GameHost`) plays each new one on every phone, never blocks taps, and skips effects that were already there when the screen opened. `fx` is one effect or a list:
- `{ kind: 'slam', title, sub, emoji, red, tone, cards, confetti, shake, big, sound, who, titleMe, subMe }` — big title; `who` + `subMe` give that player their own wording. Tones: gold red green blue purple brown fire electric snap rainbow
- `{ kind: 'fly', from, to, count | cards }` — cards fly between seats; `from`/`to` = a player name or `'@pile'`/`'@deck'`/`'@pond'` (elements with `data-spot`)
- `{ kind: 'bubble', at, text }` — speech bubble over a seat
- `{ kind: 'ask', … }` — Go Fish's question/answer show
- add `to: 'Name'` to make an effect private (Old Maid's 😱 Queen)
**Seat order:** always draw opponents with `seatsAfter(order, myId)` (or `useTurns().otherPlayers`, which uses it) — left → right is the order they play after you, the same rotation on every phone. Play Again keeps last game's seating (newcomers sit at the end). `sound: null` on a slam/bubble = silent (Old Maid's secret Queen pop-ups are silent and don't buzz so nobody can hear who has her).
Opponent seats have `data-seat={name}` so effects can find them. Snap draws its own drumroll panel + SNAP! reveal (`FXShow` + reaction-time list) from `snap` claims/`result`. Sounds: `playSfx(name)` in `lib/sfx.js`.
**Calm mode** (`lib/motion.js`): new effects must still make sense with no animation — check `useCalm()` and skip anything that only moves/flashes (Fly, Confetti, burst, shake and BurnFX's fire already do).

## Layout notes
- `.hand` is `position: sticky; bottom: 0` (not fixed) and `.game-board` uses `overflow: clip`, so the table can never slide under your hand.
- `ActionMessage` always keeps its slot, so messages don't make the table jump.
- `@media (max-height: 720px)` squeezes things for iPhone SE/mini (smaller hand cards, piles, tableau…). It only hides card-back fans in seats (`.seat-extra .opponent-cards`) — never game info like Shithead face-up cards or poker seats.
- Sort pills (`.sort-group .sort-btn`) never wrap or change width when lit; `.hand-hint` wraps balanced. Keep it that way — a wrapping Sort row made the hand ~80px taller and buried the table.
- Shithead: each face-up card sits on its face-down card (`.shed-pair`), so your table cards take one row.
- Registry `maxPlayers` (Big Two: 4) disables Start in the lobby when the room has too many.

## Liveblocks Shared State (storage)
Room id: `windy-<CODE>`. Defined in `initialStorage` in `App.jsx`:
- `deck` — `LiveList` of cards `{ id, label, red }` (**use `id` as React key, never `label`**)
- `discardPile` — `LiveList`; index 0 is the top for most games (Sevens/Shithead push to the end)
- `hands` — `LiveObject`: player name → array of cards
- `gameStarted` (bool), `gameMode` (registry id), `lastDealCount` (for Play Again)
- `currentTurn` (name), `playerOrder` (`LiveList` of names)
- `lastAction` — `LiveObject { message, id, fx }`: the "what just happened" toast + its special effect (write it with `announce()`)
- `bots` — `LiveObject`: bot name → `'easy' | 'medium' | 'hard'` (host adds/removes in the lobby; only games with `bots` in the registry use them; older rooms may lack it — guard)
- `books` (Go Fish), `declaredSuit` (Crazy Eights), `snap` `{ 'claim:Name', result }`, `whist`, `shed`, `bigTwo`, `poker` (per-game `LiveObject`s; `setupPoker` replaces `poker` with a fresh one, so older rooms without it work)
- `watch` — `LiveObject` of spectator requests/answers (see 👀 Spectator mode)
- `stakes` — `LiveObject { unit, id, result, …tallies }`: playing for chips (`resetStakes` replaces it at every start / Play Again)
- Presence: `{ playerId, bank }` — `bank` = what that phone would sit down with (kept fresh by `BankPresence` in App.jsx)

## Screens / Flow
1. **Name screen** — first launch; name saved as `windy-player-name` (editable later on landing + lobby ✏️)
2. **Landing** — Create / Join / Rejoin last game (`windy-last-room`); 💰 bank pill ("Your chips: 3,450" / bust notice); small version tag, e.g. **"Updated 18 Oct, 13:51 · v5c6b488"** at the bottom
3. **Lobby** — room code, players, swipeable game picker + Start (host only); joiners wait. "Room not found" shows if a joiner sees nobody after 4s. Host also gets bot buttons (games with `bots`) and **💰 Play for chips? Off/1/5/10/25 per point** (games with `stakes`; resets to Off each time the lobby opens); players' banks show beside names when chips are in play
4. **Game board** — from the registry; WinnerScreen gives the host Play Again / Choose Game
- `isCreator` is local App state (`true` from Create). Rejoining via the Rejoin button makes you a non-host, even if you created the room.
- Screen changes are driven by `useEffect` watching `gameStarted` in storage, so everyone moves together.

## Player Identity
- The player's **name is their ID** (hand keys, turn order, presence `{ playerId: name }`) — two players with the same name would share a hand
- Survives disconnects: rejoining with the same name gets your cards back
- 💰 The chip bank belongs to the **phone**, not the name (Jon chose this): renaming keeps it, another device starts fresh at 1,000, clearing Safari website data wipes it

## 📶 Bad-signal features
- `ConnectionBanner` (inside RoomProvider): red **"No signal — moves will send when you're back"** while reconnecting; orange **"Sending…"** if a move takes >~1s to sync. Moves made offline are kept on the phone and sent on reconnect.
- `Opponent` shows 🟢 when that player's phone is connected; faded + **"📵 away"** when not. A closed app shows as away instantly; sudden signal loss takes Liveblocks' server 30s+ to notice.
- `useKeepAwake` (lobby + GameHost) holds a screen wake lock so phones don't auto-lock and drop the connection.

## 🧪 Testing & debugging
- **Which version is a phone on?** The landing screen's version tag (Vite `define` in `vite.config.js`, using `VERCEL_GIT_COMMIT_SHA` on Vercel or `git rev-parse` locally). To update a home-screen app: swipe it away in the app switcher, then reopen (there's no service worker; HTML is `must-revalidate`).
- **After pushing to main:** check the live landing page shows the new short commit hash (deploys take ~15–30s), tell Jon that build reference, then ask Joshua to test on the phones.
- **Two-player testing on a laptop:** two browser contexts (e.g. Playwright `browser.newContext()`) at 390×844, one creates a room, the other joins. Use `vite preview` (production build) rather than `npm run dev` when cutting connections — the dev server's live-reload socket reloads the page.
- **Peek at a room's saved state** (secret key is in `.env.local`):
  ```bash
  curl -s -H "Authorization: Bearer $LIVEBLOCKS_SECRET_KEY" \
    "https://api.liveblocks.io/v2/rooms/windy-ABCD/storage?format=json"
  ```
- **Testing game logic without phones (no Liveblocks key in cloud sessions):** bundle a test script with rolldown (`node_modules/rolldown`), aliasing `src/liveblocks.config` to a tiny mock with `LiveObject`/`LiveList` classes (`get/set/delete/keys/toJSON`, `get/push/delete/insert/length`). Then call the real `setupX` / mutations on a fake `storage = { get, set }`. Poker was checked this way: 300 random full games (chips conserved, no stuck turns, no refused legal moves), bot-vs-bot win rates, `equity()` vs known odds, and every `stakesRules` payout (sum to zero).
- **Screenshotting a board without a room:** run Vite with a config whose `resolve.alias` maps `/liveblocks\.config(\.js)?$/` to a mock where `useStorage(sel) => sel(window.__root)`, `useMutation`/`useUpdateMyPresence` are no-ops, `useOthers` returns `[]`, `useStatus` is `'connected'`. Build `window.__root` with the real engine (as above), render the board from a temporary `harness.html`, and screenshot with Playwright at 390×844 and 390×667 (SE). Delete the harness files before committing. Opponents show as "📵 away" in this mode — that's the mock, not a bug.
- **Big hands:** `.hand-inner { margin: 0 auto }` centres the hand. Don't put `justify-content: center` on the scrolling `.hand-scroll` — it pushes cards off the left edge where they can't be reached.

## 🧯 Known issues / open decisions
- **Away player stalls poker** — no auto-pass because there's always a legal move. Offered fix: turn timer (auto-check/fold after ~45s). Not built yet.
- **Poker bots:** Easy is clearly weakest (Medium beats it ~64%); Hard ≈ Medium (Hard just bets bigger + bluffs). Tuning knobs: `STYLE` in `ai/pokerBot.js`.
- **Chips edge cases:** leaving a room before the game ends means that result never reaches your bank (rejoin while the winner screen is up to collect); banks clamp at 0, so a broke loser costs nothing while the winner is paid in full; bust = fresh 1,000 (free money). Phones on an old version don't pay out — everyone must refresh after a deploy.
- **Hole cards / hands are only hidden on screen** — all cards are in shared storage (true for every game). Fine for family play, not for real money.
- Poker runout timings: `RUNOUT_MS` / `DRUMROLL_MS` at the top of `PokerBoard.jsx`; normal (non-all-in) showdowns resolve instantly by design.

## Liveblocks Badge & Keys
- The free-plan `#liveblocks-badge` is hidden in `App.css`
- Liveblocks v3 `LiveObject` has **no `toObject()`** — use `.keys()`, `.get()`, `.toJSON()`.
- `.env.local`: `VITE_LIVEBLOCKS_PUBLIC_KEY` (frontend) and `LIVEBLOCKS_SECRET_KEY` (only for the REST API above — never use it in frontend code)

## Deployment
- **Vercel** project `the-tech-deck` → https://the-tech-deck.vercel.app
- **GitHub:** https://github.com/bestjon-byte/the-tech-deck — **push to `main` = deploy to the live site**
- `VITE_LIVEBLOCKS_PUBLIC_KEY` is set in Vercel project settings (not in the repo)
```bash
git add <changed files>
git commit -m "description of change"
git push            # Vercel auto-deploys main
```

## Commands
- `npm run dev` — dev server; it prints a **Network** URL (e.g. `http://192.168.x.x:5173`) to open on a phone on the same Wi-Fi (the address changes, so read it from the output)
- `npm run lint` — ESLint (must be clean)
- `npm run build` — production build; `npx vite preview` serves it locally
