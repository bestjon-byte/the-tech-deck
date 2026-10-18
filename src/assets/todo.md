- [x] make red suites red not black
- [x] make discard look like cards
- [x] add an undo button!
- [ ] sort duplicates - players are still getting the same card (can't recreate, skipping for now)
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
- [ ] More ideas: War, Old Maid variants, Spoons, Crazy Eights "draw until you can play"

## 🔍 Big review (Oct 2026) — fixes
- [x] Big hands: cards on the left were off-screen and couldn't be reached (Sevens, Big Two, Free Play 8+ cards)
- [x] Old Maid/Go Fish: tapping Sort while someone takes your card copies that card (the "duplicate cards" bug!) — Sort now only changes YOUR screen
- [x] Show "Updated … · v1234567" on the home screen so you know your phone has the latest version
- [ ] Snap: game gets stuck if the last player flips all their cards without a match
- [ ] Knockout Whist + Shithead: game waits on ONE phone (trick winner / player 1) — freezes if that phone sleeps
- [ ] Mystery: twice a game started with everyone's cards gone and the turn stuck (saved data had currentTurn + gameMode but empty hands + playerOrder). Can't make it happen on purpose yet — if you see it, note the game + what you tapped!
- [ ] Free Play: two people tapping the draw pile at the exact same moment can both get the same card
- [ ] Bad signal: reconnecting banner, faster sending, keep the screen awake
