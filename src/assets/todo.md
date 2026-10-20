- [x] make red suites red not black
- [x] make discard look like cards
- [x] add an undo button!
- [x] sort duplicates - players are still getting the same card → found it! Tapping Sort while someone took your card copied it (fixed Oct 2026). One rarer case left — see Free Play below
- [x] maitain state, someone leaves game when return cards gone
- [ ] Game crashes and players are kicked out (need steps to reproduce)
- [x] UI has the powered by liveblocks over the cards sometimes
- [x] Add sort hand - so players hands are sorted for them
- [x] When starting the game - select how many cards are to be dealt to begin
- [x] Allow players to have names
- [x] Show other players the backs of their opponents cards
- [x] Show the game code of the current game in the actual game
- [x] Refactor into reusable building blocks (cards, turns engine, shared UI, game registry) ready for more games

## 🎮 Game library
- [x] Add Crazy Eights 🎵 (match suit/number, wild 8s, first to empty hand wins)
- [x] Add Snap 👏 (flip to the middle, race to snap matches)
- [x] Add Old Maid 🙅 (toss pairs, take a hidden card, avoid the lonely Queen)
- [x] Add Sevens 🔢 (build runs out from the 7s)
- [x] Every game has built-in "How to play" instructions (ℹ️ in lobby, ? in game)
- [ ] Playtest all the new games with friends and tweak the rules/feel
- [x] Shithead: fire animation 🔥 when a 10 or four-of-a-kind burns the pile (flames, sparks, smoke, cards burn away, screen shake — on every phone!)
- [x] Big Two smart card highlighting — lights up pairs/straights/flushes you can play, then only the cards that finish your combo
- [x] Big Two AI player 🤖 with difficulty settings — 🙂 Easy / 😎 Medium / 😈 Hard, added from the lobby (brain: `src/games/ai/bigTwoBot.js`)
- [ ] Make the bots even smarter? (Hard beats Medium 60% of the time) — or add bots to another game
- [x] Texas Hold'em 🤠 with real betting — chips, blinds, check/call/raise/fold, all-in + side pots, showdown, bots (🙂😎😈)
- [x] Poker all-in showdowns are slow and dramatic: cards up, live win % bar, one street at a time, 🥁 drumroll for the river, RIVER MIRACLE! when the favourite loses
- [x] Poker chips you KEEP 💰 — saved on your phone after every hand, bring them into any room (bust = fresh 1,000)
- [x] 💰 Play any game for chips (lobby: Off / 1 / 5 / 10 / 25 per point) — each game has its own payout rules (Big Two per card ×2/×3, Shithead pays everyone, Fan Tan passes in Sevens, mis-snaps cost in Snap…) and it all goes into your bank
- [x] 👀 Spectator mode (Joshua's idea!) — when you're out, ask to watch someone's hand live; they say yes or no, and can stop you any time
- [ ] Poker: playtest! Too slow? Blinds go up too fast/slow? Are the all-in pauses the right length?
- [ ] Poker: turn timer so an away player can't stall the hand (auto-check/fold after ~45s)
- [ ] Poker: make the 😈 Hard bot actually harder than 😎 Medium
- [ ] Chips: playtest the payouts at the table — is Big Two's ×3 ×2 too brutal? Should losing be capped at what you have?
- [ ] More ideas: War, Old Maid variants, Spoons, Crazy Eights "draw until you can play"

## 🔍 Big review (Oct 2026) — fixes
- [x] Big hands: cards on the left were off-screen and couldn't be reached (Sevens, Big Two, Free Play 8+ cards)
- [x] Old Maid/Go Fish: tapping Sort while someone takes your card copies that card (the "duplicate cards" bug!) — Sort now only changes YOUR screen
- [x] Show "Updated … · v1234567" on the home screen so you know your phone has the latest version
- [x] Snap: game gets stuck if the last player flips all their cards without a match — now the last flipper keeps the pile and wins
- [x] Knockout Whist + Shithead + Snap: game waited on ONE phone — now the next online phone takes over (engine/inCharge.js)
- [ ] Mystery: twice a game started with everyone's cards gone and the turn stuck (saved data had currentTurn + gameMode but empty hands + playerOrder). Can't make it happen on purpose yet — if you see it, note the game + what you tapped!
- [ ] Free Play: two people tapping the draw pile at the exact same moment can both get the same card
- [x] Bad signal: "No signal" / "Sending…" banner, moves sent 6× sooner, 🟢/📵 dot for who's online, screen stays awake in games

## ✨ UI glow-up (Oct 2026)
- [x] Auto-pass when you have no legal moves (Sevens pass, Big Two pass, Crazy Eights auto-draw, Shithead auto pick-up, Go Fish empty hand) — with a "😶 can't play — passing…" countdown everyone can see
- [x] Go Fish: everyone SEES each ask — "Joshua asks Dad: Got any 7s?" bubble, then YES! (cards fly across) or GO FISH! (fish swim past). Books get confetti 📚. Tap a seat to choose who to ask
- [x] Snap: giant red buzzer, tap your stack to flip, the middle shows the top cards so you can SEE the match, comic-book SNAP! on every phone, MIS-SNAP! penalty show
- [x] Special effects everywhere: Crazy 8 suit spin + "LAST CARD!", Old Maid secret 😱 "Uh oh… a Queen!", Whist ⚡ TRUMPED! + 👑 trick winner + KNOCKED OUT 🥊, Shithead OOPS/PICK UP/I'M OUT, Big Two FULL HOUSE!/BIG TWO!, Sevens ROW COMPLETE
- [x] Sounds 🔊 (made by the phone, no downloads) with a mute button in the top bar
- [x] Opponents sit in a row of coloured "seats" — the seat GLOWS when it's their turn
- [x] Winner screen: confetti, spinning rays, fanfare (💩 rains on the Shithead loser!)
- [x] Layout fixes: hand can't cover the table any more, messages don't make the table jump, Sevens rows full width, Old Maid cards fit, small iPhones (SE) fit, Leave needs two taps
- [ ] Playtest the effects at the table — too much? too little? which sound is annoying? 😄
- [x] ✨/🧘 button in the top bar turns animations off on that phone (calm mode — no flashing, shaking, flying or confetti)
- [x] Sort your hand by number (1 2 3) OR by suit (♠♥♣♦) — your phone remembers which; Aces sort high in Shithead + Whist
- [x] Shithead: see the card each player went out with (big I'M OUT! show, on their seat, and on the winner screen)
- [x] Knockout Whist: the card winning the trick so far glows green with a WINNING tag
- [x] Knockout Whist: the trump picker sees their new hand BEFORE choosing trumps (the next round is dealt first)
- [x] Shithead: 3s look like real glass, and played 3s sit askew on the pile so you can read the card underneath

