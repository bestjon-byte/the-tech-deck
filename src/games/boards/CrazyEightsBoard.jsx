import { useState } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { SUITS, rankOf, suitOf, nCards } from '../../lib/cards'
import { useTurns, advanceTurn } from '../../engine/turns'
import { announce, useActionMessage } from '../../engine/announce'
import { useAutoPass } from '../../engine/autoPass'
import { isPlayable } from '../rules/crazyEights'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import AutoPassNotice from '../../components/AutoPassNotice'
import CardFace from '../../components/CardFace'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent, CardFan } from '../../components/Opponent'

const isRed = (suit) => suit === '♥' || suit === '♦'

// Draw one card (shuffling the discards back in if the deck's run out), then
// the turn passes. Used by the Draw button AND by auto-draw.
function doDraw(storage, id, why) {
  const deckList = storage.get('deck')
  const discard = storage.get('discardPile')
  // Out of cards? Shuffle the discard pile (except the top) back into the deck.
  if (deckList.length === 0 && discard.length > 1) {
    const recycled = []
    for (let i = 1; i < discard.length; i++) recycled.push(discard.get(i))
    while (discard.length > 1) discard.delete(1)
    recycled.sort(() => Math.random() - 0.5).forEach((c) => deckList.push(c))
  }
  const handsObj = storage.get('hands')
  if (deckList.length > 0) {
    const card = deckList.get(0)
    deckList.delete(0)
    handsObj.set(id, [...(handsObj.get(id) ?? []), card])
    announce(storage, `${id} ${why ? `${why} and ` : ''}drew a card`, { kind: 'fly', from: '@deck', to: id })
  } else {
    announce(storage, `${id} couldn't move and passed`, { kind: 'bubble', at: id, text: '😶 Pass' })
  }
  advanceTurn(storage, id)
}

