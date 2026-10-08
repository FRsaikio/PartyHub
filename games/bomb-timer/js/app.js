// La Bombe — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `bomb`), chaque action passe par une transaction
// qui applique bomb-logic.js. Le temps est compté localement par chaque téléphone à partir
// de la main reçue (voir bomb-logic.js) : aucune horloge n'est comparée.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf, recordGameEnd } from "../../../game-common.js";
import { initHowTo } from "../../../how-to-play.js";
import { safeImageSrc } from "../../../html-safe.js";
import { MODES, POWERS, BACKUP_DELAY_MS, newGame, applyAction, alive, normalizeWord } from "./bomb-logic.js";

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

if (spectator) document.body.classList.add("bb-tv");
if (params.get("embed") === "1") document.body.classList.add("bb-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const ringEl = $("bbRing");
const promptEl = $("bbPrompt");
const fuseEl = $("bbFuse");
const actionsEl = $("bbActions");
const panelEl = $("bbPanel");
const hostEl = $("bbHost");
const logEl = $("bbLog");
const roundEl = $("bbRound");
const boomEl = $("bbBoom");
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
  tick: hot => fx()?.tone?.(hot ? 1200 : 880, 0.04, "square", hot ? 0.45 : 0.25),
  pass: () => fx()?.tone?.(520, 0.08, "triangle", 0.5),
  boom: () => { fx()?.noise?.(0.7, 600, 1); fx()?.tone?.(60, 0.6, "sawtooth", 0.9); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => fx()?.tone?.(f, 0.2, "triangle", 0.7, null, i * 0.12)),
  no: () => fx()?.tone?.(180, 0.25, "sawtooth", 0.5)
};

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `bb-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || state?.players.find(t => t.name === name)?.avatar || "💣";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `bb-toast tone-${tone}`, text);
  document.body.append(el);
  setTimeout(() => el.classList.add("leaving"), 3000);
  setTimeout(() => el.remove(), 3500);
}

// ---------- Dictionnaire (mode Syllabes, chargé à la demande) ----------

let dict = null;
let dictLoading = null;
function loadDictionary() {
  if (dict) return Promise.resolve(dict);
  dictLoading ||= import("./words.js").then(({ WORDS }) => {
    const words = WORDS.split(/\s+/).map(normalizeWord).filter(w => w.length >= 3);
    const counts = new Map();
    words.forEach(w => {
      for (let size = 2; size <= 3; size++) {
        for (let i = 0; i <= w.length - size; i++) {
          const syl = w.slice(i, i + size);
          counts.set(syl, (counts.get(syl) || 0) + 1);
        }
      }
    });
    // Syllabes assez fréquentes pour être jouables (au moins 40 mots).
    const bank = [...counts.entries()].filter(([syl, n]) => n >= 40 && /[aeiouy]/.test(syl)).map(([syl]) => syl.toUpperCase());
    dict = { set: new Set(words), bank };
    render();
    return dict;
  });
  return dictLoading;
}

async function syllablePool() {
  const d = await loadDictionary();
  const pool = [];
  while (pool.length < 60 && d.bank.length) pool.push(d.bank[Math.floor(Math.random() * d.bank.length)]);
  return pool;
}

// ---------- État, temps local & transactions ----------

let state = null;
let busy = false;
let hand = { id: -1, at: 0, fuse: 0 }; // main reçue : quand (horloge locale) et avec combien de mèche

const remaining = () => hand.fuse - (performance.now() - hand.at);

async function mutate(type, payload = {}) {
  if (spectator || busy) return false;
  busy = true;
  renderActions();
  let committed = null;
  try {
    await runTransaction(db, async t => {
      const snap = await t.get(roomRef);
      const data = snap.data() || {};
      if (!data.bomb) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.bomb));
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName }, { rng: Math.random, ...settings });
      if (JSON.stringify(next) === JSON.stringify(data.bomb)) { committed = null; return; }
      next.v = (data.bomb.v || 0) + 1;
      t.update(roomRef, { bomb: next });
      committed = next;
    });
  } catch (error) {
    if (type !== "explode") { toast(error.message || "Action impossible.", "bad"); sound.no(); }
    if (!error.message) console.error(error);
  } finally {
    busy = false;
    if (committed) applyState(committed);
    else render();
  }
  return Boolean(committed);
}

async function ensureGame(data) {
  const session = data.activeGame?.startedAt || 0;
  if (data.bomb && data.bomb.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.bomb && d.bomb.session === s) return;
      const mode = d.bombGameMode === "syllables" ? "syllables" : "categories";
      t.update(roomRef, { bomb: newGame(d.players || [], s, mode) });
    });
  } catch (error) {
    console.error("Bombe : création de la partie impossible", error);
  }
}

function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  // Fin de partie : journal de soirée (hôte) + XP du joueur.
  if (next.phase === "end" && !spectator) recordGameEnd({ roomCode, gameId: "bomb", state: next, isHost, myName });
  if (next.handId !== hand.id) {
    hand = { id: next.handId, at: performance.now(), fuse: next.fuse };
    wordDraft = "";
  }
  react(before, next);
  render();
}

function react(before, next) {
  if (!before || before.session !== next.session) return;
  if (next.phase === "live" && next.holder !== before.holder) {
    sound.pass();
    if (next.holder === myName) { navigator.vibrate?.([120, 40, 120]); }
  }
  if (next.phase !== before.phase && (next.phase === "boom" || next.phase === "end")) {
    sound.boom();
    navigator.vibrate?.(next.boom?.name === myName ? [400, 100, 400] : 200);
    boomEl.hidden = false;
    boomEl.classList.remove("go");
    void boomEl.offsetWidth;
    boomEl.classList.add("go");
    setTimeout(() => { boomEl.hidden = true; }, 1300);
    if (next.phase === "end") setTimeout(() => { sound.win(); fx()?.confetti?.(); }, 1200);
  }
}

// Boucle de la mèche : affichage, tic-tac, explosion.
let lastTick = 0;
setInterval(() => {
  if (!state || state.phase !== "live") { fuseEl.textContent = ""; document.body.style.removeProperty("--bb-speed"); return; }
  const left = remaining();
  const hot = left <= 5000;
  fuseEl.textContent = hot ? `${Math.max(0, Math.ceil(left / 1000))}` : "??";
  fuseEl.classList.toggle("hot", hot);
  const speed = Math.max(0.18, Math.min(1.2, left / 12000));
  document.body.style.setProperty("--bb-speed", `${speed}s`);
  const now = performance.now();
  if (now - lastTick > speed * 1000) {
    lastTick = now;
    sound.tick(hot);
    if (state.holder === myName && hot) navigator.vibrate?.(30);
  }
  // Celui qui tient la bombe la fait exploser ; les autres en secours, avec du retard.
  const mine = state.holder === myName;
  if ((mine && left <= 0) || (!spectator && left <= -BACKUP_DELAY_MS - (isHost ? 0 : 1500))) {
    if (!busy) mutate("explode", { handId: state.handId });
  }
}, 100);

// ---------- Rendu ----------

const me = () => state?.players.find(p => p.name === myName) || null;

function render() {
  if (!state) { fill(promptEl, h("p", "muted", "La bombe arrive…")); return; }
  roundEl.textContent = state.round ? `Bombe ${state.round}` : "Avant-partie";
  document.body.classList.toggle("bb-live", state.phase === "live");
  document.body.classList.toggle("bb-holding", state.phase === "live" && state.holder === myName);
  renderRing();
  renderPrompt();
  renderActions();
  renderPanel();
  renderHost();
  fill(logEl, (state.log || []).map(line => h("li", "", line)));
}

// Le cercle des joueurs, avec la bombe chez celui qui la tient.
function renderRing() {
  const s = state;
  const n = s.players.length;
  const radius = n <= 6 ? 40 : n <= 12 ? 43 : 45;
  fill(ringEl, s.players.map((p, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const seat = h("div", `bb-seat${p.out ? " out" : ""}${s.phase === "live" && s.holder === p.name ? " holder" : ""}${p.name === myName ? " me" : ""}${s.boom?.name === p.name && s.phase !== "live" ? " boomed" : ""}`,
      avatarEl(p.name),
      h("strong", "", p.name),
      h("span", "bb-lives", p.out ? "👻" : "❤️".repeat(p.lives)));
    seat.style.left = `${50 + radius * Math.cos(angle)}%`;
    seat.style.top = `${50 + radius * Math.sin(angle)}%`;
    if (n > 10) seat.classList.add("small");
    return seat;
  }));
  // Flèche du sens de rotation
  ringEl.dataset.direction = s.direction > 0 ? "cw" : "ccw";
}

function renderPrompt() {
  const s = state;
  if (s.phase === "intro") {
    fill(promptEl,
      h("span", "bb-kicker", `${MODES[s.mode].icon} Mode ${MODES[s.mode].name}`),
      h("h3", "", "Prêts ? La bombe va tourner…"),
      h("p", "bb-lead", MODES[s.mode].text),
      h("p", "muted", `${s.players.length} joueurs · ${s.startLives} vie${s.startLives > 1 ? "s" : ""} chacun. Mèche cachée : elle n'affiche les secondes qu'à la fin !`));
    return;
  }
  if (s.phase === "live") {
    const holderIsMe = s.holder === myName;
    fill(promptEl,
      h("span", "bb-kicker", holderIsMe ? "💣 TU AS LA BOMBE !" : `💣 ${s.holder} a la bombe`),
      s.mode === "syllables"
        ? h("div", "bb-syllable", s.prompt.syllable)
        : h("h3", "", s.prompt.text),
      s.modifier ? h("p", "bb-mod", `${s.modifier.label}${s.modifier.letter ? ` : ${s.modifier.letter}` : ""} — ${s.modifier.instruction}`) : null,
      s.lastPass?.answer ? h("p", "muted", `Dernier mot : ${s.lastPass.answer} (${s.lastPass.from})`) : null,
      s.mode === "syllables" && s.usedWords.length ? h("p", "bb-used", `Déjà pris : ${s.usedWords.slice(-8).join(", ")}`) : null);
    return;
  }
  if (s.phase === "boom") {
    const b = s.boom;
    fill(promptEl,
      h("span", "bb-kicker", "💥 BOUM !"),
      avatarEl(b.name, true),
      h("h3", "", b.eliminated ? `${b.name} est éliminé !` : `${b.name} perd une vie`),
      h("p", "bb-lead", b.eliminated ? "Il devient un fantôme 👻 : il pourra secouer la bombe des autres." : `Il lui reste ${"❤️".repeat(b.lives)}`),
      h("p", "bb-punish", `🍻 ${b.punishment}`));
    return;
  }
  if (s.phase === "end") {
    const st = Object.entries(s.stats || {});
    const top = key => { const b = st.filter(([, v]) => v[key] > 0).sort((x, y) => y[1][key] - x[1][key])[0]; return b ? `${b[0]} (${b[1][key]})` : "—"; };
    fill(promptEl,
      h("span", "bb-kicker", "🏁 Fin de partie"),
      avatarEl(s.result.winner, true),
      h("h3", "bb-winner", `👑 ${s.result.winner}`),
      h("p", "bb-lead", "a survécu à toutes les bombes !"),
      h("div", "bb-awards",
        award("💥 Aimant à bombes", top("booms")),
        award("🏃 Roi de la passe", top("passes")),
        award("⚡ Accro aux pouvoirs", top("powers")),
        award("🚫 Le plus contesté", top("contested")),
        s.mode === "syllables" ? award("🔤 Dictionnaire vivant", top("words")) : null));
  }
}

const award = (title, value) => h("div", "bb-award", h("small", "", title), h("strong", "", value));

// Boutons du joueur (selon qu'il tient la bombe, qu'il est fantôme…).
let wordDraft = "";
function renderActions() {
  if (spectator || !state) { fill(actionsEl); return; }
  const s = state;
  const m = me();
  if (s.phase !== "live" || !m) { fill(actionsEl); return; }
  const items = [];
  const lp = s.lastPass;
  const contestBtn = () => {
    const done = s.contest.includes(myName);
    return button(done ? `Contestation envoyée (${s.contest.length})` : `🚫 Contester la réponse de ${lp.from}`, () => mutate("contest", { handId: s.handId, remaining: remaining() }), "btn secondary", done);
  };
  const canContest = !m.out && s.mode !== "syllables" && lp && lp.handId === s.handId && lp.from !== myName;
  if (s.holder === myName) {
    if (canContest) items.push(contestBtn());
    if (s.mode === "syllables") {
      const input = h("input", "bb-word");
      input.type = "text";
      input.autocomplete = "off";
      input.autocapitalize = "none";
      input.placeholder = `Un mot avec ${s.prompt.syllable}…`;
      input.value = wordDraft;
      input.addEventListener("input", () => { wordDraft = input.value; });
      const send = () => {
        const word = normalizeWord(input.value);
        if (!dict) { toast("Dictionnaire en chargement…"); loadDictionary(); return; }
        if (!dict.set.has(word)) { toast("Mot absent du dictionnaire.", "bad"); sound.no(); input.select(); return; }
        mutate("pass", { handId: s.handId, remaining: remaining(), word });
      };
      input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); send(); } });
      items.push(h("div", "bb-word-row", input, button("Valider 💣", send, "btn primary")));
      setTimeout(() => { if (document.activeElement !== input) input.focus(); }, 0);
    } else {
      items.push(button("J'ai répondu : je passe 💣", () => mutate("pass", { handId: s.handId, remaining: remaining() }), "btn primary bb-pass"));
    }
    items.push(button(s.powers[myName] ? `Pouvoir utilisé (${POWERS[s.powers[myName]].icon})` : "⚡ Pouvoir surprise", () => mutate("power", { handId: s.handId, remaining: remaining() }), "btn secondary", Boolean(s.powers[myName])));
  } else if (!m.out) {
    if (canContest) items.push(contestBtn());
    items.push(h("p", "bb-wait", `Prépare-toi… la bombe est chez ${s.holder}.`));
  } else {
    items.push(button(s.ghosts[myName] ? "👻 Bombe déjà secouée" : "👻 Secouer la bombe (-3 s)", () => mutate("shake", { handId: s.handId, remaining: remaining() }), "btn secondary", Boolean(s.ghosts[myName])));
  }
  fill(actionsEl, items);
}

function renderPanel() {
  const s = state;
  if (spectator) { fill(panelEl); return; }
  if (s.phase === "boom" && (isHost || s.boom?.name === myName)) {
    fill(panelEl, button("Nouvelle bombe 💣", async () => {
      const pool = state.mode === "syllables" ? await syllablePool() : undefined;
      mutate("next", { pool });
    }, "btn primary big-btn"));
  } else if (s.phase === "boom") {
    fill(panelEl, h("p", "bb-wait", `${s.boom.name} ou l'hôte relance la bombe.`));
  } else fill(panelEl);
}

function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  const s = state;
  const items = [];
  if (s.phase === "intro" || s.phase === "boom") {
    items.push(h("span", "bb-host-title", "👑 Hôte · mode de jeu"));
    items.push(h("div", "bb-modes", Object.entries(MODES).map(([key, m]) => {
      const b = button(`${m.icon} ${m.name}`, () => mutate("mode", { mode: key }), `btn small ${s.mode === key ? "primary" : "secondary"}`);
      return b;
    })));
  }
  if (s.phase === "intro") {
    items.push(button("Lancer la bombe 💣", async () => {
      const pool = s.mode === "syllables" ? await syllablePool() : undefined;
      mutate("start", { pool });
    }, "btn primary big-btn", s.players.length < 2));
  }
  if (s.phase === "end") items.push(button("Rejouer 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  hostEl.hidden = !items.length;
  fill(hostEl, items);
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
  if (data.bomb) {
    if (data.bomb.mode === "syllables" && !spectator) loadDictionary();
    applyState(data.bomb);
  } else render();
}, error => console.error("Bombe : synchro impossible", error));

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

render();

// Règles du jeu au lancement (bouton ❓ pour les revoir).
initHowTo("bomb", { spectator });
