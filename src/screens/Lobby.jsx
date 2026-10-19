import { useState, useEffect } from 'react'
import { useOthers, useStorage, useMutation, useUpdateMyPresence } from '../liveblocks.config'
import { resetTable } from '../engine/table'
import { GAMES, getGame, dealCountFor } from '../games/registry'
import HowToPlay from '../components/HowToPlay'
import { useKeepAwake } from '../lib/keepAwake'
import { useBots, BOT_LEVELS, BOT_NAMES, levelEmoji } from '../engine/bots'
import { LiveObject } from '../liveblocks.config'
import { bankToBring, banksInRoom } from '../lib/bank'
import { STAKE_LEVELS, resetStakes } from '../engine/stakes'

// ── Lobby ──────────────────────────────────────────────────
// Shows the room code, who's here, and (for the host only) the game picker and
// Start button. The picker and the start logic are driven entirely by the game
// registry, so new games appear here automatically.
export default function Lobby({ roomCode, playerName, isCreator, onChangeName, onLeave, onStart }) {
  const others = useOthers()
  const updateMyPresence = useUpdateMyPresence()
  useKeepAwake() // don't let the screen lock while waiting for the host
  const bots = useBots()
  const loaded = useStorage(() => true) ?? false // null until the room's saved state arrives
  const botNames = Object.keys(bots)
  const gameStarted = useStorage((root) => root.gameStarted)
  const [dealCount, setDealCount] = useState(5)
  const [stakeUnit, setStakeUnit] = useState(0) // 💰 chips per point (0 = just for fun)
  const [gameId, setGameId] = useState(GAMES[0].id)
  const [roomNotFound, setRoomNotFound] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(playerName)

  // Save an edited name: remember it on this device AND push it to the room's
  // presence so everyone else sees the new name straight away.
  function saveName() {
    const trimmed = nameDraft.trim()
    if (!trimmed) { setEditingName(false); return }
    onChangeName(trimmed)
    updateMyPresence({ playerId: trimmed })
    setEditingName(false)
  }

  const selectedGame = getGame(gameId)
  const botsPlay = !!selectedGame.bots // only some games have a computer brain
  const humanIds = [playerName, ...others.map((o) => o.presence.playerId).filter(Boolean)]
  const totalPlayers = humanIds.length + (botsPlay ? botNames.length : 0)
  const roomForBot = loaded && botsPlay && totalPlayers < selectedGame.bots.max

  // 🤖 Add / remove a computer player (host only).
  const addBot = useMutation(({ storage }, { level, taken }) => {
    if (!storage.get('bots')) storage.set('bots', new LiveObject({})) // rooms made before bots existed
    const botsObj = storage.get('bots')
    const used = new Set([...taken, ...botsObj.keys()])
    const name = BOT_NAMES.find((n) => !used.has(n))
    if (name) botsObj.set(name, level)
  }, [])
  const removeBot = useMutation(({ storage }, name) => {
    storage.get('bots')?.delete(name)
  }, [])

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
  const startGame = useMutation(({ storage }, { id, playerIds, count, banks, unit }) => {
    resetTable(storage)
    resetStakes(storage, getGame(id).stakes ? unit : 0)
    storage.set('gameMode', id)
    storage.set('lastDealCount', count) // remembered so "Play again" deals the same
    getGame(id).setup({ storage, playerIds, count, banks })
    storage.set('gameStarted', true)
  }, [])

  function handleStart() {
    const playerIds = [...humanIds, ...(botsPlay ? botNames : [])]
    const count = dealCountFor(selectedGame, playerIds.length, dealCount)
    startGame({ id: gameId, playerIds, count, banks: banksInRoom(playerName, others), unit: stakeUnit })
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
          {editingName ? (
            <>
              <input
                className="name-edit-input"
                maxLength={12}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') { setNameDraft(playerName); setEditingName(false) }
                }}
                autoFocus
              />
              <button className="name-edit-btn" onClick={saveName} aria-label="Save name">✓</button>
            </>
          ) : (
            <>
              {playerName}
              <span className="you-tag">you</span>
              {(selectedGame.bank || (selectedGame.stakes && stakeUnit > 0)) && <span className="bank-tag">💰 {bankToBring().toLocaleString()}</span>}
              <button
                className="name-edit-btn"
                onClick={() => { setNameDraft(playerName); setEditingName(true) }}
                aria-label="Edit name"
              >
                ✏️
              </button>
            </>
          )}
        </div>
        {others.map((o) => (
          <div key={o.connectionId} className="player-item">
            <span className="player-dot on" />
            {o.presence.playerId || '...'}
            {(selectedGame.bank || (selectedGame.stakes && stakeUnit > 0)) && o.presence.bank != null && <span className="bank-tag">💰 {o.presence.bank.toLocaleString()}</span>}
          </div>
        ))}
        {botNames.map((name) => (
          <div key={name} className={`player-item bot-item${isCreator && !botsPlay ? ' bot-sitting-out' : ''}`}>
            <span className="bot-badge">🤖{levelEmoji(bots[name])}</span>
            {name}
            <span className="you-tag">{isCreator && !botsPlay ? `not in ${selectedGame.name}` : bots[name]}</span>
            {isCreator && (
              <button className="name-edit-btn" onClick={() => removeBot(name)} aria-label={`Remove ${name}`}>✕</button>
            )}
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

          {botsPlay && (
            <div className="bot-adder">
              <span className="deal-label">🤖 Add a computer player</span>
              <div className="bot-level-buttons">
                {BOT_LEVELS.map((l) => (
                  <button
                    key={l.id}
                    className="bot-level-btn"
                    disabled={!roomForBot}
                    onClick={() => addBot({ level: l.id, taken: humanIds })}
                  >
                    {l.emoji} {l.label}
                  </button>
                ))}
              </div>
              {loaded && !roomForBot && <span className="bot-full">Table's full ({selectedGame.bots.max} players max)</span>}
            </div>
          )}

          {selectedGame.stakes && (
            <div className="stakes-picker">
              <span className="deal-label">💰 Play for chips?</span>
              <div className="stakes-options">
                {STAKE_LEVELS.map((u) => (
                  <button key={u} className={`stakes-opt${stakeUnit === u ? ' on' : ''}`} onClick={() => setStakeUnit(u)}>
                    {u === 0 ? 'Off' : `${u}/pt`}
                  </button>
                ))}
              </div>
              {stakeUnit > 0 && (
                <ul className="stakes-rules">
                  {selectedGame.stakes.summary.map((line) => <li key={line}>{line}</li>)}
                </ul>
              )}
            </div>
          )}

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
            <button className="big-btn create-btn" onClick={handleStart} disabled={!loaded}>{loaded ? 'Start Game' : 'Connecting…'}</button>
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
