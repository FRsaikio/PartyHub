// Blind test — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `blindtest`). La musique sort de la TV si un écran
// TV est ouvert (il le signale via le champ `blindTv`), sinon du téléphone de l'hôte.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf, recordGameEnd } from "../../../game-common.js";
import { safeImageSrc } from "../../../html-safe.js";
import { newGame, applyAction, pending, current, ANSWER_WINDOW, ROUND_CHOICES } from "./bt-logic.js";
import { THEMES, buildRounds, freshPreview } from "./bt-deezer.js";

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
const isTv = params.get("tv") === "1";
const roomCode = params.get("room") || savedData?.roomCode || "";
if (!roomCode || (!savedData && !spectator)) {
  window.location.href = "../../index.html";
  throw new Error("Aucune partie trouvée.");
}

const myName = spectator ? "" : savedData.currentPlayer || savedData.playerName || "";
let isHost = !spectator && resolveIsHost(savedData);

if (spectator) document.body.classList.add("bt-tv");
if (params.get("embed") === "1") document.body.classList.add("bt-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const stageEl = $("btStage");
const boardEl = $("btBoard");
const hostEl = $("btHost");
const roundEl = $("btRound");
const soundEl = $("btSound");
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
  b.addEventListener("click", () => { unlockAudio(); onClick(); });
  return b;
}

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `bt-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || "🎧";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `bt-toast tone-${tone}`, text);
  document.body.append(el);
  setTimeout(() => el.classList.add("leaving"), 3200);
  setTimeout(() => el.remove(), 3700);
}

// ---------- Le son ----------

const audio = new Audio();
audio.preload = "auto";
let audioUnlocked = false;
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

// Les navigateurs n'autorisent le son qu'après un geste : on « débloque » au premier clic.
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  if (audio.src && !audio.paused) return;
  audio.src = SILENCE;
  audio.play().catch(() => {});
}

// TV présente ? Elle met à jour `blindTv` toutes les 15 s ; on mesure avec NOTRE montre
// depuis quand ce champ n'a pas bougé.
let tvSign = null;
let tvSeenAt = 0;
const tvAlive = () => Date.now() - tvSeenAt < 40000;
const iPlayMusic = () => isTv || (!spectator && isHost && !tvAlive());

let playingRound = null;
async function playRound(s) {
  const round = current(s);
  if (!round || !iPlayMusic()) return;
  const id = `${s.session}:${s.index}`;
  if (playingRound === id) return;
  playingRound = id;
  try {
    const url = await freshPreview(round.trackId);
    if (playingRound !== id) return;
    audio.src = url;
    audio.currentTime = 0;
    await audio.play();
    soundEl.hidden = true;
  } catch (error) {
    // Lecture bloquée (pas encore de geste) : bouton pour lancer le son.
    console.warn("Blind test : lecture impossible", error);
    soundEl.hidden = false;
  }
}

soundEl.addEventListener("click", () => {
  const playing = state && (state.phase === "listen" || state.phase === "reveal");
  if (!playing || !audio.src || audio.src === SILENCE) {
    // Rien à jouer pour l'instant : on débloque le son pour la suite.
    audioUnlocked = true;
    audio.src = SILENCE;
    audio.play().catch(() => {});
    soundEl.hidden = true;
    playingRound = null;
    if (playing) playRound(state);
    return;
  }
  audio.play().then(() => { soundEl.hidden = true; }).catch(() => {
    playingRound = null;
    playRound(state);
  });
});

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
      if (!data.blindtest) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.blindtest));
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName });
      next.v = (data.blindtest.v || 0) + 1;
      t.update(roomRef, { blindtest: next });
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
  if (data.blindtest && data.blindtest.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.blindtest && d.blindtest.session === s) return;
      t.update(roomRef, { blindtest: newGame(d.players || [], s, d.gameDuration || "medium") });
    });
  } catch (error) {
    console.error("Blind test : création de la partie impossible", error);
  }
}

let roundSeenAt = 0; // heure locale de réception de la manche (pour chronométrer la réponse)
let firstState = true;
function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  // Fin de partie : journal de soirée (hôte) + XP du joueur.
  if (next.phase === "end" && !spectator) recordGameEnd({ roomCode, gameId: "blindtest", state: next, isHost, myName });
  const newRound = !before || before.index !== next.index || before.phase !== next.phase;
  if (next.phase === "listen" && newRound) {
    roundSeenAt = performance.now();
    autoClosed = false;
    if (!spectator && before) navigator.vibrate?.(60);
  }
  if (next.phase === "listen" || next.phase === "reveal") playRound(next);
  if (next.phase === "end" || next.phase === "intro") { audio.pause(); playingRound = null; }
  if (before && next.phase === "reveal" && before.phase !== "reveal" && !spectator) {
    const mine = next.reveal.results.find(r => r.name === myName);
    if (mine?.ok) { navigator.vibrate?.([60, 40, 60]); toast(`✅ +${mine.pts} points !`, "gold"); }
  }
  render();
  firstState = false;
}

// Fin du temps : l'hôte révèle automatiquement après la fenêtre de réponse (+ marge).
let autoClosed = false;
setInterval(() => {
  if (!state || state.phase !== "listen") return;
  const left = Math.max(0, ANSWER_WINDOW + 5000 - (performance.now() - roundSeenAt));
  const bar = document.querySelector(".bt-timer i");
  if (bar) bar.style.width = `${(left / (ANSWER_WINDOW + 5000)) * 100}%`;
  if (left <= 0 && isHost && !spectator && !autoClosed && !busy) { autoClosed = true; mutate("close"); }
}, 250);

// ---------- Rendu ----------

let stageKey = "";
function render() {
  if (!state) return;
  const s = state;
  roundEl.textContent = s.phase === "intro" ? "Avant-partie" : s.phase === "end" ? "Terminé" : `Extrait ${s.index + 1}/${s.rounds.length}`;
  const key = [s.session, s.phase, s.index, (s.themes || []).join(), s.maxRounds, s.answers?.[myName] !== undefined, isHost, busy, tvAlive()].join("|");
  if (key !== stageKey || s.phase === "listen") {
    const fresh = key.split("|").slice(0, 3).join() !== stageKey.split("|").slice(0, 3).join();
    stageKey = key;
    const builder = { intro: stageIntro, listen: stageListen, reveal: stageReveal, end: stageEnd }[s.phase];
    if (builder) fill(stageEl, builder(s));
    if (fresh) { stageEl.classList.remove("bt-pop"); void stageEl.offsetWidth; stageEl.classList.add("bt-pop"); }
  }
  renderBoard();
  renderHost();
}

const themesOf = s => (s.themes?.length ? s.themes : ["mix"]).filter(k => THEMES[k]);

function stageIntro(s) {
  const chosen = themesOf(s);
  const card = h("div", "bt-card",
    h("span", "bt-kicker", "🎧 Blind test"),
    h("h3", "", "Écoutez, trouvez, soyez le plus rapide"),
    h("p", "bt-lead", `${s.maxRounds} extraits de 30 s. 4 propositions sur ton téléphone : plus tu réponds vite, plus tu marques (de 500 à 1000 points).`),
    h("p", "muted", isTv ? "🔊 La musique sort de cet écran TV." : tvAlive() ? "🔊 La musique sortira de l'écran TV." : "🔊 Pas d'écran TV : la musique sortira du téléphone de l'hôte (branche-le sur une enceinte !)."));
  if (isHost && !spectator) {
    card.append(
      h("strong", "", "Thèmes (coche-en autant que tu veux) :"),
      h("div", "bt-themes", Object.entries(THEMES).map(([key, t]) =>
        button(`${chosen.includes(key) ? "✓ " : ""}${t.icon} ${t.name}`, () => mutate("theme", { theme: key }), `bt-theme${chosen.includes(key) ? " selected" : ""}`))),
      h("strong", "", "Nombre d'extraits :"),
      h("div", "bt-counts", ROUND_CHOICES.map(n =>
        button(String(n), () => mutate("count", { count: n }), `bt-theme${s.maxRounds === n ? " selected" : ""}`))));
  } else {
    card.append(h("div", "bt-chips", chosen.map(k => h("span", "bt-chip", `${THEMES[k].icon} ${THEMES[k].name}`))));
  }
  return card;
}

const CHOICE_COLORS = ["c0", "c1", "c2", "c3"];
function stageListen(s) {
  const round = current(s);
  const theme = THEMES[round.theme] || THEMES.mix;
  const answered = s.answers[myName];
  const total = s.players.length;
  const left = pending(s).length;
  const card = h("div", "bt-card bt-listen",
    h("span", "bt-kicker", `${theme.icon} ${theme.name} · extrait ${s.index + 1}/${s.rounds.length}`),
    h("div", "bt-eq", Array.from({ length: 12 }, () => h("i"))),
    h("div", "bt-timer", h("i")));
  if (spectator || !s.players.some(p => p.name === myName)) {
    card.append(h("h3", "", "Qu'est-ce que c'est ?"), h("div", "bt-choices view", round.choices.map((c, i) => h("div", `bt-choice ${CHOICE_COLORS[i]}`, c))));
  } else if (answered !== undefined) {
    card.append(h("h3", "", "🔒 Réponse envoyée"), h("p", "bt-lead", `« ${round.choices[answered.choice]} » en ${(answered.ms / 1000).toFixed(1)} s`));
  } else {
    card.append(h("h3", "", "Qu'est-ce que c'est ?"), h("div", "bt-choices", round.choices.map((c, i) => {
      const b = h("button", `bt-choice ${CHOICE_COLORS[i]}`, c);
      b.type = "button";
      b.disabled = busy;
      b.addEventListener("click", () => { const ms = Math.round(performance.now() - roundSeenAt); navigator.vibrate?.(15); mutate("answer", { choice: i, ms }); });
      return b;
    })));
  }
  card.append(h("p", "muted", `${total - left}/${total} ont répondu`));
  return card;
}

function stageReveal(s) {
  const round = current(s);
  const r = s.reveal;
  const mine = r.results.find(x => x.name === myName);
  const cover = safeImageSrc(round.cover);
  const label = round.choices[round.answer];
  const same = (a, b) => !b || label.toLowerCase().includes(String(b).toLowerCase());
  const card = h("div", "bt-card bt-reveal",
    h("span", "bt-kicker", `🎵 Réponse · extrait ${s.index + 1}/${s.rounds.length}`),
    h("div", "bt-track",
      cover ? Object.assign(h("img", "bt-cover"), { src: cover, alt: "" }) : h("span", "bt-cover empty", "🎵"),
      h("div", "", h("strong", "", label), same(label, round.title) ? null : h("span", "", round.title), same(label, round.artist) ? null : h("small", "", round.artist))),
    h("div", "bt-choices view", round.choices.map((c, i) => h("div", `bt-choice ${CHOICE_COLORS[i]}${i === round.answer ? " right" : " wrong"}`, c))),
    mine ? h("p", `bt-mine ${mine.ok ? "ok" : "ko"}`, mine.ok ? `✅ Bien joué : +${mine.pts} points (${(mine.ms / 1000).toFixed(1)} s)` : "❌ Raté…") : null,
    r.fastest ? h("p", "bt-fastest", `⚡ Le plus rapide : ${r.fastest}`) : h("p", "muted", "Personne n'a trouvé !"));
  return card;
}

function stageEnd(s) {
  const ranking = Object.entries(s.scores).sort((a, b) => b[1] - a[1]);
  const fast = Object.entries(s.fastest).sort((a, b) => b[1] - a[1])[0];
  const right = Object.entries(s.correct).sort((a, b) => b[1] - a[1])[0];
  if (!firstState) window.PartyHubFX?.confetti?.();
  return h("div", "bt-card bt-end",
    h("span", "bt-kicker", "🏁 Fin du blind test"),
    ranking[0] ? avatarEl(ranking[0][0], true) : null,
    h("h3", "", ranking[0] ? `🏆 ${ranking[0][0]} (${ranking[0][1]} pts)` : "Fin !"),
    h("ol", "bt-podium", ranking.map(([n, pts]) => h("li", "", h("strong", "", n), h("span", "", `${pts} pts`)))),
    h("div", "bt-awards",
      h("div", "bt-award", h("small", "", "⚡ Doigt le plus rapide"), h("strong", "", fast ? `${fast[0]} (${fast[1]})` : "—")),
      h("div", "bt-award", h("small", "", "🎯 Oreille absolue"), h("strong", "", right?.[1] ? `${right[0]} (${right[1]}/${Math.max(1, s.index + 1)})` : "—"))));
}

function renderBoard() {
  const s = state;
  const sorted = [...s.players].sort((a, b) => (s.scores[b.name] || 0) - (s.scores[a.name] || 0));
  fill(boardEl, sorted.map((p, i) => h("div", `bt-member${p.name === myName ? " me" : ""}`,
    h("span", "bt-rank", String(i + 1)),
    avatarEl(p.name),
    h("strong", "", p.name),
    h("span", "bt-pts", `${s.scores[p.name] || 0}`),
    s.phase === "listen" ? h("span", `bt-check${s.answers[p.name] !== undefined ? " done" : ""}`, s.answers[p.name] !== undefined ? "✓" : "…") : null)));
}

let preparing = false;
function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  const s = state;
  const items = [];
  if (s.phase === "intro") items.push(button(preparing ? "Préparation des extraits…" : "Lancer le blind test 🎧", async () => {
    preparing = true;
    render();
    try {
      const rounds = await buildRounds(themesOf(s), s.maxRounds);
      await mutate("start", { rounds });
    } catch (error) {
      toast(error.message || "Impossible de charger la musique.", "bad");
    } finally {
      preparing = false;
      render();
    }
  }, "btn primary big-btn", preparing));
  if (s.phase === "listen") items.push(button(`Révéler la réponse${pending(s).length ? ` (${pending(s).length} sans réponse)` : ""}`, () => mutate("close")));
  if (s.phase === "reveal") items.push(button(s.index + 1 >= s.rounds.length ? "Voir le classement 🏁" : "Extrait suivant ⏭️", () => mutate("next"), "btn primary big-btn"));
  if (s.phase === "listen" || s.phase === "reveal") items.push(button("Terminer la partie", () => { if (confirm("Terminer le blind test ?")) mutate("end"); }, "btn small"));
  if (s.phase === "end") items.push(button("Rejouer 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  if (iPlayMusic() && s.phase !== "intro" && s.phase !== "end") items.push(h("small", "muted", "🔊 La musique sort de ton téléphone."));
  hostEl.hidden = !items.length;
  fill(hostEl, items.length ? [h("span", "bt-host-title", "👑 Hôte"), ...items] : []);
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
  const sign = JSON.stringify(data.blindTv ?? null);
  if (sign !== tvSign) { if (tvSign !== null || data.blindTv) tvSeenAt = Date.now(); tvSign = sign; }
  if (!spectator) ensureGame(data);
  if (data.blindtest) applyState(data.blindtest);
}, error => console.error("Blind test : synchro impossible", error));

// L'écran TV signale sa présence (c'est lui qui jouera la musique).
if (isTv) {
  const beat = () => updateDoc(roomRef, { blindTv: Date.now() }).catch(() => {});
  beat();
  setInterval(beat, 15000);
  soundEl.hidden = false; // la TV a besoin d'un clic pour avoir le droit de jouer du son
}

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
