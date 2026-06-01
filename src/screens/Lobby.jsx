import { useState, useEffect } from 'react'
import { useOthers, useStorage, useMutation } from '../liveblocks.config'
import { resetTable } from '../engine/table'
import { GAMES, getGame, dealCountFor } from '../games/registry'
import HowToPlay from '../components/HowToPlay'

// ── Lobby ──────────────────────────────────────────────────
// Shows the room code, who's here, and (for the host only) the game picker and
// Start button. The picker and the start logic are driven entirely by the game
// registry, so new games appear here automatically.
export default function Lobby({ roomCode, playerName, isCreator, onLeave, onStart }) {
  const others = useOthers()
  const totalPlayers = others.length + 1
  const gameStarted = useStorage((root) => root.gameStarted)
  const [dealCount, setDealCount] = useState(5)
  const [gameId, setGameId] = useState(GAMES[0].id)
  const [roomNotFound, setRoomNotFound] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const selectedGame = getGame(gameId)

  // Everyone (host and joiners) jumps to the board when the game starts.
  useEffect(() => {
    if (gameStarted) onStart()
  }, [gameStarted, onStart])

  // If a joiner sees nobody else after a few seconds, the code is probably wrong.
  useEffect(() => {
    if (isCreator) return
    const timer = setTimeout(() => {
      if (others.length === 0) setRoomNotFound(true)
    }, 4000)
    return () => clearTimeout(timer)
  }, [isCreator, others.length])

  // One generic "start" for every game: reset, set the mode, then let the game
  // set itself up (deal cards, start turns, etc.). No per-game code here.
  const startGame = useMutation(({ storage }, { id, playerIds, count }) => {
    resetTable(storage)
    storage.set('gameMode', id)
    storage.set('lastDealCount', count) // remembered so "Play again" deals the same
    getGame(id).setup({ storage, playerIds, count })
    storage.set('gameStarted', true)
  }, [])

  function handleStart() {
    const otherIds = others.map((o) => o.presence.playerId).filter(Boolean)
    const playerIds = [playerName, ...otherIds]
    const count = dealCountFor(selectedGame, playerIds.length, dealCount)
    startGame({ id: gameId, playerIds, count })
    // Navigation happens via the gameStarted effect above, for everyone.
  }

  return (
    <div className="lobby">
      <div className="lobby-code-label">Room Code</div>
      <div className="room-code">{roomCode}</div>
      <p className="lobby-sub">Share this with your friends</p>

      <div className="player-list">
        <div className="player-item">
          <span className="player-dot mine" />
          {playerName}
          <span className="you-tag">you</span>
        </div>
        {others.map((o) => (
          <div key={o.connectionId} className="player-item">
            <span className="player-dot" />
            {o.presence.playerId || '...'}
          </div>
        ))}
      </div>

      {isCreator ? (
        <>
          <div className="game-mode-selector">
            <div className="deal-label">Game Mode</div>
            <div className="mode-buttons">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  className={`mode-btn ${gameId === g.id ? 'active' : ''}`}
                  onClick={() => setGameId(g.id)}
                >
                  <span className="mode-emoji">{g.emoji}</span>
                  <span className="mode-name">{g.name}</span>
                </button>
              ))}
            </div>
            <button className="rules-link" onClick={() => setShowRules(true)}>
              ℹ️ How to play {selectedGame.name}
            </button>
          </div>

          {selectedGame.deal.pickable && (
            <div className="deal-selector">
              <span className="deal-label">Cards to deal</span>
              <div className="deal-controls">
                <button className="count-btn" onClick={() => setDealCount((c) => Math.max(selectedGame.deal.min, c - 1))}>−</button>
                <span className="deal-count">{dealCount}</span>
                <button className="count-btn" onClick={() => setDealCount((c) => Math.min(selectedGame.deal.max, c + 1))}>+</button>
              </div>
            </div>
          )}

          {selectedGame.lobbyHint && (
            <p className="lobby-sub" style={{ fontSize: '0.75rem', maxWidth: 220 }}>
              {selectedGame.lobbyHint(totalPlayers)}
            </p>
          )}

          <div className="lobby-actions">
            <button className="big-btn create-btn" onClick={handleStart}>Start Game</button>
            <button className="big-btn back-btn" onClick={onLeave}>Leave Room</button>
          </div>
        </>
      ) : roomNotFound && others.length === 0 ? (
        <div className="lobby-actions">
          <p className="lobby-sub" style={{ color: '#ff6b6b' }}>❌ Room not found! Check the code and try again.</p>
          <button className="big-btn back-btn" onClick={onLeave}>Go Back</button>
        </div>
      ) : (
        <div className="lobby-actions">
          <p className="lobby-sub">Waiting for the host to start...</p>
          <button className="big-btn back-btn" onClick={onLeave}>Leave Room</button>
        </div>
      )}

      <HowToPlay game={selectedGame} open={showRules} onClose={() => setShowRules(false)} />
    </div>
  )
}
