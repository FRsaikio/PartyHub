// « Je n'ai jamais » — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `never`) ; chaque action passe par une transaction
// qui applique never-logic.js. Les réponses restent cachées jusqu'à la révélation.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf, recordGameEnd } from "../../../game-common.js";
import { safeImageSrc } from "../../../html-safe.js";
import { newGame, applyAction, pending } from "./never-logic.js";

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

if (spectator) document.body.classList.add("nv-tv");
if (params.get("embed") === "1") document.body.classList.add("nv-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const stageEl = $("nvStage");
const boardEl = $("nvBoard");
const hostEl = $("nvHost");
const roundEl = $("nvRound");
const historyEl = $("nvHistory");
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
  tick: () => fx()?.tone?.(660, 0.08, "square", 0.4),
  flip: () => [523, 659, 784].forEach((f, i) => fx()?.tone?.(f, 0.15, "triangle", 0.6, null, i * 0.08))
};

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `nv-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || "🥂";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `nv-toast tone-${tone}`, text);
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
      if (!data.never) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.never));
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName }, { rng: Math.random, ...settings });
      next.v = (data.never.v || 0) + 1;
      t.update(roomRef, { never: next });
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
  if (data.never && data.never.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.never && d.never.session === s) return;
      t.update(roomRef, { never: newGame(d.players || [], s, d.gameDuration || "medium") });
    });
  } catch (error) {
    console.error("Je n'ai jamais : création de la partie impossible", error);
  }
}

let firstState = true;
function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  // Fin de partie : journal de soirée (hôte) + XP du joueur.
  if (next.phase === "end" && !spectator) recordGameEnd({ roomCode, gameId: "never", state: next, isHost, myName });
  if (before && before.round !== next.round) { myDid = null; myGuess = null; }
  if (before && !spectator && next.phase === "answer" && before.phase !== "answer") navigator.vibrate?.([60, 40, 60]);
  render();
  firstState = false;
}

// ---------- Rendu ----------

let stageKey = "";

function render() {
  if (!state) return;
  const s = state;
  roundEl.textContent = s.round ? `Question ${s.round}${s.maxRounds < 999 ? `/${s.maxRounds}` : ""}` : "Avant-partie";
  const key = [s.session, s.phase, s.round, s.question, Boolean(s.answers?.[myName])].join("|");
  const fresh = key !== stageKey;
  if (fresh || s.phase === "answer") {
    stageKey = key;
    const builder = { intro: stageIntro, answer: stageAnswer, reveal: stageReveal, end: stageEnd }[s.phase];
    if (builder) fill(stageEl, builder(s));
    if (fresh) { stageEl.classList.remove("nv-pop"); void stageEl.offsetWidth; stageEl.classList.add("nv-pop"); }
  }
  renderBoard();
  renderHost();
  fill(historyEl, [...(s.history || [])].reverse().map(item => h("li", "", h("span", "", item.question), h("strong", "", ` → ${item.count}/${item.total}`))));
}

function stageIntro(s) {
  return h("div", "nv-card",
    h("span", "nv-kicker", "🥂 Je n'ai jamais"),
    h("h3", "", "Réponds en secret, devine, assume."),
    h("ol", "nv-steps",
      h("li", "", "Une phrase « Je n'ai jamais… » s'affiche."),
      h("li", "", "Tu réponds en secret : 🍻 Déjà fait ou 😇 Jamais."),
      h("li", "", "Tu devines combien de joueurs l'ont déjà fait (le plus proche gagne un point)."),
      h("li", "", "3, 2, 1… toutes les réponses sont révélées d'un coup. Ceux qui l'ont fait boivent !")),
    h("p", "muted", isHost ? "Lance la partie quand tout le monde est là." : "L'hôte lance la partie."));
}

let myDid = null;
let myGuess = null;
function stageAnswer(s) {
  const me = s.players.find(p => p.name === myName);
  const card = h("div", `nv-card nv-answer${s.rare ? " rare" : ""}`,
    h("span", "nv-kicker", s.rare ? "⭐ Question rare" : `🥂 Question ${s.round}`),
    h("h3", "nv-question", s.question));
  if (spectator || !me) {
    card.append(h("p", "nv-lead", "Les joueurs répondent en secret…"));
  } else if (s.answers[myName]) {
    card.append(h("p", "nv-lead", "🔒 Réponse cachée jusqu'à la révélation."), h("p", "muted", `Ton pronostic : ${s.answers[myName].guess} joueur${s.answers[myName].guess > 1 ? "s" : ""}`));
  } else {
    const choice = h("div", "nv-choice",
      button("🍻 Déjà fait", () => { myDid = true; navigator.vibrate?.(12); render(); }, `nv-did${myDid === true ? " selected" : ""}`),
      button("😇 Jamais", () => { myDid = false; navigator.vibrate?.(12); render(); }, `nv-never${myDid === false ? " selected" : ""}`));
    const guesses = h("div", "nv-guess", Array.from({ length: s.players.length + 1 }, (_, n) =>
      button(String(n), () => { myGuess = n; render(); }, `nv-num${myGuess === n ? " selected" : ""}`)));
    card.append(choice,
      h("p", "nv-step", "🔮 Combien de joueurs l'ont déjà fait (toi compris) ?"),
      guesses,
      button(myDid === null || myGuess === null ? "Réponds et devine pour valider" : "Valider en secret 🔒", () => mutate("answer", { did: myDid, guess: myGuess }), "btn primary big-btn", myDid === null || myGuess === null));
  }
  const left = pending(s);
  const total = s.players.length;
  card.append(h("div", "nv-progress",
    h("div", "nv-progress-bar", Object.assign(h("span"), { style: `width:${((total - left.length) / total) * 100}%` })),
    h("span", "", `${total - left.length}/${total} ont répondu`)));
  return card;
}

// Révélation : 3, 2, 1… puis toutes les cartes se retournent ensemble.
let revealSeen = null;
function stageReveal(s) {
  const r = s.result;
  const id = `${s.session}:${s.round}`;
  const instant = revealSeen === null && firstState;
  revealSeen = id;
  const count = h("div", "nv-count", "3");
  const grid = h("div", "nv-flip-grid");
  const after = h("div", "nv-after");
  const card = h("div", "nv-card nv-reveal", h("span", "nv-kicker", `🥂 Question ${s.round}`), h("h3", "nv-question small", s.question), count, grid, after);
  const cards = s.players.filter(p => r.guesses[p.name] !== undefined).map(p => {
    const did = r.did.includes(p.name);
    const c = h("div", `nv-flip ${did ? "did" : "never"}`,
      h("div", "nv-flip-inner",
        h("div", "nv-flip-front", avatarEl(p.name, true), h("strong", "", p.name), h("span", "", "?")),
        h("div", "nv-flip-back", avatarEl(p.name, true), h("strong", "", p.name), h("span", "", did ? "🍻 Déjà fait" : "😇 Jamais"), h("small", "", `pari : ${r.guesses[p.name]}`))));
    grid.append(c);
    return c;
  });
  const showAll = () => {
    count.className = `nv-count big ${r.count ? "hot" : "cool"}`;
    count.textContent = `${r.count}/${r.total}`;
    cards.forEach((c, i) => setTimeout(() => c.classList.add("flipped"), instant ? 0 : i * 70));
    fill(after,
      r.punishment ? h("p", "nv-punish", `🍻 ${r.punishment}`) : h("p", "nv-punish cool", "😇 Personne ne l'a jamais fait !"),
      r.bonus ? h("p", "muted", r.bonus) : null,
      r.streaks.length ? h("p", "nv-streak", r.streaks.map(x => `🔥 ${x.name} : ${x.n} « déjà fait » d'affilée !`).join(" ")) : null,
      h("p", "nv-winners", r.winners.length ? `🔮 ${r.exact ? "Pronostic parfait" : "Le plus proche"} : ${r.winners.join(", ")} (+1)` : ""));
    if (!instant) {
      sound.flip();
      if (r.did.includes(myName)) navigator.vibrate?.(200);
      if (r.winners.includes(myName)) toast("🔮 Bien deviné : +1 point !", "gold");
    }
  };
  if (instant) showAll();
  else {
    sound.tick();
    setTimeout(() => { count.textContent = "2"; sound.tick(); }, 700);
    setTimeout(() => { count.textContent = "1"; sound.tick(); }, 1400);
    setTimeout(showAll, 2100);
  }
  return card;
}

