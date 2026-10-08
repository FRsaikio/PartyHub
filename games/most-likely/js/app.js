// Most Likely — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `mostLikely`) ; chaque action passe par une
// transaction qui applique ml-logic.js.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf, recordGameEnd } from "../../../game-common.js";
import { initHowTo } from "../../../how-to-play.js";
import { safeImageSrc } from "../../../html-safe.js";
import { newGame, applyAction, pending } from "./ml-logic.js";

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
const partyMode = (() => {
  const k = String(savedData?.selectedPartyMode || "Party").toLowerCase();
  return k === "chill" ? "Chill" : k === "chaos" ? "Chaos" : k === "hardcore" ? "Hardcore" : "Party";
})();
const settings = { partyMode, drinkLevel: savedData?.drinkLevel || "normal", alcohol: savedData?.alcoholMode !== false };

if (spectator) document.body.classList.add("ml-tv");
if (params.get("embed") === "1") document.body.classList.add("ml-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const stageEl = $("mlStage");
const boardEl = $("mlBoard");
const hostEl = $("mlHost");
const roundEl = $("mlRound");
const historyEl = $("mlHistory");
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
  drum: () => { fx()?.tone?.(110, 0.25, "sine", 0.9); fx()?.tone?.(70, 0.35, "sine", 0.7, null, 0.05); },
  win: () => [523, 659, 784].forEach((f, i) => fx()?.tone?.(f, 0.18, "triangle", 0.7, null, i * 0.12))
};

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `ml-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || "🤔";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `ml-toast tone-${tone}`, text);
  document.body.append(el);
  setTimeout(() => el.classList.add("leaving"), 3200);
  setTimeout(() => el.remove(), 3700);
}

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
      if (!data.mostLikely) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.mostLikely));
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName }, { rng: Math.random, ...settings });
      next.v = (data.mostLikely.v || 0) + 1;
      t.update(roomRef, { mostLikely: next });
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
  if (data.mostLikely && data.mostLikely.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.mostLikely && d.mostLikely.session === s) return;
      t.update(roomRef, { mostLikely: newGame(d.players || [], s, d.gameDuration || "medium") });
    });
  } catch (error) {
    console.error("Most Likely : création de la partie impossible", error);
  }
}

let firstState = true;
function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  // Fin de partie : journal de soirée (hôte) + XP du joueur.
  if (next.phase === "end" && !spectator) recordGameEnd({ roomCode, gameId: "mostLikely", state: next, isHost, myName });
  if (before && before.round !== next.round) { pickVote = null; pickBet = null; }
  if (before && !spectator && next.phase === "vote" && before.phase !== "vote") { navigator.vibrate?.([60, 40, 60]); }
  render();
  firstState = false;
}

// ---------- Rendu ----------

let stageKey = "";

function render() {
  if (!state) return;
  const s = state;
  roundEl.textContent = s.round ? `Manche ${s.round}${s.maxRounds < 999 ? `/${s.maxRounds}` : ""}` : "Avant-partie";
  const key = [s.session, s.phase, s.round, s.question, Boolean(s.votes?.[myName])].join("|");
  if (key !== stageKey || s.phase === "vote") {
    const fresh = key !== stageKey;
    stageKey = key;
    const builder = { intro: stageIntro, vote: stageVote, reveal: stageReveal, end: stageEnd }[s.phase];
    if (builder && (fresh || s.phase === "vote")) {
      fill(stageEl, builder(s));
      if (fresh) { stageEl.classList.remove("ml-pop"); void stageEl.offsetWidth; stageEl.classList.add("ml-pop"); }
    }
  }
  renderBoard();
  renderHost();
  fill(historyEl, [...(s.history || [])].reverse().map(item => h("li", "", h("span", "", item.question), h("strong", "", item.designated ? ` → ${item.designated}` : " → égalité"))));
}

function stageIntro(s) {
  return h("div", "ml-card",
    h("span", "ml-kicker", "🤔 Most Likely"),
    h("h3", "", "Qui est le plus susceptible de… ?"),
    h("ol", "ml-steps",
      h("li", "", "Une question s'affiche."),
      h("li", "", "Tu votes en secret pour la personne qui correspond le mieux…"),
      h("li", "", "…et tu paries sur qui va être désigné (bonne prédiction = 1 point de devin)."),
      h("li", "", "Révélation des votes un par un. Le plus voté prend la punition !")),
    h("p", "muted", isHost ? "Lance la partie quand tout le monde est là." : "L'hôte lance la partie."));
}

let pickVote = null;
let pickBet = null;
function pickGrid(s, selected, onPick) {
  return h("div", "ml-grid", s.players.map(p => {
    const b = h("button", `ml-pick${selected === p.name ? " selected" : ""}`, avatarEl(p.name, true), h("strong", "", p.name === myName ? `${p.name} (toi)` : p.name));
    b.type = "button";
    b.addEventListener("click", () => { onPick(p.name); navigator.vibrate?.(12); render(); });
    return b;
  }));
}

function stageVote(s) {
  const me = s.players.find(p => p.name === myName);
  const card = h("div", "ml-card ml-vote", h("span", "ml-kicker", `🤔 Manche ${s.round}`), h("h3", "ml-question", s.question));
  if (spectator || !me) {
    card.append(h("p", "ml-lead", "Les joueurs votent en secret sur leur téléphone…"));
  } else if (s.votes[myName]) {
    card.append(h("p", "ml-lead", `🔒 Vote : ${s.votes[myName]} · Pari : ${s.predictions[myName]}`), h("p", "muted", "Personne ne voit ton vote avant la révélation."));
  } else {
    card.append(
      h("p", "ml-step", h("span", "", "1"), " Ton vote : qui correspond le mieux ?"),
      pickGrid(s, pickVote, n => { pickVote = n; }),
      h("p", "ml-step", h("span", "", "2"), " Ton pari : qui va être désigné par le groupe ?"),
      pickGrid(s, pickBet, n => { pickBet = n; }),
      button(pickVote && pickBet ? `Valider (vote ${pickVote} · pari ${pickBet})` : "Choisis ton vote et ton pari", () => mutate("vote", { target: pickVote, prediction: pickBet }), "btn primary big-btn", !pickVote || !pickBet));
  }
  const left = pending(s);
  const total = s.players.length;
  card.append(h("div", "ml-progress",
    h("div", "ml-progress-bar", Object.assign(h("span"), { style: `width:${((total - left.length) / total) * 100}%` })),
    h("span", "", `${total - left.length}/${total} ont voté${left.length && left.length <= 4 ? ` · on attend ${left.join(", ")}` : ""}`)));
  return card;
}

// Révélation : les votes un par un, puis le verdict, puis « qui a voté qui ».
const STEP = 1500;
let revealSeen = null;
function stageReveal(s) {
  const r = s.result;
  const id = `${s.session}:${s.round}`;
  const instant = revealSeen === null && firstState;
  revealSeen = id;
  const cards = h("div", "ml-votes");
  const tally = h("div", "ml-tally");
  const verdict = h("div", "ml-verdict");
  const card = h("div", "ml-card ml-reveal", h("span", "ml-kicker", `🗳️ Manche ${s.round}`), h("h3", "ml-question small", s.question), cards, tally, verdict);
  const counts = {};
  const drawTally = () => {
    const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const max = Math.max(1, ...Object.values(counts));
    fill(tally, names.map(n => h("div", "ml-tally-row", h("strong", "", n), h("span", "ml-bar", Object.assign(h("i"), { style: `width:${(counts[n] / max) * 100}%` })), h("em", "", String(counts[n])))));
  };
  const showItem = it => {
    cards.append(h("div", "ml-vote-card", avatarEl(it.target, true), h("strong", "", it.target)));
    counts[it.target] = (counts[it.target] || 0) + 1;
    drawTally();
    if (!instant) sound.drum();
  };
  const showVerdict = () => {
    verdict.className = `ml-verdict ${r.designated ? "hit" : "tie"}`;
    fill(verdict,
      r.designated ? avatarEl(r.designated, true) : null,
      h("strong", "ml-verdict-title", r.designated ? `🎯 ${r.designated} !` : `🤝 Égalité${r.tie?.length ? ` (${r.tie.join(", ")})` : ""}`),
      r.penalty ? h("span", "ml-penalty", `🍻 ${r.penalty}`) : h("span", "muted", "Personne ne boit cette fois."),
      r.designated ? h("span", "ml-prophets", r.prophets.length ? `🔮 Bons devins : ${r.prophets.join(", ")} (+1)` : "🔮 Personne ne l'avait vu venir !") : null,
      h("details", "ml-who",
        h("summary", "", "👀 Qui a voté qui ?"),
        h("ul", "", r.items.map(it => h("li", "", `${it.voter} → ${it.target}`, r.predictions[it.voter] ? h("small", "", ` (pari : ${r.predictions[it.voter]})`) : null)))));
    if (!instant) {
      sound.win();
      if (r.designated === myName) navigator.vibrate?.([200, 80, 200]);
      if (r.prophets.includes(myName)) toast("🔮 Bien vu : +1 point de devin !", "gold");
    }
  };
  if (instant) { r.items.forEach(showItem); showVerdict(); }
  else {
    r.items.forEach((it, k) => setTimeout(() => showItem(it), 900 + k * STEP));
    setTimeout(showVerdict, 900 + r.items.length * STEP + 500);
  }
  return card;
}

function stageEnd(s) {
  const designated = Object.entries(s.scores).sort((a, b) => b[1] - a[1]);
  const prophets = Object.entries(s.prophet).sort((a, b) => b[1] - a[1]);
  if (!firstState) { sound.win(); fx()?.confetti?.(); }
  return h("div", "ml-card ml-end",
    h("span", "ml-kicker", "🏁 Fin de partie"),
    designated[0]?.[1] ? avatarEl(designated[0][0], true) : null,
    h("h3", "", designated[0]?.[1] ? `👑 ${designated[0][0]}, désigné ${designated[0][1]} fois !` : "Personne n'a été désigné…"),
    h("div", "ml-awards",
      h("div", "ml-award", h("small", "", "🎯 Le plus désigné"), h("strong", "", designated[0]?.[1] ? `${designated[0][0]} (${designated[0][1]})` : "—")),
      h("div", "ml-award", h("small", "", "🔮 Meilleur devin"), h("strong", "", prophets[0]?.[1] ? `${prophets[0][0]} (${prophets[0][1]})` : "—")),
      h("div", "ml-award", h("small", "", "😇 Le plus épargné"), h("strong", "", designated.length ? designated[designated.length - 1][0] : "—"))));
}

function renderBoard() {
  const s = state;
  const sorted = [...s.players].sort((a, b) => (s.scores[b.name] || 0) - (s.scores[a.name] || 0));
  fill(boardEl, sorted.map(p => h("div", `ml-member${p.name === myName ? " me" : ""}`,
    avatarEl(p.name),
    h("strong", "", p.name),
    h("span", "ml-stat", `🎯 ${s.scores[p.name] || 0}`),
    h("span", "ml-stat", `🔮 ${s.prophet[p.name] || 0}`),
    s.phase === "vote" ? h("span", `ml-check${s.votes[p.name] ? " done" : ""}`, s.votes[p.name] ? "✓" : "…") : null)));
}

function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  const s = state;
  const items = [];
  const left = pending(s);
  if (s.phase === "intro") items.push(button("Lancer la partie 🤔", () => mutate("start"), "btn primary big-btn", s.players.length < 2));
  if (s.phase === "vote") {
    if (left.length) items.push(button(`Révéler sans attendre (${left.join(", ")})`, () => mutate("close"), "btn secondary"));
    items.push(button("Autre question 🔄", () => mutate("skip"), "btn small"));
  }
  if (s.phase === "reveal") items.push(button(s.round >= s.maxRounds ? "Voir le classement final 🏁" : "Question suivante ➡️", () => mutate("next"), "btn primary big-btn"));
  if (s.phase === "vote" || s.phase === "reveal") items.push(button("Terminer la partie", () => { if (confirm("Terminer la partie maintenant ?")) mutate("end"); }, "btn small"));
  if (s.phase === "end") items.push(button("Rejouer 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  hostEl.hidden = !items.length;
  fill(hostEl, items.length ? [h("span", "ml-host-title", "👑 Hôte"), ...items] : []);
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
  if (data.mostLikely) applyState(data.mostLikely);
}, error => console.error("Most Likely : synchro impossible", error));

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

// Règles du jeu au lancement (bouton ❓ pour les revoir).
initHowTo("mostLikely", { spectator });
