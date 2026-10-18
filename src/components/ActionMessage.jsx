// A little toast that tells everyone what just happened ("Sam got 2 nines!").
// Its space is always kept, even when empty, so the table never jumps up and
// down as messages come and go.
export default function ActionMessage({ message }) {
  return (
    <div className="action-msg-slot">
      {message && <div key={message} className="action-msg">{message}</div>}
    </div>
  )
}
