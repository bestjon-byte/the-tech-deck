// ── Computer players 🤖 ────────────────────────────────────
//
// A bot is a player with no phone. The host adds them in the lobby; they're
// saved in storage as `bots` (name → level: 'easy' | 'medium' | 'hard') and
// sit in `playerOrder` like anyone else.
//
// Somebody's phone has to make the bot's moves. useBotTurn() picks exactly
// ONE human phone to do it (the first human in the order if they're online,
// otherwise the next online human — see inCharge.js), waits a moment so the
// bot looks like it's thinking, then calls `act(botName, level)`.
// `act` should be a useMutation that re-checks `currentTurn === botName`
// and reads the table fresh from storage.

import { useEffect } from 'react'
import { useStorage } from '../liveblocks.config'
import { useInCharge } from './inCharge'

export const BOT_LEVELS = [
  { id: 'easy', label: 'Easy', emoji: '🙂' },
  { id: 'medium', label: 'Medium', emoji: '😎' },
  { id: 'hard', label: 'Hard', emoji: '😈' },
]
export const BOT_NAMES = ['Robo', 'Chip', 'Byte', 'Pixel', 'Bolt', 'Sparky']
export const levelEmoji = (level) => BOT_LEVELS.find((l) => l.id === level)?.emoji ?? '🤖'

const EMPTY = {}
export function useBots() {
  return useStorage((root) => root.bots) ?? EMPTY
}

// Read the bot names inside a mutation (older rooms may not have `bots` yet).
export function readBotNames(storage) {
  const bots = storage.get('bots')
  return bots ? [...bots.keys()] : []
}

const THINK_MS = { easy: 1100, medium: 1300, hard: 1700 }

// `active` — false when the game is over or still loading.
// `watch`  — anything that changes after every move (e.g. lastAction.id), so
//            a bot that gets the turn straight back still moves again.
export function useBotTurn({ myId, currentTurn, playerOrder, act, active = true, watch }) {
  const bots = useBots()
  const humans = playerOrder.filter((p) => !bots[p])
  const iAmInCharge = useInCharge(myId, humans[0], humans)
  const level = bots[currentTurn]
  const botToMove = active && level && playerOrder.includes(currentTurn) ? currentTurn : null

  useEffect(() => {
    if (!botToMove || !iAmInCharge) return
    const wait = (THINK_MS[level] ?? 1300) + Math.random() * 600
    const t = setTimeout(() => act(botToMove, level), wait)
    return () => clearTimeout(t)
  }, [botToMove, level, iAmInCharge, act, watch])
}
