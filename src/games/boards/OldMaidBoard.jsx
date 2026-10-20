import { useStorage, useMutation } from '../../liveblocks.config'
import { rankOf, nCards } from '../../lib/cards'
import { useTurns, advanceTurnWhile, getNextTurn, seatsAfter } from '../../engine/turns'
import { announce, useActionMessage } from '../../engine/announce'
import { extractPairs } from '../rules/oldMaid'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent, CardFan } from '../../components/Opponent'

// Whoever sits after `fromId` in turn order and still has cards — the player
// you draw from in Old Maid.
function nextHolder(order, fromId, hands) {
  let p = getNextTurn(order, fromId)
  for (let guard = 0; guard < order.length; guard++) {
    if ((hands[p] ?? []).length > 0) return p
    p = getNextTurn(order, p)
  }
  return null
}

// ── Old Maid ───────────────────────────────────────────────
// Throw away pairs. On your turn, take a hidden card from the next player. If
// it makes a pair, it goes too. Don't be the one left holding the lonely Queen!
export default function OldMaidBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands?.[myId] ?? [])
  const hands = useStorage((root) => root.hands)
  const actionMsg = useActionMessage(4000)

  const { currentTurn, playerOrder, isMyTurn } = useTurns(myId)

  const takeCard = useMutation(({ storage }, { fromId, toId, index }) => {
    if (storage.get('currentTurn') !== toId) return
    const handsObj = storage.get('hands')
    const fromHand = [...(handsObj.get(fromId) ?? [])]
    if (index < 0 || index >= fromHand.length) return
    const [taken] = fromHand.splice(index, 1)
    handsObj.set(fromId, fromHand)

    const toHand = handsObj.get(toId) ?? []
    const partner = toHand.find((c) => rankOf(c) === rankOf(taken))
    const { newHand, pairsRemoved } = extractPairs([...toHand, taken])
    handsObj.set(toId, newHand)

    // Everyone sees a card fly across. A pair is shown off to the whole table;
    // a Queen is a secret — only the taker (😱) and the giver (😅) find out,
    // and SILENTLY (no sound, no buzz) so nobody nearby can hear who's got her.
    const fx = [{ kind: 'fly', from: fromId, to: toId }]
    if (pairsRemoved > 0 && partner) {
      fx.push({
        kind: 'slam', tone: 'green', title: 'PAIR!', sound: 'ding', cards: [partner, taken], burst: false,
        who: toId, sub: `${toId} threw away a pair`, subMe: 'Nice! Two less to worry about',
      })
    }
    if (rankOf(taken) === 'Q' && pairsRemoved === 0) {
      fx.push({ kind: 'slam', to: toId, tone: 'purple', emoji: '😱', title: 'UH OH…', sub: 'You just picked up a Queen!', sound: null, burst: false })
      fx.push({ kind: 'slam', to: fromId, tone: 'green', emoji: '😅', title: 'PHEW!', sub: `${toId} took your Queen!`, sound: null, burst: false })
    }
    announce(storage, pairsRemoved > 0
      ? `${toId} took ${taken.label} from ${fromId} — pair! 🎉`
      : `${toId} took a card from ${fromId}`, fx)

    // Pass to the next player who still holds cards.
    advanceTurnWhile(storage, toId, (pid) => (handsObj.get(pid) ?? []).length === 0)
  }, [])

  if (!hands) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  // Game ends when a single card is left in play — its holder is the Old Maid.
  const totalCards = playerOrder.reduce((sum, p) => sum + (hands[p] ?? []).length, 0)
  if (playerOrder.length > 0 && totalCards <= 1) {
    const loser = playerOrder.find((p) => (hands[p] ?? []).length === 1)
    const scores = playerOrder
      .map((p) => ({ name: p, detail: p === loser ? '🙀 Old Maid!' : '✅ safe' }))
      .sort((a) => (a.name === loser ? 1 : -1))
    return <WinnerScreen emoji="🙅" rain="👵" title={loser ? `${loser} is stuck with the Old Maid!` : 'Game over!'} scores={scores} onLeave={onLeave} />
  }

  const target = nextHolder(playerOrder, myId, hands)
  const takeFrom = isMyTurn && myHand.length > 0 ? target : null
  // Who is the current player taking from? (Their seat gets a "target" ring.)
  const victim = nextHolder(playerOrder, currentTurn, hands)

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🙅" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {seatsAfter(playerOrder, myId).map((p) => {
            const n = (hands[p] ?? []).length
            return (
              <Opponent key={p} name={p} sub={n ? `${nCards(n)}${p === victim ? ' · 🎯' : ''}` : 'safe 😎'}>
                <CardFan count={n} />
              </Opponent>
            )
          })}
        </div>
      </div>

      <div className="table-center">
        {takeFrom ? (
          <div className="ask-ui">
            <div className="ask-step">🫣 Take a hidden card from <b>{takeFrom}</b></div>
            <div className="pick-row mini-cards">
              {(hands[takeFrom] ?? []).map((_, i) => (
                <CardBack
                  key={i}
                  className="pick-card"
                  onClick={() => takeCard({ fromId: takeFrom, toId: myId, index: i })}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="waiting-ui">
            <div className="waiting-text">
              {myHand.length === 0
                ? "You're safe! 😎"
                : victim === myId ? `👀 ${currentTurn} is picking one of YOUR cards…` : `${currentTurn} is taking a card from ${victim}…`}
            </div>
          </div>
        )}
      </div>

      <Hand cards={myHand} showSort hint="Pairs are thrown away for you" />
    </div>
  )
}
