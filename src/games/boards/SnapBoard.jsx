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
  const snapWinner = useStorage((root) => root.snap?.winner ?? '')

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)

  const [actionMsg, setActionMsg] = useState('')
  const [shownId, setShownId] = useState(0)
  // Brief cool-off after a mis-snap so a single panic-mash can't drain your whole
  // stack 5 cards at a time — you eat one penalty, then the button locks for a beat.
  const [penaltyLock, setPenaltyLock] = useState(false)
  if (lastAction && lastAction.id !== shownId && lastAction.message) {
    setShownId(lastAction.id)
    setActionMsg(lastAction.message)
  }
  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(''), 3000)
    return () => clearTimeout(t)
  }, [actionMsg])

  useEffect(() => {
    if (!penaltyLock) return
    const t = setTimeout(() => setPenaltyLock(false), 1200)
    return () => clearTimeout(t)
  }, [penaltyLock])

  const myCount = (hands?.[myId] ?? []).length
  const topTwoMatch = centre && centre.length >= 2 && rankOf(centre[0]) === rankOf(centre[1])
  const claimPending = !!snapWinner

  const flipCard = useMutation(({ storage }, id) => {
    if (storage.get('snap').get('winner')) return // a snap is being resolved
    const handsObj = storage.get('hands')
    const myStack = handsObj.get(id) ?? []
    if (myStack.length === 0) return
    const card = myStack[0]
    handsObj.set(id, myStack.slice(1))
    storage.get('discardPile').insert(card, 0)
    // Move to the next player who still has cards.
    advanceTurnWhile(storage, id, (pid) => (handsObj.get(pid) ?? []).length === 0)
  }, [])

  // Pressing SNAP only *claims* the pile. If several players claim at once,
  // Liveblocks settles on one winner (last write wins) — so there's exactly one.
  const claimSnap = useMutation(({ storage }, id) => {
    const centreList = storage.get('discardPile')
    if (centreList.length < 2) return
    if (rankOf(centreList.get(0)) !== rankOf(centreList.get(1))) return // not a match
    const snap = storage.get('snap')
    if (snap.get('winner')) return // already claimed this pile
    snap.set('winner', id)
  }, [])

  // Smacking SNAP when the top two cards DON'T match is a mis-snap: the culprit
  // loses up to 5 cards to the bottom of the middle pile (back into play for
  // everyone else to win). This is what stops people just mashing the button.
  const wrongSnap = useMutation(({ storage }, id) => {
    const snap = storage.get('snap')
    if (snap.get('winner')) return // a real snap is resolving — ignore stray taps
    const centreList = storage.get('discardPile')
    // Re-check it genuinely isn't a snap, so we never punish a true (if slow) call.
    if (centreList.length >= 2 && rankOf(centreList.get(0)) === rankOf(centreList.get(1))) return
    const handsObj = storage.get('hands')
    const myStack = handsObj.get(id) ?? []
    if (myStack.length === 0) return // nothing to lose
    const n = Math.min(5, myStack.length)
    const penalty = myStack.slice(0, n)
    handsObj.set(id, myStack.slice(n))
    penalty.forEach((card) => centreList.push(card)) // push = onto the bottom of the pile
    const la = storage.get('lastAction')
    la.set('message', `❌ ${id} mis-snapped — lost ${n} card${n === 1 ? '' : 's'}!`)
    la.set('id', (la.get('id') ?? 0) + 1)
  }, [])

  // A moment later, the pile is handed to whoever the claim settled on. This
  // reads the single agreed winner from storage, so every client makes the
  // SAME change — the pile can never be handed out twice. (Fixes >52 cards.)
  const awardPile = useMutation(({ storage }) => {
    const snap = storage.get('snap')
    const winner = snap.get('winner')
    if (!winner) return
    const centreList = storage.get('discardPile')
    if (centreList.length === 0) { snap.set('winner', ''); return }
    const handsObj = storage.get('hands')
    const won = []
    while (centreList.length > 0) { won.push(centreList.get(0)); centreList.delete(0) }
    handsObj.set(winner, [...(handsObj.get(winner) ?? []), ...won])

    const la = storage.get('lastAction')
    la.set('message', `SNAP! ${winner} grabbed ${won.length} cards 👏`)
    la.set('id', (la.get('id') ?? 0) + 1)
    snap.set('winner', '')

    const ct = storage.get('currentTurn')
    if ((handsObj.get(ct) ?? []).length === 0) {
      advanceTurnWhile(storage, ct, (pid) => (handsObj.get(pid) ?? []).length === 0)
    }
  }, [])

  // Once a winner is claimed, give the claims a beat to settle, then award.
  useEffect(() => {
    if (!snapWinner) return
    const t = setTimeout(() => awardPile(), 450)
    return () => clearTimeout(t)
  }, [snapWinner, awardPile])

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
          {isMyTurn && myCount > 0 && !claimPending && (
            <button className="big-btn flip-btn" onClick={() => flipCard(myId)}>Flip a card 🃏</button>
          )}
          {/* Anyone can snap — even a knocked-out player can fight back in.
              A real match claims the pile; a wrong call costs you 5 cards. */}
          <button
            className={`big-btn snap-btn ${topTwoMatch && !claimPending ? 'armed' : ''}`}
            onClick={() => {
              if (claimPending || penaltyLock) return
              if (topTwoMatch) {
                claimSnap(myId)
              } else {
                wrongSnap(myId)
                setPenaltyLock(true)
              }
            }}
            disabled={claimPending || penaltyLock}
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
