import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { VALUES, rankOf, suitOf } from '../../lib/cards'
import { useTurns, advanceTurn } from '../../engine/turns'
import { suitRanges, canPlay, hasAnyMove, SUIT_ROWS } from '../rules/sevens'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardFace from '../../components/CardFace'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'

// ── Sevens (Fan Tan) ───────────────────────────────────────
// Build four rows out from the 7s — 6,5,4… down and 8,9,10… up. Play a card
// each turn if you can; if you can't, you pass. First to empty their hand wins.
export default function SevensBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const hands = useStorage((root) => root.hands)
  const tableau = useStorage((root) => root.discardPile)
  const lastAction = useStorage((root) => root.lastAction ?? { message: '', id: 0 })

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)

  const [actionMsg, setActionMsg] = useState('')
  const [shownId, setShownId] = useState(0)
  if (lastAction && lastAction.id !== shownId && lastAction.message) {
    setShownId(lastAction.id)
    setActionMsg(lastAction.message)
  }
  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(''), 3500)
    return () => clearTimeout(t)
  }, [actionMsg])

  const ranges = suitRanges(tableau ?? [])

  const playCard = useMutation(({ storage }, { id, cardId }) => {
    const handsObj = storage.get('hands')
    const table = storage.get('discardPile')
    const hand = handsObj.get(id) ?? []
    const card = hand.find((c) => c.id === cardId)
    if (!card) return
    const all = []
    for (let i = 0; i < table.length; i++) all.push(table.get(i))
    if (!canPlay(card, suitRanges(all))) return

    handsObj.set(id, hand.filter((c) => c.id !== cardId))
    table.push(card)
    const la = storage.get('lastAction')
    la.set('message', `${id} played ${card.label}`)
    la.set('id', (la.get('id') ?? 0) + 1)
    if ((handsObj.get(id) ?? []).length > 0) advanceTurn(storage, id)
  }, [])

  const pass = useMutation(({ storage }, id) => {
    const la = storage.get('lastAction')
    la.set('message', `${id} couldn't play and passed`)
    la.set('id', (la.get('id') ?? 0) + 1)
    advanceTurn(storage, id)
  }, [])

  if (!hands) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  const winner = playerOrder.find((p) => (hands[p] ?? []).length === 0)
  if (winner) {
    const scores = playerOrder
      .map((p) => ({ name: p, count: (hands[p] ?? []).length }))
      .sort((a, b) => a.count - b.count)
      .map((s) => ({ name: s.name, detail: `${s.count} cards left` }))
    return <WinnerScreen emoji="🔢" title={`${winner} wins Sevens!`} scores={scores} onLeave={onLeave} />
  }

  const iCanMove = hasAnyMove(myHand, ranges)

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🔢" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {otherPlayers.map((p) => (
            <Opponent key={p} name={p} sub={`${(hands[p] ?? []).length} cards`} />
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="tableau">
          {SUIT_ROWS.map((suit) => {
            const cards = (tableau ?? [])
              .filter((c) => suitOf(c) === suit)
              .sort((a, b) => VALUES.indexOf(rankOf(a)) - VALUES.indexOf(rankOf(b)))
            return (
              <div key={suit} className="tableau-row">
                <span className={`tableau-suit ${suit === '♥' || suit === '♦' ? 'red' : ''}`}>{suit}</span>
                <div className="tableau-cards">
                  {cards.length === 0
                    ? <span className="tableau-empty">play the 7</span>
                    : cards.map((c) => <CardFace key={c.id} label={c.label} red={c.red} />)}
                </div>
              </div>
            )
          })}
        </div>

        {isMyTurn && !iCanMove && (
          <div className="action-buttons">
            <button className="big-btn pass-btn" onClick={() => pass(myId)}>No moves — Pass →</button>
          </div>
        )}
      </div>

      <Hand
        cards={myHand}
        onCardClick={isMyTurn ? (card) => { if (canPlay(card, ranges)) playCard({ id: myId, cardId: card.id }) } : undefined}
        isHighlighted={(card) => isMyTurn && canPlay(card, ranges)}
        showSort={false}
        hint={isMyTurn ? (iCanMove ? 'Tap a glowing card to play' : 'No moves — tap Pass') : undefined}
      />
    </div>
  )
}
