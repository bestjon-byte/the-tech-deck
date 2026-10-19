import { useState, useEffect, useMemo } from 'react'
import { useStorage, useMutation } from '../../liveblocks.config'
import { useActionMessage } from '../../engine/announce'
import { useInCharge } from '../../engine/inCharge'
import { useBotTurn } from '../../engine/bots'
import TopBar from '../../components/TopBar'
import TurnBanner from '../../components/TurnBanner'
import ActionMessage from '../../components/ActionMessage'
import CardFace from '../../components/CardFace'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import WinnerScreen from '../../components/WinnerScreen'
import { Opponent } from '../../components/Opponent'
import { choosePokerMove } from '../ai/pokerBot'
import { doAction, nextHand, runoutStep, equity, optionsFor, potOf, bestHand, describeStart } from '../rules/poker'
import { playSfx } from '../../lib/sfx'
import { hueOf } from '../../lib/looks'
import { setBank } from '../../lib/bank'

const NEXT_HAND_MS = { fold: 3500, showdown: 7000 }
// 🥁 All-in runout: how long to wait (by cards already on the board) before
// the next street comes — the river gets the longest drumroll.
const RUNOUT_MS = { 0: 3500, 3: 3500, 4: 5000, 5: 3000 }
const DRUMROLL_MS = 2600 // the drumroll starts this long before the river lands
const chips = (n) => (n ?? 0).toLocaleString()

// The little D / SB / BB buttons next to a player.
function roles(pk, p) {
  const r = []
  if (pk.dealer === p) r.push('D')
  if (pk.sb === p && pk.sb !== pk.dealer) r.push('SB')
  if (pk.bb === p) r.push('BB')
  return r
}
function RoleChips({ pk, p }) {
  return roles(pk, p).map((r) => <span key={r} className={`poker-role role-${r}`}>{r}</span>)
}

