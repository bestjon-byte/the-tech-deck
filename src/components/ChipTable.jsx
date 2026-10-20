import { createPortal } from 'react-dom'
import { useOthers, useStorage } from '../liveblocks.config'
import { useBank, bankToBring } from '../lib/bank'

// 💰 The chip leaderboard pop-up (tap the 💰 pill in the top bar): every
// human in the room and their chips, richest first. Bots have no bank, so
// they're left out. Each phone shares its chips in presence (`bank`).
// Drawn straight into <body>: the top bar's blur would otherwise trap it.

function useRoomBanks(myId) {
  useBank() // re-render when my own bank changes
  const others = useOthers()
  const rows = [{ name: myId, chips: bankToBring(), me: true }]
  for (const o of others) {
    const name = o.presence.playerId
    if (name && name !== myId && !rows.some((r) => r.name === name)) rows.push({ name, chips: o.presence.bank ?? null, me: false })
  }
  return rows.sort((a, b) => (b.chips ?? -1) - (a.chips ?? -1))
}

export default function ChipTable({ myId, open, onClose }) {
  const rows = useRoomBanks(myId)
  const stake = useStorage((root) => root.stakes?.unit ?? 0)
  const mode = useStorage((root) => root.gameMode)
  if (!open) return null
  const medals = ['🥇', '🥈', '🥉']
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card chip-table" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">💰 Chip leaderboard</div>
        <p className="chip-table-sub">
          {mode === 'poker' ? "Hold'em: your chips are saved after every hand"
            : stake > 0 ? `This game is for ${stake} chip${stake === 1 ? '' : 's'} a point`
              : 'This game is just for fun — no chips at stake'}
        </p>
        <div className="chip-rows">
          {rows.map((r, i) => (
            <div key={r.name} className={`chip-row${r.me ? ' me' : ''}`}>
              <span className="chip-rank">{medals[i] ?? `${i + 1}.`}</span>
              <span className="chip-name">{r.me ? `${r.name} (you)` : r.name}</span>
              <b>{r.chips == null ? 'old app' : r.chips.toLocaleString()}</b>
            </div>
          ))}
        </div>
        <p className="chip-table-sub">Chips are saved on each phone. Go bust and you get a fresh 1,000 next game.</p>
        <button className="big-btn create-btn" onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  )
}
