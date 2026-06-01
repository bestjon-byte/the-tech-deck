import { useState } from 'react'
import { getLastRoom } from '../lib/identity'

// The home screen: Create a game, Join a game by code, or Rejoin the last one.
export default function LandingScreen({ playerName, onChangeName, onCreate, onJoin }) {
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(playerName)
  const lastRoom = getLastRoom()

  function saveName() {
    const trimmed = nameDraft.trim()
    if (trimmed) onChangeName(trimmed)
    setEditingName(false)
  }

  return (
    <div className="landing">
      <div className="landing-logo">🃏</div>
      <h1>The Tech Deck</h1>
      {editingName ? (
        <div className="join-form">
          <input
            className="code-input name-input"
            maxLength={12}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName()
              if (e.key === 'Escape') { setNameDraft(playerName); setEditingName(false) }
            }}
            autoFocus
          />
          <button className="big-btn create-btn" onClick={saveName} disabled={!nameDraft.trim()}>
            Save name
          </button>
        </div>
      ) : (
        <p className="landing-sub">
          Hey {playerName}! Ready to play?{' '}
          <button className="name-edit-btn" onClick={() => { setNameDraft(playerName); setEditingName(true) }} aria-label="Edit name">✏️</button>
        </p>
      )}

      {!showJoin ? (
        <div className="landing-buttons">
          <button className="big-btn create-btn" onClick={onCreate}>Create Game</button>
          <button className="big-btn join-btn" onClick={() => setShowJoin(true)}>Join Game</button>
          {lastRoom && (
            <button className="big-btn rejoin-btn" onClick={() => onJoin(lastRoom)}>
              Rejoin {lastRoom}
            </button>
          )}
        </div>
      ) : (
        <div className="join-form">
          <p>Enter the 4-letter room code</p>
          <input
            className="code-input"
            maxLength={4}
            placeholder="ABCD"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            autoFocus
          />
          <div className="join-form-buttons">
            <button className="big-btn join-btn" onClick={() => onJoin(joinCode)} disabled={joinCode.length !== 4}>
              Join
            </button>
            <button className="big-btn back-btn" onClick={() => setShowJoin(false)}>Back</button>
          </div>
        </div>
      )}
    </div>
  )
}
