import { useState, useMemo } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { advanceTurnWhile, readPlayerOrder } from '../../engine/turns'
import { announce, useActionMessage } from '../../engine/announce'
import { useAutoPass } from '../../engine/autoPass'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import AutoPassNotice from '../../components/AutoPassNotice'
import CardFace from '../../components/CardFace'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent, CardFan } from '../../components/Opponent'
import { useBotTurn, useBots } from '../../engine/bots'
import { chooseBigTwoMove } from '../ai/bigTwoBot'
import { identifyCombo, isLegalPlay, describeCombo, sortForBigTwo, legalPlays, selectableCardIds, highlightHintIds } from '../rules/bigTwo'
import { rankOf } from '../../lib/cards'

// The big plays get a big moment.
const COMBO_SLAM = {
  straight: { title: 'STRAIGHT!', emoji: '📏', tone: 'blue' },
  flush: { title: 'FLUSH!', emoji: '🌊', tone: 'blue' },
  fullhouse: { title: 'FULL HOUSE!', emoji: '🏠', tone: 'gold' },
  quad: { title: 'FOUR OF A KIND!', emoji: '💣', tone: 'fire', shake: true },
  straightflush: { title: 'STRAIGHT FLUSH!!!', emoji: '💣💣', tone: 'rainbow', shake: true, big: true },
}

function playFx(id, combo, cards, cardsLeft, place) {
  const fx = []
  const look = COMBO_SLAM[combo.type]
  const allTwos = cards.every((c) => rankOf(c) === '2')
  if (look) fx.push({ kind: 'slam', ...look, cards, who: id, sub: `${id} played it!`, subMe: 'Boom! 💥', sound: look.shake ? 'zap' : 'slam' })
  else if (allTwos && cards.length === 1) fx.push({ kind: 'slam', tone: 'fire', title: 'BIG TWO!', emoji: '2️⃣', cards, who: id, sub: `${id} played a 2!`, subMe: 'Top card! 🔥' })
  else if (allTwos) fx.push({ kind: 'slam', tone: 'fire', title: 'DOUBLE TWOS!', emoji: '😱', cards, shake: true, who: id, sub: `${id} played ${cards.length} twos!` })
  if (cardsLeft === 0) {
    fx.push({ kind: 'slam', tone: 'green', emoji: place === 1 ? '🏆' : '🎉', title: place === 1 ? 'WINNER!' : "I'M OUT!", confetti: true, sound: 'fanfare', who: id, sub: `${id} finished #${place}`, subMe: `You finished #${place}!` })
  } else if (cardsLeft === 1) {
    fx.push({ kind: 'bubble', at: id, text: '☝️ Last card!' })
  }
  return fx.length ? fx : null
}

// Play cards / pass — plain functions so a human tap and a bot's move follow
// exactly the same rules. Both refuse unless it's `id`'s turn.
function doPlay(storage, { id, cardIds }) {
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
  if (newHand.length === 0 && !finishedList.includes(id)) {
    bt.set('finished', [...finishedList, id])
    // 💰 First out? Remember what everyone's stuck with — that's what they pay for.
    if (finishedList.length === 0) {
      const left = {}
      for (const p of readPlayerOrder(storage)) {
        const h = p === id ? [] : (handsObj.get(p) ?? [])
        left[p] = { n: h.length, twos: h.filter((c) => rankOf(c) === '2').length }
      }
      bt.set('leftAtWin', left)
    }
  }

  const finishedNow = bt.get('finished') ?? []
  announce(storage, `${id} played ${describeCombo(combo, cards)}`, playFx(id, combo, cards, newHand.length, finishedNow.indexOf(id) + 1))

  advanceTurnWhile(storage, id, (p) => finishedNow.includes(p))
}

