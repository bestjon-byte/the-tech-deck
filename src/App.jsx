import { useState, useEffect } from 'react'
import './App.css'
import { RoomProvider, useStorage, useMutation, useOthers, useUpdateMyPresence, LiveList, LiveObject } from './liveblocks.config'
import { useBank, bankToBring, banksInRoom } from './lib/bank'
import { getSavedName, saveName, saveLastRoom, makeRoomCode } from './lib/identity'
import { getGame } from './games/registry'
import { resetTable } from './engine/table'
import { readPlayerOrder } from './engine/turns'
import { GameContext } from './components/GameContext'
import ErrorBoundary from './components/ErrorBoundary'
import ConnectionBanner from './components/ConnectionBanner'
import { useKeepAwake } from './lib/keepAwake'
import { readBotNames } from './engine/bots'
import HowToPlay from './components/HowToPlay'
import FXLayer from './components/FXLayer'
import { StakesKeeper } from './components/Stakes'
import Spectate from './components/Spectate'
import { resetStakes, currentUnit } from './engine/stakes'
import NameScreen from './screens/NameScreen'
import LandingScreen from './screens/LandingScreen'
import Lobby from './screens/Lobby'

// Picks which game board to show, based on the game mode stored in the room,
// and gives every board a "How to play" pop-up (opened by the ? in the TopBar).
// It also hands the end-of-game screen the "Play again" / "Choose game" actions
// (host only) through context, so no board has to wire them up.
// Adding a game to the registry makes it playable here with no changes.
function GameHost({ playerName, roomCode, isCreator, onLeave, onExitToLobby }) {
  const gameMode = useStorage((root) => root.gameMode ?? 'freeplay')
  const gameStarted = useStorage((root) => root.gameStarted)
  const others = useOthers()
  const [helpOpen, setHelpOpen] = useState(false)
  useKeepAwake() // stop the screen locking (and dropping the connection) mid-game
  const game = getGame(gameMode)
  const Board = game.Board

  // Re-deal the same game for everyone (used by "Play again").
  const playAgain = useMutation(({ storage }) => {
    const g = getGame(storage.get('gameMode'))
    const here = [playerName, ...others.map((o) => o.presence.playerId).filter(Boolean)]
    if (g.bots) here.push(...readBotNames(storage)) // 🤖 computer players play again too
    // Keep everyone in the same seats as last game (someone rejoining mustn't
    // shuffle the table); anybody new sits at the end.
    const lastOrder = readPlayerOrder(storage)
    const ids = [...lastOrder.filter((p) => here.includes(p)), ...here.filter((p) => !lastOrder.includes(p))]
    const count = storage.get('lastDealCount') ?? 5
    resetTable(storage)
    resetStakes(storage, g.stakes ? currentUnit(storage) : 0) // same stake as last game, fresh payout
    g.setup({ storage, playerIds: ids, count, banks: banksInRoom(playerName, others) })
  }, [playerName, others])

  // Send everyone back to the lobby so the host can pick a different game.
  const chooseGame = useMutation(({ storage }) => {
    storage.set('gameStarted', false)
  }, [])

  // When the game is ended (gameStarted → false), every player returns to the lobby.
  useEffect(() => {
    if (gameStarted === false) onExitToLobby()
  }, [gameStarted, onExitToLobby])

  return (
    <GameContext.Provider value={{ myId: playerName, game, isCreator, openHelp: () => setHelpOpen(true), playAgain, chooseGame }}>
      <Board playerName={playerName} roomCode={roomCode} onLeave={onLeave} />
      <FXLayer myId={playerName} />
      <StakesKeeper myId={playerName} game={game} />
      <Spectate myId={playerName} gameId={game.id} />
      <HowToPlay game={game} open={helpOpen} onClose={() => setHelpOpen(false)} />
    </GameContext.Provider>
  )
}

// Keeps this phone's bank in its presence, so the room always knows it.
function BankPresence() {
  const bank = useBank()
  const updateMyPresence = useUpdateMyPresence()
  useEffect(() => { updateMyPresence({ bank: bankToBring() }) }, [bank, updateMyPresence])
  return null
}

// ── Root app ──────────────────────────────────────────────
// Just routes between the screens. All the game smarts live in games/ and
// engine/. The flow is: name → landing → lobby → game.
function App() {
  const [playerName, setPlayerName] = useState(getSavedName)
  const [screen, setScreen] = useState('landing')
  const [roomCode, setRoomCode] = useState('')
  const [isCreator, setIsCreator] = useState(false)

  function handleCreate() {
    const code = makeRoomCode()
    saveLastRoom(code)
    setRoomCode(code)
    setIsCreator(true)
    setScreen('lobby')
  }

  function handleJoin(code) {
    saveLastRoom(code)
    setRoomCode(code)
    setIsCreator(false)
    setScreen('lobby')
  }

  // Remember a new name on this device and update the live app state. In the
  // lobby this is also pushed to the room's presence so others see it instantly.
  function handleChangeName(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    saveName(trimmed)
    setPlayerName(trimmed)
  }

  if (!playerName) {
    return <NameScreen onDone={(name) => setPlayerName(name)} />
  }

  if (screen === 'landing') {
    return <LandingScreen playerName={playerName} onChangeName={handleChangeName} onCreate={handleCreate} onJoin={handleJoin} />
  }

  return (
    <ErrorBoundary>
      <RoomProvider
        id={`windy-${roomCode}`}
        initialPresence={{ playerId: playerName, bank: bankToBring() }}
        initialStorage={{
          deck: new LiveList([]),
          discardPile: new LiveList([]),
          hands: new LiveObject({}),
          gameStarted: false,
          gameMode: 'freeplay',
          currentTurn: '',
          playerOrder: new LiveList([]),
          books: new LiveObject({}),
          lastAction: new LiveObject({ message: '', id: 0, fx: null }), // fx = the special effect everyone plays (FXLayer)
          declaredSuit: '',
          snap: new LiveObject({ winner: '' }),
          whist: new LiveObject({}),
          shed: new LiveObject({}),
          bigTwo: new LiveObject({}),
          poker: new LiveObject({}),
          blackJack: new LiveObject({}),
          watch: new LiveObject({}), // 👀 spectator requests (engine/spectate.js)
          stakes: new LiveObject({ unit: 0, id: '', result: null }), // 💰 playing for chips (engine/stakes.js)
          bots: new LiveObject({}), // computer players: name → 'easy' | 'medium' | 'hard'
          lastDealCount: 5,
        }}
      >
        <ConnectionBanner />
        <BankPresence />
        {screen === 'lobby'
          ? <Lobby roomCode={roomCode} playerName={playerName} isCreator={isCreator} onChangeName={handleChangeName} onLeave={() => setScreen('landing')} onStart={() => setScreen('game')} />
          : <GameHost playerName={playerName} roomCode={roomCode} isCreator={isCreator} onLeave={() => setScreen('landing')} onExitToLobby={() => setScreen('lobby')} />
        }
      </RoomProvider>
    </ErrorBoundary>
  )
}

export default App
