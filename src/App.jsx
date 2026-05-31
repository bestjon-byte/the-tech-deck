import { useState, useEffect, Component } from 'react'
import './App.css'
import { RoomProvider, useStorage, useMutation, useOthers, LiveList, LiveObject } from './liveblocks.config'

// ── Card helpers ──────────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣']
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUIT_ORDER = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 }
const VALUE_ORDER = { 'A': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '10': 9, 'J': 10, 'Q': 11, 'K': 12 }

function buildShuffledDeck() {
  const deck = []
  let id = 0
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ id: id++, label: value + suit, red: suit === '♥' || suit === '♦' })
    }
  }
  return deck.sort(() => Math.random() - 0.5)
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const suitA = a.label.slice(-1), suitB = b.label.slice(-1)
    const valA = a.label.slice(0, -1), valB = b.label.slice(0, -1)
    if ((VALUE_ORDER[valA] ?? 0) !== (VALUE_ORDER[valB] ?? 0)) return (VALUE_ORDER[valA] ?? 0) - (VALUE_ORDER[valB] ?? 0)
    return SUIT_ORDER[suitA] - SUIT_ORDER[suitB]
  })
}

// ── Real playing card face ────────────────────────────────
function CardFace({ label, red, onClick }) {
  const suit = label.slice(-1)
  const value = label.slice(0, -1)
  return (
    <div className={`card${red ? ' red' : ''}`} onClick={onClick}>
      <div className="card-corner card-tl">
        <div className="card-val">{value}</div>
        <div className="card-suit-sm">{suit}</div>
      </div>
      <div className="card-center-suit">{suit}</div>
      <div className="card-corner card-br">
        <div className="card-val">{value}</div>
        <div className="card-suit-sm">{suit}</div>
      </div>
    </div>
  )
}

// ── Stable player identity saved on this device ───────────
function getSavedName() { return localStorage.getItem('windy-player-name') || '' }
function saveName(name) { localStorage.setItem('windy-player-name', name) }
function getLastRoom() { return localStorage.getItem('windy-last-room') || '' }
function saveLastRoom(code) { localStorage.setItem('windy-last-room', code) }

