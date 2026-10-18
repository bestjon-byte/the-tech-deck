import { useOthers, useStorage } from '../liveblocks.config'
import CardBack from './CardBack'
import { levelEmoji } from '../engine/bots'

// One opponent row: their name, a little sub-label (card count or books),
// and an optional visual (like a fan of face-down cards) as children.
// A green dot means their phone is connected right now; a grey dot and "away"
// means it isn't (screen locked, no signal, or app closed) — so you know why
// you're waiting. Pass `id` if `name` has extras added (like Whist's 🐶).
// Computer players show 🤖 and their level instead (they never have a phone).
export function Opponent({ name, id = name, sub, children }) {
  const botLevel = useStorage((root) => root.bots?.[id])
  const phoneOnline = useOthers((others) => others.some((o) => o.presence.playerId === id))
  const online = phoneOnline || !!botLevel
  return (
    <div className={`opponent${online ? '' : ' away'}`}>
      <div className="opponent-info">
        <span className="opponent-name">
          {botLevel ? <span className="bot-badge">🤖{levelEmoji(botLevel)}</span> : <span className={`online-dot${online ? ' on' : ''}`} />}
          {name}
        </span>
        {sub != null && <span className="opponent-count">{online ? sub : `📵 away · ${sub}`}</span>}
      </div>
      {children}
    </div>
  )
}

// Shows every connected opponent with a fan of face-down cards and their card
// count. This is the "free play" style — it reads who's connected via presence.
export function OpponentBacks() {
  const others = useOthers()
  const hands = useStorage((root) => root.hands)
  if (!hands || others.length === 0) return null

  return (
    <div className="opponents">
      {others.map((other) => {
        const name = other.presence.playerId || '?'
        const count = (hands[name] ?? []).length
        return (
          <Opponent key={other.connectionId} name={name} sub={`${count} cards`}>
            <div className="opponent-cards">
              {Array.from({ length: Math.min(count, 13) }).map((_, i) => (
                <CardBack key={i} />
              ))}
            </div>
          </Opponent>
        )
      })}
    </div>
  )
}
