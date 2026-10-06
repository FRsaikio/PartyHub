# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

PartyHub is a French-language multiplayer party-game site: phones act as controllers, an optional TV screen (`tv.html`) shows the shared view. It is plain static HTML/CSS/vanilla JS with Firebase Firestore (loaded from the gstatic CDN) for real-time sync. All UI text and code comments are in French.

## Running

There is no build step, package manager, linter, or test suite. Serve the repo root with any static server (ES modules don't load over `file://`), e.g. `npx serve .` or `python -m http.server`, then open `index.html`. Testing multiplayer means opening several tabs/devices against the same room code — they all hit the live Firebase project configured in [firebase.js](firebase.js).

## Architecture

**Entry points**
- [index.html](index.html) + [app.js](app.js) — home screen and room lobby (create/join room, pick game, party mode, alcohol/drink level, start game).
- [tv.html](tv.html) + [tv.js](tv.js) — big-screen view of a room (`tv.html?room=CODE`), shows join link/QR, players, activity feed.
- `games/<game>/` — each mini-game is a standalone page with its own HTML/CSS/JS.

**Shared modules**
- [firebase.js](firebase.js) — initializes Firestore and re-exports the Firestore helpers (`doc`, `updateDoc`, `onSnapshot`, `runTransaction`, …). Every page imports from here; add new Firestore functions to its export list rather than importing the CDN directly.
- [profile.js](profile.js) — persistent player profile (XP, stats, avatar incl. uploaded photo) stored in Firestore `profiles/{id}`, id kept in `localStorage.partyhubProfileId`.
- [partyhub-fx.js](partyhub-fx.js) — classic (non-module) script exposing `window.PartyHubFX` (WebAudio sounds, confetti). Loaded before the module script on every page.
- [html-safe.js](html-safe.js) — `escapeHtml`, `safeImageSrc`, `cleanPseudo`. Anything coming from a player (names, avatars, activity lines, synced game state) must go through `escapeHtml`/`safeImageSrc` before being put in `innerHTML`, since any client can write to the room doc. Monopoly (classic script) keeps a local copy of `escapeHtml`.
- [game-common.js](game-common.js) — helpers shared by games. `resolveIsHost(savedData)` is the single source of truth for "does this phone drive the game": the player flagged `host`, or, in TV-created rooms where no phone is host, the first non-fake player.
- CSS: the redesign ("Néon Club": night background `#08061a`, neon pink `#e01fa0`, cyan `#22d3ee`, Unbounded + Manrope from Google Fonts) lives in [neon-club.css](neon-club.css), with tokens prefixed `--nc-`. The lobby (`index.html`) loads **only** that file. The TV screen (`tv.html`) loads `neon-club.css` → `tv.css` → [tv-neon.css](tv-neon.css): `tv.css` keeps the geometry of the live game views (roulette wheel, bomb, cards, cinema mode) and `tv-neon.css` re-skins everything, so restyle TV in `tv-neon.css` rather than in the layered `tv.css`. Migrated games load `neon-club.css` → [neon-game.css](neon-game.css) (shared game layer: `.game-header`, `.round-info`, `.question-card`, `.result-box`, `.score-panel`, `.end-screen`…) → their own CSS, and drop `global-ui.css`/`style.css`. Most Likely is migrated; the other games still use the old layering. Games still use the old layering `global-ui.css` → `style.css` → page CSS until they are migrated one by one; `neon-premium-v2.css` is now unused by the lobby. Casino Night, Poker and Monopoly use only their own CSS.
- Lobby panels are grouped in three `.lobby-col` wrappers (players + activity / games / settings + launch). On phones the wrappers are `display: contents` and the panels are ordered with `order`. JS relies only on ids, `data-game`/`data-mode`, and the `<strong>` text inside `.mode-card`/`.game-card`, so keep those when editing the markup.

**Room state & navigation flow** (spans app.js, tv.js and every game)
- One Firestore doc per room: `rooms/{4-char code}`. It holds players, lobby settings, `activity`, `gameStarted`, `activeGame`, `gameState`, `roomStatus`/`screen`, and `forceNavigation: { target, at }`.
- Games are registered in `GAME_CONFIG` in [app.js](app.js) (id → label + url). Adding a game means adding a folder under `games/` and an entry there (plus the lobby card markup in `index.html`).
- When the host starts, the room doc gets `gameStarted: true` + `activeGame`; every lobby client's `onSnapshot` redirects to `game.url?room=CODE`.
- The lobby continuously writes `localStorage.partyhubGameData` (roomCode, players, selectedPartyMode, alcoholMode, drinkLevel, isHost, currentPlayer, profile id…). **Game pages read their config from this localStorage blob**, not from the URL, and redirect to the lobby if it's missing.
- Each game keeps its in-progress state in the room doc (usually under `gameState`) and listens via `onSnapshot`.
- Returning to lobby: the host sets `gameStarted: false`, `activeGame: null`, `gameState: {}`, `forceNavigation: { target: "lobby", at: Date.now() }`; all clients (including TV) see `gameStarted === false`, set `localStorage.partyhubReturnLobby = "true"`, and navigate to `../../index.html`. Follow this same pattern in new games.
- Host-only vs. any-player actions differ per game (e.g. Chaos Kings: reset is host-only, drawing is open to all). Games compute `isHost` with `resolveIsHost()`; only the host publishes the initial `gameState` on page load, so a non-host must never do it (it would reset the game for everyone).

**Script loading quirks**
- Most games use `<script type="module">` with static imports from `../../firebase.js`. Casino Night and Monopoly use classic scripts and pull Firebase with dynamic `import("../../firebase.js")`; Poker lives one level deeper (`games/casino-night/poker/`) so its paths use `../../../`.
- `GAME_CONFIG["verite-ou-bois"]` is a legacy alias kept for old rooms; it points to `games/truth-or-drink/`.

## Content conventions

Game content (prompts, card rules, dares) lives as large arrays inside each game's JS file, typically tiered by party mode (Chill / Party / Chaos / Hardcore) and drink level (soft / normal / hard / extreme). Chaos Kings uses a `variants[]` pool per card with random alcohol intensity capped by the global drink-level setting. The roulette wheel's visual pointer must land on the category actually drawn; GAGE and SECRET categories are intentionally removed from it.