// ── Crash protection ──────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { crashed: false } }
  static getDerivedStateFromError() { return { crashed: true } }
  render() {
    if (this.state.crashed) {
      return (
        <div className="lobby">
          <div className="landing-logo">😬</div>
          <h2>Something crashed</h2>
          <p className="lobby-sub">Don't worry — your cards are still saved.</p>
          <button className="big-btn create-btn" onClick={() => window.location.reload()}>
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Name screen (first time only) ────────────────────────
function NameScreen({ onDone }) {
  const [name, setName] = useState('')
  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    saveName(trimmed)
    onDone(trimmed)
  }
  return (
    <div className="landing">
      <div className="landing-logo">🃏</div>
      <h1>Windy Cards</h1>
      <p className="landing-sub">What's your name?</p>
      <div className="join-form">
        <input
          className="code-input name-input"
          maxLength={12}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <button className="big-btn create-btn" onClick={handleSave} disabled={!name.trim()}>
          Let's play →
        </button>
      </div>
    </div>
  )
}

// ── Landing screen ────────────────────────────────────────
function LandingScreen({ playerName, onCreate, onJoin }) {
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const lastRoom = getLastRoom()

  return (
    <div className="landing">
      <div className="landing-logo">🃏</div>
      <h1>Windy Cards</h1>
      <p className="landing-sub">Hey {playerName}! Ready to play?</p>

      {!showJoin ? (
        <div className="landing-buttons">
          <button className="big-btn create-btn" onClick={onCreate}>
            Create Game
          </button>
          <button className="big-btn join-btn" onClick={() => setShowJoin(true)}>
            Join Game
          </button>
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
            <button className="big-btn back-btn" onClick={() => setShowJoin(false)}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Lobby screen ──────────────────────────────────────────
function Lobby({ roomCode, playerName, onLeave, onStart }) {
  const others = useOthers()
  const totalPlayers = others.length + 1
  const gameStarted = useStorage((root) => root.gameStarted)
  const [dealCount, setDealCount] = useState(5)

  useEffect(() => {
    if (gameStarted) onStart()
  }, [gameStarted])

  const freshDeal = useMutation(({ storage }, { playerIds, count }) => {
    const deckList = storage.get('deck')
    const discardList = storage.get('discardPile')
    const handsObj = storage.get('hands')

    while (deckList.length > 0) deckList.delete(0)
    while (discardList.length > 0) discardList.delete(0)

    const allCards = buildShuffledDeck()
    let cardIndex = 0

    for (const playerId of playerIds) {
      handsObj.set(String(playerId), allCards.slice(cardIndex, cardIndex + count))
      cardIndex += count
    }

    allCards.slice(cardIndex).forEach((card) => deckList.push(card))
    storage.set('gameStarted', true)
  }, [])

  function handleStart() {
    const otherIds = others.map((o) => o.presence.playerId).filter(Boolean)
    freshDeal({ playerIds: [playerName, ...otherIds], count: dealCount })
    onStart()
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

      <div className="deal-selector">
        <span className="deal-label">Cards to deal</span>
        <div className="deal-controls">
          <button className="count-btn" onClick={() => setDealCount((c) => Math.max(1, c - 1))}>−</button>
          <span className="deal-count">{dealCount}</span>
          <button className="count-btn" onClick={() => setDealCount((c) => Math.min(13, c + 1))}>+</button>
        </div>
      </div>

      <div className="lobby-actions">
        <button className="big-btn create-btn" onClick={handleStart} disabled={totalPlayers < 1}>
          Start Game
        </button>
        <button className="big-btn back-btn" onClick={onLeave}>Leave Room</button>
      </div>
    </div>
  )
}

// ── Opponents' card backs ─────────────────────────────────
function OpponentHands({ myName }) {
  const others = useOthers()
  const hands = useStorage((root) => root.hands)
  if (!hands || others.length === 0) return null

  return (
    <div className="opponents">
      {others.map((other) => {
        const name = other.presence.playerId || '?'
        const count = (hands[name] ?? []).length
        return (
          <div key={other.connectionId} className="opponent">
            <div className="opponent-info">
              <span className="opponent-name">{name}</span>
              <span className="opponent-count">{count} cards</span>
            </div>
            <div className="opponent-cards">
              {Array.from({ length: Math.min(count, 13) }).map((_, i) => (
                <div key={i} className="card-back" />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Game board ────────────────────────────────────────────
function GameBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands[myId] ?? [])
  const deck = useStorage((root) => root.deck)
  const discardPile = useStorage((root) => root.discardPile)

  const drawCard = useMutation(({ storage }, id) => {
    const deckList = storage.get('deck')
    if (deckList.length === 0) return
    const card = deckList.get(0)
    deckList.delete(0)
    const handsObj = storage.get('hands')
    handsObj.set(id, [...(handsObj.get(id) ?? []), card])
  }, [])

  const playCard = useMutation(({ storage }, { id, cardId }) => {
    const handsObj = storage.get('hands')
    const discardList = storage.get('discardPile')
    const hand = handsObj.get(id) ?? []
    const card = hand.find((c) => c.id === cardId)
    if (!card) return
    handsObj.set(id, hand.filter((c) => c.id !== cardId))
    discardList.insert(card, 0)
  }, [])

  const undoPlay = useMutation(({ storage }, id) => {
    const discardList = storage.get('discardPile')
    if (discardList.length === 0) return
    const card = discardList.get(0)
    discardList.delete(0)
    const handsObj = storage.get('hands')
    handsObj.set(id, [...(handsObj.get(id) ?? []), card])
  }, [])

  const shuffleDiscardIntoDeck = useMutation(({ storage }) => {
    const deckList = storage.get('deck')
    const discardList = storage.get('discardPile')
    if (discardList.length <= 1) return
    const cardsToShuffle = []
    for (let i = 1; i < discardList.length; i++) cardsToShuffle.push(discardList.get(i))
    while (discardList.length > 1) discardList.delete(1)
    cardsToShuffle.sort(() => Math.random() - 0.5).forEach((card) => deckList.push(card))
  }, [])

  const sortHand = useMutation(({ storage }, id) => {
    const handsObj = storage.get('hands')
    handsObj.set(id, sortCards(handsObj.get(id) ?? []))
  }, [])

  if (deck === null) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  const discardTop = discardPile[0] ?? null

  return (
    <div className="game-board">
      <div className="top-bar">
        <button className="leave-btn" onClick={onLeave}>← Leave</button>
        <div className="game-code">Room: {roomCode}</div>
      </div>

      <div className="table-top">
        <OpponentHands myName={myId} />
      </div>

      <div className="table-center">
        <div className="piles-area">
          <div className="pile-col">
            {deck.length > 0 ? (
              <div className="card-back draw-pile-card" onClick={() => drawCard(myId)} />
            ) : (
              <div className="empty-pile" onClick={() => drawCard(myId)}>Empty</div>
            )}
            <span className="pile-label">Draw {deck.length > 0 ? `· ${deck.length}` : ''}</span>
          </div>
          <div className="pile-col">
            {discardTop ? (
              <CardFace label={discardTop.label} red={discardTop.red} />
            ) : (
              <div className="empty-pile discard-empty">Discard</div>
            )}
            <span className="pile-label">Discard</span>
          </div>
        </div>

        <div className="action-buttons">
          {discardPile.length > 0 && (
            <button className="action-btn undo-btn" onClick={() => undoPlay(myId)}>Undo</button>
          )}
          {discardPile.length > 1 && (
            <button className="action-btn shuffle-btn" onClick={shuffleDiscardIntoDeck}>Shuffle</button>
          )}
        </div>
      </div>

      <div className="hand">
        {myHand.length > 1 && (
          <div className="hand-controls">
            <button className="action-btn sort-btn" onClick={() => sortHand(myId)}>Sort</button>
          </div>
        )}
        <div className="hand-scroll">
          <div className="hand-inner">
            {myHand.map((card) => (
              <CardFace
                key={card.id}
                label={card.label}
                red={card.red}
                onClick={() => playCard({ id: myId, cardId: card.id })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Root app ──────────────────────────────────────────────
function App() {
  const [playerName, setPlayerName] = useState(getSavedName)
  const [screen, setScreen] = useState('landing')
  const [roomCode, setRoomCode] = useState('')

  function handleCreate() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
    saveLastRoom(code)
    setRoomCode(code)
    setScreen('lobby')
  }

  function handleJoin(code) {
    saveLastRoom(code)
    setRoomCode(code)
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
        }}
      >
        {screen === 'lobby'
          ? <Lobby roomCode={roomCode} playerName={playerName} onLeave={() => setScreen('landing')} onStart={() => setScreen('game')} />
          : <GameBoard playerName={playerName} roomCode={roomCode} onLeave={() => setScreen('landing')} />
        }
      </RoomProvider>
    </ErrorBoundary>
  )
}

export default App
