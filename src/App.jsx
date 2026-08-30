import { useState, useEffect } from 'react'
import './App.css'
import { RoomProvider, useStorage, useMutation, useOthers, LiveList, LiveObject } from './liveblocks.config'
import { getSavedName, saveName, saveLastRoom, makeRoomCode } from './lib/identity'
import { getGame } from './games/registry'
import { resetTable } from './engine/table'
import { GameContext } from './components/GameContext'
import ErrorBoundary from './components/ErrorBoundary'
import HowToPlay from './components/HowToPlay'
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
  const game = getGame(gameMode)
  const Board = game.Board

  // Re-deal the same game for everyone (used by "Play again").
  const playAgain = useMutation(({ storage }) => {
    const g = getGame(storage.get('gameMode'))
    const ids = [playerName, ...others.map((o) => o.presence.playerId).filter(Boolean)]
    const count = storage.get('lastDealCount') ?? 5
    resetTable(storage)
    g.setup({ storage, playerIds: ids, count })
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
    <GameContext.Provider value={{ game, isCreator, openHelp: () => setHelpOpen(true), playAgain, chooseGame }}>
      <Board playerName={playerName} roomCode={roomCode} onLeave={onLeave} />
      <HowToPlay game={game} open={helpOpen} onClose={() => setHelpOpen(false)} />
    </GameContext.Provider>
  )
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
        initialPresence={{ playerId: playerName }}
        initialStorage={{
          deck: new LiveList([]),
          discardPile: new LiveList([]),
          hands: new LiveObject({}),
          gameStarted: false,
          gameMode: 'freeplay',
          currentTurn: '',
          playerOrder: new LiveList([]),
          books: new LiveObject({}),
          lastAction: new LiveObject({ message: '', id: 0 }),
          declaredSuit: '',
          snap: new LiveObject({ winner: '' }),
          whist: new LiveObject({}),
          shed: new LiveObject({}),
          bigTwo: new LiveObject({}),
          lastDealCount: 5,
        }}
      >
        {screen === 'lobby'
          ? <Lobby roomCode={roomCode} playerName={playerName} isCreator={isCreator} onChangeName={handleChangeName} onLeave={() => setScreen('landing')} onStart={() => setScreen('game')} />
          : <GameHost playerName={playerName} roomCode={roomCode} isCreator={isCreator} onLeave={() => setScreen('landing')} onExitToLobby={() => setScreen('lobby')} />
        }
      </RoomProvider>
    </ErrorBoundary>
  )
}

export default App
