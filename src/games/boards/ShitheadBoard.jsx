import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { advanceTurnWhile } from '../../engine/turns'
import { rankOf } from '../../lib/cards'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardFace from '../../components/CardFace'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'
import { canPlay, canPlayAny, topRankRun, readPile, findStarter, effectiveTop } from '../rules/shithead'

const isGlass = (card) => card && rankOf(card) === '3'

// ── Shithead ───────────────────────────────────────────────
// Empty your hand, then your face-up cards, then your blind face-down cards.
// Beat the top of the pile or pick it all up. Don't be the last one holding!
export default function ShitheadBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const hands = useStorage((root) => root.hands)
  const shed = useStorage((root) => root.shed)
  const discard = useStorage((root) => root.discardPile ?? [])
  const deckCount = useStorage((root) => root.deck?.length ?? 0)
  const currentTurn = useStorage((root) => root.currentTurn ?? '')
  const playerOrder = useStorage((root) => root.playerOrder ?? [])
  const lastAction = useStorage((root) => root.lastAction ?? { message: '', id: 0 })

  const [actionMsg, setActionMsg] = useState('')
  const [shownId, setShownId] = useState(0)
  const [selectedHandId, setSelectedHandId] = useState(null)
  if (lastAction && lastAction.id !== shownId && lastAction.message) {
    setShownId(lastAction.id)
    setActionMsg(lastAction.message)
  }
  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(''), 3500)
    return () => clearTimeout(t)
  }, [actionMsg])

  const swap = useMutation(({ storage }, { id, handId, fuId }) => {
    const sh = storage.get('shed')
    const handsObj = storage.get('hands')
    const hand = [...(handsObj.get(id) ?? [])]
    const fu = [...(sh.get(`fu:${id}`) ?? [])]
    const hi = hand.findIndex((c) => c.id === handId)
    const fi = fu.findIndex((c) => c.id === fuId)
    if (hi < 0 || fi < 0) return
    const tmp = hand[hi]; hand[hi] = fu[fi]; fu[fi] = tmp
    handsObj.set(id, hand)
    sh.set(`fu:${id}`, fu)
  }, [])

  const setReady = useMutation(({ storage }, { id }) => {
    storage.get('shed').set(`ready:${id}`, true)
  }, [])

  // Once everyone's ready, exactly one client (the first player) flips the game
  // into play and picks the starter — avoids a race where two ready-ups collide.
  const startPlay = useMutation(({ storage }) => {
    const sh = storage.get('shed')
    if (sh.get('phase') !== 'swap') return
    const list = storage.get('playerOrder')
    const ids = []
    for (let i = 0; i < list.length; i++) ids.push(list.get(i))
    if (ids.length === 0 || !ids.every((p) => sh.get(`ready:${p}`))) return
    sh.set('phase', 'play')
    storage.set('currentTurn', findStarter(storage, ids))
    const la = storage.get('lastAction')
    la.set('message', `${storage.get('currentTurn')} has the lowest card and starts`)
    la.set('id', (la.get('id') ?? 0) + 1)
  }, [])

  const play = useMutation(({ storage }, { id, source, key }) => {
    const sh = storage.get('shed')
    if (sh.get('phase') !== 'play') return
    if (storage.get('currentTurn') !== id) return
    const handsObj = storage.get('hands')
    const discardList = storage.get('discardPile')
    const drawPile = storage.get('deck')
    const pile = readPile(storage)
    const top = effectiveTop(pile) // see through any glass 3s on top
    const hand = handsObj.get(id) ?? []
    const faceDown = { ...sh.get('faceDown') }
    const fu = sh.get(`fu:${id}`) ?? []
    const fd = faceDown[id] ?? []
    const finishedList = sh.get('finished') ?? []
    const la = storage.get('lastAction')

    let card
    if (source === 'hand') {
      if (hand.length === 0) return
      card = hand.find((c) => c.id === key)
      if (!card || !canPlay(card, top)) return
      handsObj.set(id, hand.filter((c) => c.id !== key))
    } else if (source === 'faceUp') {
      if (hand.length > 0 || drawPile.length > 0) return
      card = fu.find((c) => c.id === key)
      if (!card || !canPlay(card, top)) return
      sh.set(`fu:${id}`, fu.filter((c) => c.id !== key))
    } else { // faceDown — blind flip
      if (hand.length > 0 || fu.length > 0) return
      card = fd[key]
      if (!card) return
      faceDown[id] = fd.filter((_, i) => i !== key)
      sh.set('faceDown', faceDown)
      if (!canPlay(card, top)) {
        const taken = [...pile, card]
        while (discardList.length > 0) discardList.delete(0)
        handsObj.set(id, [...(handsObj.get(id) ?? []), ...taken])
        la.set('message', `🙈 ${id} flipped ${card.label} — couldn't play, picked up ${taken.length}`)
        la.set('id', (la.get('id') ?? 0) + 1)
        advanceTurnWhile(storage, id, (p) => finishedList.includes(p))
        return
      }
    }

    discardList.push(card)
    if (source === 'hand') {
      while ((handsObj.get(id) ?? []).length < 3 && drawPile.length > 0) {
        const c = drawPile.get(0); drawPile.delete(0)
        handsObj.set(id, [...(handsObj.get(id) ?? []), c])
      }
    }

    const r = rankOf(card)
    const after = readPile(storage)
    const burned = r === '10' || topRankRun(after) >= 4
    if (burned) {
      const count = discardList.length
      while (discardList.length > 0) discardList.delete(0)
      sh.set('burned', (sh.get('burned') ?? 0) + count)
      la.set('message', `🔥 ${id} played ${card.label} — pile burned, go again!`)
    } else {
      la.set('message', `${id} played ${card.label}`)
    }
    la.set('id', (la.get('id') ?? 0) + 1)

    const handLeft = (handsObj.get(id) ?? []).length
    const fuLeft = (sh.get(`fu:${id}`) ?? []).length
    const fdLeft = (sh.get('faceDown')[id] ?? []).length
    const done = handLeft === 0 && fuLeft === 0 && fdLeft === 0
    if (done && !finishedList.includes(id)) {
      sh.set('finished', [...finishedList, id])
    }
    const finishedNow = sh.get('finished') ?? []
    if (burned && !finishedNow.includes(id)) {
      storage.set('currentTurn', id)
    } else {
      advanceTurnWhile(storage, id, (p) => finishedNow.includes(p))
    }
  }, [])

  const pickUp = useMutation(({ storage }, { id }) => {
    const sh = storage.get('shed')
    if (sh.get('phase') !== 'play') return
    if (storage.get('currentTurn') !== id) return
    const discardList = storage.get('discardPile')
    const pile = readPile(storage)
    if (pile.length === 0) return
    const handsObj = storage.get('hands')
    while (discardList.length > 0) discardList.delete(0)
    handsObj.set(id, [...(handsObj.get(id) ?? []), ...pile])
    const la = storage.get('lastAction')
    la.set('message', `😤 ${id} picked up ${pile.length} cards`)
    la.set('id', (la.get('id') ?? 0) + 1)
    advanceTurnWhile(storage, id, (p) => (sh.get('finished') ?? []).includes(p))
  }, [])

  const isReady = (p) => !!(shed && shed[`ready:${p}`])
  const everyoneReady = playerOrder.length > 0 && playerOrder.every(isReady)

  // The first player kicks off play once everyone has readied up.
  useEffect(() => {
    if (shed?.phase === 'swap' && everyoneReady && playerOrder[0] === myId) startPlay()
  }, [shed?.phase, everyoneReady, playerOrder, myId, startPlay])

  if (!shed || !hands || !shed.phase) {
    return <div className="lobby"><p className="lobby-sub">Dealing the cards…</p></div>
  }

  const { phase, faceDown = {}, finished = [], burned = 0 } = shed
  const faceUpOf = (p) => shed[`fu:${p}`] ?? []
  const myFaceUp = faceUpOf(myId)
  const myFaceDown = faceDown[myId] ?? []
  const others = playerOrder.filter((p) => p !== myId)
  const top = discard.length ? discard[discard.length - 1] : null // actual top (may be a glass 3)
  const beatTop = effectiveTop(discard) // the card you must actually beat
  const isMyTurn = currentTurn === myId && phase === 'play'

  // ── Swap phase ───────────────────────────────────────────
  if (phase === 'swap') {
    const iAmReady = isReady(myId)
    return (
      <div className="game-board">
        <TopBar roomCode={roomCode} onLeave={onLeave} />
        <div className="turn-banner their-turn">🔀 Swap cards, then ready up</div>
        <ActionMessage message={actionMsg} />
        <div className="table-center">
          <p className="ask-label">Your face-up cards (swap your best cards up here)</p>
          <div className="shed-stack-row">
            {myFaceUp.map((c) => (
              <CardFace
                key={c.id}
                label={c.label}
                red={c.red}
                onClick={iAmReady || selectedHandId == null ? undefined : () => { swap({ id: myId, handId: selectedHandId, fuId: c.id }); setSelectedHandId(null) }}
                highlight={!iAmReady && selectedHandId != null}
              />
            ))}
          </div>
          {!iAmReady && <p className="ask-empty-msg">{selectedHandId == null ? 'Tap a hand card, then a face-up card to swap them.' : 'Now tap a face-up card to swap.'}</p>}
          <div className="action-buttons">
            {iAmReady
              ? <p className="ask-empty-msg">Ready! Waiting for {others.filter((p) => !isReady(p)).join(', ') || 'others'}…</p>
              : <button className="big-btn create-btn" onClick={() => setReady({ id: myId })}>I'm ready ✓</button>}
          </div>
          <div className="whist-standings">
            {playerOrder.map((p) => (
              <span key={p} className={`whist-chip ${isReady(p) ? '' : 'out'}`}>{p} {isReady(p) ? '✓' : '…'}</span>
            ))}
          </div>
        </div>
        <Hand
          cards={myHand}
          onCardClick={iAmReady ? undefined : (card) => setSelectedHandId(card.id === selectedHandId ? null : card.id)}
          isHighlighted={(card) => card.id === selectedHandId}
          showSort={false}
          hint={iAmReady ? undefined : 'Your hand'}
        />
      </div>
    )
  }

  // ── Game over ────────────────────────────────────────────
  const notFinished = playerOrder.filter((p) => !finished.includes(p))
  if (playerOrder.length > 1 && notFinished.length <= 1) {
    const ranking = [...finished, ...notFinished]
    const scores = ranking.map((p, idx) => ({
      name: p,
      detail: idx < finished.length ? `#${idx + 1} — out` : '💩 Shithead!',
    }))
    return <WinnerScreen emoji="💩" title={notFinished[0] ? `${notFinished[0]} is the Shithead!` : 'Game over!'} scores={scores} onLeave={onLeave} />
  }

  // Which layer am I playing from, and can I beat the pile?
  const myLayer = myHand.length > 0 ? 'hand' : (myFaceUp.length > 0 ? 'faceUp' : 'faceDown')
  const activeCards = myLayer === 'hand' ? myHand : (myLayer === 'faceUp' ? myFaceUp : myFaceDown)
  const canBeat = myLayer === 'faceDown' ? true : canPlayAny(activeCards, beatTop)
  const iAmFinished = finished.includes(myId)

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="💩" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {others.map((p) => (
            <Opponent
              key={p}
              name={p}
              sub={finished.includes(p) ? 'finished ✅' : `${(hands[p] ?? []).length} in hand · ${(faceDown[p] ?? []).length} down`}
            >
              <div className="shed-opp-cards">
                {faceUpOf(p).map((c) => <CardFace key={c.id} label={c.label} red={c.red} glass={isGlass(c)} />)}
                {faceUpOf(p).length === 0 && (faceDown[p] ?? []).map((_, i) => <CardBack key={i} />)}
              </div>
            </Opponent>
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="shed-piles">
          <div className="pile-col">
            {deckCount > 0 ? <CardBack className="draw-pile-card" /> : <div className="empty-pile discard-empty">Empty</div>}
            <span className="pile-label">Draw · {deckCount}</span>
          </div>
          <div className="pile-col">
            {top ? <CardFace label={top.label} red={top.red} glass={isGlass(top)} /> : <div className="empty-pile discard-empty">Pile</div>}
            <span className="pile-label">Pile{discard.length > 0 ? ` · ${discard.length}` : ''}{top && isGlass(top) && beatTop ? ` · on ${beatTop.label}` : ''}</span>
          </div>
          {burned > 0 && (
            <div className="pile-col">
              <div className="empty-pile discard-empty">🔥 {burned}</div>
              <span className="pile-label">Burned</span>
            </div>
          )}
        </div>

        {isMyTurn && !iAmFinished && (
          <div className="action-buttons">
            {myLayer === 'faceDown' && <span className="hand-hint">Flip a blind card below 👇</span>}
            {discard.length > 0 && (
              !canBeat && myLayer !== 'faceDown'
                ? <button className="big-btn pass-btn" onClick={() => pickUp({ id: myId })}>Can't play — pick up pile</button>
                : <button className="action-btn sort-btn" onClick={() => pickUp({ id: myId })}>Pick up pile</button>
            )}
          </div>
        )}

        {/* My face-down (blind) and face-up cards */}
        <div className="shed-mine">
          <div className="shed-stack-row">
            {myFaceDown.map((_, i) => (
              <CardBack
                key={i}
                className={isMyTurn && myLayer === 'faceDown' ? 'pick-card' : ''}
                onClick={isMyTurn && myLayer === 'faceDown' ? () => play({ id: myId, source: 'faceDown', key: i }) : undefined}
              />
            ))}
          </div>
          {myFaceUp.length > 0 && (
            <div className="shed-stack-row">
              {myFaceUp.map((c) => (
                <CardFace
                  key={c.id}
                  label={c.label}
                  red={c.red}
                  glass={isGlass(c)}
                  highlight={isMyTurn && myLayer === 'faceUp' && canPlay(c, beatTop)}
                  onClick={isMyTurn && myLayer === 'faceUp' && canPlay(c, beatTop) ? () => play({ id: myId, source: 'faceUp', key: c.id }) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Hand
        cards={myHand}
        onCardClick={isMyTurn && myLayer === 'hand' ? (card) => { if (canPlay(card, beatTop)) play({ id: myId, source: 'hand', key: card.id }) } : undefined}
        isHighlighted={(card) => isMyTurn && myLayer === 'hand' && canPlay(card, beatTop)}
        isGlass={isGlass}
        showSort={false}
        hint={isMyTurn && myLayer === 'hand' ? (canBeat ? 'Tap a glowing card to play' : 'Nothing to play — pick up the pile') : undefined}
      />
    </div>
  )
}
