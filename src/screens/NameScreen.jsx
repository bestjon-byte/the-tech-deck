import { useState } from 'react'
import { saveName } from '../lib/identity'

// First-launch screen: ask the player's name once and remember it.
export default function NameScreen({ onDone }) {
  const [name, setName] = useState('')
  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    saveName(trimmed)
    onDone(trimmed)
  }
  return (
    <div className="landing">
      <div className="landing-logo">🃏</div>
      <h1>The Tech Deck</h1>
      <p className="landing-sub">What's your name?</p>
      <div className="join-form">
        <input
          className="code-input name-input"
          maxLength={12}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <button className="big-btn create-btn" onClick={handleSave} disabled={!name.trim()}>
          Let's play →
        </button>
      </div>
    </div>
  )
}
