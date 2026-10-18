import { AUTO_PASS_MS } from '../engine/autoPass'

// The "no moves — passing…" strip with a countdown bar, shown on every phone
// while useAutoPass waits to move on (so nobody wonders why the turn skipped).
//   who    — the stuck player
//   reason — e.g. "can't play"
//   action — e.g. "passing", "drawing a card", "picking up the pile"
export default function AutoPassNotice({ who, myId, reason = "can't play", action = 'passing' }) {
  return (
    <div className="autopass" key={who}>
      <span>😶 {who === myId ? 'You' : who} {reason} — {action}…</span>
      <div className="autopass-bar" style={{ animationDuration: `${AUTO_PASS_MS}ms` }} />
    </div>
  )
}
