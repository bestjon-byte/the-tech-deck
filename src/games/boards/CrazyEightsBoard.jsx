import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { SUITS, rankOf, suitOf } from '../../lib/cards'
import { useTurns, advanceTurn } from '../../engine/turns'
import { isPlayable } from '../rules/crazyEights'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardFace from '../../components/CardFace'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'

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
  const lastAction = useStorage((root) => root.lastAction ?? { message: '', id: 0 })

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)

  const [pendingEight, setPendingEight] = useState(null) // cardId of an 8 awaiting a suit choice
  const [actionMsg, setActionMsg] = useState('')
  const [shownId, setShownId] = useState(0)

  if (lastAction && lastAction.id !== shownId && lastAction.message) {
    setShownId(lastAction.id)
    setActionMsg(lastAction.message)
  }
  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(''), 4000)
    return () => clearTimeout(t)
  }, [actionMsg])

  const topCard = discardPile?.[0] ?? null

  const playCard = useMutation(({ storage }, { id, cardId, chosenSuit }) => {
    const handsObj = storage.get('hands')
    const discard = storage.get('discardPile')
    const hand = handsObj.get(id) ?? []
    const card = hand.find((c) => c.id === cardId)
    const top = discard.length > 0 ? discard.get(0) : null
    const declared = storage.get('declaredSuit') ?? ''
    if (!card || !isPlayable(card, top, declared)) return

    handsObj.set(id, hand.filter((c) => c.id !== cardId))
    discard.insert(card, 0)
    storage.set('declaredSuit', rankOf(card) === '8' ? (chosenSuit || suitOf(card)) : '')

    const la = storage.get('lastAction')
    const suitText = rankOf(card) === '8' ? ` and changed the suit to ${chosenSuit || suitOf(card)}` : ''
    la.set('message', `${id} played ${card.label}${suitText}`)
    la.set('id', (la.get('id') ?? 0) + 1)

    // The win is detected in the board; only pass the turn if cards remain.
    if ((handsObj.get(id) ?? []).length > 0) advanceTurn(storage, id)
  }, [])

  const drawCard = useMutation(({ storage }, id) => {
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
    const la = storage.get('lastAction')
    if (deckList.length > 0) {
      const card = deckList.get(0)
      deckList.delete(0)
      handsObj.set(id, [...(handsObj.get(id) ?? []), card])
      la.set('message', `${id} drew a card`)
    } else {
      la.set('message', `${id} couldn't move and passed`)
    }
    la.set('id', (la.get('id') ?? 0) + 1)
    advanceTurn(storage, id)
  }, [])

  if (deck === null || !hands) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  // Someone empties their hand → game over.
  const winner = playerOrder.find((p) => (hands[p] ?? []).length === 0)
  if (winner) {
    const scores = playerOrder
      .map((p) => ({ name: p, count: (hands[p] ?? []).length }))
      .sort((a, b) => a.count - b.count)
      .map((s) => ({ name: s.name, detail: `${s.count} cards left` }))
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
            <Opponent key={p} name={p} sub={`${(hands[p] ?? []).length} cards`}>
              <div className="opponent-cards">
                {Array.from({ length: Math.min((hands[p] ?? []).length, 13) }).map((_, i) => <CardBack key={i} />)}
              </div>
            </Opponent>
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="piles-area">
          <div className="pile-col">
            {deck.length > 0 || discardPile.length > 1 ? (
              <CardBack className="draw-pile-card" onClick={isMyTurn ? () => drawCard(myId) : undefined} />
            ) : (
              <div className="empty-pile">Empty</div>
            )}
            <span className="pile-label">Draw{deck.length > 0 ? ` · ${deck.length}` : ''}</span>
          </div>
          <div className="pile-col">
            {topCard ? <CardFace label={topCard.label} red={topCard.red} /> : <div className="empty-pile discard-empty">—</div>}
            <span className="pile-label">{declaredSuit ? `Suit: ${declaredSuit}` : 'Discard'}</span>
          </div>
        </div>

        {isMyTurn && (
          <div className="action-buttons">
            <button className="action-btn draw-btn" onClick={() => drawCard(myId)}>Draw / Pass</button>
          </div>
        )}

        {/* Suit picker shown after playing an 8 */}
        {pendingEight !== null && (
          <div className="suit-picker">
            <div className="ask-label">Pick the new suit:</div>
            <div className="suit-choices">
              {SUITS.map((s) => (
                <button
                  key={s}
                  className={`suit-choice ${s === '♥' || s === '♦' ? 'red' : ''}`}
                  onClick={() => { playCard({ id: myId, cardId: pendingEight, chosenSuit: s }); setPendingEight(null) }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Hand
        cards={myHand}
        onCardClick={isMyTurn ? handleCardClick : undefined}
        isHighlighted={(card) => isMyTurn && isPlayable(card, topCard, declaredSuit)}
        showSort={false}
        hint={isMyTurn ? 'Tap a glowing card to play it' : undefined}
      />
    </div>
  )
}