function stageEnd(s) {
  const byDid = Object.entries(s.did).sort((a, b) => b[1] - a[1]);
  const byPoints = Object.entries(s.points).sort((a, b) => b[1] - a[1]);
  if (!firstState) fx()?.confetti?.();
  return h("div", "nv-card nv-end",
    h("span", "nv-kicker", "🏁 Fin de partie"),
    byDid[0]?.[1] ? avatarEl(byDid[0][0], true) : null,
    h("h3", "", byDid[0]?.[1] ? `🍻 ${byDid[0][0]} a le plus vécu (${byDid[0][1]} « déjà fait »)` : "Que des anges ici…"),
    h("div", "nv-awards",
      h("div", "nv-award", h("small", "", "🍻 Le plus expérimenté"), h("strong", "", byDid[0]?.[1] ? `${byDid[0][0]} (${byDid[0][1]})` : "—")),
      h("div", "nv-award", h("small", "", "😇 L'ange de la soirée"), h("strong", "", byDid.length ? `${byDid[byDid.length - 1][0]} (${byDid[byDid.length - 1][1]})` : "—")),
      h("div", "nv-award", h("small", "", "🔮 Meilleur pronostiqueur"), h("strong", "", byPoints[0]?.[1] ? `${byPoints[0][0]} (${byPoints[0][1]})` : "—"))));
}

