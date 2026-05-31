import { Component } from 'react'

// Catches any crash inside the game and shows a friendly reload screen instead
// of a blank page. Cards are safe because they live in Liveblocks storage.
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { crashed: false } }
  static getDerivedStateFromError() { return { crashed: true } }
  render() {
    if (this.state.crashed) {
      return (
        <div className="lobby">
          <div className="landing-logo">😬</div>
          <h2>Something crashed</h2>
          <p className="lobby-sub">Don't worry — your cards are still saved.</p>
          <button className="big-btn create-btn" onClick={() => window.location.reload()}>
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
