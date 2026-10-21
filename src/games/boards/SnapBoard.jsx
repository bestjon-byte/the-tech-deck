import { useState, useEffect, useRef } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { rankOf, nCards } from '../../lib/cards'
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
import { SNAP_WINDOW_MS, claimsFor, secs } from '../rules/snap'

const REVEAL_MS = 3200 // how long the winner + reaction times stay up

// A card's own little tilt on the pile — the same on every phone.
function tiltOf(card) {
  let h = 0
  for (const ch of String(card.id)) h = (h * 31 + ch.charCodeAt(0)) % 997
  return (rand(h) - 0.5) * 24
}

// ── Snap ───────────────────────────────────────────────────
// Your cards stay face down. On your turn you flip your top card onto the
// middle. The moment the top two middle cards match, everyone races to hit
// SNAP. Every phone times its own player's reaction (from the card landing on
// THAT screen to the tap), so a slow connection doesn't cost you. After the
// first snap there's a 🥁 drumroll while the rest get theirs in, then the
// fastest reaction scoops the pile. Run out of cards and you're out!
export default function SnapBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const hands = useStorage((root) => root.hands)
  const centre = useStorage((root) => root.discardPile)
  const snap = useStorage((root) => root.snap)
  const actionMsg = useActionMessage(3000)

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)

  const topId = centre?.[0]?.id
  const myCount = (hands?.[myId] ?? []).length
  const topTwoMatch = !!centre && centre.length >= 2 && rankOf(centre[0]) === rankOf(centre[1])
  // Snaps already in on the match showing now → the drumroll is on.
  const claims = topTwoMatch ? claimsFor(snap, topId, playerOrder) : []
  const drumroll = claims.length > 0
  const iClaimed = claims.some((c) => c.name === myId)

  // ⏱️ When did the match land on MY screen? Your reaction time counts from here.
  const matchSeen = useRef(null)
  useEffect(() => {
    if (topTwoMatch) matchSeen.current = { id: topId, at: performance.now() }
  }, [topId, topTwoMatch])

  // The buzzer locks for a beat after a mis-snap (so one panic-mash can't drain
  // your stack 5 cards at a time). Just after a snap is decided there's a grace
  // beat too: a late smack on a pile that's just gone isn't a mis-snap.
  const [lock, setLock] = useState(null) // null | 'penalty' | 'grace'
  useEffect(() => {
    if (!lock) return
    const t = setTimeout(() => setLock(null), lock === 'penalty' ? 1200 : 1500)
    return () => clearTimeout(t)
  }, [lock])

  // 🥁 The drumroll starts the moment the first snap lands.
  const drumMatch = drumroll ? topId : null
  useEffect(() => { if (drumMatch != null) playSfx('snapdrum') }, [drumMatch])

  // 👏 The reveal plays on every phone when a snap is decided.
  const result = snap?.result ?? null
  const [seenResult, setSeenResult] = useState(result?.match ?? null)
  const [snapShow, setSnapShow] = useState(null)
  if ((result?.match ?? null) !== seenResult) {
    setSeenResult(result?.match ?? null)
    if (result) {
      setSnapShow(result)
      setLock('grace')
    }
  }
  useEffect(() => {
    if (!snapShow) return
    const t = setTimeout(() => setSnapShow(null), REVEAL_MS)
    return () => clearTimeout(t)
  }, [snapShow])

  // A little "thwip" every time a new card lands in the middle.
  useEffect(() => { if (topId != null) playSfx('pop') }, [topId])

  const flipCard = useMutation(({ storage }, id) => {
    const centreList = storage.get('discardPile')
    const top = centreList.length > 0 ? centreList.get(0) : null
    if (top && claimsFor(storage.get('snap').toJSON(), top.id).length > 0) return // a snap is being decided
    if (storage.get('currentTurn') !== id) return
    const handsObj = storage.get('hands')
    const myStack = handsObj.get(id) ?? []
    if (myStack.length === 0) return
    const card = myStack[0]
    handsObj.set(id, myStack.slice(1))
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

  // Pressing SNAP puts your name in for this match, with your reaction time.
  // Each player has their own key, so snaps landing together can't clobber
  // each other — the decision is made later from everyone's times.
  const claimSnap = useMutation(({ storage }, id, match, ms) => {
    const centreList = storage.get('discardPile')
    if (centreList.length < 2 || centreList.get(0).id !== match) return // that match is gone
    if (rankOf(centreList.get(0)) !== rankOf(centreList.get(1))) return // not a match
    const snapObj = storage.get('snap')
    if (snapObj.get(`claim:${id}`)?.match === match) return // already in
    snapObj.set(`claim:${id}`, { match, ms })
  }, [])

  // Smacking SNAP when the top two cards DON'T match is a mis-snap: the culprit
  // loses up to 5 cards to the bottom of the middle pile (back into play for
  // everyone else to win). This is what stops people just mashing the button.
  const wrongSnap = useMutation(({ storage }, id) => {
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

  // When the drumroll's over, the fastest reaction gets the pile. Re-checks the
  // match is still on top, so it can never be handed out twice.
  const awardPile = useMutation(({ storage }, match) => {
    const centreList = storage.get('discardPile')
    if (centreList.length < 2 || centreList.get(0).id !== match) return // already decided
    const snapObj = storage.get('snap')
    const times = claimsFor(snapObj.toJSON(), match, readPlayerOrder(storage))
    if (times.length === 0) return
    const winner = times[0].name
    const handsObj = storage.get('hands')
    const won = []
    while (centreList.length > 0) { won.push(centreList.get(0)); centreList.delete(0) }
    handsObj.set(winner, [...(handsObj.get(winner) ?? []), ...won])

    snapObj.set('result', { match, winner, count: won.length, times })
    for (const key of [...snapObj.keys()]) if (key.startsWith('claim:')) snapObj.delete(key)
    announce(storage, `SNAP! ${winner} grabbed ${nCards(won.length)} in ${secs(times[0].ms)} 👏`)

    const ct = storage.get('currentTurn')
    if ((handsObj.get(ct) ?? []).length === 0) {
      advanceTurnWhile(storage, ct, (pid) => (handsObj.get(pid) ?? []).length === 0)
    }
  }, [])

  // Once the first snap is in, everyone else gets SNAP_WINDOW_MS to get theirs
  // in, then the pile is awarded. Only ONE phone does it (whoever's turn it is,
  // or the next online player if they've dropped out) — if every phone did it,
  // a laggy phone could hand it out again from old cards.
  const iAwardPile = useInCharge(myId, currentTurn, playerOrder)
  useEffect(() => {
    if (drumMatch == null || !iAwardPile) return
    const t = setTimeout(() => awardPile(drumMatch), SNAP_WINDOW_MS)
    return () => clearTimeout(t)
  }, [drumMatch, iAwardPile, awardPile])

  if (!hands) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  // One player has scooped up every card (and the middle is clear) → they win.
  const stillIn = playerOrder.filter((p) => (hands[p] ?? []).length > 0)
  if (playerOrder.length > 1 && stillIn.length === 1 && (centre?.length ?? 0) === 0) {
    return <WinnerScreen emoji="👏" title={`${stillIn[0]} wins Snap!`} onLeave={onLeave} />
  }

  const shown = (centre ?? []).slice(0, 3).reverse() // top card drawn last (on top)
  const canFlip = isMyTurn && myCount > 0 && !drumroll
  const buzzerOff = lock === 'penalty' || iClaimed

  function hitSnap() {
    if (buzzerOff) return
    if (topTwoMatch) {
      const seen = matchSeen.current
      const ms = seen?.id === topId ? Math.round(performance.now() - seen.at) : 9999
      claimSnap(myId, topId, ms)
    } else if (lock !== 'grace') {
      wrongSnap(myId)
      setLock('penalty')
    }
  }

  // Who's in the drumroll — in seat order, so it doesn't give the answer away.
  const seat = (name) => { const i = playerOrder.indexOf(name); return i < 0 ? playerOrder.length : i }
  const inTheRunning = claims.map((c) => c.name).sort((a, b) => seat(a) - seat(b))

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="👏" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {otherPlayers.map((p) => (
            <Opponent key={p} name={p} sub={`${nCards((hands[p] ?? []).length)}`}>
              {(hands[p] ?? []).length > 0 && <div className="opponent-cards"><CardBack /></div>}
            </Opponent>
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className={`snap-pile${topTwoMatch ? ' match' : ''}`} data-spot="pile">
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
        {topTwoMatch && !drumroll && <div className="snap-alert">IT'S A MATCH!</div>}
      </div>

      <div className="hand snap-dock">
        <button className={`snap-stack${canFlip ? ' ready' : ''}`} onClick={() => canFlip && flipCard(myId)} disabled={!canFlip}>
          {myCount > 0 ? <CardBack className="draw-pile-card" /> : <div className="empty-pile discard-empty">Out</div>}
          <span className="pile-label">{canFlip ? `👆 Tap to flip · ${myCount}` : `Your stack · ${myCount}`}</span>
        </button>

        {/* Anyone can snap — even a knocked-out player can fight back in.
            A real match claims the pile; a wrong call costs you 5 cards. */}
        {/* onPointerDown, not onClick: fires the instant your finger lands,
            so your reaction time isn't padded by the tap. */}
        <button
          className={`snap-buzzer${topTwoMatch && !buzzerOff ? ' armed' : ''}`}
          onPointerDown={hitSnap}
          disabled={buzzerOff}
        >
          <span>{lock === 'penalty' ? '⏳' : iClaimed ? '✋' : 'SNAP!'}</span>
        </button>
      </div>

      {drumroll && (
        <div className="snap-drumroll" aria-live="polite">
          <div className="snap-drum">🥁</div>
          <div className="snap-drumroll-title">SNAP! Who was fastest…?</div>
          <div className="snap-claimers">
            {inTheRunning.map((p) => (
              <span key={p} className={`snap-claimer${p === myId ? ' me' : ''}`}>✋ {p === myId ? 'You' : p}</span>
            ))}
          </div>
        </div>
      )}

      {snapShow && (
        <div key={snapShow.match}>
          {/* the cards fly underneath the big title */}
          <FXShow myId={myId} spec={{ kind: 'fly', from: '@pile', to: snapShow.winner, count: snapShow.count, sound: null }} />
          <FXShow
            myId={myId}
            spec={{
              kind: 'slam', tone: 'snap', title: 'SNAP!', big: true, shake: true, sound: 'snap',
              who: snapShow.winner,
              sub: `${snapShow.winner} got it! ⚡ ${secs(snapShow.times[0].ms)} · +${snapShow.count}`,
              subMe: `YOU GOT IT! ⚡ ${secs(snapShow.times[0].ms)} · +${snapShow.count} 🙌`,
            }}
          />
          {/* Everyone's reaction time, fastest first. */}
          <ol className="snap-times">
            {snapShow.times.map((t, i) => (
              <li key={t.name} className={`snap-time${i === 0 ? ' first' : ''}${t.name === myId ? ' me' : ''}`}>
                <span className="snap-time-place">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
                <span className="snap-time-name">{t.name === myId ? 'You' : t.name}</span>
                <span className="snap-time-ms">{secs(t.ms)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
