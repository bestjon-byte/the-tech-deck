import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { suitOf, sortCards } from '../../lib/cards'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardFace from '../../components/CardFace'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'
import {
  WHIST_SUITS, cardsForRound, legalWhistPlay, whistTrickWinner,
  nextWhistActor, nextLeaderAfter, endWhistRound, dealWhistRound,
} from '../rules/knockoutWhist'

const isRed = (suit) => suit === '♥' || suit === '♦'

// ── Knockout Whist ─────────────────────────────────────────
// Follow suit, win tricks, survive the round. Trumps beat everything; the
// player who wins the most tricks picks trumps for the next, shorter hand.
export default function KnockoutWhistBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const hands = useStorage((root) => root.hands)
  const whist = useStorage((root) => root.whist)
  const currentTurn = useStorage((root) => root.currentTurn ?? '')
  const lastAction = useStorage((root) => root.lastAction ?? { message: '', id: 0 })

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

  const playCard = useMutation(({ storage }, { id, cardId }) => {
    const w = storage.get('whist')
    if (w.get('phase') !== 'play') return
    if (w.get('trickWinner')) return // a completed trick is still being shown
    if (storage.get('currentTurn') !== id) return
    const handsObj = storage.get('hands')
    const hand = handsObj.get(id) ?? []
    const card = hand.find((c) => c.id === cardId)
    if (!card) return
    const leadSuit = w.get('leadSuit') || ''
    if (!legalWhistPlay(card, hand, leadSuit)) return

    handsObj.set(id, hand.filter((c) => c.id !== cardId))
    const trick = [...(w.get('trick') ?? []), { player: id, label: card.label, red: card.red }]
    w.set('trick', trick)
    const lead = leadSuit || suitOf(card)
    if (!leadSuit) w.set('leadSuit', lead)

    const la = storage.get('lastAction')
    la.set('message', `${id} played ${card.label}`)
    la.set('id', (la.get('id') ?? 0) + 1)

    const alive = w.get('alive') ?? []
    const skips = w.get('trickSkips') ?? []
    const skipSet = new Set(skips)
    const played = new Set(trick.map((t) => t.player))
    const complete = alive.every((p) => played.has(p) || (handsObj.get(p) ?? []).length === 0 || skipSet.has(p))
    if (complete) {
      w.set('trickWinner', whistTrickWinner(trick, lead, w.get('trump')))
    } else {
      const seating = w.get('seating') ?? []
      const next = nextWhistActor(seating, alive, id, new Set([...played, ...skips]), handsObj)
      if (next) storage.set('currentTurn', next)
    }
  }, [])

  // The dog (on a dog's life) holds their single card, passing this trick to
  // save it for a later one. They can hold any trick — but not start an empty
  // one with nobody else to play, and if they never commit it they're knocked
  // out at round's end.
  const holdCard = useMutation(({ storage }, { id }) => {
    const w = storage.get('whist')
    if (w.get('phase') !== 'play') return
    if (w.get('trickWinner')) return
    if (storage.get('currentTurn') !== id) return
    if (!(w.get('dogs') ?? []).includes(id)) return
    const handsObj = storage.get('hands')
    const alive = w.get('alive') ?? []
    const seating = w.get('seating') ?? []
    const trick = w.get('trick') ?? []
    const skips = [...(w.get('trickSkips') ?? [])]
    const played = new Set(trick.map((t) => t.player))
    const otherActors = alive.filter((p) => p !== id && !played.has(p) && !skips.includes(p) && (handsObj.get(p) ?? []).length > 0)
    if (trick.length === 0 && otherActors.length === 0) return // nobody else to play — you must lay it down
    skips.push(id)
    w.set('trickSkips', skips)
    const la = storage.get('lastAction')
    la.set('message', `🐶 ${id} saved their card`)
    la.set('id', (la.get('id') ?? 0) + 1)
    const skipSet = new Set(skips)
    const complete = alive.every((p) => played.has(p) || (handsObj.get(p) ?? []).length === 0 || skipSet.has(p))
    if (complete) {
      w.set('trickWinner', whistTrickWinner(trick, w.get('leadSuit') || '', w.get('trump')))
    } else {
      const next = nextWhistActor(seating, alive, id, new Set([...played, ...skips]), handsObj)
      if (next) storage.set('currentTurn', next)
    }
  }, [])

  // Completed tricks linger for a beat so everyone can see them, then the trick
  // winner's client clears the table (one client only, so it happens once).
  const resolveTrick = useMutation(({ storage }) => {
    const w = storage.get('whist')
    const winner = w.get('trickWinner')
    if (!winner) return
    const tricksWon = { ...(w.get('tricksWon') ?? {}) }
    tricksWon[winner] = (tricksWon[winner] ?? 0) + 1
    w.set('tricksWon', tricksWon)
    w.set('trick', [])
    w.set('leadSuit', '')
    w.set('trickWinner', '')
    w.set('trickSkips', [])
    w.set('leader', winner)

    const la = storage.get('lastAction')
    la.set('message', `🏅 ${winner} won the trick`)
    la.set('id', (la.get('id') ?? 0) + 1)

    // The round is over once every regular player is out of cards. A dog that
    // never committed its held card simply wins no trick and drops out — there's
    // no free solo trick for it.
    const handsObj = storage.get('hands')
    const alive = w.get('alive') ?? []
    const dogs = w.get('dogs') ?? []
    const roundOver = alive.every((p) => dogs.includes(p) || (handsObj.get(p) ?? []).length === 0)
    if (roundOver) { endWhistRound(storage); return }
    const seating = w.get('seating') ?? []
    storage.set('currentTurn', nextLeaderAfter(seating, alive, winner, handsObj))
  }, [])

  const sortHand = useMutation(({ storage }) => {
    const h = storage.get('hands')
    h.set(myId, sortCards(h.get(myId) ?? []))
  }, [myId])

  const pickTrump = useMutation(({ storage }, { id, suit }) => {
    const w = storage.get('whist')
    if (w.get('phase') !== 'pickTrump') return
    if (w.get('trumpPicker') !== id) return
    const seating = w.get('seating') ?? []
    const alive = w.get('alive') ?? []
    const { tricksWon } = dealWhistRound(storage, { seating, alive, round: w.get('round'), dogs: w.get('dogs') ?? [], flip: false })
    w.set('trump', suit)
    w.set('trumpCardLabel', '')
    w.set('tricksWon', tricksWon)
    w.set('trick', [])
    w.set('leadSuit', '')
    w.set('trickWinner', '')
    w.set('trickSkips', [])
    w.set('leader', id)
    w.set('phase', 'play')
    const order = storage.get('playerOrder')
    while (order.length > 0) order.delete(0)
    seating.forEach((p) => order.push(p))
    storage.set('currentTurn', id)
    const la = storage.get('lastAction')
    la.set('message', `${id} chose ${suit} as trumps`)
    la.set('id', (la.get('id') ?? 0) + 1)
  }, [])

  const trickWinner = whist?.trickWinner ?? ''
  useEffect(() => {
    if (trickWinner && trickWinner === myId) {
      const t = setTimeout(() => resolveTrick(), 1600)
      return () => clearTimeout(t)
    }
  }, [trickWinner, myId, resolveTrick])

  if (!whist || !hands || !whist.phase) {
    return <div className="lobby"><p className="lobby-sub">Dealing the cards…</p></div>
  }

  if (whist.phase === 'gameOver') {
    return <WinnerScreen emoji="🎩" title={`${whist.champion} wins Knockout Whist!`} onLeave={onLeave} />
  }

  const { phase, trump, alive = [], seating = [], tricksWon = {}, trick = [], dogs = [], round = 1, trumpPicker = '', lastResult = '' } = whist
  const isMyTurn = currentTurn === myId && phase === 'play' && !trickWinner
  const leadSuit = whist.leadSuit || ''
  const amOut = !alive.includes(myId)
  const others = seating.filter((p) => p !== myId)

  // I'm the dog and I can choose to hold my card — as long as someone else can
  // still play this trick (I can't sit out an otherwise-empty trick).
  const playedNames = new Set(trick.map((t) => t.player))
  const trickSkips = whist.trickSkips ?? []
  const someoneElseCanPlay = alive.some((p) => p !== myId && !playedNames.has(p) && !trickSkips.includes(p) && (hands[p] ?? []).length > 0)
  const iAmDog = dogs.includes(myId)
  const canHold = iAmDog && isMyTurn && (trick.length > 0 || someoneElseCanPlay)

  // Between rounds: the round's top player picks trumps for the next hand.
  if (phase === 'pickTrump') {
    const iPick = trumpPicker === myId
    return (
      <div className="game-board">
        <TopBar roomCode={roomCode} onLeave={onLeave} />
        <TurnBanner isMyTurn={iPick} currentTurn={trumpPicker} emoji="🎩" />
        <ActionMessage message={actionMsg} />
        <div className="table-center">
          <p className="whist-result">{lastResult}</p>
          <p className="ask-label">Round {round} · {cardsForRound(round)} card{cardsForRound(round) === 1 ? '' : 's'} each</p>
          {iPick ? (
            <div className="suit-picker">
              <span className="ask-label">You won the most — choose trumps</span>
              <div className="suit-choices">
                {WHIST_SUITS.map((s) => (
                  <button key={s} className={`suit-choice ${isRed(s) ? 'red' : ''}`} onClick={() => pickTrump({ id: myId, suit: s })}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <p className="ask-empty-msg">Waiting for {trumpPicker} to choose trumps…</p>
          )}
          <div className="whist-standings">
            {seating.map((p) => (
              <span key={p} className={`whist-chip ${alive.includes(p) ? '' : 'out'}`}>
                {p}{dogs.includes(p) ? ' 🐶' : ''} · {alive.includes(p) ? 'in' : 'out'}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🎩" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {others.map((p) => (
            <Opponent
              key={p}
              name={`${p}${dogs.includes(p) ? ' 🐶' : ''}`}
              sub={alive.includes(p) ? `${(hands[p] ?? []).length} cards · ${tricksWon[p] ?? 0} won` : 'knocked out'}
            />
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="whist-trump">
          Trumps: <span className={isRed(trump) ? 'red' : ''}>{trump}</span>
          <span className="whist-round"> · Round {round} · {tricksWon[myId] ?? 0} trick{(tricksWon[myId] ?? 0) === 1 ? '' : 's'} won</span>
        </div>

        <div className="whist-trick">
          {trick.length === 0
            ? <span className="tableau-empty">{isMyTurn ? 'Lead a card' : 'Waiting for cards…'}</span>
            : trick.map((t) => (
                <div key={t.player} className="whist-play">
                  <CardFace label={t.label} red={t.red} />
                  <span className="whist-play-name">{t.player}{suitOf(t) === trump ? ' ⚡' : ''}</span>
                </div>
              ))}
        </div>

        {isMyTurn && iAmDog && (
          <div className="action-buttons">
            {canHold
              ? <button className="action-btn sort-btn" onClick={() => holdCard({ id: myId })}>🐶 Save my card for a later trick</button>
              : <span className="hand-hint">Last chance — you must play your card now</span>}
          </div>
        )}

        {amOut && <p className="ask-empty-msg">You're out — watching the rest of the game.</p>}
      </div>

      <Hand
        cards={myHand}
        onCardClick={isMyTurn ? (card) => { if (legalWhistPlay(card, myHand, leadSuit)) playCard({ id: myId, cardId: card.id }) } : undefined}
        isHighlighted={(card) => isMyTurn && legalWhistPlay(card, myHand, leadSuit)}
        showSort
        onSort={sortHand}
        hint={isMyTurn ? (iAmDog ? 'Play your card, or hold it for a later trick' : (leadSuit ? `Follow ${leadSuit} if you can` : 'Your lead — tap a card')) : undefined}
      />
    </div>
  )
}
