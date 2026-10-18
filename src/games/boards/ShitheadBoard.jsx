import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { advanceTurnWhile } from '../../engine/turns'
import { announce, useActionMessage } from '../../engine/announce'
import { useAutoPass } from '../../engine/autoPass'
import { rankOf } from '../../lib/cards'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import AutoPassNotice from '../../components/AutoPassNotice'
import CardFace from '../../components/CardFace'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'
import BurnFX from '../../components/BurnFX'
import { useInCharge } from '../../engine/inCharge'
import { canPlay, canPlayAny, topRankRun, readPile, findStarter, effectiveTop } from '../rules/shithead'

const isGlass = (card) => card && rankOf(card) === '3'

// Which cards is this player playing from right now: hand, then face-up, then
// the blind face-down ones.
function layerOf(hand, faceUp) {
  return hand.length > 0 ? 'hand' : (faceUp.length > 0 ? 'faceUp' : 'faceDown')
}

// Pick up the whole pile (used by the button AND by auto pick-up).
function doPickUp(storage, id, why = '') {
  const sh = storage.get('shed')
  const discardList = storage.get('discardPile')
  const pile = readPile(storage)
  if (pile.length === 0) return
  const handsObj = storage.get('hands')
  while (discardList.length > 0) discardList.delete(0)
  handsObj.set(id, [...(handsObj.get(id) ?? []), ...pile])
  announce(storage, `😤 ${id} ${why}picked up ${pile.length} cards`, [
    { kind: 'slam', tone: 'brown', emoji: '😤', title: 'PICK UP!', burst: false, sound: 'sad', who: id, sub: `${id} takes ${pile.length} card${pile.length === 1 ? '' : 's'}`, subMe: `You take ${pile.length} card${pile.length === 1 ? '' : 's'}` },
    { kind: 'fly', from: '@pile', to: id, count: pile.length, sound: null },
  ])
  advanceTurnWhile(storage, id, (p) => (sh.get('finished') ?? []).includes(p))
}

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
  const lastActionId = useStorage((root) => root.lastAction?.id ?? 0)
  const actionMsg = useActionMessage(3500)

  const [selectedHandId, setSelectedHandId] = useState(null) // swap phase: hand card to swap up
  const [selected, setSelected] = useState([]) // play phase: same-rank cards to play together

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
    announce(storage, `${storage.get('currentTurn')} has the lowest card and starts`)
  }, [])

  // Play one card OR several of the SAME rank at once. `keys` is an array of
  // card ids for hand/faceUp, or a single [index] for a blind face-down flip.
  const play = useMutation(({ storage }, { id, source, keys }) => {
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

    let cards
    if (source === 'hand' || source === 'faceUp') {
      if (source === 'faceUp' && (hand.length > 0 || drawPile.length > 0)) return
      const pool = source === 'hand' ? hand : fu
      cards = (keys ?? []).map((k) => pool.find((c) => c.id === k)).filter(Boolean)
      if (cards.length === 0) return
      const r0 = rankOf(cards[0])
      if (!cards.every((c) => rankOf(c) === r0)) return // multiples must match rank
      if (!canPlay(cards[0], top)) return
      const playedIds = new Set(cards.map((c) => c.id))
      if (source === 'hand') handsObj.set(id, hand.filter((c) => !playedIds.has(c.id)))
      else sh.set(`fu:${id}`, fu.filter((c) => !playedIds.has(c.id)))
    } else { // faceDown — single blind flip
      if (hand.length > 0 || fu.length > 0) return
      const idx = (keys ?? [])[0]
      const card = fd[idx]
      if (!card) return
      faceDown[id] = fd.filter((_, i) => i !== idx)
      sh.set('faceDown', faceDown)
      if (!canPlay(card, top)) {
        const taken = [...pile, card]
        while (discardList.length > 0) discardList.delete(0)
        handsObj.set(id, [...(handsObj.get(id) ?? []), ...taken])
        announce(storage, `🙈 ${id} flipped ${card.label} — couldn't play, picked up ${taken.length}`, [
          { kind: 'slam', tone: 'purple', emoji: '🙈', title: 'OOPS!', cards: [card], burst: false, sound: 'sad', who: id, sub: `${id}'s blind card can't go — picks up ${taken.length}`, subMe: `Can't play that — you pick up ${taken.length}` },
          { kind: 'fly', from: '@pile', to: id, count: taken.length, sound: null },
        ])
        advanceTurnWhile(storage, id, (p) => finishedList.includes(p))
        return
      }
      cards = [card]
    }

    cards.forEach((c) => discardList.push(c))
    if (source === 'hand') {
      while ((handsObj.get(id) ?? []).length < 3 && drawPile.length > 0) {
        const c = drawPile.get(0); drawPile.delete(0)
        handsObj.set(id, [...(handsObj.get(id) ?? []), c])
      }
    }

    const r = rankOf(cards[0])
    const after = readPile(storage)
    const burned = r === '10' || topRankRun(after) >= 4
    const label = cards.length > 1 ? `${cards.length}× ${r}` : cards[0].label
    const handLeft = (handsObj.get(id) ?? []).length
    const fuLeft = (sh.get(`fu:${id}`) ?? []).length
    const fdLeft = (sh.get('faceDown')[id] ?? []).length
    const done = handLeft === 0 && fuLeft === 0 && fdLeft === 0
    if (done && !finishedList.includes(id)) {
      sh.set('finished', [...finishedList, id])
    }

    // Little effects for the magic cards; a big one for getting out.
    const fx = []
    if (!burned && r === '2') fx.push({ kind: 'bubble', at: '@pile', text: '🔄 Reset!' })
    if (!burned && r === '7') fx.push({ kind: 'bubble', at: '@pile', text: '⬇️ 7 or lower!' })
    if (!burned && r === '3') fx.push({ kind: 'bubble', at: '@pile', text: '👻 Invisible!' })
    if (done) fx.push({ kind: 'slam', tone: 'green', emoji: '🎉', title: "I'M OUT!", confetti: true, sound: 'fanfare', who: id, sub: `${id} has no cards left — safe!`, subMe: "You're safe! 🎉" })

    if (burned) {
      const count = discardList.length
      while (discardList.length > 0) discardList.delete(0)
      sh.set('burned', (sh.get('burned') ?? 0) + count)
      // Every phone watches this to play the fire animation 🔥
      sh.set('lastBurn', { at: Date.now(), by: id, count, why: r === '10' ? 'ten' : 'four', cards: after.slice(-4) })
      announce(storage, `🔥 ${id} played ${label} — pile burned, go again!`, fx.length ? fx : null)
    } else {
      announce(storage, `${id} played ${label}`, fx.length ? fx : null)
    }
    const finishedNow = sh.get('finished') ?? []
    if (burned && !finishedNow.includes(id)) {
      storage.set('currentTurn', id)
    } else {
      advanceTurnWhile(storage, id, (p) => finishedNow.includes(p))
    }
  }, [myId])

  const pickUp = useMutation(({ storage }, { id }) => {
    if (storage.get('shed').get('phase') !== 'play') return
    if (storage.get('currentTurn') !== id) return
    doPickUp(storage, id)
  }, [])

  // ⏭ Nothing in your hand (or face-up cards) can beat the pile? Then you have
  // to pick it up — so after a short countdown it happens by itself.
  const autoPickUp = useMutation(({ storage }, id) => {
    const sh = storage.get('shed')
    if (sh.get('phase') !== 'play') return
    if (storage.get('currentTurn') !== id) return
    const hand = storage.get('hands').get(id) ?? []
    const fu = sh.get(`fu:${id}`) ?? []
    const layer = layerOf(hand, fu)
    if (layer === 'faceDown') return // blind cards are always a gamble — you flip one
    const pile = readPile(storage)
    if (pile.length === 0 || canPlayAny(layer === 'hand' ? hand : fu, effectiveTop(pile))) return
    doPickUp(storage, id, "couldn't beat the pile and ")
  }, [])

  const isReady = (p) => !!(shed && shed[`ready:${p}`])
  const everyoneReady = playerOrder.length > 0 && playerOrder.every(isReady)

  // The first player kicks off play once everyone has readied up — or, if
  // they're offline, the next online player does.
  const iStartPlay = useInCharge(myId, playerOrder[0], playerOrder)
  useEffect(() => {
    if (shed?.phase === 'swap' && everyoneReady && iStartPlay) startPlay()
  }, [shed?.phase, everyoneReady, iStartPlay, startPlay])

  // Is the current player stuck (nothing can beat the pile)? Every phone can
  // tell, because everyone's cards are in shared storage.
  const turnHand = hands?.[currentTurn] ?? []
  const turnFaceUp = shed?.[`fu:${currentTurn}`] ?? []
  const turnLayer = layerOf(turnHand, turnFaceUp)
  const pileTop = effectiveTop(discard)
  const turnIsStuck = shed?.phase === 'play' && discard.length > 0 && turnLayer !== 'faceDown' &&
    !(shed.finished ?? []).includes(currentTurn) &&
    !canPlayAny(turnLayer === 'hand' ? turnHand : turnFaceUp, pileTop)
  useAutoPass({ myId, currentTurn, order: playerOrder, stuck: turnIsStuck, act: autoPickUp, watch: lastActionId })

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
        <TurnBanner isMyTurn={!iAmReady} text={iAmReady ? '⏳ Waiting for everyone to be ready…' : '🔀 Swap cards, then ready up'} />
        <ActionMessage message={actionMsg} />
        <div className="table-center">
          <div className="ask-step">Your face-up cards</div>
          <p className="ask-hint">Swap your best cards up here — you'll play them later</p>
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
          {!iAmReady && <p className="ask-empty-msg">{selectedHandId == null ? '👇 Tap a card in your hand, then one of these to swap' : '👆 Now tap a face-up card to swap'}</p>}
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
    return <WinnerScreen emoji="💩" rain="💩" title={notFinished[0] ? `${notFinished[0]} is the Shithead!` : 'Game over!'} scores={scores} onLeave={onLeave} />
  }

  // Which layer am I playing from, and can I beat the pile?
  const myLayer = myHand.length > 0 ? 'hand' : (myFaceUp.length > 0 ? 'faceUp' : 'faceDown')
  const activeCards = myLayer === 'hand' ? myHand : (myLayer === 'faceUp' ? myFaceUp : myFaceDown)
  const canBeat = myLayer === 'faceDown' ? true : canPlayAny(activeCards, beatTop)
  const iAmFinished = finished.includes(myId)

  // Multi-select: keep only still-valid ids (cards still in my active layer).
  const validSelected = selected.filter((sid) => activeCards.some((c) => c.id === sid))
  const selectedRank = validSelected.length ? rankOf(activeCards.find((c) => c.id === validSelected[0])) : null
  // Tap a playable card to add/remove it; selecting a different rank starts over.
  const toggleSelect = (card) => {
    if (!canPlay(card, beatTop)) return
    setSelected((prev) => {
      if (prev.includes(card.id)) return prev.filter((x) => x !== card.id)
      if (selectedRank && rankOf(card) !== selectedRank) return [card.id]
      return [...prev, card.id]
    })
  }
  const playSelected = () => {
    if (validSelected.length === 0) return
    play({ id: myId, source: myLayer, keys: validSelected })
    setSelected([])
  }

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="💩" />
      <ActionMessage message={actionMsg} />
      <BurnFX burn={shed.lastBurn} />

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
          <div className="pile-col" data-spot="pile">
            {!top ? (
              <div className="empty-pile discard-empty">Pile</div>
            ) : isGlass(top) ? (
              <div className="shed-glass-stack">
                {beatTop ? <CardFace label={beatTop.label} red={beatTop.red} /> : <div className="empty-pile discard-empty">—</div>}
                <CardFace label={top.label} red={top.red} glass />
              </div>
            ) : (
              <div key={top.id} className="card-land"><CardFace label={top.label} red={top.red} /></div>
            )}
            <span className="pile-label">Pile{discard.length > 0 ? ` · ${discard.length}` : ''}</span>
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
            {myLayer !== 'faceDown' && validSelected.length > 0 && (
              <button className="big-btn create-btn" onClick={playSelected}>
                Play {validSelected.length > 1 ? `${validSelected.length}× ${selectedRank}` : selectedRank} ▶
              </button>
            )}
            {discard.length > 0 && canBeat && (
              <button className="action-btn sort-btn" onClick={() => pickUp({ id: myId })}>Pick up pile</button>
            )}
          </div>
        )}
        {turnIsStuck && <AutoPassNotice who={currentTurn} myId={myId} reason="can't beat the pile" action="picking it up" />}

        {/* My face-down (blind) and face-up cards */}
        <div className="shed-mine">
          <div className="shed-stack-row">
            {myFaceDown.map((_, i) => (
              <CardBack
                key={i}
                className={isMyTurn && myLayer === 'faceDown' ? 'pick-card' : ''}
                onClick={isMyTurn && myLayer === 'faceDown' ? () => play({ id: myId, source: 'faceDown', keys: [i] }) : undefined}
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
                  picked={validSelected.includes(c.id)}
                  onClick={isMyTurn && myLayer === 'faceUp' && canPlay(c, beatTop) ? () => toggleSelect(c) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Hand
        cards={myHand}
        onCardClick={isMyTurn && myLayer === 'hand' ? (card) => { if (canPlay(card, beatTop)) toggleSelect(card) } : undefined}
        isHighlighted={(card) => isMyTurn && myLayer === 'hand' && canPlay(card, beatTop) && !validSelected.includes(card.id)}
        isPicked={(card) => validSelected.includes(card.id)}
        isGlass={isGlass}
        showSort
        hint={isMyTurn && myLayer === 'hand' && canBeat ? 'Tap matching cards, then Play ▶' : undefined}
      />
    </div>
  )
}
