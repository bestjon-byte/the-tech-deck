import { useSyncExternalStore } from 'react'

// ── Your chip bank 💰 ──────────────────────────────────────
// Poker chips you keep between games and take into any room. They're saved on
// THIS phone (like the mute setting), so they're yours whatever room you join.
//   bankToBring()  — what you sit down with: your saved chips, or a fresh
//                    FRESH_BANK if you've never played or you went bust
//   setBank(n)     — save your stack (poker does this after every hand)
//   useBank()      — re-render when it changes
// The room learns each player's bank through Liveblocks presence (see
// BankPresence in App.jsx), so the host's phone can seat everyone with theirs.

export const FRESH_BANK = 1000
const BANK_KEY = 'tech-deck-bank'

let bank = null // null = never played
try {
  const saved = localStorage.getItem(BANK_KEY)
  if (saved !== null && Number.isFinite(Number(saved))) bank = Number(saved)
} catch { /* private mode */ }

const listeners = new Set()
export const getBank = () => bank
export const isBroke = () => bank !== null && bank <= 0
export const bankToBring = () => (bank > 0 ? bank : FRESH_BANK)

export function setBank(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0))
  if (n === bank) return
  bank = n
  try { localStorage.setItem(BANK_KEY, String(n)) } catch { /* ignore */ }
  listeners.forEach((fn) => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const useBank = () => useSyncExternalStore(subscribe, getBank)

// Everyone's bank in the room: mine, plus what each other phone shares in its
// presence. Passed to a game's setup as `banks` (poker seats people with it).
export function banksInRoom(myName, others) {
  const banks = { [myName]: bankToBring() }
  for (const o of others) if (o.presence.playerId) banks[o.presence.playerId] = o.presence.bank
  return banks
}
