import { useState, useEffect } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { useTurns, advanceTurnWhile, getNextTurn } from '../../engine/turns'
import { extractPairs } from '../rules/oldMaid'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'

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
  const lastAction = useStorage((root) => root.lastAction ?? { message: '', id: 0 })

  const { currentTurn, playerOrder, isMyTurn } = useTurns(myId)

  const [actionMsg, setActionMsg] = useState('')
  const [shownId, setShownId] = useState(0)
  if (lastAction && lastAction.id !== shownId && lastAction.message) {
    setShownId(lastAction.id)
    setActionMsg(lastAction.message)
  }
  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(''), 4000)
    return () => clearTimeout(t)
  }, [actionMsg])

  const takeCard = useMutation(({ storage }, { fromId, toId, index }) => {
    const handsObj = storage.get('hands')
    const fromHand = [...(handsObj.get(fromId) ?? [])]
    if (index < 0 || index >= fromHand.length) return
    const [taken] = fromHand.splice(index, 1)
    handsObj.set(fromId, fromHand)

    const { newHand, pairsRemoved } = extractPairs([...(handsObj.get(toId) ?? []), taken])
    handsObj.set(toId, newHand)

    const la = storage.get('lastAction')
    la.set('message', pairsRemoved > 0
      ? `${toId} took ${taken.label} from ${fromId} — pair! 🎉`
      : `${toId} took a card from ${fromId}`)
    la.set('id', (la.get('id') ?? 0) + 1)

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
    return <WinnerScreen emoji="🙅" title={loser ? `${loser} is stuck with the Old Maid!` : 'Game over!'} scores={scores} onLeave={onLeave} />
  }

  const target = nextHolder(playerOrder, myId, hands)

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🙅" />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {playerOrder.filter((p) => p !== myId).map((p) => (
            <Opponent key={p} name={p} sub={`${(hands[p] ?? []).length} cards`}>
              <div className="opponent-cards">
                {Array.from({ length: Math.min((hands[p] ?? []).length, 13) }).map((_, i) => <CardBack key={i} />)}
              </div>
            </Opponent>
          ))}
        </div>
      </div>

      <div className="table-center">
        {isMyTurn && myHand.length > 0 ? (
          target ? (
            <div className="ask-ui">
              <div className="ask-label">Take a hidden card from {target}:</div>
              <div className="pick-row">
                {(hands[target] ?? []).map((_, i) => (
                  <CardBack
                    key={i}
                    className="pick-card"
                    onClick={() => takeCard({ fromId: target, toId: myId, index: i })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="ask-empty-msg">Waiting for other players...</p>
          )
        ) : (
          <div className="waiting-ui">
            <div className="waiting-text">{myHand.length === 0 ? "You're safe! 😎" : `Waiting for ${currentTurn}...`}</div>
          </div>
        )}
      </div>

      <Hand cards={myHand} showSort={false} hint="Your cards (pairs removed automatically)" />
    </div>
  )
}
