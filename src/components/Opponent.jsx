import { useOthers, useStorage } from '../liveblocks.config'
import CardBack from './CardBack'
import { levelEmoji } from '../engine/bots'
import { hueOf } from '../lib/looks'
import { chipText } from '../lib/bank'

// One opponent "seat": a coloured badge (their colour comes from hueOf) with their initial, their name, a
// little sub-label (card count, books…) and an optional visual (like a fan of
// face-down cards) as children.
//   • The seat GLOWS when it's their turn, so you can see who you're waiting for.
//   • Green dot = their phone is connected. Faded + "away" = it isn't (screen
//     locked, no signal, app closed) — so you know why you're waiting.
//   • Computer players show 🤖 and their level (they never have a phone).
// Pass `id` if `name` has extras added (like Whist's 🐶). `active` overrides
// the "is it their turn?" glow. `data-seat` lets effects fly cards to them.
// Give it `onClick` to make the seat tappable (Go Fish: tap who to ask), and
// `selected` to light it up.
export function Opponent({ name, id = name, sub, children, active, onClick, selected }) {
  const botLevel = useStorage((root) => root.bots?.[id])
  const currentTurn = useStorage((root) => root.currentTurn)
  const seat = useStorage((root) => (root.playerOrder ?? []).indexOf(id))
  const phoneOnline = useOthers((others) => others.some((o) => o.presence.playerId === id))
  const bank = useOthers((others) => others.find((o) => o.presence.playerId === id)?.presence.bank ?? null)
  const showBank = useStorage((root) => (root.stakes?.unit ?? 0) > 0 && root.gameMode !== 'poker') // 💰 playing for chips
  const online = phoneOnline || !!botLevel
  const theirTurn = active ?? currentTurn === id
  return (
    <div
      className={`opponent${online ? '' : ' away'}${theirTurn ? ' is-turn' : ''}${onClick ? ' tappable' : ''}${selected ? ' selected' : ''}`}
      data-seat={id}
      onClick={onClick}
      style={{ '--hue': hueOf(id, seat) }}
    >
      <div className="seat-head">
        <span className="seat-avatar">
          {botLevel ? '🤖' : (id[0] ?? '?').toUpperCase()}
          {!botLevel && <span className={`online-dot${online ? ' on' : ''}`} />}
        </span>
        <span className="opponent-name">
          {name}
          {botLevel && <span className="bot-badge"> {levelEmoji(botLevel)}</span>}
        </span>
      </div>
      {showBank && !botLevel && bank != null && <span className="seat-bank">💰 {chipText(bank)}</span>}
      {sub != null && <span className="opponent-count">{online ? sub : `📵 away · ${sub}`}</span>}
      {children && <div className="seat-extra">{children}</div>}
    </div>
  )
}

// A small fan of face-down cards (at most 10 drawn, so a seat never gets too wide).
export function CardFan({ count }) {
  if (!count) return null
  return (
    <div className="opponent-cards">
      {Array.from({ length: Math.min(count, 10) }, (_, i) => <CardBack key={i} />)}
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
          <Opponent key={other.connectionId} name={name} sub={`${count} cards`} active={false}>
            <CardFan count={count} />
          </Opponent>
        )
      })}
    </div>
  )
}
