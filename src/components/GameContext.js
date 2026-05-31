import { createContext } from 'react'

// Lets any part of a game board reach the "How to play" pop-up without every
// board having to wire it up. GameHost provides { openHelp }; TopBar uses it to
// show the ? button.
export const GameContext = createContext(null)
