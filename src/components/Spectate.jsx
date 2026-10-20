import { useState } from 'react'
import { useStorage, useMutation } from '../liveblocks.config'
import { requestWatch, stopWatching, answerWatch, watchState } from '../engine/spectate'
import { isOut, isOver } from '../games/spectateRules'
import CardFace from './CardFace'

// 👀 Spectator mode (see engine/spectate.js). Mounted once in GameHost, so it
// works in every game:
//   • Out of the game? A "👀 Watch a hand" button lets you ask a player.
//   • Asked? A pop-up lets you say "Let them watch" or "No".
//   • Allowed? Their hand shows live at the bottom of your screen, and their
//     seat glows. Either of you can stop it any time.
export default function Spectate({ myId, gameId }) {
  const root = useStorage((r) => r)
  const [picking, setPicking] = useState(false)

  const ask = useMutation(({ storage }, target) => requestWatch(storage, myId, target), [myId])
  const stop = useMutation(({ storage }) => stopWatching(storage, myId), [myId])
  const answer = useMutation(({ storage }, viewer, ok, stopped) => answerWatch(storage, myId, viewer, ok, stopped), [myId])

  if (!root?.gameStarted) return null
  const order = root.playerOrder ?? []
  const bots = root.bots ?? {}
  const watch = root.watch ?? {}
  const over = isOver(gameId, root)
  if (over || order.length === 0) return null

  const iAmOut = isOut(gameId, root, myId)
  const targets = order.filter((p) => p !== myId && !isOut(gameId, root, p))
  const mine = watchState(watch, myId, bots)
  const watching = mine && targets.includes(mine.target) ? mine : null // they went out too → nothing to show

  // Requests TO me: who's asking, and who I've already let in.
  const viewers = Object.keys(watch).filter((k) => k.startsWith('req:')).map((k) => k.slice(4))
  const asking = viewers.filter((v) => watch[`req:${v}`]?.target === myId && watchState(watch, v).state === 'waiting')
  const watchingMe = viewers.filter((v) => watch[`req:${v}`]?.target === myId && watchState(watch, v).state === 'yes')

  return (
    <>
      {/* ── Someone wants to watch me ── */}
      {asking.length > 0 && (
        <div className="spect-ask" role="dialog" aria-label="Watch request">
          <div className="spect-ask-text">👀 <b>{asking[0]}</b> wants to watch your hand</div>
          <div className="spect-ask-btns">
            <button className="spect-btn no" onClick={() => answer(asking[0], false)}>No</button>
            <button className="spect-btn yes" onClick={() => answer(asking[0], true)}>Let them watch</button>
          </div>
        </div>
      )}
      {asking.length === 0 && watchingMe.length > 0 && (
        <div className="spect-watchers">
          👀 {watchingMe.join(' & ')} {watchingMe.length === 1 ? 'is' : 'are'} watching your hand
          {watchingMe.map((v) => (
            <button key={v} className="spect-stop" onClick={() => answer(v, false, true)} aria-label={`Stop ${v} watching`}>
              Stop{watchingMe.length > 1 ? ` ${v}` : ''}
            </button>
          ))}
        </div>
      )}

      {/* ── I'm out: watch someone ── */}
      {iAmOut && targets.length > 0 && (
        <>
          {watching?.state === 'yes' && (
            <>
              <style>{`[data-seat="${CSS.escape(watching.target)}"] { box-shadow: 0 0 0 3px #64D2FF, 0 0 22px rgba(100,210,255,0.6) !important; }`}</style>
              <div className="spect-panel">
                <div className="spect-panel-head">
                  <span>👀 <b>{watching.target}</b>'s hand · live</span>
                  <button className="spect-stop" onClick={() => stop()}>✕ Stop</button>
                </div>
                <div className="spect-cards mini-cards">
                  {(root.hands?.[watching.target] ?? []).map((c) => <CardFace key={c.id} label={c.label} red={c.red} />)}
                  {(root.hands?.[watching.target] ?? []).length === 0 && <span className="spect-empty">No cards in hand right now</span>}
                </div>
              </div>
            </>
          )}

          {watching?.state === 'waiting' && (
            <div className="spect-pill">
              ⏳ Asking <b>{watching.target}</b>…
              <button className="spect-stop" onClick={() => stop()}>Cancel</button>
            </div>
          )}

          {(!watching || watching.state === 'no' || watching.state === 'stopped') && !picking && (
            <div className="spect-pill">
              {watching?.state === 'no' && <span>🙅 {watching.target} said no · </span>}
              {watching?.state === 'stopped' && <span>✋ {watching.target} stopped you watching · </span>}
              <button className="spect-btn yes" onClick={() => setPicking(true)}>👀 Watch a hand</button>
            </div>
          )}

          {picking && (
            <div className="spect-pick">
              <div className="spect-pick-title">Whose hand do you want to watch?</div>
              <div className="spect-pick-list">
                {targets.map((p) => (
                  <button key={p} className="spect-btn" onClick={() => { ask(p); setPicking(false) }}>
                    {bots[p] ? '🤖 ' : ''}{p}
                  </button>
                ))}
              </div>
              <button className="spect-stop" onClick={() => setPicking(false)}>Cancel</button>
            </div>
          )}
        </>
      )}
    </>
  )
}
