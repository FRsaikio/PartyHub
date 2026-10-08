// Monopoly Party — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `monopoly`) ; chaque action passe par une transaction
// qui applique mono-logic.js. Chacun joue à son tour sur son téléphone.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf } from "../../../game-common.js";
import { safeImageSrc } from "../../../html-safe.js";
import { TILES, QUARTERS, MAX_LEVEL, newGame, applyAction, rentOf, wealth, upgradeCost, quarterOwned } from "./mono-logic.js";

// ---------- Qui joue ----------

const params = new URLSearchParams(window.location.search);
const savedData = (() => {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const data = JSON.parse(store.getItem("partyhubGameData") || "null");
      if (data) return data;
    } catch { /* stockage indisponible */ }
  }
  return null;
})();

const spectator = params.get("spectator") === "1" || params.get("tv") === "1";
const roomCode = params.get("room") || savedData?.roomCode || "";
if (!roomCode || (!savedData && !spectator)) {
  window.location.href = "../../index.html";
  throw new Error("Aucune partie trouvée.");
}

const myName = spectator ? "" : savedData.currentPlayer || savedData.playerName || "";
let isHost = !spectator && resolveIsHost(savedData);
const settings = { drinkLevel: savedData?.drinkLevel || "normal", alcohol: savedData?.alcoholMode !== false };