function renderBoard() {
  const s = state;
  const sorted = [...s.players].sort((a, b) => (s.did[b.name] || 0) - (s.did[a.name] || 0));
  fill(boardEl, sorted.map(p => h("div", `nv-member${p.name === myName ? " me" : ""}`,
    avatarEl(p.name),
    h("strong", "", p.name),
    h("span", "nv-stat", `🍻 ${s.did[p.name] || 0}`),
    h("span", "nv-stat", `🔮 ${s.points[p.name] || 0}`),
    (s.streak[p.name] || 0) >= 2 ? h("span", "nv-stat hot", `🔥${s.streak[p.name]}`) : null,
    s.phase === "answer" ? h("span", `nv-check${s.answers[p.name] ? " done" : ""}`, s.answers[p.name] ? "✓" : "…") : null)));
}

function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  const s = state;
  const items = [];
  const left = pending(s);
  if (s.phase === "intro") items.push(button("Lancer la partie 🥂", () => mutate("start"), "btn primary big-btn", s.players.length < 2));
  if (s.phase === "answer") {
    if (left.length) items.push(button(`Révéler sans attendre (${left.join(", ")})`, () => mutate("close"), "btn secondary"));
    items.push(button("Autre question 🔄", () => mutate("skip"), "btn small"));
  }
  if (s.phase === "reveal") items.push(button(s.round >= s.maxRounds ? "Voir le classement final 🏁" : "Question suivante ➡️", () => mutate("next"), "btn primary big-btn"));
  if (s.phase === "answer" || s.phase === "reveal") items.push(button("Terminer la partie", () => { if (confirm("Terminer la partie maintenant ?")) mutate("end"); }, "btn small"));
  if (s.phase === "end") items.push(button("Rejouer 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  hostEl.hidden = !items.length;
  fill(hostEl, items.length ? [h("span", "nv-host-title", "👑 Hôte"), ...items] : []);
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
  if (data.never) applyState(data.never);
}, error => console.error("Je n'ai jamais : synchro impossible", error));

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