// ── Crazy Eights ───────────────────────────────────────────
// Shed your whole hand by matching the suit or rank of the top card. 8s are
// wild — play one and pick the suit everyone must follow.
export default function CrazyEightsBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const hands = useStorage((root) => root.hands)
  const deck = useStorage((root) => root.deck)
  const discardPile = useStorage((root) => root.discardPile)
  const declaredSuit = useStorage((root) => root.declaredSuit ?? '')
  const lastActionId = useStorage((root) => root.lastAction?.id ?? 0)
  const actionMsg = useActionMessage(4000)

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)

  const [pendingEight, setPendingEight] = useState(null) // cardId of an 8 awaiting a suit choice

  const topCard = discardPile?.[0] ?? null

  const playCard = useMutation(({ storage }, { id, cardId, chosenSuit }) => {
    if (storage.get('currentTurn') !== id) return
    const handsObj = storage.get('hands')
    const discard = storage.get('discardPile')
    const hand = handsObj.get(id) ?? []
    const card = hand.find((c) => c.id === cardId)
    const top = discard.length > 0 ? discard.get(0) : null
    const declared = storage.get('declaredSuit') ?? ''
    if (!card || !isPlayable(card, top, declared)) return

    handsObj.set(id, hand.filter((c) => c.id !== cardId))
    discard.insert(card, 0)
    const isEight = rankOf(card) === '8'
    const suit = isEight ? (chosenSuit || suitOf(card)) : ''
    storage.set('declaredSuit', suit)

    const left = (handsObj.get(id) ?? []).length
    const fx = []
    if (isEight) {
      fx.push({
        kind: 'slam', tone: 'rainbow', title: 'CRAZY 8!', emoji: suit, red: isRed(suit), sound: 'zap',
        who: id, sub: `${id} changed the suit to ${suit}`, subMe: `You changed the suit to ${suit}`,
      })
    }
    if (left === 1) {
      fx.push(isEight
        ? { kind: 'bubble', at: id, text: '☝️ Last card!' }
        : { kind: 'slam', tone: 'red', title: 'LAST CARD!', emoji: '☝️', burst: false, who: id, sub: `${id} has one card left!`, subMe: 'One more and you win!' })
    }
    announce(storage, `${id} played ${card.label}${isEight ? ` and changed the suit to ${suit}` : ''}`, fx.length ? fx : null)

    // The win is detected in the board; only pass the turn if cards remain.
    if (left > 0) advanceTurn(storage, id)
  }, [])

  const drawCard = useMutation(({ storage }, id) => {
    if (storage.get('currentTurn') !== id) return
    doDraw(storage, id)
  }, [])

  // ⏭ No card you can play? You'd have to draw anyway — so it happens by itself.
  const autoDraw = useMutation(({ storage }, id) => {
    if (storage.get('currentTurn') !== id) return
    const discard = storage.get('discardPile')
    const top = discard.length > 0 ? discard.get(0) : null
    const declared = storage.get('declaredSuit') ?? ''
    const hand = storage.get('hands').get(id) ?? []
    if (hand.length === 0 || hand.some((c) => isPlayable(c, top, declared))) return
    doDraw(storage, id, 'had no match')
  }, [])

  const turnHand = hands?.[currentTurn] ?? []
  const winner = playerOrder.find((p) => (hands?.[p] ?? []).length === 0)
  const turnIsStuck = !!hands && !winner && turnHand.length > 0 && !turnHand.some((c) => isPlayable(c, topCard, declaredSuit))
  useAutoPass({ myId, currentTurn, order: playerOrder, stuck: turnIsStuck, act: autoDraw, watch: lastActionId })

  if (deck === null || !hands) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  // Someone empties their hand → game over.
  if (winner) {
    const scores = playerOrder
      .map((p) => ({ name: p, count: (hands[p] ?? []).length }))
      .sort((a, b) => a.count - b.count)
      .map((s) => ({ name: s.name, detail: `${nCards(s.count)} left` }))
    return <WinnerScreen emoji="🎵" title={`${winner} wins Crazy Eights!`} scores={scores} onLeave={onLeave} />
  }

  function handleCardClick(card) {
    if (!isMyTurn) return
    if (!isPlayable(card, topCard, declaredSuit)) return
    if (rankOf(card) === '8') {
      setPendingEight(card.id) // need a suit before we can play it
    } else {
      playCard({ id: myId, cardId: card.id })
    }
  }

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🎵" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {otherPlayers.map((p) => (
            <Opponent key={p} name={p} sub={`${nCards((hands[p] ?? []).length)}`}>
              <CardFan count={(hands[p] ?? []).length} />
            </Opponent>
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="piles-area">
          <div className="pile-col" data-spot="deck">
            {deck.length > 0 || discardPile.length > 1 ? (
              <CardBack className="draw-pile-card" onClick={isMyTurn ? () => drawCard(myId) : undefined} />
            ) : (
              <div className="empty-pile">Empty</div>
            )}
            <span className="pile-label">Draw{deck.length > 0 ? ` · ${deck.length}` : ''}</span>
          </div>
          <div className="pile-col" data-spot="pile">
            {topCard
              ? <div key={topCard.id} className="card-land"><CardFace label={topCard.label} red={topCard.red} /></div>
              : <div className="empty-pile discard-empty">—</div>}
            {declaredSuit
              ? <span key={declaredSuit} className={`suit-badge${isRed(declaredSuit) ? ' red' : ''}`}>Now: {declaredSuit}</span>
              : <span className="pile-label">Discard</span>}
          </div>
        </div>

        {isMyTurn && !turnIsStuck && (
          <div className="action-buttons">
            <button className="action-btn draw-btn" onClick={() => drawCard(myId)}>Draw a card</button>
          </div>
        )}
        {turnIsStuck && <AutoPassNotice who={currentTurn} myId={myId} reason="can't match" action="drawing a card" />}
      </div>

      {/* Suit picker shown after choosing an 8 */}
      {pendingEight !== null && (
        <div className="modal-overlay" onClick={() => setPendingEight(null)}>
          <div className="modal-card suit-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">🎵 Crazy 8! Pick the new suit</div>
            <div className="suit-choices">
              {SUITS.map((s) => (
                <button
                  key={s}
                  className={`suit-choice ${isRed(s) ? 'red' : ''}`}
                  onClick={() => { playCard({ id: myId, cardId: pendingEight, chosenSuit: s }); setPendingEight(null) }}
                >
                  {s}
                </button>
              ))}
            </div>
            <button className="big-btn back-btn" onClick={() => setPendingEight(null)}>Cancel</button>
          </div>
        </div>
      )}

      <Hand
        cards={myHand}
        onCardClick={isMyTurn ? handleCardClick : undefined}
        isHighlighted={(card) => isMyTurn && isPlayable(card, topCard, declaredSuit)}
        showSort
        hint={isMyTurn ? 'Tap a glowing card to play it' : undefined}
      />
    </div>
  )
}