function doPass(storage, { id }) {
  const bt = storage.get('bigTwo')
  if (storage.get('currentTurn') !== id) return
  if (!bt.get('trickType')) return // can't pass while leading — you must play
  const finished = bt.get('finished') ?? []
  const leader = bt.get('leader')
  const order = readPlayerOrder(storage)
  const activeOthers = order.filter((p) => p !== leader && !finished.includes(p)).length
  const newPassCount = (bt.get('passCount') ?? 0) + 1

  if (newPassCount >= activeOthers) {
    announce(storage, `${id} passed — ${leader} leads again`, [
      { kind: 'bubble', at: id, text: '😶 Pass' },
      { kind: 'bubble', at: leader, text: '👑 My lead!', sound: null },
    ])
    bt.set('currentTrick', [])
    bt.set('trickType', null)
    bt.set('leader', '')
    bt.set('passCount', 0)
  } else {
    announce(storage, `${id} passed`, { kind: 'bubble', at: id, text: '😶 Pass' })
    bt.set('passCount', newPassCount)
  }
  advanceTurnWhile(storage, id, (p) => finished.includes(p))
}

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
  const lastActionId = useStorage((root) => root.lastAction?.id ?? 0)
  const actionMsg = useActionMessage(3500)
  const [selected, setSelected] = useState([])

  const play = useMutation(({ storage }, args) => doPlay(storage, args), [])
  const pass = useMutation(({ storage }, args) => doPass(storage, args), [])

  // 🤖 A bot's go: decide from the table as it is RIGHT NOW, then play or pass.
  const botMove = useMutation(({ storage }, botId, level) => {
    if (storage.get('currentTurn') !== botId) return
    const bt = storage.get('bigTwo')
    const handsObj = storage.get('hands')
    const finished = bt.get('finished') ?? []
    const stillIn = readPlayerOrder(storage).filter((p) => !finished.includes(p))
    if (stillIn.length <= 1 || !stillIn.includes(botId)) return // game over
    const move = chooseBigTwoMove({
      hand: handsObj.get(botId) ?? [],
      trickType: bt.get('trickType'),
      mustStartWith3D: bt.get('mustStartWith3D'),
      level,
      oppCounts: stillIn.filter((p) => p !== botId).map((p) => (handsObj.get(p) ?? []).length),
    })
    if (move) doPlay(storage, { id: botId, cardIds: move.map((c) => c.id) })
    else doPass(storage, { id: botId })
  }, [])

  const bots = useBots()
  const finishedNow = bigTwo?.finished ?? []
  useBotTurn({
    myId,
    currentTurn,
    playerOrder,
    act: botMove,
    active: !!bigTwo?.finished && playerOrder.filter((p) => !finishedNow.includes(p)).length > 1,
    watch: lastActionId,
  })

  // ⏭ Can't beat what's on the table? Pass by itself after a countdown.
  // (Bots decide for themselves, and you can never pass when leading.)
  const autoPass = useMutation(({ storage }, id) => {
    if (storage.get('currentTurn') !== id) return
    const bt = storage.get('bigTwo')
    const trick = bt.get('trickType')
    if (!trick) return
    if (legalPlays(storage.get('hands').get(id) ?? [], trick, bt.get('mustStartWith3D')).length > 0) return
    doPass(storage, { id })
  }, [])
  const turnHand = hands?.[currentTurn]
  const turnIsStuck = useMemo(() => {
    if (!bigTwo?.trickType || !turnHand || bots[currentTurn]) return false
    if ((bigTwo.finished ?? []).includes(currentTurn)) return false
    return legalPlays(turnHand, bigTwo.trickType, bigTwo.mustStartWith3D).length === 0
  }, [bigTwo, turnHand, bots, currentTurn])
  useAutoPass({ myId, currentTurn, order: playerOrder, stuck: turnIsStuck, act: autoPass, watch: lastActionId })

  // Every legal move in my hand (searched once per change, not on every tap).
  const isMyTurnNow = currentTurn === myId
  const trickNow = bigTwo?.trickType ?? null
  const must3D = bigTwo?.mustStartWith3D ?? false
  const plays = useMemo(
    () => (isMyTurnNow ? legalPlays(myHand, trickNow, must3D) : []),
    [isMyTurnNow, myHand, trickNow, must3D],
  )

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
    return <WinnerScreen emoji="2️⃣" title={`${finished[0]} wins Big Two!`} scores={scores} onLeave={onLeave} />
  }

  const selectedCards = myHand.filter((c) => selected.includes(c.id))
  const potentialCombo = selectedCards.length > 0 ? identifyCombo(selectedCards) : null
  const legal = selectedCards.length > 0 && isLegalPlay(selectedCards, trickType, mustStartWith3D)

  // Smart highlights: with nothing tapped, light up the combos on offer; once
  // a card is tapped, light up only the cards that can still complete it.
  const selectableIds = selectableCardIds(plays, selected)
  const hintIds = highlightHintIds(plays, trickType, mustStartWith3D)

  const toggleSelect = (card) => {
    setSelected((prev) => {
      if (prev.includes(card.id)) return prev.filter((x) => x !== card.id)
      if (prev.length > 0 && !selectableIds.has(card.id)) return [card.id] // doesn't fit → start again with this card
      if (prev.length >= 5) return prev
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
              sub={finished.includes(p)
                ? `finished — #${finished.indexOf(p) + 1} ✅`
                : `${(hands[p] ?? []).length} cards${bots[p] && currentTurn === p ? ' · 🤔' : ''}`}
            >
              <CardFan count={(hands[p] ?? []).length} />
            </Opponent>
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="whist-trick" data-spot="pile">
          {currentTrick.length === 0
            ? <span className="trick-empty">{isMyTurn ? '👑 Your lead — play anything' : `👑 ${currentTurn} leads…`}</span>
            : (
              <div key={currentTrick.map((c) => c.id).join()} className="whist-play card-land">
                <div className="shed-stack-row">
                  {currentTrick.map((c) => <CardFace key={c.id} label={c.label} red={c.red} />)}
                </div>
                <span className="whist-play-name">{leader} played {trickType ? describeCombo(trickType, currentTrick) : ''}</span>
              </div>
            )}
        </div>

        {turnIsStuck && <AutoPassNotice who={currentTurn} myId={myId} reason="can't beat that" />}
        {isMyTurn && !iAmFinished && !turnIsStuck && (
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
        sortWith={sortForBigTwo}
        hint={isMyTurn ? 'Tap cards, then Play\u00a0▶' : undefined}
      />
    </div>
  )
}
