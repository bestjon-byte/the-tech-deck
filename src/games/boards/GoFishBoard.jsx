import { useState } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { rankOf } from '../../lib/cards'
import { useTurns, advanceTurn } from '../../engine/turns'
import { announce, useActionMessage } from '../../engine/announce'
import { useAutoPass } from '../../engine/autoPass'
import { extractBooks } from '../rules/goFish'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import AutoPassNotice from '../../components/AutoPassNotice'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent, CardFan } from '../../components/Opponent'

// ── Go Fish ────────────────────────────────────────────────
// A turn-based game. Notice it doesn't manage turns itself — it asks the
// shared turn engine "is it my turn?" (useTurns) and tells it "my turn is
// over" (advanceTurn). The Go-Fish-specific bit is only the asking/books rules.
// Every ask is announced with an 'ask' effect, so the whole table SEES
// "Joshua asks Dad: got any 7s?" and the answer — no shouting needed.
export default function GoFishBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const hands = useStorage((root) => root.hands)
  const deck = useStorage((root) => root.deck)
  const books = useStorage((root) => root.books)
  const lastActionId = useStorage((root) => root.lastAction?.id ?? 0)
  const actionMsg = useActionMessage(4000)

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)

  const [selectedRank, setSelectedRank] = useState(null)
  const [pickedTarget, setPickedTarget] = useState(null)
  // Only one other player? Then there's nobody else to ask — pick them for you.
  const selectedTarget = otherPlayers.length === 1 ? otherPlayers[0] : pickedTarget

  const myRanks = [...new Set(myHand.map(rankOf))]
  const totalBooks = playerOrder.reduce((sum, p) => sum + (books?.[p] ?? []).length, 0)
  const gameOver = totalBooks >= 13

  // Ask another player for a rank — the heart of Go Fish.
  const askForRank = useMutation(({ storage }, { askerId, targetId, rank }) => {
    if (storage.get('currentTurn') !== askerId) return
    const handsObj = storage.get('hands')
    const booksObj = storage.get('books')
    const deckList = storage.get('deck')

    const askerHand = handsObj.get(askerId) ?? []
    if (!askerHand.some((c) => rankOf(c) === rank)) return // you must hold the rank you ask for
    const targetHand = handsObj.get(targetId) ?? []
    const matching = targetHand.filter((c) => rankOf(c) === rank)
    let goAgain = false
    let msg
    let result
    let newBooks = []

    if (matching.length > 0) {
      // Target had the cards — they come across to the asker.
      handsObj.set(targetId, targetHand.filter((c) => rankOf(c) !== rank))
      const { newHand, bookRanks } = extractBooks([...askerHand, ...matching])
      handsObj.set(askerId, newHand)
      newBooks = bookRanks
      msg = bookRanks.length > 0
        ? `${askerId} got ${matching.length} ${rank}(s) from ${targetId} and laid down a book! 📚`
        : `${askerId} got ${matching.length} ${rank}(s) from ${targetId}! Go again ↩`
      result = 'got'
      goAgain = true
    } else if (deckList.length > 0) {
      // Go Fish — draw from the deck.
      const drawnCard = deckList.get(0)
      deckList.delete(0)
      const { newHand, bookRanks } = extractBooks([...askerHand, drawnCard])
      handsObj.set(askerId, newHand)
      newBooks = bookRanks
      if (rankOf(drawnCard) === rank) {
        goAgain = true
        result = 'lucky'
        msg = `${askerId} asked for ${rank}s — Go Fish! But drew a ${rank}! Go again! 🎣`
      } else {
        result = 'fish'
        msg = `${askerId} asked ${targetId} for ${rank}s — Go Fish! 🎣`
      }
    } else {
      result = 'empty'
      msg = `${askerId} asked ${targetId} for ${rank}s — Go Fish! Deck is empty. 🎣`
    }
    if (newBooks.length > 0) booksObj.set(askerId, [...(booksObj.get(askerId) ?? []), ...newBooks])

    announce(storage, msg, {
      kind: 'ask', asker: askerId, target: targetId, rank, result, books: newBooks,
      cards: matching.map(({ id, label, red }) => ({ id, label, red })),
    })

    if (!goAgain) advanceTurn(storage, askerId)
  }, [])

  // ⏭ Out of cards on your turn? Draw one from the pond — or, if the pond is
  // empty too, the turn passes. Happens by itself (see useAutoPass below).
  const emptyHandMove = useMutation(({ storage }, playerId) => {
    if (storage.get('currentTurn') !== playerId) return
    const handsObj = storage.get('hands')
    if ((handsObj.get(playerId) ?? []).length > 0) return
    const deckList = storage.get('deck')
    if (deckList.length === 0) {
      announce(storage, `${playerId} has no cards left — turn passes`)
      advanceTurn(storage, playerId)
      return
    }
    const drawnCard = deckList.get(0)
    deckList.delete(0)
    const booksObj = storage.get('books')
    const { newHand, bookRanks } = extractBooks([drawnCard])
    handsObj.set(playerId, newHand)
    if (bookRanks.length > 0) booksObj.set(playerId, [...(booksObj.get(playerId) ?? []), ...bookRanks])
    announce(storage, `${playerId} ran out of cards and fished one from the pond 🎣`, { kind: 'fly', from: '@pond', to: playerId })
  }, [])

  const turnHand = hands?.[currentTurn] ?? []
  useAutoPass({
    myId,
    currentTurn,
    order: playerOrder,
    stuck: !!hands && !gameOver && playerOrder.includes(currentTurn) && turnHand.length === 0,
    act: emptyHandMove,
    watch: lastActionId,
  })

  function handleAsk() {
    if (!selectedRank || !selectedTarget) return
    askForRank({ askerId: myId, targetId: selectedTarget, rank: selectedRank })
    setSelectedRank(null)
    setPickedTarget(null)
  }

  if (deck === null || books === null || !hands) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  if (gameOver) {
    const scores = playerOrder
      .map((p) => ({ name: p, detail: `${(books?.[p] ?? []).length} books` }))
      .sort((a, b) => (books?.[b.name] ?? []).length - (books?.[a.name] ?? []).length)
    return <WinnerScreen emoji="🎣" title={`${scores[0]?.name} wins Go Fish!`} scores={scores} onLeave={onLeave} />
  }

  const myBooks = books?.[myId] ?? []
  const canAsk = isMyTurn && myHand.length > 0
  const turnIsStuck = turnHand.length === 0

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🎣" />
      <ActionMessage message={actionMsg} />

      {/* Opponents — on your turn, tap one to choose who to ask */}
      <div className="table-top">
        <div className="opponents">
          {otherPlayers.map((p) => {
            const n = (books?.[p] ?? []).length
            return (
              <Opponent
                key={p}
                name={p}
                sub={`${(hands[p] ?? []).length} cards${n ? ` · 📚 ${n}` : ''}`}
                onClick={canAsk && otherPlayers.length > 1 ? () => setPickedTarget(p === pickedTarget ? null : p) : undefined}
                selected={canAsk && selectedTarget === p}
              >
                <CardFan count={(hands[p] ?? []).length} />
              </Opponent>
            )
          })}
        </div>
      </div>

      <div className="table-center">
        {/* The pond — where you Go Fish from */}
        <div className="pond" data-spot="pond">
          {deck.length > 0 ? <CardBack className="draw-pile-card" /> : <div className="empty-pile discard-empty">Empty</div>}
          <span className="pile-label">🌊 Pond · {deck.length}</span>
        </div>

        {canAsk ? (
          <div className="ask-ui">
            <div className="ask-step">
              <span className="ask-num">1</span> Pick a number <span className="ask-hint">(or tap a card)</span>
            </div>
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
            {otherPlayers.length > 1 && (
              <>
                <div className="ask-step">
                  <span className="ask-num">2</span> Who will you ask? <span className="ask-hint">(or tap their seat)</span>
                </div>
                <div className="player-buttons">
                  {otherPlayers.map((pName) => (
                    <button
                      key={pName}
                      className={`player-btn ${selectedTarget === pName ? 'selected' : ''}`}
                      onClick={() => setPickedTarget(pName === pickedTarget ? null : pName)}
                    >
                      {pName}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              className="big-btn ask-confirm-btn"
              onClick={handleAsk}
              disabled={!selectedRank || !selectedTarget}
            >
              {selectedRank && selectedTarget
                ? `🎣 Ask ${selectedTarget} for ${selectedRank}s`
                : !selectedRank ? 'Pick a number to ask for' : 'Pick who to ask'}
            </button>
          </div>
        ) : turnIsStuck ? (
          <AutoPassNotice
            who={currentTurn}
            myId={myId}
            reason="has no cards"
            action={deck.length > 0 ? 'fishing one from the pond' : 'passing'}
          />
        ) : (
          <div className="waiting-ui">
            <div className="waiting-text">{currentTurn} is choosing who to ask…</div>
          </div>
        )}

        {myBooks.length > 0 && (
          <div className="my-books">
            <div className="books-label">Your books · {myBooks.length}</div>
            <div className="book-ranks">
              {myBooks.map((rank) => (
                <span key={rank} className="book-chip">📚 {rank}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Hand
        cards={myHand}
        onCardClick={canAsk ? (card) => setSelectedRank(rankOf(card) === selectedRank ? null : rankOf(card)) : undefined}
        isHighlighted={(card) => canAsk && selectedRank === rankOf(card)}
        showSort
        hint={canAsk ? 'Tap a card to ask for that number' : undefined}
      />
    </div>
  )
}
