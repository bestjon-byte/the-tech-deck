import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { rankOf } from '../../lib/cards'
import { useTurns, advanceTurnWhile } from '../../engine/turns'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardFace from '../../components/CardFace'
import CardBack from '../../components/CardBack'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'

// ── Snap ───────────────────────────────────────────────────
// Your cards stay face down. On your turn you flip your top card onto the
// middle. The moment the top two middle cards match, everyone races to hit
// SNAP — winner scoops the pile. Run out of cards and you're out!
export default function SnapBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const hands = useStorage((root) => root.hands)
  const centre = useStorage((root) => root.discardPile)
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
    const t = setTimeout(() => setActionMsg(''), 3000)
    return () => clearTimeout(t)
  }, [actionMsg])

  const myCount = (hands?.[myId] ?? []).length
  const topTwoMatch = centre && centre.length >= 2 && rankOf(centre[0]) === rankOf(centre[1])

  const flipCard = useMutation(({ storage }, id) => {
    const handsObj = storage.get('hands')
    const myStack = handsObj.get(id) ?? []
    if (myStack.length === 0) return
    const card = myStack[0]
    handsObj.set(id, myStack.slice(1))
    storage.get('discardPile').insert(card, 0)
    // Move to the next player who still has cards.
    advanceTurnWhile(storage, id, (pid) => (handsObj.get(pid) ?? []).length === 0)
  }, [])

  const snap = useMutation(({ storage }, id) => {
    const centreList = storage.get('discardPile')
    if (centreList.length < 2) return
    if (rankOf(centreList.get(0)) !== rankOf(centreList.get(1))) return // false snap, no harm

    const handsObj = storage.get('hands')
    const won = []
    while (centreList.length > 0) { won.push(centreList.get(0)); centreList.delete(0) }
    handsObj.set(id, [...(handsObj.get(id) ?? []), ...won]) // pile goes under your stack

    const la = storage.get('lastAction')
    la.set('message', `SNAP! ${id} grabbed ${won.length} cards 👏`)
    la.set('id', (la.get('id') ?? 0) + 1)

    // If it's a knocked-out player's turn, move on to someone with cards.
    if ((handsObj.get(storage.get('currentTurn')) ?? []).length === 0) {
      advanceTurnWhile(storage, storage.get('currentTurn'), (pid) => (handsObj.get(pid) ?? []).length === 0)
    }
  }, [])

  if (!hands) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  // One player has scooped up every card (and the middle is clear) → they win.
  const stillIn = playerOrder.filter((p) => (hands[p] ?? []).length > 0)
  if (playerOrder.length > 1 && stillIn.length === 1 && (centre?.length ?? 0) === 0) {
    return <WinnerScreen emoji="👏" title={`${stillIn[0]} wins Snap!`} onLeave={onLeave} />
  }

  const topCard = centre?.[0] ?? null

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="👏" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {otherPlayers.map((p) => (
            <Opponent key={p} name={p} sub={`${(hands[p] ?? []).length} cards`}>
              <CardBack />
            </Opponent>
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="snap-centre">
          {topCard ? <CardFace label={topCard.label} red={topCard.red} /> : <div className="empty-pile">Middle</div>}
          <span className="pile-label">Middle{centre.length > 0 ? ` · ${centre.length}` : ''}</span>
        </div>

        <div className="action-buttons">
          {isMyTurn && myCount > 0 && (
            <button className="big-btn flip-btn" onClick={() => flipCard(myId)}>Flip a card 🃏</button>
          )}
          {/* Anyone can snap — even a knocked-out player can fight back in. */}
          <button
            className={`big-btn snap-btn ${topTwoMatch ? 'armed' : ''}`}
            onClick={() => snap(myId)}
          >
            SNAP!
          </button>
        </div>
      </div>

      <div className="hand">
        <div className="my-stack">
          {myCount > 0 ? <CardBack className="draw-pile-card" /> : <div className="empty-pile">Out</div>}
          <span className="pile-label">Your stack · {myCount}</span>
        </div>
      </div>
    </div>
  )
}
