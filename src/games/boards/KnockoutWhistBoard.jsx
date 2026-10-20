import { useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { suitOf, sortByValue, nCards } from '../../lib/cards'
import { announce, useActionMessage } from '../../engine/announce'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardFace from '../../components/CardFace'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'
import { useInCharge } from '../../engine/inCharge'
import {
  WHIST_SUITS, cardsForRound, legalWhistPlay, whistTrickWinner,
  nextWhistActor, nextLeaderAfter, endWhistRound, cardValue,
} from '../rules/knockoutWhist'

const sortAcesHigh = (cards) => sortByValue(cards, cardValue)
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
  const actionMsg = useActionMessage(3500)

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

    // ⚡ Trumping a trick you couldn't follow gets the lightning treatment.
    const trump = w.get('trump')
    const trumped = leadSuit && leadSuit !== trump && suitOf(card) === trump
    announce(storage, `${id} played ${card.label}${trumped ? ' — TRUMPED! ⚡' : ''}`, trumped
      ? { kind: 'slam', tone: 'electric', title: 'TRUMPED!', emoji: '⚡', cards: [card], sound: 'zap', shake: true, who: id, sub: `${id} played a trump!`, subMe: 'You played a trump!' }
      : null)

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
    announce(storage, `🐶 ${id} saved their card`, { kind: 'bubble', at: id, text: '🐶 Saving it!' })
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
    const trickSize = (w.get('trick') ?? []).length
    const tricksWon = { ...(w.get('tricksWon') ?? {}) }
    tricksWon[winner] = (tricksWon[winner] ?? 0) + 1
    w.set('tricksWon', tricksWon)
    w.set('trick', [])
    w.set('leadSuit', '')
    w.set('trickWinner', '')
    w.set('trickSkips', [])
    w.set('leader', winner)

    const wonTrick = { kind: 'fly', from: '@pile', to: winner, count: trickSize }

    // The round is over once every regular player is out of cards. A dog that
    // never committed its held card simply wins no trick and drops out — there's
    // no free solo trick for it.
    const handsObj = storage.get('hands')
    const alive = w.get('alive') ?? []
    const dogs = w.get('dogs') ?? []
    const roundOver = alive.every((p) => dogs.includes(p) || (handsObj.get(p) ?? []).length === 0)
    if (roundOver) {
      endWhistRound(storage)
      const stillAlive = w.get('alive') ?? []
      const out = alive.filter((p) => !stillAlive.includes(p))
      const newDogs = w.get('dogs') ?? []
      let roundFx = null
      if (w.get('phase') === 'gameOver') roundFx = null // the winner screen takes over
      else if (out.length) roundFx = { kind: 'slam', tone: 'red', emoji: '🥊', title: 'KNOCKED OUT!', sub: out.join(' & '), sound: 'sad', shake: true, who: out.length === 1 ? out[0] : '', subMe: "That's you! 😭" }
      else if (newDogs.length) roundFx = { kind: 'slam', tone: 'gold', emoji: '🐶', title: "DOG'S LIFE!", sub: `${newDogs.join(' & ')} clings on with one card`, sound: 'pop' }
      announce(storage, `🏅 ${winner} won the trick. ${w.get('lastResult') ?? ''}`, roundFx ? [wonTrick, roundFx] : wonTrick)
      return
    }
    announce(storage, `🏅 ${winner} won the trick`, wonTrick)
    const seating = w.get('seating') ?? []
    storage.set('currentTurn', nextLeaderAfter(seating, alive, winner, handsObj))
  }, [])

  const pickTrump = useMutation(({ storage }, { id, suit }) => {
    const w = storage.get('whist')
    if (w.get('phase') !== 'pickTrump') return
    if (w.get('trumpPicker') !== id) return
    // The hands were already dealt at the end of the last round (so the picker
    // could see theirs) — just set trumps and start play.
    const seating = w.get('seating') ?? []
    w.set('trump', suit)
    w.set('leader', id)
    w.set('phase', 'play')
    const order = storage.get('playerOrder')
    while (order.length > 0) order.delete(0)
    seating.forEach((p) => order.push(p))
    storage.set('currentTurn', id)
    announce(storage, `${id} chose ${suit} as trumps`, {
      kind: 'slam', tone: 'gold', title: 'TRUMPS!', emoji: suit, red: isRed(suit), sound: 'zap',
      who: id, sub: `${id} chose ${suit}`, subMe: `You chose ${suit}`,
    })
  }, [])

  // The trick winner's phone clears the trick — or, if they're offline, the
  // next online player's phone does, so nobody gets stuck waiting.
  const trickWinner = whist?.trickWinner ?? ''
  const iClearTheTrick = useInCharge(myId, trickWinner, whist?.seating ?? [])
  useEffect(() => {
    if (trickWinner && iClearTheTrick) {
      const t = setTimeout(() => resolveTrick(), 1600)
      return () => clearTimeout(t)
    }
  }, [trickWinner, iClearTheTrick, resolveTrick])

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
  // Who's winning the trick so far? Lit up while it's still being played, so
  // everyone can see the card to beat (the 👑 takes over once it's finished).
  const leading = !trickWinner && trick.length > 1 ? whistTrickWinner(trick, leadSuit, trump) : ''
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
              <span className="ask-label">You won the most — look at your new hand and choose trumps</span>
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
        <Hand
          cards={myHand}
          showSort
          sortWith={sortAcesHigh}
          hint={iPick ? "Your new hand — pick the suit you're strongest in" : undefined}
        />
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
              id={p}
              sub={alive.includes(p) ? `${nCards((hands[p] ?? []).length)} · ${tricksWon[p] ?? 0} won` : 'knocked out'}
            />
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="whist-info">
          <span className={`trump-badge${isRed(trump) ? ' red' : ''}`}>Trumps <b>{trump}</b></span>
          <span className="whist-round">Round {round} · you've won {tricksWon[myId] ?? 0} trick{(tricksWon[myId] ?? 0) === 1 ? '' : 's'}</span>
        </div>

        <div className={`whist-trick${alive.length > 4 ? ' many' : ''}`} data-spot="pile">
          {trick.length === 0
            ? <span className="trick-empty">{isMyTurn ? '👇 Lead any card' : 'Waiting for cards…'}</span>
            : trick.map((t) => (
                <div key={t.player} className={`whist-play${trickWinner === t.player ? ' winner' : ''}${trickWinner && trickWinner !== t.player ? ' loser' : ''}${leading === t.player ? ' leading' : ''}`}>
                  {trickWinner === t.player && <span className="trick-crown">👑</span>}
                  {leading === t.player && <span className="trick-leading">Winning</span>}
                  <div className="card-land"><CardFace label={t.label} red={t.red} /></div>
                  <span className="whist-play-name">{t.player === myId ? 'You' : t.player}{suitOf(t) === trump ? ' ⚡' : ''}</span>
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
        sortWith={sortAcesHigh}
        hint={isMyTurn ? (iAmDog ? 'Play your card, or hold it for a later trick' : (leadSuit ? `Follow ${leadSuit} if you can` : 'Your lead — tap a card')) : undefined}
      />
    </div>
  )
}
