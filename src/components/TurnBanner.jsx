// Shows whose turn it is. Any turn-based game can drop this in.
//   isMyTurn    — true if it's the local player's turn
//   currentTurn — the name of whoever's turn it is
//   emoji       — a little icon for the game (e.g. 🎣)
export default function TurnBanner({ isMyTurn, currentTurn, emoji = '🎲' }) {
  return (
    <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`}>
      {isMyTurn ? `${emoji} Your turn!` : `⏳ ${currentTurn}'s turn...`}
    </div>
  )
}
