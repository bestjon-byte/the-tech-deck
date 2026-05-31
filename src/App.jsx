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

// ── Go Fish helpers ───────────────────────────────────────
function extractBooks(hand) {
  const counts = {}
  for (const card of hand) {
    const rank = card.label.slice(0, -1)
    counts[rank] = (counts[rank] || 0) + 1
  }
  const bookRanks = Object.entries(counts).filter(([, n]) => n === 4).map(([r]) => r)
  return {
    newHand: hand.filter(c => !bookRanks.includes(c.label.slice(0, -1))),
    bookRanks,
  }
}

function getNextTurn(playerOrder, currentId) {
  const idx = playerOrder.indexOf(currentId)
  if (idx === -1) return playerOrder[0] ?? ''
  return playerOrder[(idx + 1) % playerOrder.length]
}

// ── Real playing card face ────────────────────────────────
function CardFace({ label, red, onClick, highlight, picked }) {
  const suit = label.slice(-1)
  const value = label.slice(0, -1)
  return (
    <div className={`card${red ? ' red' : ''}${highlight ? ' card-highlight' : ''}${picked ? ' card-picked' : ''}`} onClick={onClick}>
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
      <h1>The Tech Deck</h1>
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
      <h1>The Tech Deck</h1>
      <p className="landing-sub">Hey {playerName}! Ready to play?</p>

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

// ── Lobby screen ──────────────────────────────────────────
function Lobby({ roomCode, playerName, isCreator, onLeave, onStart }) {
  const others = useOthers()
  const totalPlayers = others.length + 1
  const gameStarted = useStorage((root) => root.gameStarted)
  const storedGameMode = useStorage((root) => root.gameMode ?? 'freeplay')
  const [dealCount, setDealCount] = useState(5)
  const [gameMode, setGameMode] = useState('freeplay')
  const [roomNotFound, setRoomNotFound] = useState(false)

  useEffect(() => {
    if (gameStarted) onStart(storedGameMode)
  }, [gameStarted, storedGameMode])

  useEffect(() => {
    if (isCreator) return
    const timer = setTimeout(() => {
      if (others.length === 0) setRoomNotFound(true)
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  const freshDeal = useMutation(({ storage }, { playerIds, count, mode }) => {
    const deckList = storage.get('deck')
    const discardList = storage.get('discardPile')
    const handsObj = storage.get('hands')
    const booksObj = storage.get('books')
    const playerOrderList = storage.get('playerOrder')
    const lastActionObj = storage.get('lastAction')

    while (deckList.length > 0) deckList.delete(0)
    while (discardList.length > 0) discardList.delete(0)
    while (playerOrderList.length > 0) playerOrderList.delete(0)

    const allCards = buildShuffledDeck()
    let cardIndex = 0

    for (const playerId of playerIds) {
      handsObj.set(String(playerId), allCards.slice(cardIndex, cardIndex + count))
      cardIndex += count
    }

    allCards.slice(cardIndex).forEach((card) => deckList.push(card))

    storage.set('gameMode', mode)

    if (mode === 'gofish') {
      for (const pid of playerIds) {
        playerOrderList.push(pid)
        booksObj.set(pid, [])
      }
      storage.set('currentTurn', playerIds[0])
      lastActionObj.set('message', '')
      lastActionObj.set('id', 0)
    }

    storage.set('gameStarted', true)
  }, [])

  function handleStart() {
    const otherIds = others.map((o) => o.presence.playerId).filter(Boolean)
    const playerIds = [playerName, ...otherIds]
    const goFishCount = playerIds.length <= 2 ? 7 : 5
    const count = gameMode === 'gofish' ? goFishCount : dealCount
    freshDeal({ playerIds, count, mode: gameMode })
    // navigation is handled by the useEffect above for all players
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
              <button
                className={`mode-btn ${gameMode === 'freeplay' ? 'active' : ''}`}
                onClick={() => setGameMode('freeplay')}
              >
                🃏 Free Play
              </button>
              <button
                className={`mode-btn ${gameMode === 'gofish' ? 'active' : ''}`}
                onClick={() => setGameMode('gofish')}
              >
                🎣 Go Fish
              </button>
            </div>
          </div>

          {gameMode === 'freeplay' && (
            <div className="deal-selector">
              <span className="deal-label">Cards to deal</span>
              <div className="deal-controls">
                <button className="count-btn" onClick={() => setDealCount((c) => Math.max(1, c - 1))}>−</button>
                <span className="deal-count">{dealCount}</span>
                <button className="count-btn" onClick={() => setDealCount((c) => Math.min(13, c + 1))}>+</button>
              </div>
            </div>
          )}

          {gameMode === 'gofish' && (
            <p className="lobby-sub" style={{ fontSize: '0.75rem', maxWidth: 220 }}>
              {totalPlayers <= 2 ? 7 : 5} cards each · ask for matching ranks · first to collect all their sets wins
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
    </div>
  )
}

// ── Opponents' card backs ─────────────────────────────────
function OpponentHands() {
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

// ── Game board (Free Play) ────────────────────────────────
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
        <OpponentHands />
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

// ── Go Fish board ─────────────────────────────────────────
function GoFishBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const deck = useStorage((root) => root.deck)
  const books = useStorage((root) => root.books)
  const currentTurn = useStorage((root) => root.currentTurn ?? '')
  const playerOrder = useStorage((root) => root.playerOrder ?? [])
  const lastAction = useStorage((root) => root.lastAction ?? { message: '', id: 0 })

  const [selectedRank, setSelectedRank] = useState(null)
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [actionMsg, setActionMsg] = useState('')
  const [shownId, setShownId] = useState(0)

  useEffect(() => {
    if (lastAction && lastAction.id !== shownId && lastAction.message) {
      setActionMsg(lastAction.message)
      setShownId(lastAction.id)
      const t = setTimeout(() => setActionMsg(''), 4000)
      return () => clearTimeout(t)
    }
  }, [lastAction, shownId])

  const isMyTurn = currentTurn === myId
  const myRanks = [...new Set(myHand.map(c => c.label.slice(0, -1)))]
  const otherPlayerNames = playerOrder.filter(p => p !== myId)
  const totalBooks = playerOrder.reduce((sum, p) => sum + (books?.[p] ?? []).length, 0)
  const gameOver = totalBooks >= 13

  const askForRank = useMutation(({ storage }, { askerId, targetId, rank }) => {
    const handsObj = storage.get('hands')
    const booksObj = storage.get('books')
    const deckList = storage.get('deck')
    const lastActionObj = storage.get('lastAction')

    // Build playerOrder array from LiveList
    const orderList = storage.get('playerOrder')
    const order = []
    for (let i = 0; i < orderList.length; i++) order.push(orderList.get(i))

    const targetHand = handsObj.get(targetId) ?? []
    const matching = targetHand.filter(c => c.label.slice(0, -1) === rank)
    let gotCards = false
    let msg = ''

    if (matching.length > 0) {
      handsObj.set(targetId, targetHand.filter(c => c.label.slice(0, -1) !== rank))
      const { newHand, bookRanks } = extractBooks([...(handsObj.get(askerId) ?? []), ...matching])
      handsObj.set(askerId, newHand)
      if (bookRanks.length > 0) {
        booksObj.set(askerId, [...(booksObj.get(askerId) ?? []), ...bookRanks])
        msg = `${askerId} got ${matching.length} ${rank}(s) from ${targetId} and laid down a book! 📚`
      } else {
        msg = `${askerId} got ${matching.length} ${rank}(s) from ${targetId}! Go again ↩`
      }
      gotCards = true
    } else {
      if (deckList.length > 0) {
        const drawnCard = deckList.get(0)
        deckList.delete(0)
        const { newHand, bookRanks } = extractBooks([...(handsObj.get(askerId) ?? []), drawnCard])
        handsObj.set(askerId, newHand)
        if (bookRanks.length > 0) {
          booksObj.set(askerId, [...(booksObj.get(askerId) ?? []), ...bookRanks])
        }
        if (drawnCard.label.slice(0, -1) === rank) {
          gotCards = true
          msg = `${askerId} asked for ${rank}s — Go Fish! But drew a ${rank}! Go again! 🎣`
        } else {
          msg = `${askerId} asked for ${rank}s — Go Fish! Drew a card 🎣`
        }
      } else {
        msg = `${askerId} asked for ${rank}s — Go Fish! Deck is empty. 🎣`
      }
    }

    lastActionObj.set('message', msg)
    lastActionObj.set('id', (lastActionObj.get('id') ?? 0) + 1)

    if (!gotCards) {
      storage.set('currentTurn', getNextTurn(order, askerId))
    }
  }, [])

  const drawForEmptyHand = useMutation(({ storage }, playerId) => {
    const deckList = storage.get('deck')
    if (deckList.length === 0) return
    const drawnCard = deckList.get(0)
    deckList.delete(0)
    const handsObj = storage.get('hands')
    const booksObj = storage.get('books')
    const { newHand, bookRanks } = extractBooks([...(handsObj.get(playerId) ?? []), drawnCard])
    handsObj.set(playerId, newHand)
    if (bookRanks.length > 0) {
      booksObj.set(playerId, [...(booksObj.get(playerId) ?? []), ...bookRanks])
    }
  }, [])

  const sortHand = useMutation(({ storage }, id) => {
    const handsObj = storage.get('hands')
    handsObj.set(id, sortCards(handsObj.get(id) ?? []))
  }, [])

  const passTurn = useMutation(({ storage }, playerId) => {
    const orderList = storage.get('playerOrder')
    const order = []
    for (let i = 0; i < orderList.length; i++) order.push(orderList.get(i))
    storage.set('currentTurn', getNextTurn(order, playerId))
  }, [])

  function handleAsk() {
    if (!selectedRank || !selectedTarget) return
    askForRank({ askerId: myId, targetId: selectedTarget, rank: selectedRank })
    setSelectedRank(null)
    setSelectedTarget(null)
  }

  if (deck === null || books === null) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  if (gameOver) {
    const scores = playerOrder
      .map(p => ({ name: p, count: (books?.[p] ?? []).length }))
      .sort((a, b) => b.count - a.count)
    return (
      <div className="lobby">
        <div className="landing-logo">🏆</div>
        <h2>{scores[0]?.name} wins Go Fish!</h2>
        <div className="score-list">
          {scores.map((s, i) => (
            <div key={s.name} className="score-item">
              <span className="score-medal">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <span className="score-name">{s.name}</span>
              <span className="score-books">{s.count} books</span>
            </div>
          ))}
        </div>
        <button className="big-btn back-btn" onClick={onLeave}>Back to Menu</button>
      </div>
    )
  }

  const myBooks = books?.[myId] ?? []

  return (
    <div className="game-board">
      <div className="top-bar">
        <button className="leave-btn" onClick={onLeave}>← Leave</button>
        <div className="game-code">Room: {roomCode}</div>
      </div>

      <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`}>
        {isMyTurn ? '🎣 Your turn!' : `⏳ ${currentTurn}'s turn...`}
      </div>

      {actionMsg && <div className="action-msg">{actionMsg}</div>}

      {/* Opponents with book counts */}
      <div className="table-top">
        <div className="opponents">
          {otherPlayerNames.map(pName => (
            <div key={pName} className="opponent">
              <div className="opponent-info">
                <span className="opponent-name">{pName}</span>
                <span className="opponent-count">{(books?.[pName] ?? []).length} 📚</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ask UI */}
      <div className="table-center gofish-center">
        {isMyTurn ? (
          myHand.length === 0 ? (
            <div className="ask-ui">
              {deck.length > 0 ? (
                <>
                  <p className="ask-empty-msg">Your hand is empty!</p>
                  <button className="big-btn draw-btn" onClick={() => drawForEmptyHand(myId)}>
                    Draw a card 🃏
                  </button>
                </>
              ) : (
                <>
                  <p className="ask-empty-msg">No cards left — passing your turn!</p>
                  <button className="big-btn pass-btn" onClick={() => passTurn(myId)}>Pass Turn →</button>
                </>
              )}
            </div>
          ) : (
            <div className="ask-ui">
              <div className="ask-section">
                <div className="ask-label">Ask for rank:</div>
                <div className="rank-buttons">
                  {myRanks.map(rank => (
                    <button
                      key={rank}
                      className={`rank-btn ${selectedRank === rank ? 'selected' : ''}`}
                      onClick={() => setSelectedRank(rank === selectedRank ? null : rank)}
                    >
                      {rank}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ask-section">
                <div className="ask-label">Ask who:</div>
                <div className="player-buttons">
                  {otherPlayerNames.map(pName => (
                    <button
                      key={pName}
                      className={`player-btn ${selectedTarget === pName ? 'selected' : ''}`}
                      onClick={() => setSelectedTarget(pName === selectedTarget ? null : pName)}
                    >
                      {pName}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="big-btn ask-confirm-btn"
                onClick={handleAsk}
                disabled={!selectedRank || !selectedTarget}
              >
                {selectedRank && selectedTarget
                  ? `Ask ${selectedTarget} for ${selectedRank}s →`
                  : 'Pick a rank + player above'}
              </button>
            </div>
          )
        ) : (
          <div className="waiting-ui">
            <div className="waiting-text">Waiting for {currentTurn}...</div>
            <div className="deck-count">{deck.length} cards in deck</div>
          </div>
        )}

        {myBooks.length > 0 && (
          <div className="my-books">
            <div className="books-label">Your books ({myBooks.length})</div>
            <div className="book-ranks">
              {myBooks.map(rank => (
                <span key={rank} className="book-chip">{rank}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hand */}
      <div className="hand">
        {myHand.length > 1 && (
          <div className="hand-controls">
            {isMyTurn && <span className="hand-hint">Tap a card to select its rank</span>}
            <button className="action-btn sort-btn" onClick={() => sortHand(myId)}>Sort</button>
          </div>
        )}
        <div className="hand-scroll">
          <div className="hand-inner">
            {myHand.map((card) => {
              const rank = card.label.slice(0, -1)
              return (
                <CardFace
                  key={card.id}
                  label={card.label}
                  red={card.red}
                  highlight={isMyTurn && selectedRank === rank}
                  onClick={isMyTurn ? () => setSelectedRank(rank === selectedRank ? null : rank) : undefined}
                />
              )
            })}
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
  const [isCreator, setIsCreator] = useState(false)

  function handleCreate() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
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

  function handleStart(mode) {
    setScreen(mode === 'gofish' ? 'gofish' : 'game')
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
          ? <Lobby roomCode={roomCode} playerName={playerName} isCreator={isCreator} onLeave={() => setScreen('landing')} onStart={handleStart} />
          : screen === 'gofish'
            ? <GoFishBoard playerName={playerName} roomCode={roomCode} onLeave={() => setScreen('landing')} />
            : <GameBoard playerName={playerName} roomCode={roomCode} onLeave={() => setScreen('landing')} />
        }
      </RoomProvider>
    </ErrorBoundary>
  )
}

export default App
