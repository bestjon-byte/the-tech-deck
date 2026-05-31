import { useStorage } from '../../liveblocks.config'
import { useCardTable } from '../../engine/table'
import TopBar from '../../components/TopBar'
import CardFace from '../../components/CardFace'
import CardBack from '../../components/CardBack'
import Hand from '../../components/Hand'
import { OpponentBacks } from '../../components/Opponent'

// ── Free Play ──────────────────────────────────────────────
// The open table with no rules: deal, draw, play to the discard pile, undo,
// shuffle and sort. It's built almost entirely from the shared building blocks.
export default function FreePlayBoard({ playerName, roomCode, onLeave }) {
  const myId = playerName
  const myHand = useStorage((root) => root.hands[myId] ?? [])
  const deck = useStorage((root) => root.deck)
  const discardPile = useStorage((root) => root.discardPile)

  const { drawCard, playCard, undoPlay, shuffleDiscardIntoDeck, sortHand } = useCardTable()

  if (deck === null) {
    return <div className="lobby"><p className="lobby-sub">Setting up game...</p></div>
  }

  const discardTop = discardPile[0] ?? null

  return (
    <div className="game-board">
      <TopBar roomCode={roomCode} onLeave={onLeave} />

      <div className="table-top">
        <OpponentBacks />
      </div>

      <div className="table-center">
        <div className="piles-area">
          <div className="pile-col">
            {deck.length > 0 ? (
              <CardBack className="draw-pile-card" onClick={() => drawCard(myId)} />
            ) : (
              <div className="empty-pile" onClick={() => drawCard(myId)}>Empty</div>
            )}
            <span className="pile-label">Draw {deck.length > 0 ? `· ${deck.length}` : ''}</span>
          </div>
          <div className="pile-col">
            {discardTop ? (
              <CardFace label={discardTop.label} red={discardTop.red} />
            ) : (
              <div className="empty-pile discard-empty">Discard</div>
            )}
            <span className="pile-label">Discard</span>
          </div>
        </div>

        <div className="action-buttons">
          {discardPile.length > 0 && (
            <button className="action-btn undo-btn" onClick={() => undoPlay(myId)}>Undo</button>
          )}
          {discardPile.length > 1 && (
            <button className="action-btn shuffle-btn" onClick={shuffleDiscardIntoDeck}>Shuffle</button>
          )}
        </div>
      </div>

      <Hand
        cards={myHand}
        onCardClick={(card) => playCard({ id: myId, cardId: card.id })}
        showSort
        onSort={() => sortHand(myId)}
      />
    </div>
  )
}
