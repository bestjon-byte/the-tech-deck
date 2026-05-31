# Welcome to Vibe Coding: Build Your Own Windy-Day Card Game!
Have you ever tried to play a game of cards on the beach or a camping trip, only for a sudden gust of wind to blow your entire hand into the grass or the ocean?

You are about to build the solution. You're going to create a smartphone card game where four people sitting next to each other can join a private "room," deal cards, and play together on their phones—completely safe from the wind.

The coolest part? **You don't need to know how to write thousands of lines of code to do it.** You are going to "vibe code" this game using **Claude**, a super-smart AI assistant.

## 1. Your Role vs. Claude's Role
Think of building this app like directing a movie or running a Lego construction site:
 * **You are the Director:** You come up with the rules, choose how the cards look, test the game, and decide what feature to build next.
 * **Claude is your Master Builder:** Claude sits inside your computer program (**VS Code**) and does all the heavy lifting, creating the project files and typing out the code at lightning speed based on what you tell it to do.

## 2. The Magic Multiplayer Secret: Liveblocks
To make sure your game works *anywhere*—on home Wi-Fi, hotel Wi-Fi, or even out in nature using phone data—we are using a secret weapon called **Liveblocks**.

Think of Liveblocks like a **magic cloud table**. When you play a physical card game, everyone sits around a real wooden table. With Liveblocks, everyone's phone connects to the same invisible cloud table. When you throw a card down, Liveblocks instantly copies that move to everyone else's screen in less than a blink of an eye.

Plus, if your phone screen locks or you get a text message, Liveblocks remembers your spot so you don't get kicked out of the game!

## 3. The 3 Golden Rules of Vibe Coding
To keep the "vibes" good and prevent the AI from getting confused, you must follow these rules:
 * **Rule 1: One tiny step at a time.** Never ask Claude to "build the whole game" at once.
 * **Rule 2: Ask Claude how to test.** Type: *"How do I test my game right now?"* and Claude will help.
 * **Rule 3: Don't guess—feed the errors back.** Copy red error text and paste it to Claude.

## 4. Your 4-Level Game Plan

### ✅ Level 1: The Looks (COMPLETE!)
A shuffled 52-card deck, draw pile, discard pile, and a hand of cards at the bottom. Red suits are red, black suits are black. Click a card to play it. Click the draw pile to draw. Shuffle button sends discard pile back into the draw pile.

### 🏠 Level 2: Creating the Room Code ← YOU ARE HERE
Next, you'll use Liveblocks to connect different phones. When you open the app, it should say "Create Game" or "Join Game." If you create a game, Liveblocks will give you a 4-letter code (like WIND) so your friends can type it in and sit in a virtual multiplayer lobby with you.

### 🔄 Level 3: The Magic Sync
This is where the multiplayer magic happens. You will tell Claude to link the cards to Liveblocks. When Player 1 tosses a card into the discard pile on *their* phone, Liveblocks will instantly pop it up on Player 2, 3, and 4's phones in real-time.

### ⚙️ Level 4: Custom Actions
Once the basic game works, you can add your favorite custom actions! Add a button to shuffle the discard pile, let players pick up from the discard pile, and more.
