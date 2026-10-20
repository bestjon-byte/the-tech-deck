import { useState } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { SUITS, rankOf, nCards } from '../../lib/cards'
import { useTurns, readPlayerOrder } from '../../engine/turns'
import { useActionMessage } from '../../engine/announce'
import { useAutoPass } from '../../engine/autoPass'
import { useBotTurn, useBots } from '../../engine/bots'
import { chooseBlackJackMove } from '../ai/blackJackBot'
import {
  canStart, isLegalPlay, effectiveTop, seatAfter, isInvisible, readTable, gameOver, doPlay, doTake,
} from '../rules/blackJack'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import AutoPassNotice from '../../components/AutoPassNotice'
import CardFace from '../../components/CardFace'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent, CardFan } from '../../components/Opponent'

const isRed = (suit) => suit === '♥' || suit === '♦'

// ── Black Jack ─────────────────────────────────────────────
// Uno with a normal deck: match the suit or number, dodge the pick-ups, and
// be the first to empty your hand.
export default function BlackJackBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const hands = useStorage((root) => root.hands)
  const deckCount = useStorage((root) => root.deck?.length ?? 0)
  const discard = useStorage((root) => root.discardPile ?? [])
  const bj = useStorage((root) => root.blackJack)
  const lastActionId = useStorage((root) => root.lastAction?.id ?? 0)
  const actionMsg = useActionMessage(4000)
  const bots = useBots()

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)
  const [selected, setSelected] = useState([]) // card ids, in the order they'll go down
  const [choosingSuit, setChoosingSuit] = useState(false)
  const [selectedAt, setSelectedAt] = useState(lastActionId)
  if (selectedAt !== lastActionId) { setSelectedAt(lastActionId); setSelected([]) } // a move happened — start fresh

  const play = useMutation(({ storage }, args) => doPlay(storage, args), [])
  const take = useMutation(({ storage }, id) => doTake(storage, id), [])

  // ⏭ Nothing you can play? You'd have to pick up / draw anyway — so it happens by itself.
  const autoTake = useMutation(({ storage }, id) => {
    if (storage.get('currentTurn') !== id) return
    const hand = storage.get('hands').get(id) ?? []
    const table = readTable(storage)
    if (hand.length === 0 || hand.some((c) => canStart(c, table))) return
    doTake(storage, id, 'had no match')
  }, [])

  // 🤖 A bot's go: decide from the table as it is RIGHT NOW.
  const botMove = useMutation(({ storage }, botId, level) => {
    if (storage.get('currentTurn') !== botId || gameOver(storage)) return
    const handsObj = storage.get('hands')
    const table = readTable(storage)
    const order = readPlayerOrder(storage)
    const next = seatAfter(order, botId, table.dir)
    const move = chooseBlackJackMove({ hand: handsObj.get(botId) ?? [], table, level, nextCount: (handsObj.get(next) ?? []).length, players: order.length })
    if (move) doPlay(storage, { id: botId, cardIds: move.cards.map((c) => c.id), suit: move.suit })
    else doTake(storage, botId)
  }, [])

  const table = { top: effectiveTop(discard), suit: bj?.suit ?? '', pickup: bj?.pickup ?? 0 }
  const dir = bj?.dir ?? 1
  const winner = hands ? playerOrder.find((p) => (hands[p] ?? []).length === 0) : null
  useBotTurn({ myId, currentTurn, playerOrder, act: botMove, active: !!bj && !!hands && !winner, watch: lastActionId })

  const turnHand = hands?.[currentTurn] ?? []
  const turnIsStuck = !!bj && !!hands && !winner && !bots[currentTurn] && turnHand.length > 0 && !turnHand.some((c) => canStart(c, table))
  useAutoPass({ myId, currentTurn, order: playerOrder, stuck: turnIsStuck, act: autoTake, watch: lastActionId })

  if (!bj || !hands || bj.dir === undefined) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  if (winner) {
    const scores = playerOrder
      .map((p) => ({ name: p, count: (hands[p] ?? []).length }))
      .sort((a, b) => a.count - b.count)
      .map((s) => ({ name: s.name, detail: `${nCards(s.count)} left` }))
    return <WinnerScreen emoji="🖤" title={`${winner} wins Black Jack!`} scores={scores} onLeave={onLeave} />
  }

  // Selection: the first card must be playable; more cards must be the same number.
  const picked = selected.map((id) => myHand.find((c) => c.id === id)).filter(Boolean)
  const validPicked = isMyTurn && isLegalPlay(picked, table) ? picked : []
  const pickedRank = validPicked.length ? rankOf(validPicked[0]) : null
  const canTap = (card) => isMyTurn && (pickedRank ? rankOf(card) === pickedRank || canStart(card, table) : canStart(card, table))

  function tapCard(card) {
    if (!canTap(card)) return
    setSelected(() => {
      const ids = validPicked.map((c) => c.id)
      if (ids.includes(card.id)) return ids[0] === card.id ? [] : ids.filter((x) => x !== card.id)
      if (pickedRank && rankOf(card) === pickedRank) return [...ids, card.id]
      return [card.id]
    })
  }

  function playPicked(suit) {
    if (!validPicked.length) return
    if (pickedRank === 'A' && !suit) { setChoosingSuit(true); return }
    play({ id: myId, cardIds: validPicked.map((c) => c.id), suit })
    setSelected([])
    setChoosingSuit(false)
  }

  function takeCards() {
    if (!isMyTurn) return
    take(myId)
    setSelected([])
  }

  // The pile: the real card at the back, any invisible 3s laid over it askew.
  const top = discard[0] ?? null
  const glass = []
  for (const c of discard) { if (!isInvisible(c)) break; glass.unshift(c) }
  const shownGlass = glass.slice(-3)
  const nextUp = seatAfter(playerOrder, currentTurn, dir)
  const answerHint = 'pass it on with a 2 or Black Jack · a Red Jack cancels it'

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🖤" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {otherPlayers.map((p) => (
            <Opponent key={p} name={p} sub={`${nCards((hands[p] ?? []).length)}${bots[p] && currentTurn === p ? ' · 🤔' : ''}`}>
              <CardFan count={(hands[p] ?? []).length} />
            </Opponent>
          ))}
        </div>
        {playerOrder.length > 2 && (
          <div className={`bj-direction${dir < 0 ? ' reversed' : ''}`} key={dir}>
            {dir > 0 ? 'Play goes ➡️' : '⬅️ Reversed'} · {nextUp === myId ? 'you' : nextUp} next
          </div>
        )}
      </div>

      <div className="table-center">
        <div className="piles-area">
          <div className="pile-col" data-spot="deck">
            {deckCount > 0 || discard.length > 1 ? (
              <CardBack className="draw-pile-card" onClick={isMyTurn ? takeCards : undefined} />
            ) : (
              <div className="empty-pile">Empty</div>
            )}
            <span className="pile-label">Draw{deckCount > 0 ? ` · ${deckCount}` : ''}</span>
          </div>
          <div className="pile-col" data-spot="pile">
            {!top ? (
              <div className="empty-pile discard-empty">—</div>
            ) : isInvisible(top) ? (
              <div className="shed-glass-stack" style={{ '--n': shownGlass.length }}>
                {table.top ? <CardFace label={table.top.label} red={table.top.red} /> : <div className="empty-pile discard-empty">Anything</div>}
                {shownGlass.map((c, i) => (
                  <div key={c.id} className={`glass-pane${c.id === top.id ? ' card-land' : ''}`} style={{ '--i': i + 1 }}>
                    <CardFace label={c.label} red={c.red} glass />
                  </div>
                ))}
              </div>
            ) : (
              <div key={top.id} className="card-land"><CardFace label={top.label} red={top.red} /></div>
            )}
            {table.pickup > 0
              ? <span key={`p${table.pickup}`} className="suit-badge bj-pickup-badge">Pick up {table.pickup}</span>
              : table.suit
                ? <span key={table.suit} className={`suit-badge${isRed(table.suit) ? ' red' : ''}`}>Now: {table.suit}</span>
                : <span className="pile-label">Pile</span>}
          </div>
        </div>

        {table.pickup > 0 && !turnIsStuck && (
          <p className="bj-pickup-msg">
            {isMyTurn ? <>😱 <b>Pick up {table.pickup}</b> — or {answerHint}</> : <>⚠️ {currentTurn} has to pick up {table.pickup}…</>}
          </p>
        )}

        {isMyTurn && !turnIsStuck && (
          <div className="action-buttons">
            {validPicked.length > 0 && (
              <button className="big-btn create-btn" onClick={() => playPicked()}>
                Play {validPicked.length > 1 ? `${validPicked.length}× ${pickedRank}` : validPicked[0].label} ▶
              </button>
            )}
            <button className="action-btn draw-btn" onClick={takeCards}>
              {table.pickup > 0 ? `Pick up ${table.pickup}` : 'Draw a card'}
            </button>
          </div>
        )}
        {turnIsStuck && (
          <AutoPassNotice
            who={currentTurn}
            myId={myId}
            reason={table.pickup > 0 ? "can't fight back" : "can't match"}
            action={table.pickup > 0 ? `picking up ${table.pickup}` : 'drawing a card'}
          />
        )}
      </div>

      {/* Suit picker for an Ace */}
      {choosingSuit && (
        <div className="modal-overlay" onClick={() => setChoosingSuit(false)}>
          <div className="modal-card suit-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">🅰️ Ace! Pick the new suit</div>
            <div className="suit-choices">
              {SUITS.map((s) => (
                <button key={s} className={`suit-choice ${isRed(s) ? 'red' : ''}`} onClick={() => playPicked(s)}>{s}</button>
              ))}
            </div>
            <button className="big-btn back-btn" onClick={() => setChoosingSuit(false)}>Cancel</button>
          </div>
        </div>
      )}

      <Hand
        cards={myHand}
        onCardClick={isMyTurn ? tapCard : undefined}
        isHighlighted={(card) => canTap(card) && !validPicked.some((c) => c.id === card.id)}
        isPicked={(card) => validPicked.some((c) => c.id === card.id)}
        isGlass={isInvisible}
        showSort
        hint={!isMyTurn ? undefined : validPicked.length ? `Add more ${pickedRank}s, or Play\u00a0▶` : 'Tap a glowing card, then Play\u00a0▶'}
      />
    </div>
  )
}
