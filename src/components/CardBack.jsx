// A face-down card. Pass extra classes (e.g. "draw-pile-card") and an onClick
// to turn it into a clickable draw pile.
export default function CardBack({ className = '', onClick }) {
  return <div className={`card-back ${className}`.trim()} onClick={onClick} />
}
