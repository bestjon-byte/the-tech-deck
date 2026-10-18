// Little helpers for how things LOOK (not game rules).

// Same "random" number for the same input, every time and on every phone —
// so particles, card tilts etc. don't jump about between renders.
export const rand = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Everyone gets their own colour. Players at the table get one each from this
// list by their seat number (so nobody shares a colour); anyone else gets one
// worked out from their name. Same on every phone.
const SEAT_HUES = [28, 205, 130, 330, 265, 50, 175, 0]
export function hueOf(name = '', seat = -1) {
  if (seat >= 0) return SEAT_HUES[seat % SEAT_HUES.length]
  let h = 0
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) % 360
  return h
}
