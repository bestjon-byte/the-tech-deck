import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { rankOf } from '../../lib/cards'
import { useTurns, advanceTurn } from '../../engine/turns'
import { useCardTable } from '../../engine/table'
import { extractBooks } from '../rules/goFish'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'

// ── Go Fish ────────────────────────────────────────────────
// A turn-based game. Notice it doesn't manage turns itself any more — it asks
// the shared turn engine "is it my turn?" (useTurns) and tells it "my turn is
// over" (advanceTurn). The Go-Fish-specific bit is only the asking/books rules.
export default function GoFishBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const deck = useStorage((root) => root.deck)
  const books = useStorage((root) => root.books)
  const lastAction = useStorage((root) => root.lastAction ?? { message: '', id: 0 })

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)
  const { sortHand } = useCardTable()

  const [selectedRank, setSelectedRank] = useState(null)
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [actionMsg, setActionMsg] = useState('')
  const [shownId, setShownId] = useState(0)

  // When a brand-new action arrives, show it. Adjusting state during render
  // (guarded so it only runs once per new id) is React's recommended way to
  // react to changing props/storage — no effect needed.
  if (lastAction && lastAction.id !== shownId && lastAction.message) {
    setShownId(lastAction.id)
    setActionMsg(lastAction.message)
  }

  // Auto-hide the message a few seconds after it appears.
  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(''), 4000)
    return () => clearTimeout(t)
  }, [actionMsg])

  const myRanks = [...new Set(myHand.map(rankOf))]
  const totalBooks = playerOrder.reduce((sum, p) => sum + (books?.[p] ?? []).length, 0)
  const gameOver = totalBooks >= 13

  // Ask another player for a rank — the heart of Go Fish.
  const askForRank = useMutation(({ storage }, { askerId, targetId, rank }) => {
    const handsObj = storage.get('hands')
    const booksObj = storage.get('books')
    const deckList = storage.get('deck')
    const lastActionObj = storage.get('lastAction')

    const targetHand = handsObj.get(targetId) ?? []
    const matching = targetHand.filter((c) => rankOf(c) === rank)
    let goAgain = false
    let msg

    if (matching.length > 0) {
      // Target had the cards — they come across to the asker.
      handsObj.set(targetId, targetHand.filter((c) => rankOf(c) !== rank))
      const { newHand, bookRanks } = extractBooks([...(handsObj.get(askerId) ?? []), ...matching])
      handsObj.set(askerId, newHand)
      if (bookRanks.length > 0) {
        booksObj.set(askerId, [...(booksObj.get(askerId) ?? []), ...bookRanks])
        msg = `${askerId} got ${matching.length} ${rank}(s) from ${targetId} and laid down a book! 📚`
      } else {
        msg = `${askerId} got ${matching.length} ${rank}(s) from ${targetId}! Go again ↩`
      }
      goAgain = true
    } else if (deckList.length > 0) {
      // Go Fish — draw from the deck.
      const drawnCard = deckList.get(0)
      deckList.delete(0)
      const { newHand, bookRanks } = extractBooks([...(handsObj.get(askerId) ?? []), drawnCard])
      handsObj.set(askerId, newHand)
      if (bookRanks.length > 0) {
        booksObj.set(askerId, [...(booksObj.get(askerId) ?? []), ...bookRanks])
      }
      if (rankOf(drawnCard) === rank) {
        goAgain = true
        msg = `${askerId} asked for ${rank}s — Go Fish! But drew a ${rank}! Go again! 🎣`
      } else {
        msg = `${askerId} asked for ${rank}s — Go Fish! Drew a card 🎣`
      }
    } else {
      msg = `${askerId} asked for ${rank}s — Go Fish! Deck is empty. 🎣`
    }

    lastActionObj.set('message', msg)
    lastActionObj.set('id', (lastActionObj.get('id') ?? 0) + 1)

    // Turn handling now lives in the shared engine.
    if (!goAgain) advanceTurn(storage, askerId)
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

  const passTurn = useMutation(({ storage }, playerId) => {
    advanceTurn(storage, playerId)
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
      .map((p) => ({ name: p, detail: `${(books?.[p] ?? []).length} books` }))
      .sort((a, b) => (books?.[b.name] ?? []).length - (books?.[a.name] ?? []).length)
    return <WinnerScreen title={`${scores[0]?.name} wins Go Fish!`} scores={scores} onLeave={onLeave} />
  }

  const myBooks = books?.[myId] ?? []

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />

      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🎣" />

      <ActionMessage message={actionMsg} />

      {/* Opponents with their book counts */}
      <div className="table-top">
        <div className="opponents">
          {otherPlayers.map((pName) => (
            <Opponent key={pName} name={pName} sub={`${(books?.[pName] ?? []).length} 📚`} />
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
                  {myRanks.map((rank) => (
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
                  {otherPlayers.map((pName) => (
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
              {myBooks.map((rank) => (
                <span key={rank} className="book-chip">{rank}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hand */}
      <Hand
        cards={myHand}
        onCardClick={isMyTurn ? (card) => setSelectedRank(rankOf(card) === selectedRank ? null : rankOf(card)) : undefined}
        isHighlighted={(card) => isMyTurn && selectedRank === rankOf(card)}
        showSort
        onSort={() => sortHand(myId)}
        hint={isMyTurn ? 'Tap a card to select its rank' : undefined}
      />
    </div>
  )
}
