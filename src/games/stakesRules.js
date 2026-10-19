import { rankOf } from '../lib/cards'
import { payTo, tallyOf } from '../engine/stakes'

// ── 💰 What each game pays out when played for chips ───────
// Every entry: summary (the rules in words) + settle(root) → null while the
// game is still going, or { points, lines } once it's over (see
// engine/stakes.js). A "point" is worth whatever stake the host picked.
// `root` is a plain snapshot of the room's storage.

const order = (root) => root.playerOrder ?? []
const handOf = (root, p) => root.hands?.[p] ?? []
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// Add up several { name: points } tables.
function combine(...tables) {
  const out = {}
  for (const t of tables) for (const [p, n] of Object.entries(t)) out[p] = (out[p] ?? 0) + n
  return out
}

export const STAKES = {
  // 2️⃣ Classic Big Two: losers pay per card they're still holding when the
  // winner goes out — doubled for a big hand, tripled if you never played.
  bigtwo: {
    summary: [
      'Everyone pays the winner 1 point per card left in their hand',
      '10+ cards left: ×2 · never played a card: ×3',
      'Caught holding a 2: ×2 on top!',
    ],
    settle(root) {
      const bt = root.bigTwo ?? {}
      const finished = bt.finished ?? []
      const all = order(root)
      if (all.length < 2 || all.filter((p) => !finished.includes(p)).length > 1) return null
      const winner = finished[0]
      const left = bt.leftAtWin ?? {}
      const full = all.length === 4 ? 13 : 17
      const lines = []
      const points = payTo(winner, all, (p) => {
        const { n = handOf(root, p).length, twos = 0 } = left[p] ?? {}
        let mult = n >= full ? 3 : n >= 10 ? 2 : 1
        if (twos > 0) mult *= 2
        const why = [n >= full ? '×3 never played' : n >= 10 ? '×2 (10+)' : '', twos > 0 ? '×2 holding a 2' : ''].filter(Boolean).join(' ')
        lines.push(`${p}: ${plural(n, 'card')}${why ? ` ${why}` : ''} = ${n * mult}`)
        return n * mult
      })
      return { points, lines }
    },
  },

  // 💩 The Shithead pays everyone — and pays the first player out extra.
  shithead: {
    summary: ['The Shithead pays every other player 2 points', '…and pays the first player out 3 more'],
    settle(root) {
      const sh = root.shed ?? {}
      const finished = sh.finished ?? []
      const all = order(root)
      const left = all.filter((p) => !finished.includes(p))
      if (sh.phase !== 'play' || all.length < 2 || left.length !== 1) return null
      const loser = left[0]
      const points = { [loser]: 0 }
      for (const p of all) {
        if (p === loser) continue
        const n = p === finished[0] ? 5 : 2
        points[p] = n
        points[loser] -= n
      }
      return { points, lines: [`💩 ${loser} pays ${finished[0]} 5 and everyone else 2`] }
    },
  },

  // 🎩 Everyone antes; the champion takes the pot. Won it after being on a
  // dog's life? Everyone pays a comeback bonus.
  knockout: {
    summary: ['Everyone puts 3 points in the pot — the champion takes it', "Champion who came back from a dog's life 🐶: +2 from everyone"],
    settle(root) {
      const w = root.whist ?? {}
      if (w.phase !== 'gameOver' || !w.champion) return null
      const comeback = (w.dogsUsed ?? []).includes(w.champion)
      const points = payTo(w.champion, order(root), () => (comeback ? 5 : 3))
      return { points, lines: [comeback ? `🐶 ${w.champion} came back from a dog's life! 5 each` : `🎩 ${w.champion} takes the pot: 3 each`] }
    },
  },

  // 🎣 Books are money: you win (or pay) the difference in books with every
  // other player, and the top fisher gets a bonus.
  gofish: {
    summary: ['Against each other player: win 1 point for every book you have more than them (pay 1 for every book fewer)', 'Most books (no tie): +2 from everyone'],
    settle(root) {
      const all = order(root)
      const books = Object.fromEntries(all.map((p) => [p, (root.books?.[p] ?? []).length]))
      const total = Object.values(books).reduce((a, b) => a + b, 0)
      if (all.length < 2 || total < 13) return null
      let points = Object.fromEntries(all.map((p) => [p, all.length * books[p] - total]))
      const best = Math.max(...Object.values(books))
      const top = all.filter((p) => books[p] === best)
      const lines = all.map((p) => `${p}: ${plural(books[p], 'book')}`)
      if (top.length === 1) {
        points = combine(points, payTo(top[0], all, () => 2))
        lines.push(`🏆 ${top[0]} has the most books: +2 each`)
      }
      return { points, lines }
    },
  },

  // 🎵 Classic scoring: losers pay the winner for the cards stuck in their
  // hand — and getting caught with an 8 really hurts.
  crazy8s: {
    summary: ['Losers pay the winner 1 point per 10 card points left in their hand (rounded up)', 'Card points: 8 = 50 (ouch!), J/Q/K = 10, Ace = 1, others face value'],
    settle(root) {
      const all = order(root)
      const winner = all.find((p) => handOf(root, p).length === 0)
      if (!winner || all.length < 2) return null
      const cardPts = (c) => ({ '8': 50, J: 10, Q: 10, K: 10, A: 1 })[rankOf(c)] ?? Number(rankOf(c))
      const lines = []
      const points = payTo(winner, all, (p) => {
        const raw = handOf(root, p).reduce((s, c) => s + cardPts(c), 0)
        const n = Math.ceil(raw / 10)
        lines.push(`${p}: ${raw} card points = ${n}`)
        return n
      })
      return { points, lines }
    },
  },

  // 👏 Everyone antes; every mis-snap costs extra. The winner takes it all.
  snap: {
    summary: ['Everyone puts 5 points in the pot — the winner takes it', 'Every MIS-SNAP adds 1 more point to the pot'],
    settle(root) {
      const all = order(root)
      const stillIn = all.filter((p) => handOf(root, p).length > 0)
      if (all.length < 2 || stillIn.length !== 1 || (root.discardPile ?? []).length > 0) return null
      const winner = stillIn[0]
      const lines = []
      const points = payTo(winner, all, (p) => {
        const miss = tallyOf(root, `miss:${p}`)
        if (miss) lines.push(`${p}: ${plural(miss, 'mis-snap')}`)
        return 5 + miss
      })
      return { points, lines }
    },
  },

  // 🙅 Whoever's left holding the Old Maid pays everyone.
  oldmaid: {
    summary: ['Whoever ends up with the Old Maid pays every other player 3 points'],
    settle(root) {
      const all = order(root)
      const total = all.reduce((s, p) => s + handOf(root, p).length, 0)
      if (all.length < 2 || total > 1) return null
      const loser = all.find((p) => handOf(root, p).length === 1)
      if (!loser) return { points: {}, lines: ['Nobody got stuck — no chips change hands'] }
      const points = { [loser]: 0 }
      for (const p of all) if (p !== loser) { points[p] = 3; points[loser] -= 3 }
      return { points, lines: [`👵 ${loser} pays 3 to everyone`] }
    },
  },

  // 🔢 Fan Tan rules: every pass costs a chip into the pot, and losers pay
  // the winner for each card they're still holding.
  sevens: {
    summary: ['Every time you pass, 1 point goes in the pot', 'Winner takes the pot + 1 point per card everyone has left'],
    settle(root) {
      const all = order(root)
      const winner = all.find((p) => handOf(root, p).length === 0)
      if (!winner || all.length < 2) return null
      const lines = []
      const points = payTo(winner, all, (p) => {
        const n = handOf(root, p).length
        const passes = tallyOf(root, `pass:${p}`)
        lines.push(`${p}: ${plural(n, 'card')} + ${passes} pass${passes === 1 ? '' : 'es'} = ${n + passes}`)
        return n + passes
      })
      return { points, lines }
    },
  },
}
