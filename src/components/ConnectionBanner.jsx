import { useStatus, useSyncStatus } from '../liveblocks.config'

// A strip across the top that tells you when YOUR signal is the problem:
//   • "Reconnecting…" — your phone lost its connection. Keep playing! Your
//     moves are saved on your phone and sent the moment you're back.
//   • "Sending…" — you're connected, but your last move is taking a while to
//     reach everyone (slow signal). `smooth` waits a moment before showing
//     this, so it doesn't flash up on every normal move.
// When everything's fine it shows nothing at all.
export default function ConnectionBanner() {
  const status = useStatus()
  const syncStatus = useSyncStatus({ smooth: true })

  if (status === 'reconnecting' || status === 'disconnected') {
    return <div className="connection-banner offline">📶 No signal — moves will send when you're back</div>
  }
  if (status === 'connected' && syncStatus === 'synchronizing') {
    return <div className="connection-banner sending">⏳ Sending…</div>
  }
  return null
}
