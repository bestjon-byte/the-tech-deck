// A little toast that tells everyone what just happened ("Sam got 2 nines!").
// Renders nothing when there's no message.
export default function ActionMessage({ message }) {
  if (!message) return null
  return <div className="action-msg">{message}</div>
}
