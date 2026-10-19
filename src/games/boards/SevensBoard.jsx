import { useStorage, useMutation } from '../../liveblocks.config'
import { VALUES, rankOf, suitOf } from '../../lib/cards'
import { useTurns, advanceTurn } from '../../engine/turns'
import { tallyStake } from '../../engine/stakes'
import { announce, useActionMessage } from '../../engine/announce'
import { useAutoPass } from '../../engine/autoPass'
import { suitRanges, canPlay, hasAnyMove, SUIT_ROWS } from '../rules/sevens'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import AutoPassNotice from '../../components/AutoPassNotice'
import CardFace from '../../components/CardFace'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'

const readTable = (storage) => {
  const table = storage.get('discardPile')
  const all = []
  for (let i = 0; i < table.length; i++) all.push(table.get(i))
  return all
}

// ── Sevens (Fan Tan) ───────────────────────────────────────
// Build four rows out from the 7s — 6,5,4… down and 8,9,10… up. Play a card
// each turn if you can; if you can't, you pass (automatically!). First to
// empty their hand wins.
export default function SevensBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const hands = useStorage((root) => root.hands)
  const tableau = useStorage((root) => root.discardPile)
  const lastActionId = useStorage((root) => root.lastAction?.id ?? 0)
  const actionMsg = useActionMessage(3500)

  const { currentTurn, playerOrder, isMyTurn, otherPlayers } = useTurns(myId)

  const ranges = suitRanges(tableau ?? [])

  const playCard = useMutation(({ storage }, { id, cardId }) => {
    if (storage.get('currentTurn') !== id) return
    const handsObj = storage.get('hands')
    const hand = handsObj.get(id) ?? []
    const card = hand.find((c) => c.id === cardId)
    if (!card) return
    if (!canPlay(card, suitRanges(readTable(storage)))) return

    handsObj.set(id, hand.filter((c) => c.id !== cardId))
    storage.get('discardPile').push(card)
    const left = (handsObj.get(id) ?? []).length
    const suit = suitOf(card)
    const rowDone = readTable(storage).filter((c) => suitOf(c) === suit).length === 13
    let fx = null
    if (rowDone) {
      fx = { kind: 'slam', tone: 'gold', emoji: suit, red: card.red, title: 'ROW COMPLETE!', sub: `${id} finished the ${suit} row`, who: id, subMe: `You finished the ${suit} row!`, sound: 'ding' }
    } else if (left === 1) {
      fx = { kind: 'bubble', at: id, text: '☝️ Last card!' }
    }
    announce(storage, `${id} played ${card.label}`, fx)
    if (left > 0) advanceTurn(storage, id)
  }, [])

  // Pass — only allowed when you really can't move. useAutoPass calls this
  // for you after a short countdown.
  const pass = useMutation(({ storage }, id) => {
    if (storage.get('currentTurn') !== id) return
    const hand = storage.get('hands').get(id) ?? []
    if (hand.length === 0 || hasAnyMove(hand, suitRanges(readTable(storage)))) return
    tallyStake(storage, `pass:${id}`) // 💰 a pass puts a point in the pot when playing for chips
    announce(storage, `${id} couldn't play and passed`, { kind: 'bubble', at: id, text: '😶 Pass' })
    advanceTurn(storage, id)
  }, [])

  const winner = playerOrder.find((p) => (hands?.[p] ?? []).length === 0)
  const turnHand = hands?.[currentTurn] ?? []
  const turnIsStuck = !!hands && !winner && turnHand.length > 0 && !hasAnyMove(turnHand, ranges)
  useAutoPass({ myId, currentTurn, order: playerOrder, stuck: turnIsStuck, act: pass, watch: lastActionId })

  if (!hands) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  if (winner) {
    const scores = playerOrder
      .map((p) => ({ name: p, count: (hands[p] ?? []).length }))
      .sort((a, b) => a.count - b.count)
      .map((s) => ({ name: s.name, detail: `${s.count} cards left` }))
    return <WinnerScreen emoji="🔢" title={`${winner} wins Sevens!`} scores={scores} onLeave={onLeave} />
  }

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🔢" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {otherPlayers.map((p) => (
            <Opponent key={p} name={p} sub={`${(hands[p] ?? []).length} cards`} />
          ))}
        </div>
      </div>

      <div className="table-center">
        <div className="tableau" data-spot="pile">
          {SUIT_ROWS.map((suit) => {
            const cards = (tableau ?? [])
              .filter((c) => suitOf(c) === suit)
              .sort((a, b) => VALUES.indexOf(rankOf(a)) - VALUES.indexOf(rankOf(b)))
            return (
              <div key={suit} className={`tableau-row${cards.length === 13 ? ' done' : ''}`}>
                <span className={`tableau-suit ${suit === '♥' || suit === '♦' ? 'red' : ''}`}>{suit}</span>
                <div className="tableau-cards">
                  {cards.length === 0
                    ? <span className="tableau-empty">waiting for the 7{suit}</span>
                    : cards.map((c) => <CardFace key={c.id} label={c.label} red={c.red} />)}
                </div>
              </div>
            )
          })}
        </div>

        {turnIsStuck && <AutoPassNotice who={currentTurn} myId={myId} />}
      </div>

      <Hand
        cards={myHand}
        onCardClick={isMyTurn ? (card) => { if (canPlay(card, ranges)) playCard({ id: myId, cardId: card.id }) } : undefined}
        isHighlighted={(card) => isMyTurn && canPlay(card, ranges)}
        showSort
        hint={isMyTurn && !turnIsStuck ? 'Tap a glowing card to play' : undefined}
      />
    </div>
  )
}