// ── Texas Hold'em ──────────────────────────────────────────
// 2 secret cards each + 5 shared cards. Bet, call, raise or fold over four
// rounds; best 5-card hand at the end (or the last one not folded) wins the pot.
export default function PokerBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const pk = useStorage((root) => root.poker)
  const hands = useStorage((root) => root.hands)
  const currentTurn = useStorage((root) => root.currentTurn ?? '')
  const playerOrder = useStorage((root) => root.playerOrder ?? [])
  const lastActionId = useStorage((root) => root.lastAction?.id ?? 0)
  const actionMsg = useActionMessage(3500)
  const [raiseTo, setRaiseTo] = useState(null) // null = raise panel closed

  const act = useMutation(({ storage }, args) => doAction(storage, args), [])
  const dealNext = useMutation(({ storage }, handNo) => nextHand(storage, handNo), [])

  // 🤖 A bot's go: decide from the table as it is RIGHT NOW.
  const botMove = useMutation(({ storage }, botId, level) => {
    if (storage.get('currentTurn') !== botId) return
    const now = storage.get('poker').toJSON()
    if (now.phase !== 'betting') return
    const move = choosePokerMove(now, botId, storage.get('hands').get(botId) ?? [], level)
    const before = storage.get('lastAction').get('id')
    doAction(storage, { id: botId, ...move })
    if (storage.get('lastAction').get('id') === before) { // move wasn't allowed — play safe
      const o = optionsFor(now, botId)
      doAction(storage, { id: botId, kind: o.canCheck ? 'check' : 'fold' })
    }
  }, [])
  const phase = pk?.phase
  useBotTurn({ myId, currentTurn, playerOrder, act: botMove, active: phase === 'betting', watch: lastActionId })

  // Between hands: one phone deals the next one after a pause to see the result.
  const iDeal = useInCharge(myId, pk?.dealer, playerOrder)
  const handNo = pk?.handNo
  const foldWin = !!pk?.result?.foldWin
  useEffect(() => {
    if (phase !== 'handOver' || !iDeal) return
    const t = setTimeout(() => dealNext(handNo), foldWin ? NEXT_HAND_MS.fold : NEXT_HAND_MS.showdown)
    return () => clearTimeout(t)
  }, [phase, iDeal, handNo, foldWin, dealNext])

  // 🥁 Everyone's all in: one phone deals the rest of the board slowly, one
  // street at a time, then shows the result. Every phone sees each card land.
  const boardLen = pk?.board?.length ?? 0
  const dealStep = useMutation(({ storage }, n, len) => runoutStep(storage, n, len), [])
  useEffect(() => {
    if (phase !== 'runout' || !iDeal) return
    const t = setTimeout(() => dealStep(handNo, boardLen), RUNOUT_MS[boardLen] ?? 3000)
    return () => clearTimeout(t)
  }, [phase, iDeal, handNo, boardLen, dealStep])

  // Sounds for the runout: a card flip as each street lands, a drumroll before the river.
  const [drumroll, setDrumroll] = useState(false)
  useEffect(() => {
    if (phase !== 'runout') return
    if (boardLen > 0) playSfx(boardLen === 5 ? 'slam' : 'flip')
    if (boardLen !== 4) return
    const t = setTimeout(() => { setDrumroll(true); playSfx('drum') }, RUNOUT_MS[4] - DRUMROLL_MS)
    return () => { clearTimeout(t); setDrumroll(false) }
  }, [phase, boardLen])

  // Everyone's chance of winning, shown live during a runout 📊
  const runoutKey = phase === 'runout' ? `${handNo}|${(pk?.board ?? []).map((c) => c.label).join(',')}` : ''
  const odds = useMemo(() => {
    if (!runoutKey) return null
    const live = (pk.inHand ?? []).filter((p) => !(pk.folded ?? []).includes(p))
    const holes = Object.fromEntries(live.map((p) => [p, hands?.[p] ?? []]))
    if (live.some((p) => holes[p].length !== 2)) return null
    return equity(holes, pk.board ?? [], pk.handNo)
  }, [runoutKey]) // eslint-disable-line react-hooks/exhaustive-deps -- runoutKey captures everything that changes the odds

  // 💰 Save my stack to my phone's bank after every hand, so I keep it for the
  // next game in any room. (Mid-hand, chips in the pot aren't mine yet.)
  const myStack = pk?.chips?.[myId]
  useEffect(() => {
    if ((phase === 'handOver' || phase === 'gameOver') && myStack != null) setBank(myStack)
  }, [phase, handNo, myStack])

  // A new turn or a new hand closes the raise panel.
  const [panelFor, setPanelFor] = useState('')
  const turnKey = `${handNo}-${currentTurn}-${lastActionId}`
  if (panelFor !== turnKey) {
    setPanelFor(turnKey)
    setRaiseTo(null)
  }

  if (!pk || !hands || !phase) {
    return <div className="lobby"><p className="lobby-sub">Shuffling up…</p></div>
  }

  // ── Game over ────────────────────────────────────────────
  if (phase === 'gameOver') {
    const champ = playerOrder.find((p) => (pk.chips?.[p] ?? 0) > 0) ?? ''
    const ranking = [champ, ...[...(pk.busted ?? [])].reverse()].filter(Boolean)
    const scores = ranking.map((p, i) => ({ name: p, detail: i === 0 ? `💰 ${chips(pk.chips?.[p])}` : `out ${['', '2nd', '3rd'][i] ?? `${i + 1}th`}` }))
    const title = champ === myId ? `You win all the chips — ${chips(pk.chips?.[myId])} saved to your bank! 🤑` : `${champ} wins all the chips!`
    return <WinnerScreen emoji="🤠" title={title} scores={scores} onLeave={onLeave} />
  }

  const board = pk.board ?? []
  const inHand = pk.inHand ?? []
  const folded = pk.folded ?? []
  const result = pk.result
  const handOver = phase === 'handOver'
  const myHole = hands[myId] ?? []
  const myChips = pk.chips?.[myId] ?? 0
  const myBet = pk.bets?.[myId] ?? 0
  const amIn = inHand.includes(myId)
  const iFolded = folded.includes(myId)
  const isMyTurn = currentTurn === myId && phase === 'betting'
  const pot = potOf(pk)
  const others = playerOrder.filter((p) => p !== myId)
  const winnerCards = new Set((result?.winners?.[0]?.cards ?? []).map((c) => c.id))
  const onlyOneLeft = playerOrder.filter((p) => (pk.chips?.[p] ?? 0) > 0).length < 2

  // What have I got? (Helps you learn the hands!)
  const myBest = myHole.length === 2 ? (board.length >= 3 ? bestHand([...myHole, ...board])?.name : describeStart(myHole)) : ''

  const o = isMyTurn ? optionsFor(pk, myId) : null
  const step = pk.blinds?.big ?? 20
  const clampRaise = (x) => Math.max(o.minTo, Math.min(o.maxTo, Math.round(x / step) * step || o.minTo))
  const potRaise = (fraction) => clampRaise(o.bet + o.toCall + (pot + o.toCall) * fraction) // raise by a share of the pot after calling
  const sendRaise = () => { act({ id: myId, kind: 'raise', amount: raiseTo }); setRaiseTo(null) }
  const raiseWord = (pk.currentBet ?? 0) === 0 ? 'Bet' : 'Raise'

  const runout = phase === 'runout'
  const pct = (p) => (odds && odds[p] != null ? Math.round(odds[p] * 100) : null)
  const leader = odds ? Object.keys(odds).sort((a, b) => odds[b] - odds[a])[0] : ''
  const seatOf = (p) => playerOrder.indexOf(p)
  const nextLen = board.length === 0 ? 3 : board.length + 1 // the slots the next street will fill

  let banner
  if (runout) banner = boardLen === 4 ? '🥁 Here comes the river…' : boardLen === 5 ? '😱 …' : '🔥 ALL IN — cards up!'
  else if (handOver) banner = '🃏 Next hand coming up…'
  else if (!amIn) banner = '👀 You\'re out — watching'
  else if (iFolded && !isMyTurn) banner = `🏳️ You folded · ${currentTurn ? `${currentTurn}'s turn…` : ''}`

  return (
    <div className="game-board poker-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />
      <TurnBanner isMyTurn={isMyTurn} currentTurn={currentTurn} emoji="🤠" text={banner} />
      <ActionMessage message={actionMsg} />

      <div className="table-top">
        <div className="opponents">
          {others.map((p) => {
            const out = !inHand.includes(p)
            const shown = result?.shown?.[p] ?? (runout && inHand.includes(p) && !folded.includes(p) ? hands[p] : null)
            const theirBet = pk.bets?.[p] ?? 0
            let status = `💰 ${chips(pk.chips?.[p])}`
            if (out) status = (pk.busted ?? []).includes(p) ? '💸 busted' : 'sitting out'
            else if (folded.includes(p)) status += ' · folded'
            else if ((pk.chips?.[p] ?? 0) === 0) status += ' · ALL IN'
            if (!out && theirBet > 0) status += ` · bet ${chips(theirBet)}`
            return (
              <Opponent key={p} name={p} sub={status} active={currentTurn === p && phase === 'betting'}>
                <div className={`poker-seat${folded.includes(p) || out ? ' is-folded' : ''}`}>
                  <div className="poker-seat-cards mini-cards">
                    {!out && (shown
                      ? shown.map((c) => <CardFace key={c.id} label={c.label} red={c.red} highlight={winnerCards.has(c.id)} />)
                      : !folded.includes(p) && [0, 1].map((i) => <CardBack key={i} />))}
                  </div>
                  <div className="poker-seat-tags">
                    <RoleChips pk={pk} p={p} />
                  </div>
                  {shown && result?.hands?.[p] && <span className="poker-hand-name">{result.hands[p]}</span>}
                  {runout && shown && board.length >= 3 && <span className="poker-hand-name">{bestHand([...shown, ...board])?.name}</span>}
                  {pct(p) != null && <span className={`poker-odds${p === leader ? ' lead' : ''}`}>{pct(p)}%</span>}
                </div>
              </Opponent>
            )
          })}
        </div>
      </div>

      <div className="table-center">
        <div className="poker-felt" data-spot="pile">
          <div className={`poker-board-cards${runout ? ' runout' : ''}`}>
            {[0, 1, 2, 3, 4].map((i) => board[i]
              ? <div key={board[i].id} className={runout ? `card-flip${i === 4 ? ' river' : ''}` : 'card-land'} style={{ '--i': board.length === 3 && runout ? i : 0 }}><CardFace label={board[i].label} red={board[i].red} highlight={winnerCards.has(board[i].id)} /></div>
              : <div key={`slot-${i}`} className={`poker-slot${runout && i < nextLen ? ` next${drumroll ? ' drumroll' : ''}` : ''}`}>{runout && i < nextLen ? '?' : ''}</div>)}
          </div>
          {odds && (
            <div className="poker-odds-bar" aria-label="Chances of winning">
              {Object.keys(odds).map((p) => (
                <div key={p} className="poker-odds-seg" style={{ flexGrow: Math.max(odds[p], 0.001), '--hue': hueOf(p, seatOf(p)) }}>
                  {odds[p] >= 0.12 && <span>{p === myId ? 'You' : p} {pct(p)}%</span>}
                </div>
              ))}
            </div>
          )}
          <div className="poker-pot">
            <span className="poker-pot-chip" />
            Pot <b>{chips(pot)}</b>
            <span className="poker-blinds">· blinds {pk.blinds?.small}/{pk.blinds?.big}</span>
          </div>
        </div>

        {handOver && result && (
          <div className="poker-result">
            {result.foldWin
              ? <p><b>{result.foldWin}</b> wins {chips(result.pot)} — everyone else folded</p>
              : result.winners.map((w) => (
                  <p key={w.name}><b>{w.name === myId ? 'You' : w.name}</b> win{w.name === myId ? '' : 's'} {chips(w.amount)} · {w.hand}</p>
                ))}
            <button className="action-btn sort-btn poker-next" onClick={() => dealNext(handNo)}>{onlyOneLeft ? 'See the winner 🏆' : 'Next hand ▶'}</button>
          </div>
        )}

        {/* My seat: chips, bet, what I've got */}
        {amIn && (
          <div className={`poker-me${iFolded ? ' is-folded' : ''}`}>
            <span className="poker-me-chips">💰 {chips(myChips)}</span>
            <RoleChips pk={pk} p={myId} />
            {myBet > 0 && <span className="poker-bet">bet {chips(myBet)}</span>}
            {myBest && !iFolded && <span className="poker-me-hand">{myBest}</span>}
            {pct(myId) != null && <span className={`poker-odds${myId === leader ? ' lead' : ''}`}>{pct(myId)}% to win</span>}
            {iFolded && <span className="poker-me-hand">folded</span>}
            {!iFolded && myChips === 0 && <span className="poker-allin-tag">ALL IN</span>}
          </div>
        )}

        {isMyTurn && raiseTo == null && (
          <div className="poker-actions">
            <button className="poker-btn fold" onClick={() => act({ id: myId, kind: 'fold' })}>Fold</button>
            {o.canCheck
              ? <button className="poker-btn check" onClick={() => act({ id: myId, kind: 'check' })}>Check</button>
              : <button className="poker-btn call" onClick={() => act({ id: myId, kind: 'call' })}>{o.toCall >= myChips ? `All in ${chips(o.toCall)}` : `Call ${chips(o.toCall)}`}</button>}
            {o.canRaise && <button className="poker-btn raise" onClick={() => setRaiseTo(o.minTo)}>{raiseWord}…</button>}
          </div>
        )}

        {isMyTurn && raiseTo != null && (
          <div className="poker-raise">
            <div className="poker-raise-amount">
              <button className="count-btn" onClick={() => setRaiseTo(clampRaise(raiseTo - step))}>−</button>
              <span>{raiseWord} to <b>{chips(raiseTo)}</b></span>
              <button className="count-btn" onClick={() => setRaiseTo(clampRaise(raiseTo + step))}>+</button>
            </div>
            <input
              type="range"
              className="poker-slider"
              min={o.minTo}
              max={o.maxTo}
              step={1}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
            />
            <div className="poker-quick">
              <button className="action-btn sort-btn" onClick={() => setRaiseTo(o.minTo)}>Min</button>
              <button className="action-btn sort-btn" onClick={() => setRaiseTo(potRaise(0.5))}>½ Pot</button>
              <button className="action-btn sort-btn" onClick={() => setRaiseTo(potRaise(1))}>Pot</button>
              <button className="action-btn sort-btn" onClick={() => setRaiseTo(o.maxTo)}>All in</button>
            </div>
            <div className="poker-actions">
              <button className="poker-btn fold" onClick={() => setRaiseTo(null)}>Back</button>
              <button className="poker-btn raise" onClick={sendRaise}>{raiseTo >= o.maxTo ? `ALL IN ${chips(raiseTo)}` : `${raiseWord} ${chips(raiseTo)}`} ▶</button>
            </div>
          </div>
        )}
      </div>

      <Hand
        cards={myHole}
        isHighlighted={(c) => winnerCards.has(c.id)}
      />
    </div>
  )
}
