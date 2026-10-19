import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { rankOf } from '../../lib/cards'
import { playSfx } from '../../lib/sfx'
import { useTurns, advanceTurnWhile, readPlayerOrder } from '../../engine/turns'
import { tallyStake } from '../../engine/stakes'
import { announce, useActionMessage } from '../../engine/announce'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardFace from '../../components/CardFace'
import CardBack from '../../components/CardBack'
import WinnerScreen from '../../components/WinnerScreen'
import { FXShow } from '../../components/FXLayer'
import { rand } from '../../lib/looks'
import { Opponent } from '../../components/Opponent'
import { useInCharge } from '../../engine/inCharge'

// A card's own little tilt on the pile — the same on every phone.
function tiltOf(card) {
  let h = 0
  for (const ch of String(card.id)) h = (h * 31 + ch.charCodeAt(0)) % 997
  return (rand(h) - 0.5) * 24
}

// ── Snap ───────────────────────────────────────────────────
// Your cards stay face down. On your turn you flip your top card onto the
// middle. The moment the top two middle cards match, everyone races to hit
// SNAP — winner scoops the pile. Run out of cards and you're out!
export default function SnapBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const hands = useStorage((root) => root.hands)
  const centre = useStorage((root) => root.discardPile)
  const snapWinner = useStorage((root) => root.snap?.winner ?? '')
  const actionMsg = useActionMessage(3000)

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)

  // Brief cool-off after a mis-snap so a single panic-mash can't drain your whole
  // stack 5 cards at a time — you eat one penalty, then the button locks for a beat.
  const [penaltyLock, setPenaltyLock] = useState(false)
  useEffect(() => {
    if (!penaltyLock) return
    const t = setTimeout(() => setPenaltyLock(false), 1200)
    return () => clearTimeout(t)
  }, [penaltyLock])

  // 👏 The SNAP! show plays the instant anyone's claim lands — on every phone.
  const [seenWinner, setSeenWinner] = useState(snapWinner)
  const [snapShow, setSnapShow] = useState(null)
  if (snapWinner !== seenWinner) {
    setSeenWinner(snapWinner)
    if (snapWinner) setSnapShow((prev) => ({ n: (prev?.n ?? 0) + 1, winner: snapWinner, count: centre?.length ?? 0 }))
  }
  useEffect(() => {
    if (!snapShow) return
    const t = setTimeout(() => setSnapShow(null), 2500)
    return () => clearTimeout(t)
  }, [snapShow])

  // A little "thwip" every time a new card lands in the middle.
  const topId = centre?.[0]?.id
  useEffect(() => { if (topId != null) playSfx('pop') }, [topId])

  const myCount = (hands?.[myId] ?? []).length
  const topTwoMatch = centre && centre.length >= 2 && rankOf(centre[0]) === rankOf(centre[1])
  const claimPending = !!snapWinner

  const flipCard = useMutation(({ storage }, id) => {
    if (storage.get('snap').get('winner')) return // a snap is being resolved
    if (storage.get('currentTurn') !== id) return
    const handsObj = storage.get('hands')
    const myStack = handsObj.get(id) ?? []
    if (myStack.length === 0) return
    const card = myStack[0]
    handsObj.set(id, myStack.slice(1))
    const centreList = storage.get('discardPile')
    centreList.insert(card, 0)

    // Nobody has a card left to flip and there's nothing to snap? Then the game
    // would be stuck forever — so whoever flipped the last card survived to the
    // end and keeps the whole pile (which makes them the winner).
    const everyoneOut = readPlayerOrder(storage).every((pid) => (handsObj.get(pid) ?? []).length === 0)
    const isMatch = centreList.length >= 2 && rankOf(centreList.get(0)) === rankOf(centreList.get(1))
    if (everyoneOut && !isMatch) {
      const pile = []
      while (centreList.length > 0) { pile.push(centreList.get(0)); centreList.delete(0) }
      handsObj.set(id, pile)
      announce(storage, `${id} flipped the last card with no snap — and keeps the pile! 🏆`)
      return
    }

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
    tallyStake(storage, `miss:${id}`) // 💰 each mis-snap costs a point when playing for chips
    announce(storage, `❌ ${id} mis-snapped — lost ${n} card${n === 1 ? '' : 's'}!`, [
      {
        kind: 'slam', tone: 'red', emoji: '❌', title: 'MIS-SNAP!', burst: false, shake: true, sound: 'buzz',
        who: id, sub: `${id} loses ${n} card${n === 1 ? '' : 's'}`, subMe: `Oops! You lose ${n} card${n === 1 ? '' : 's'}`,
      },
      { kind: 'fly', from: id, to: '@pile', count: n },
    ])
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

    announce(storage, `SNAP! ${winner} grabbed ${won.length} cards 👏`)
    snap.set('winner', '')

    const ct = storage.get('currentTurn')
    if ((handsObj.get(ct) ?? []).length === 0) {
      advanceTurnWhile(storage, ct, (pid) => (handsObj.get(pid) ?? []).length === 0)
    }
  }, [])

  // Once a winner is claimed, give the claims a beat to settle, then award.
  // Only ONE phone hands the pile out (the snapper's, or the next online
  // player's if they've dropped out) — if every phone did it, a laggy phone
  // could hand it out again from old cards and undo someone's flip.
  const iAwardPile = useInCharge(myId, snapWinner, playerOrder)
  useEffect(() => {
    if (!snapWinner || !iAwardPile) return
    const t = setTimeout(() => awardPile(), 450)
    return () => clearTimeout(t)
  }, [snapWinner, iAwardPile, awardPile])

  if (!hands) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  // One player has scooped up every card (and the middle is clear) → they win.
  const stillIn = playerOrder.filter((p) => (hands[p] ?? []).length > 0)
  if (playerOrder.length > 1 && stillIn.length === 1 && (centre?.length ?? 0) === 0) {
    return <WinnerScreen emoji="👏" title={`${stillIn[0]} wins Snap!`} onLeave={onLeave} />
  }

  const shown = (centre ?? []).slice(0, 3).reverse() // top card drawn last (on top)
  const canFlip = isMyTurn && myCount > 0 && !claimPending

  function hitSnap() {
    if (claimPending || penaltyLock) return
    if (topTwoMatch) {
      claimSnap(myId)
    } else {
      wrongSnap(myId)
      setPenaltyLock(true)
    }
  }

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="👏" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {otherPlayers.map((p) => (
            <Opponent key={p} name={p} sub={`${(hands[p] ?? []).length} cards`}>
              {(hands[p] ?? []).length > 0 && <div className="opponent-cards"><CardBack /></div>}
            </Opponent>
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className={`snap-pile${topTwoMatch && !claimPending ? ' match' : ''}`} data-spot="pile">
          {shown.length === 0 && <div className="empty-pile discard-empty">Flip to start</div>}
          {shown.map((c, i) => (
            <div
              key={c.id}
              className={`snap-pile-card${i === shown.length - 1 ? ' top' : ''}`}
              style={{ '--tilt': `${tiltOf(c)}deg`, '--depth': shown.length - 1 - i }}
            >
              <CardFace label={c.label} red={c.red} />
            </div>
          ))}
        </div>
        <span className="pile-label">Middle{centre.length > 0 ? ` · ${centre.length}` : ''}</span>
        {topTwoMatch && !claimPending && <div className="snap-alert">IT'S A MATCH!</div>}
      </div>

      <div className="hand snap-dock">
        <button className={`snap-stack${canFlip ? ' ready' : ''}`} onClick={() => canFlip && flipCard(myId)} disabled={!canFlip}>
          {myCount > 0 ? <CardBack className="draw-pile-card" /> : <div className="empty-pile discard-empty">Out</div>}
          <span className="pile-label">{canFlip ? `👆 Tap to flip · ${myCount}` : `Your stack · ${myCount}`}</span>
        </button>

        {/* Anyone can snap — even a knocked-out player can fight back in.
            A real match claims the pile; a wrong call costs you 5 cards. */}
        <button
          className={`snap-buzzer${topTwoMatch && !claimPending ? ' armed' : ''}`}
          onClick={hitSnap}
          disabled={claimPending || penaltyLock}
        >
          <span>{penaltyLock ? '⏳' : 'SNAP!'}</span>
        </button>
      </div>

      {snapShow && (
        <div key={snapShow.n}>
          {/* the cards fly underneath the big title */}
          <FXShow myId={myId} spec={{ kind: 'fly', from: '@pile', to: snapShow.winner, count: snapShow.count, sound: null }} />
          <FXShow
            myId={myId}
            spec={{
              kind: 'slam', tone: 'snap', title: 'SNAP!', big: true, shake: true, sound: 'snap',
              who: snapShow.winner, sub: `${snapShow.winner} got it! +${snapShow.count}`, subMe: `YOU GOT IT! +${snapShow.count} 🙌`,
            }}
          />
        </div>
      )}
    </div>
  )
}
