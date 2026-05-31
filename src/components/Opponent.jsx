import { useOthers, useStorage } from '../liveblocks.config'
import CardBack from './CardBack'

// One opponent row: their name, a little sub-label (card count or books),
// and an optional visual (like a fan of face-down cards) as children.
export function Opponent({ name, sub, children }) {
  return (
    <div className="opponent">
      <div className="opponent-info">
        <span className="opponent-name">{name}</span>
        {sub != null && <span className="opponent-count">{sub}</span>}
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