if (spectator) document.body.classList.add("mp-tv");
if (params.get("embed") === "1") document.body.classList.add("mp-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const boardEl = $("mpBoard");
const centerEl = $("mpCenter");
const panelEl = $("mpPanel");
const playersEl = $("mpPlayers");
const myPlacesEl = $("mpPlaces");
const hostEl = $("mpHost");
const logEl = $("mpLog");
const roundEl = $("mpRound");
$("roomBadge").textContent = `Room ${roomCode}`;

// ---------- Outils ----------

function h(tag, cls, ...children) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  children.flat().forEach(child => {
    if (child == null || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return el;
}
const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter(k => k != null && k !== false));

function button(label, onClick, cls = "btn secondary", disabled = false) {
  const b = h("button", cls, label);
  b.type = "button";
  b.disabled = disabled || busy;
  b.addEventListener("click", onClick);
  return b;
}

const fx = () => window.PartyHubFX;
const sound = {
  dice: () => { for (let i = 0; i < 6; i++) fx()?.tone?.(300 + Math.random() * 400, 0.04, "square", 0.25, null, i * 0.06); },
  step: () => fx()?.tone?.(660, 0.04, "triangle", 0.3),
  buy: () => [523, 659, 784].forEach((f, i) => fx()?.tone?.(f, 0.15, "triangle", 0.6, null, i * 0.08)),
  pay: () => fx()?.tone?.(220, 0.25, "sawtooth", 0.4)
};

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `mp-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || "🎩";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `mp-toast tone-${tone}`, text);
  document.body.append(el);
  setTimeout(() => el.classList.add("leaving"), 3200);
  setTimeout(() => el.remove(), 3700);
}

const DICE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const stars = n => "⭐".repeat(n || 0);

// ---------- État & transactions ----------

let state = null;
let busy = false;

async function mutate(type, payload = {}) {
  if (spectator || busy) return;
  busy = true;
  render();
  let committed = null;
  try {
    await runTransaction(db, async t => {
      const snap = await t.get(roomRef);
      const data = snap.data() || {};
      if (!data.monopoly) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.monopoly));
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName }, { rng: Math.random, ...settings });
      next.v = (data.monopoly.v || 0) + 1;
      t.update(roomRef, { monopoly: next });
      committed = next;
    });
  } catch (error) {
    toast(error.message || "Action impossible.", "bad");
    if (!error.message) console.error(error);
  } finally {
    busy = false;
    if (committed) applyState(committed);
    else render();
  }
}

async function ensureGame(data) {
  const session = data.activeGame?.startedAt || 0;
  if (data.monopoly && data.monopoly.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.monopoly && d.monopoly.session === s) return;
      t.update(roomRef, { monopoly: newGame(d.players || [], s, d.gameDuration || "medium") });
    });
  } catch (error) {
    console.error("Monopoly : création de la partie impossible", error);
  }
}

// Animation des pions : on avance case par case depuis l'ancienne position.
const shownPos = {};
let animating = false;
function animateMoves(before, next) {
  const moves = next.players.map(p => {
    const old = before?.players.find(o => o.name === p.name);
    return { name: p.name, from: old ? old.pos : p.pos, to: p.pos };
  }).filter(m => m.from !== m.to);
  if (!moves.length || !before) { next.players.forEach(p => { shownPos[p.name] = p.pos; }); return; }
  animating = true;
  let step = 0;
  const maxSteps = Math.max(...moves.map(m => ((m.to - m.from + TILES.length) % TILES.length)));
  const forward = maxSteps <= 12; // un échange de places (carte Chance) ne s'anime pas pas à pas
  if (!forward) { moves.forEach(m => { shownPos[m.name] = m.to; }); animating = false; return; }
  const timer = setInterval(() => {
    step += 1;
    moves.forEach(m => {
      const dist = (m.to - m.from + TILES.length) % TILES.length;
      if (step <= dist) shownPos[m.name] = (m.from + step) % TILES.length;
    });
    sound.step();
    renderBoard();
    if (step >= maxSteps) { clearInterval(timer); animating = false; render(); }
  }, 170);
}

function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  if (before && before.session === next.session) {
    if (next.dice && JSON.stringify(next.dice) !== JSON.stringify(before.dice)) { sound.dice(); diceSpin(); }
    animateMoves(before, next);
    if (!spectator && next.phase === "play" && next.players[next.current]?.name === myName && before.players[before.current]?.name !== myName) {
      navigator.vibrate?.([80, 60, 80]);
      toast("🎲 À toi de lancer les dés !", "gold");
    }
    if (Object.keys(next.owners).length > Object.keys(before.owners).length) sound.buy();
  } else {
    next.players.forEach(p => { shownPos[p.name] = p.pos; });
  }
  render();
}

let diceRolling = false;
function diceSpin() {
  diceRolling = true;
  setTimeout(() => { diceRolling = false; render(); }, 600);
}

// ---------- Plateau ----------

// Cases sur le pourtour d'une grille 8×8 (sens des aiguilles d'une montre, Départ en bas à gauche).
function pathPositions() {
  const pos = [];
  for (let c = 1; c <= 8; c++) pos.push([8, c]);
  for (let r = 7; r >= 1; r--) pos.push([r, 8]);
  for (let c = 7; c >= 1; c--) pos.push([1, c]);
  for (let r = 2; r <= 7; r++) pos.push([r, 1]);
  return pos;
}
const PATH = pathPositions();

function renderBoard() {
  const s = state;
  const cells = TILES.map((t, i) => {
    const [r, c] = PATH[i];
    const owner = s.owners[i];
    const ownerP = owner && s.players.find(p => p.name === owner);
    const q = t.quarter && QUARTERS[t.quarter];
    const cell = h("div", `mp-tile type-${t.type}${s.last?.tile === i && s.phase === "play" ? " landed" : ""}`,
      q ? h("span", "mp-band", "") : h("span", "mp-icon", t.icon || ""),
      h("strong", "mp-tile-name", t.name),
      t.type === "property" ? h("small", "mp-price", owner ? `${stars(s.levels[i])}${s.levels[i] ? " " : ""}loyer ${rentOf(s, i).coins}` : `${t.price} 🪙`) : null,
      h("div", "mp-pawns", s.players.filter(p => (shownPos[p.name] ?? p.pos) === i).map(p => {
        const pawn = h("span", `mp-pawn${s.players[s.current]?.name === p.name ? " active" : ""}`, "");
        pawn.style.background = p.color;
        pawn.title = p.name;
        return pawn;
      })));
    cell.style.gridRow = r;
    cell.style.gridColumn = c;
    if (q) cell.style.setProperty("--q", q.color);
    if (ownerP) { cell.classList.add("owned"); cell.style.setProperty("--owner", ownerP.color); }
    return cell;
  });
  fill(boardEl, cells, centerEl);
}

function renderCenter() {
  const s = state;
  const p = s.players[s.current];
  const items = [h("span", "mp-logo", "🎩 Monopoly Party")];
  if (s.phase === "play" && p) {
    items.push(h("div", "mp-turn", avatarEl(p.name), h("strong", "", p.name)));
    items.push(h("div", `mp-dice${diceRolling ? " rolling" : ""}`, s.dice ? s.dice.map(d => h("span", "", DICE[d])) : [h("span", "", "🎲"), h("span", "", "🎲")]));
    if (s.last && s.rolled) items.push(h("div", "mp-landed", h("strong", "", s.last.name), h("small", "", s.last.text)));
  }
  fill(centerEl, items);
}

// ---------- Panneau d'action ----------

let draft = {};
function renderPanel() {
  const s = state;
  if (s.phase === "intro") {
    fill(panelEl, h("span", "mp-kicker", "🎩 Monopoly Party"), h("h3", "", "Achète les quartiers, fais boire les visiteurs"),
      h("ul", "mp-rules",
        h("li", "", "Chacun son tour : 2 dés (un double = tu rejoues)."),
        h("li", "", "Achète les lieux. Les visiteurs te paient en jetons… et boivent."),
        h("li", "", "Tout un quartier de la même couleur = loyers ×2. Rénove tes lieux (⭐→⭐⭐⭐) pour les faire grimper."),
        h("li", "", `À la fin des ${s.maxRounds < 999 ? `${s.maxRounds} tours` : "tours"}, le plus riche (jetons + lieux) gagne.`)),
      s.players.length > 0 ? h("p", "muted", `${s.players.length} joueurs${(roomPlayers.filter(p => !p.fake).length > 10) ? " (10 max, les autres regardent)" : ""}.`) : null);
    return;
  }
  if (s.phase === "end") {
    const r = s.result.ranking;
    const thirsty = [...s.players].sort((a, b) => b.sips - a.sips)[0];
    const counts = {};
    Object.values(s.owners).forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    const landlord = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!firstState) fx()?.confetti?.();
    fill(panelEl,
      h("span", "mp-kicker", "🏁 Fin de partie"),
      avatarEl(r[0].name, true),
      h("h3", "", `🏆 ${r[0].name}, magnat de la soirée`),
      h("ol", "mp-ranking", r.map(x => h("li", "", h("strong", "", x.name), h("span", "", `${x.wealth} 💰`), h("small", "", `${x.coins} jetons · ${x.sips} gorgées`)))),
      h("div", "mp-awards",
        award("🍺 Le plus assoiffé", thirsty?.sips ? `${thirsty.name} (${thirsty.sips})` : "—"),
        award("🏠 Roi de l'immobilier", landlord ? `${landlord[0]} (${landlord[1]} lieu${landlord[1] > 1 ? "x" : ""})` : "—")));
    return;
  }

  const p = s.players[s.current];
  const mine = p.name === myName;
  const canAct = !spectator && (mine || isHost);
  const pend = s.pending;
  const items = [h("span", "mp-kicker", mine ? "🎲 C'EST TON TOUR" : `🎲 Tour de ${p.name}`)];

  if (!s.rolled) {
    if (canAct) items.push(button(mine ? "🎲 Lancer les dés" : `🎲 Lancer pour ${p.name} (absent)`, () => mutate("roll"), mine ? "btn primary big-btn mp-roll" : "btn secondary"));
    else items.push(h("p", "mp-wait", `${p.name} va lancer les dés…`));
    fill(panelEl, items);
    return;
  }
  if (animating) { items.push(h("p", "mp-wait", "Le pion avance…")); fill(panelEl, items); return; }

  items.push(h("h3", "", s.last?.name || ""), h("p", "mp-lead", s.last?.text || ""));

  if (pend?.type === "buy" && canAct) {
    const t = TILES[pend.tile];
    items.push(h("div", "mp-row",
      button(`🏠 Acheter (${t.price} 🪙)`, () => mutate("buy", { yes: true }), "btn primary", p.coins < t.price),
      button("Passer", () => mutate("buy", { yes: false }))));
  } else if (pend?.type === "challenge" && canAct) {
    items.push(h("div", "mp-row",
      button("✅ Défi réussi (+1 🪙)", () => mutate("challenge", { done: true }), "btn primary"),
      button(`🍺 Je bois (${pend.sips})`, () => mutate("challenge", { done: false }), "btn danger")));
  } else if (pend?.type === "casino" && canAct) {
    items.push(h("div", "mp-row",
      button("🎰 Jouer 2 jetons", () => mutate("casino", { play: true }), "btn primary", p.coins < 2),
      button("Non merci", () => mutate("casino", { play: false }))));
  } else if (pend?.type === "duel") {
    if (!pend.opponent) {
      if (canAct) items.push(h("p", "", "Choisis ton adversaire :"), pickGrid(s.players.filter(o => o !== p), n => mutate("duelPick", { opponent: n })));
      else items.push(h("p", "mp-wait", `${p.name} choisit un adversaire…`));
    } else {
      const duelist = !spectator && (mine || myName === pend.opponent || isHost);
      items.push(h("p", "mp-lead", `⚔️ ${p.name} contre ${pend.opponent} : faites le duel en vrai !`));
      if (duelist) items.push(h("p", "", "Qui a gagné ?"), h("div", "mp-row",
        button(`🏆 ${p.name}`, () => mutate("duelWinner", { winner: p.name }), "btn primary"),
        button(`🏆 ${pend.opponent}`, () => mutate("duelWinner", { winner: pend.opponent }), "btn primary")));
    }
  } else if (pend?.type === "distribute" && canAct) {
    const used = Object.values(draft).reduce((a, b) => a + b, 0);
    items.push(h("strong", "", `Distribue ${pend.sips} gorgées (reste ${pend.sips - used})`));
    s.players.filter(o => o !== p).forEach(o => {
      const n = draft[o.name] || 0;
      items.push(h("div", "mp-dist", avatarEl(o.name), h("span", "", o.name),
        button("−", () => { draft[o.name] = Math.max(0, n - 1); render(); }, "btn small", n === 0),
        h("strong", "", String(n)),
        button("+", () => { draft[o.name] = n + 1; render(); }, "btn small", used >= pend.sips)));
    });
    items.push(button("Valider", () => { const give = draft; draft = {}; mutate("distribute", { give }); }, "btn primary", used !== pend.sips));
  } else if (pend?.type === "swap" && canAct) {
    items.push(h("p", "", "Avec qui échanges-tu ta place ?"), pickGrid(s.players.filter(o => o !== p), n => mutate("swap", { target: n })));
  } else if (pend?.type === "freeUpgrade" && canAct) {
    items.push(h("p", "mp-lead", "🔨 Choisis le lieu à rénover gratuitement dans « Mes lieux »."));
  } else if (pend && !canAct) {
    items.push(h("p", "mp-wait", `${p.name} décide…`));
  }

  if ((!pend || pend.type === "freeUpgrade") && canAct) {
    items.push(button(s.replay && !p.skip ? "🎲 Double : relancer" : "Fin du tour ➡️", () => mutate("end"), "btn primary big-btn"));
  }
  fill(panelEl, items);
}

function pickGrid(list, onPick) {
  return h("div", "mp-grid", list.map(o => {
    const b = h("button", "mp-pick", avatarEl(o.name), h("span", "", o.name));
    b.type = "button";
    b.disabled = busy;
    b.addEventListener("click", () => onPick(o.name));
    return b;
  }));
}

const award = (title, value) => h("div", "mp-award", h("small", "", title), h("strong", "", value));

// Mes lieux (rénovation pendant mon tour).
function renderPlaces() {
  const s = state;
  if (spectator || s.phase !== "play") { fill(myPlacesEl); myPlacesEl.hidden = true; return; }
  const places = Object.keys(s.owners).filter(i => s.owners[i] === myName).map(Number);
  myPlacesEl.hidden = false;
  const p = s.players.find(x => x.name === myName);
  const myTurn = s.players[s.current]?.name === myName;
  const free = myTurn && s.pending?.type === "freeUpgrade";
  fill(myPlacesEl, h("span", "mp-box-title", "🏠 Mes lieux"),
    places.length ? places.map(i => {
      const t = TILES[i];
      const level = s.levels[i] || 0;
      const full = quarterOwned(s, t.quarter, myName);
      return h("div", "mp-place",
        h("span", "mp-place-band", ""),
        h("div", "", h("strong", "", t.name), h("small", "", `${stars(level) || "—"} · loyer ${rentOf(s, i).coins} 🪙${full ? " · quartier ×2" : ""}`)),
        level < MAX_LEVEL && myTurn ? button(free ? "🔨 Gratuit" : `🔨 ${upgradeCost(t)} 🪙`, () => mutate("upgrade", { tile: i }), "btn small primary", !free && p.coins < upgradeCost(t)) : null);
    }).map((el, k) => { el.style.setProperty("--q", QUARTERS[TILES[places[k]].quarter].color); return el; })
      : h("p", "muted", "Aucun lieu pour l'instant. Achète en tombant sur une case libre !"));
}

function renderPlayers() {
  const s = state;
  const sorted = [...s.players].sort((a, b) => wealth(s, b) - wealth(s, a));
  fill(playersEl, sorted.map(p => {
    const places = Object.values(s.owners).filter(n => n === p.name).length;
    const row = h("div", `mp-player${s.players[s.current]?.name === p.name && s.phase === "play" ? " turn" : ""}${p.name === myName ? " me" : ""}`,
      h("span", "mp-color", ""),
      avatarEl(p.name),
      h("div", "mp-player-info", h("strong", "", p.name), h("small", "", `🏠 ${places} · 🍺 ${p.sips}${p.shield ? ` · 🛡️${p.shield}` : ""}${p.skip ? " · 🚔" : ""}`)),
      h("div", "mp-money", h("strong", "", `${p.coins} 🪙`), h("small", "", `${wealth(s, p)} 💰`)));
    row.style.setProperty("--pc", p.color);
    return row;
  }));
}

function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  const s = state;
  const items = [];
  if (s.phase === "intro") items.push(button("Lancer la partie 🎩", () => mutate("start"), "btn primary big-btn", s.players.length < 2));
  if (s.phase === "play") items.push(button("Terminer la partie (classement)", () => { if (confirm("Terminer la partie et afficher le classement ?")) mutate("finish"); }, "btn small"));
  if (s.phase === "end") items.push(button("Rejouer 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  hostEl.hidden = !items.length;
  fill(hostEl, items.length ? [h("span", "mp-host-title", "👑 Hôte"), ...items] : []);
}

let firstState = true;
function render() {
  if (!state) return;
  const s = state;
  roundEl.textContent = s.phase === "play" ? `Tour ${s.round}${s.maxRounds < 999 ? `/${s.maxRounds}` : ""}` : s.phase === "end" ? "Terminé" : "Avant-partie";
  renderCenter();
  renderBoard();
  renderPanel();
  renderPlaces();
  renderPlayers();
  renderHost();
  fill(logEl, (s.log || []).map(line => h("li", "", line)));
  firstState = false;
}

// ---------- Démarrage ----------

onSnapshot(roomRef, snap => {
  if (!snap.exists()) return;
  const data = snap.data();
  if (!spectator && data.gameStarted === false) {
    localStorage.setItem("partyhubReturnLobby", "true");
    window.location.href = "../../index.html";
    return;
  }
  roomPlayers = Array.isArray(data.players) ? data.players : [];
  if (!spectator) ensureGame(data);
  if (data.monopoly) applyState(data.monopoly);
}, error => console.error("Monopoly : synchro impossible", error));

if (!spectator) watchHost(roomCode, savedData, value => { isHost = value; render(); });

$("backToLobbyBtn").addEventListener("click", async () => {
  if (isHost) {
    try {
      await lobbyWrite(updateDoc(roomRef, {
        gameStarted: false, roomStatus: "lobby", screen: "lobby", activeGame: null, gameState: {},
        forceNavigation: { target: "lobby", at: Date.now() }
      }));
    } catch (error) {
      console.error("Erreur retour lobby global :", error);
    }
  }
  localStorage.setItem("partyhubReturnLobby", "true");
  window.location.href = "../../index.html";
});
