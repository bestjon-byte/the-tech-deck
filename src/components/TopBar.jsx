// The bar across the top of every game board: Leave button + room code.
export default function TopBar({ roomCode, onLeave }) {
  return (
    <div className="top-bar">
      <button className="leave-btn" onClick={onLeave}>← Leave</button>
      <div className="game-code">Room: {roomCode}</div>
    </div>
  )
}
