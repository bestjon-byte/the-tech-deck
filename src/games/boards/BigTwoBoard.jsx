import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { advanceTurnWhile, readPlayerOrder } from '../../engine/turns'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardFace from '../../components/CardFace'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'
import { identifyCombo, isLegalPlay, describeCombo, sortForBigTwo, selectableCardIds, highlightHintIds } from '../rules/bigTwo'

// ── Big Two ────────────────────────────────────────────────
// Empty your hand first to win. Beat the live combo with a bigger one of the
// same size (single/pair/triple/5-card hand), or Pass. Once every other
// active player has passed, the table clears and the last player to play
// leads again with anything.
export default function BigTwoBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const hands = useStorage((root) => root.hands)
  const bigTwo = useStorage((root) => root.bigTwo)
  const currentTurn = useStorage((root) => root.currentTurn ?? '')
  const playerOrder = useStorage((root) => root.playerOrder ?? [])
  const lastAction = useStorage((root) => root.lastAction ?? { message: '', id: 0 })

  const [actionMsg, setActionMsg] = useState('')
  const [shownId, setShownId] = useState(0)
  const [selected, setSelected] = useState([])
  if (lastAction && lastAction.id !== shownId && lastAction.message) {
    setShownId(lastAction.id)
    setActionMsg(lastAction.message)
  }
  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(''), 3500)
    return () => clearTimeout(t)
  }, [actionMsg])

  const sortHand = useMutation(({ storage }) => {
    const h = storage.get('hands')
    h.set(myId, sortForBigTwo(h.get(myId) ?? []))
  }, [myId])

  const play = useMutation(({ storage }, { id, cardIds }) => {
    const bt = storage.get('bigTwo')
    if (storage.get('currentTurn') !== id) return
    const handsObj = storage.get('hands')
    const hand = handsObj.get(id) ?? []
    const cards = cardIds.map((cid) => hand.find((c) => c.id === cid)).filter(Boolean)
    if (cards.length !== cardIds.length) return
    const trickType = bt.get('trickType')
    const mustStart = bt.get('mustStartWith3D')
    if (!isLegalPlay(cards, trickType, mustStart)) return
    const combo = identifyCombo(cards)

    const playedIds = new Set(cardIds)
    const newHand = hand.filter((c) => !playedIds.has(c.id))
    handsObj.set(id, newHand)
    bt.set('currentTrick', cards)
    bt.set('trickType', combo)
    bt.set('leader', id)
    bt.set('passCount', 0)
    if (mustStart) bt.set('mustStartWith3D', false)

    const finishedList = bt.get('finished') ?? []
    if (newHand.length === 0 && !finishedList.includes(id)) bt.set('finished', [...finishedList, id])

    const la = storage.get('lastAction')
    la.set('message', `${id} played ${describeCombo(combo, cards)}`)
    la.set('id', (la.get('id') ?? 0) + 1)

    const finishedNow = bt.get('finished') ?? []
    advanceTurnWhile(storage, id, (p) => finishedNow.includes(p))
  }, [])

  const pass = useMutation(({ storage }, { id }) => {
    const bt = storage.get('bigTwo')
    if (storage.get('currentTurn') !== id) return
    if (!bt.get('trickType')) return // can't pass while leading — you must play
    const finished = bt.get('finished') ?? []
    const leader = bt.get('leader')
    const order = readPlayerOrder(storage)
    const activeOthers = order.filter((p) => p !== leader && !finished.includes(p)).length
    const newPassCount = (bt.get('passCount') ?? 0) + 1

    const la = storage.get('lastAction')
    la.set('message', `${id} passed`)
    la.set('id', (la.get('id') ?? 0) + 1)

    if (newPassCount >= activeOthers) {
      bt.set('currentTrick', [])
      bt.set('trickType', null)
      bt.set('leader', '')
      bt.set('passCount', 0)
    } else {
      bt.set('passCount', newPassCount)
    }
    advanceTurnWhile(storage, id, (p) => finished.includes(p))
  }, [])

  if (!bigTwo || !hands || !playerOrder.length) {
    return <div className="lobby"><p className="lobby-sub">Dealing the cards…</p></div>
  }

  const { currentTrick = [], trickType = null, leader = '', finished = [], mustStartWith3D = false } = bigTwo
  const others = playerOrder.filter((p) => p !== myId)
  const isMyTurn = currentTurn === myId
  const iAmFinished = finished.includes(myId)

  // ── Game over ────────────────────────────────────────────
  const notFinished = playerOrder.filter((p) => !finished.includes(p))
  if (playerOrder.length > 1 && notFinished.length <= 1) {
    const ranking = [...finished, ...notFinished]
    const scores = ranking.map((p, idx) => ({
      name: p,
      detail: idx < finished.length ? `#${idx + 1}` : `😖 ${(hands[p] ?? []).length} left`,
    }))
    return <WinnerScreen emoji="🃏" title={`${finished[0]} wins Big Two!`} scores={scores} onLeave={onLeave} />
  }

  const selectedCards = myHand.filter((c) => selected.includes(c.id))
  const potentialCombo = selectedCards.length > 0 ? identifyCombo(selectedCards) : null
  const legal = selectedCards.length > 0 && isLegalPlay(selectedCards, trickType, mustStartWith3D)

  // Cards that can still join the current selection and end up a legal,
  // trick-beating play — once at least one card is picked this is what gates
  // further taps; with nothing picked yet it's the "smart highlight" hint.
  const selectableIds = isMyTurn ? selectableCardIds(myHand, trickType, mustStartWith3D, selected) : new Set()
  const hintIds = isMyTurn && selected.length === 0 ? highlightHintIds(myHand, trickType, mustStartWith3D) : new Set()

  const toggleSelect = (card) => {
    setSelected((prev) => {
      if (prev.includes(card.id)) return prev.filter((x) => x !== card.id)
      if (prev.length >= 5) return prev
      if (prev.length > 0 && !selectableIds.has(card.id)) return prev
      return [...prev, card.id]
    })
  }

  const playSelected = () => {
    if (!legal) return
    play({ id: myId, cardIds: selected })
    setSelected([])
  }

  let playLabel = 'Select cards to play'
  if (selectedCards.length > 0) {
    if (!potentialCombo) playLabel = 'Not a valid hand'
    else if (!legal) playLabel = trickType ? "Can't beat that" : 'Must include the 3♦'
    else playLabel = `Play ${describeCombo(potentialCombo, selectedCards)} ▶`
  }

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="2️⃣" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {others.map((p) => (
            <Opponent
              key={p}
              name={p}
              sub={finished.includes(p) ? `finished — #${finished.indexOf(p) + 1} ✅` : `${(hands[p] ?? []).length} cards`}
            />
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="whist-trick">
          {currentTrick.length === 0
            ? <span className="tableau-empty">{isMyTurn ? 'Your lead — play anything' : 'Table is clear…'}</span>
            : (
              <div className="whist-play">
                <div className="shed-stack-row">
                  {currentTrick.map((c) => <CardFace key={c.id} label={c.label} red={c.red} />)}
                </div>
                <span className="whist-play-name">{leader} played {trickType ? describeCombo(trickType, currentTrick) : ''}</span>
              </div>
            )}
        </div>

        {isMyTurn && !iAmFinished && (
          <div className="action-buttons">
            {selectedCards.length > 0 && (
              <button className="big-btn create-btn" disabled={!legal} onClick={playSelected}>{playLabel}</button>
            )}
            {trickType && (
              <button className="action-btn sort-btn" onClick={() => pass({ id: myId })}>Pass</button>
            )}
            {selectedCards.length === 0 && !trickType && (
              <span className="hand-hint">{mustStartWith3D ? 'Your first play must include the 3♦' : 'Tap cards to build a play'}</span>
            )}
          </div>
        )}
      </div>

      <Hand
        cards={myHand}
        onCardClick={isMyTurn ? toggleSelect : undefined}
        isPicked={(card) => selected.includes(card.id)}
        isHighlighted={(card) => {
          if (!isMyTurn || selected.includes(card.id)) return false
          return selected.length === 0 ? hintIds.has(card.id) : selectableIds.has(card.id)
        }}
        showSort
        onSort={sortHand}
        hint={isMyTurn ? 'Tap cards, then Play ▶' : undefined}
      />
    </div>
  )
}
