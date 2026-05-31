import { useState } from 'react'
import './App.css'
import { RoomProvider, useStorage, LiveList, LiveObject } from './liveblocks.config'
import { getSavedName, saveLastRoom, makeRoomCode } from './lib/identity'
import { getGame } from './games/registry'
import ErrorBoundary from './components/ErrorBoundary'
import NameScreen from './screens/NameScreen'
import LandingScreen from './screens/LandingScreen'
import Lobby from './screens/Lobby'

// Picks which game board to show, based on the game mode stored in the room.
// Adding a game to the registry makes it playable here with no changes.
function GameHost({ playerName, roomCode, onLeave }) {
  const gameMode = useStorage((root) => root.gameMode ?? 'freeplay')
  const Board = getGame(gameMode).Board
  return <Board playerName={playerName} roomCode={roomCode} onLeave={onLeave} />
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

  if (!playerName) {
    return <NameScreen onDone={(name) => setPlayerName(name)} />
  }

  if (screen === 'landing') {
    return <LandingScreen playerName={playerName} onCreate={handleCreate} onJoin={handleJoin} />
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
        }}
      >
        {screen === 'lobby'
          ? <Lobby roomCode={roomCode} playerName={playerName} isCreator={isCreator} onLeave={() => setScreen('landing')} onStart={() => setScreen('game')} />
          : <GameHost playerName={playerName} roomCode={roomCode} onLeave={() => setScreen('landing')} />
        }
      </RoomProvider>
    </ErrorBoundary>
  )
}

export default App
