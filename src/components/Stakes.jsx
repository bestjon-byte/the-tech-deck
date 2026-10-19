import { useEffect } from 'react'
import { useStorage, useMutation, useOthers } from '../liveblocks.config'
import { useInCharge } from '../engine/inCharge'
import { bankToBring, setBank, banksInRoom } from '../lib/bank'
import { capToBanks } from '../engine/stakes'

// 💰 The chips side of a game played for chips (see engine/stakes.js).

const SETTLED_KEY = 'tech-deck-settled'
function alreadyApplied(id) {
  try { return (JSON.parse(localStorage.getItem(SETTLED_KEY)) ?? []).includes(id) } catch { return false }
}
function markApplied(id) {
  try {
    const list = JSON.parse(localStorage.getItem(SETTLED_KEY)) ?? []
    localStorage.setItem(SETTLED_KEY, JSON.stringify([...list, id].slice(-30)))
  } catch { /* ignore */ }
}

// Mounted once in GameHost. Watches for the end of the game, records the
// payout (one phone), and pays this phone's share into its bank.
export function StakesKeeper({ myId, game }) {
  const root = useStorage((r) => r) // the whole room — fine, this renders nothing
  const stakes = root?.stakes
  const order = root?.playerOrder ?? []
  const iRecord = useInCharge(myId, order[0], order)
  const outcome = stakes?.unit > 0 && game.stakes && !stakes.result ? game.stakes.settle(root) : null

  const others = useOthers()
  const record = useMutation(({ storage }, { id, outcome: o, banks }) => {
    const st = storage.get('stakes')
    if (!st || st.get('id') !== id || st.get('result')) return
    const unit = st.get('unit')
    const raw = Object.fromEntries(Object.entries(o.points).map(([p, n]) => [p, Math.round(n * unit)]))
    const { chips, capped } = capToBanks(raw, banks)
    const lines = [...(o.lines ?? []), ...capped.map((p) => `${p} only had ${banks[p].toLocaleString()} chips — paid what they had`)]
    st.set('result', { id, chips, lines, unit })
  }, [])

  const outcomeKey = outcome ? JSON.stringify(outcome.points) : ''
  useEffect(() => {
    if (outcome && iRecord) record({ id: stakes.id, outcome, banks: banksInRoom(myId, others) })
  }, [outcomeKey, iRecord]) // eslint-disable-line react-hooks/exhaustive-deps -- outcomeKey stands for outcome

  // Pay my share into my bank, once per game.
  const result = stakes?.result
  const myChips = result && result.id === stakes.id ? result.chips?.[myId] : undefined
  useEffect(() => {
    if (myChips == null || alreadyApplied(result.id)) return
    setBank(bankToBring() + myChips)
    markApplied(result.id)
  }, [myChips, result?.id])

  return null
}

// The chips part of the winner screen.
export function StakesSummary({ myId }) {
  const result = useStorage((r) => (r.stakes?.unit > 0 ? r.stakes.result : null))
  if (!result) return null
  const rows = Object.entries(result.chips).sort((a, b) => b[1] - a[1])
  return (
    <div className="stakes-summary">
      <div className="stakes-title">💰 Chips · {result.unit} per point</div>
      {rows.map(([p, n]) => (
        <div key={p} className={`stakes-row ${n > 0 ? 'up' : n < 0 ? 'down' : ''}`}>
          <span>{p === myId ? 'You' : p}</span>
          <b>{n > 0 ? '+' : ''}{n.toLocaleString()}</b>
        </div>
      ))}
      {result.lines?.length > 0 && <div className="stakes-lines">{result.lines.map((l, i) => <div key={i}>{l}</div>)}</div>}
    </div>
  )
}
