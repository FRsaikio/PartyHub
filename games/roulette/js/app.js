// Roulette — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `roulette`) ; chaque action passe par une transaction
// qui applique roulette-logic.js. Chacun fait tourner la roue sur son téléphone, à son tour.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf } from "../../../game-common.js";
import { safeImageSrc } from "../../../html-safe.js";
import { BONUSES, RARE, DUELS, DUEL_FAIL, SPIN_MS, newGame, applyAction } from "./roulette-logic.js";

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

if (spectator) document.body.classList.add("rl-tv");
if (params.get("embed") === "1") document.body.classList.add("rl-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const wheel = $("wheel");
const spinZone = $("rlSpinZone");
const panelEl = $("rlPanel");
const bagEl = $("rlBag");
const boardEl = $("rlBoard");
const hostEl = $("rlHost");
const logEl = $("rlLog");
const turnEl = $("rlTurn");
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
  spin: () => fx()?.sounds?.spin?.(),
  win: () => [523, 659, 784].forEach((f, i) => fx()?.tone?.(f, 0.18, "triangle", 0.7, null, i * 0.12)),
  go: () => fx()?.tone?.(980, 0.08, "square", 0.5),
  bad: () => fx()?.tone?.(170, 0.3, "sawtooth", 0.5)
};

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `rl-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || "🎡";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `rl-toast tone-${tone}`, text);
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
      if (!data.roulette) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.roulette));
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName }, { rng: Math.random, ...settings });
      next.v = (data.roulette.v || 0) + 1;
      t.update(roomRef, { roulette: next });
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
  if (data.roulette && data.roulette.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.roulette && d.roulette.session === s) return;
      t.update(roomRef, { roulette: newGame(d.players || [], s) });
    });
  } catch (error) {
    console.error("Roulette : création de la partie impossible", error);
  }
}

// La roue : quand un nouveau tirage arrive, chaque appareil l'anime depuis l'ancienne position.
let shownSpin = null;
let revealed = true; // le résultat s'affiche à la fin de l'animation
function playWheel(s, instant) {
  const sp = s.spin;
  if (!sp || sp.id === shownSpin) return;
  shownSpin = sp.id;
  if (instant) {
    wheel.style.transition = "none";
    wheel.style.transform = `rotate(${sp.rotation}deg)`;
    void wheel.offsetWidth;
    wheel.style.transition = "";
    revealed = true;
    return;
  }
  revealed = false;
  wheel.style.transition = "none";
  wheel.style.transform = `rotate(${sp.startRotation}deg)`;
  void wheel.offsetWidth;
  wheel.style.transition = "";
  wheel.classList.add("spinning");
  wheel.style.transform = `rotate(${sp.rotation}deg)`;
  sound.spin();
  setTimeout(() => wheel.classList.add("pre-stop"), SPIN_MS - 900);
  setTimeout(() => {
    wheel.classList.remove("spinning", "pre-stop");
    revealed = true;
    duelState = null;
    sound.win();
    if (state?.spin?.victims?.includes(myName)) navigator.vibrate?.([120, 60, 120]);
    if (state?.spin?.rare) { document.body.classList.add("rl-shake"); setTimeout(() => document.body.classList.remove("rl-shake"), 500); }
    render();
  }, SPIN_MS);
}

let firstState = true;
function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  playWheel(next, firstState);
  if (before && !spectator) {
    if (next.phase === "play" && next.current === myName && before.current !== myName) { navigator.vibrate?.([80, 60, 80]); toast("🎡 À toi de faire tourner la roue !", "gold"); }
    const d = next.spin?.duel;
    if (d?.opponent === myName && before.spin?.duel?.opponent !== myName) { navigator.vibrate?.([100, 50, 100]); toast(`⚔️ ${next.spin.by} te défie en duel !`, "gold"); }
    if (next.spin?.given?.[myName] && !before.spin?.given) toast(`🎁 ${next.spin.by} t'envoie ${next.spin.given[myName]} gorgée(s) !`, "bad");
  }
  firstState = false;
  render();
}

// ---------- Rendu ----------

const CAT_ICONS = { BOIS: "🍺", DISTRIBUE: "🎁", DUEL: "⚔️", TOUS: "👥", CHANCE: "🍀", CHAOS: "⚡" };

function render() {
  if (!state) return;
  turnEl.textContent = state.turn ? `Tour ${state.turn}` : "Avant-partie";
  renderSpinZone();
  renderPanel();
  renderBag();
  renderBoard();
  renderHost();
  fill(logEl, (state.log || []).map(line => h("li", "", line)));
}

function renderSpinZone() {
  const s = state;
  if (spectator || s.phase !== "play") { fill(spinZone); return; }
  const sp = s.spin;
  const waiting = sp && !sp.closed;
  if (s.current === myName && !waiting) fill(spinZone, button("Faire tourner la roue 🎡", () => mutate("spin"), "btn primary big-btn rl-spin"));
  else if (!waiting && isHost) fill(spinZone, button(`Faire tourner pour ${s.current} (absent)`, () => mutate("spin"), "btn secondary"));
  else fill(spinZone, h("p", "rl-wait", waiting ? (sp.by === myName ? "" : `Tour de ${sp.by}…`) : `À ${s.current} de faire tourner la roue`));
}

function renderPanel() {
  const s = state;
  if (s.phase === "intro") {
    fill(panelEl,
      h("span", "rl-kicker", "🎡 Roulette"),
      h("h3", "", "Chacun son tour, chacun son destin"),
      h("ul", "rl-cases",
        h("li", "", "🍺 ", h("strong", "", "BOIS"), " : c'est pour toi."),
        h("li", "", "🎁 ", h("strong", "", "DISTRIBUE"), " : tu répartis des gorgées sur ton téléphone."),
        h("li", "", "⚔️ ", h("strong", "", "DUEL"), " : tu choisis un adversaire, duel sur vos deux téléphones."),
        h("li", "", "👥 ", h("strong", "", "TOUS"), " : tout le monde boit."),
        h("li", "", "🍀 ", h("strong", "", "CHANCE"), " : un bonus à garder (bouclier, miroir, cadeau empoisonné)."),
        h("li", "", "⚡ ", h("strong", "", "CHAOS"), " : action chaos pour le groupe.")),
      h("p", "muted", "Événements rares : double spin, mode furie, mort subite, jackpot… Le jeu compte les gorgées de chacun !"));
    return;
  }
  if (s.phase === "end") {
    const ranking = Object.entries(s.sips).sort((a, b) => b[1] - a[1]);
    const st = Object.entries(s.stats);
    const top = key => { const b = st.filter(([, v]) => v[key] > 0).sort((x, y) => y[1][key] - x[1][key])[0]; return b ? `${b[0]} (${b[1][key]})` : "—"; };
    fill(panelEl,
      h("span", "rl-kicker", "🏁 Fin de la roulette"),
      ranking[0] ? avatarEl(ranking[0][0], true) : null,
      h("h3", "", ranking[0] ? `🍻 ${ranking[0][0]} est le plus assoiffé (${ranking[0][1]} gorgées)` : "Fin !"),
      h("div", "rl-awards",
        award("⚔️ Roi du duel", top("duelsWon")),
        award("🎁 Le plus généreux", top("distributed")),
        award("🍀 Accro aux bonus", top("bonusesUsed")),
        award("🎡 A le plus tourné", top("spins"))));
    return;
  }
  const sp = s.spin;
  if (!sp || sp.closed) {
    fill(panelEl, h("span", "rl-kicker", `🎡 Au tour de ${s.current}`), h("h3", "", s.current === myName ? "À toi de jouer !" : `${s.current} va faire tourner la roue…`),
      s.furie ? h("p", "rl-furie", `⚡ MODE FURIE : gorgées ×2 encore ${s.furie} tour${s.furie > 1 ? "s" : ""}`) : null,
      s.sudden ? h("p", "rl-furie", "☠️ MORT SUBITE : le prochain résultat compte double") : null);
    return;
  }
  if (!revealed) {
    fill(panelEl, h("span", "rl-kicker", `🎡 ${sp.by} fait tourner…`), h("h3", "rl-suspense", "…"));
    return;
  }
  const items = [
    h("span", "rl-kicker", `${sp.by} · ${CAT_ICONS[sp.category]} ${sp.category}${sp.mult > 1 ? ` · ×${sp.mult}` : ""}`),
    sp.rare ? h("div", "rl-rare", h("strong", "", RARE[sp.rare].label), h("span", "", RARE[sp.rare].text)) : null,
    sp.text ? h("h3", "", sp.text) : null
  ];
  if (sp.category === "BOIS") items.push(h("p", "rl-result", `🍺 ${sp.by} boit (${sp.sips} gorgées comptées)`));
  if (sp.category === "TOUS") items.push(h("p", "rl-result", `👥 Tout le monde boit (${Math.ceil(sp.sips / 2)} chacun)`));
  if (sp.category === "CHANCE") items.push(h("p", "rl-result", `🍀 ${sp.by} gagne : ${BONUSES[sp.bonus].icon} ${BONUSES[sp.bonus].name}`), h("p", "muted", BONUSES[sp.bonus].text));
  if (sp.jackpot) items.push(h("p", "rl-result", `🎯 Jackpot : ${BONUSES[sp.jackpot].icon} ${BONUSES[sp.jackpot].name} en plus !`));
  if (sp.category === "DISTRIBUE") items.push(distributeBox(s));
  if (sp.category === "DUEL") items.push(duelBox(s));
  if (sp.protectedBy?.length) items.push(h("p", "muted", `Protégé(s) : ${sp.protectedBy.join(", ")}`));
  // Bouclier / miroir : si la punition vient de me tomber dessus.
  const mine = s.bonuses[myName] || [];
  if (!spectator && sp.resolved && sp.victims.includes(myName) && !sp.protectedBy?.includes(myName)) {
    if (mine.includes("shield")) items.push(button("🛡️ Utiliser mon bouclier", () => mutate("bonus", { bonus: "shield" }), "btn secondary"));
    if (mine.includes("mirror")) {
      const select = document.createElement("select");
      s.players.filter(p => p.name !== myName).forEach(p => select.append(new Option(p.name, p.name)));
      items.push(h("div", "rl-row", h("span", "", "🪞 Renvoyer à"), select, button("Renvoyer", () => mutate("bonus", { bonus: "mirror", target: select.value }), "btn small primary")));
    }
  }
  if (sp.resolved && !spectator && (sp.by === myName || isHost)) items.push(button(sp.rare === "double" ? "Rejouer (DOUBLE SPIN) 🔥" : "Joueur suivant ➡️", () => mutate("next"), "btn primary big-btn"));
  fill(panelEl, items);
}

const award = (title, value) => h("div", "rl-award", h("small", "", title), h("strong", "", value));

// DISTRIBUE : le lanceur répartit son budget de gorgées.
let draft = {};
function distributeBox(s) {
  const sp = s.spin;
  const box = h("div", "rl-dist");
  if (sp.resolved) {
    box.append(h("p", "rl-result", `🎁 ${sp.by} distribue : ${Object.entries(sp.given).filter(([, k]) => k > 0).map(([n, k]) => `${n} ${k}`).join(", ")}`));
    return box;
  }
  if (spectator || (sp.by !== myName && !isHost)) { box.append(h("p", "muted", `${sp.by} distribue ${sp.budget} gorgées…`)); return box; }
  const used = Object.values(draft).reduce((a, b) => a + b, 0);
  box.append(h("strong", "", `Distribue ${sp.budget} gorgées (reste ${sp.budget - used})`));
  s.players.filter(p => p.name !== sp.by).forEach(p => {
    const n = draft[p.name] || 0;
    box.append(h("div", "rl-dist-row", avatarEl(p.name), h("span", "", p.name),
      button("−", () => { draft[p.name] = Math.max(0, n - 1); render(); }, "btn small", n === 0),
      h("strong", "rl-count", String(n)),
      button("+", () => { draft[p.name] = n + 1; render(); }, "btn small", used >= sp.budget)));
  });
  box.append(button("Valider la distribution", () => { const give = draft; draft = {}; mutate("distribute", { give }); }, "btn primary", used !== sp.budget));
  return box;
}

// DUEL : choix de l'adversaire puis mini-duel mesuré localement sur chaque téléphone.
let duelState = null; // { phase: "wait"|"go"|"count"|"done", goAt, taps }
function duelBox(s) {
  const sp = s.spin;
  const d = sp.duel;
  const def = DUELS[d.kind];
  const box = h("div", "rl-duel", h("strong", "", `${def.icon} ${def.name}`), h("p", "muted", def.text));
  if (!d.opponent) {
    if (!spectator && (sp.by === myName || isHost)) {
      box.append(h("p", "", "Choisis ton adversaire :"), h("div", "rl-grid", s.players.filter(p => p.name !== sp.by).map(p => {
        const b = h("button", "rl-pick", avatarEl(p.name), h("span", "", p.name));
        b.type = "button";
        b.disabled = busy;
        b.addEventListener("click", () => mutate("duelPick", { opponent: p.name }));
        return b;
      })));
    } else box.append(h("p", "muted", `${sp.by} choisit son adversaire…`));
    return box;
  }
  box.append(h("p", "rl-vs", avatarEl(sp.by), ` ${sp.by}  ⚔️  ${d.opponent} `, avatarEl(d.opponent)));
  if (d.loser) {
    box.append(h("p", "rl-result", `🏆 ${d.loser === sp.by ? d.opponent : sp.by} gagne · ${d.loser} boit ${sp.sips} gorgées`));
    return box;
  }
  const inDuel = myName === sp.by || myName === d.opponent;
  if (!spectator && inDuel && d.scores[myName] == null) box.append(duelPad(d.kind));
  else if (inDuel) box.append(h("p", "muted", "Score envoyé, on attend l'autre…"));
  const scores = Object.entries(d.scores);
  if (scores.length) box.append(h("p", "muted", scores.map(([n, v]) => `${n} : ${d.kind === "reflex" ? (v >= DUEL_FAIL ? "faux départ" : `${v} ms`) : `${v} taps`}`).join(" · ")));
  if (!spectator && (sp.by === myName || isHost) && scores.length === 1) box.append(button("Clore le duel (absent)", () => mutate("closeDuel"), "btn small"));
  return box;
}

function duelPad(kind) {
  const ds = duelState || {};
  const label = kind === "reflex"
    ? ds.phase === "go" ? "TAPE !" : ds.phase === "wait" ? "Attends le vert…" : "Touche pour te préparer"
    : ds.phase === "count" ? `${ds.taps} taps` : ds.phase === "wait" ? "3… 2… 1…" : "Touche pour lancer le sprint";
  const pad = h("button", `rl-pad ${ds.phase || ""}`, label);
  pad.type = "button";
  pad.addEventListener("pointerdown", e => {
    e.preventDefault();
    if (kind === "reflex") {
      if (!duelState) {
        duelState = { phase: "wait" };
        setTimeout(() => { if (duelState?.phase === "wait") { duelState = { phase: "go", goAt: performance.now() }; sound.go(); render(); } }, 1200 + Math.random() * 2600);
      } else if (duelState.phase === "wait") { duelState = { phase: "done" }; sound.bad(); mutate("duelScore", { score: DUEL_FAIL }); return; }
      else if (duelState.phase === "go") { const ms = Math.round(performance.now() - duelState.goAt); duelState = { phase: "done" }; mutate("duelScore", { score: ms }); return; }
    } else {
      if (!duelState) {
        duelState = { phase: "wait", taps: 0 };
        setTimeout(() => {
          duelState = { phase: "count", taps: 0 };
          sound.go();
          render();
          setTimeout(() => { const taps = duelState?.taps || 0; duelState = { phase: "done" }; mutate("duelScore", { score: taps }); }, 5000);
        }, 2100);
      } else if (duelState.phase === "count") {
        duelState.taps += 1;
        pad.textContent = `${duelState.taps} taps`;
        navigator.vibrate?.(8);
        return;
      }
    }
    render();
  });
  return pad;
}

// Mon sac de bonus.
function renderBag() {
  if (spectator || !state || state.phase === "intro") { fill(bagEl); bagEl.hidden = true; return; }
  const mine = state.bonuses[myName] || [];
  bagEl.hidden = false;
  const items = [h("span", "rl-bag-title", "🎒 Tes bonus")];
  if (!mine.length) items.push(h("p", "muted", "Aucun bonus. Tombe sur CHANCE pour en gagner !"));
  mine.forEach((key, i) => {
    const b = BONUSES[key];
    const row = h("div", "rl-bonus", h("span", "rl-bonus-icon", b.icon), h("div", "", h("strong", "", b.name), h("small", "", b.text)));
    if (key === "gift") {
      const select = document.createElement("select");
      state.players.filter(p => p.name !== myName).forEach(p => select.append(new Option(p.name, p.name)));
      row.append(select, button("Offrir", () => mutate("bonus", { bonus: "gift", target: select.value }), "btn small primary"));
    }
    row.dataset.i = i;
    items.push(row);
  });
  fill(bagEl, items);
}

// Le compteur de gorgées.
function renderBoard() {
  const s = state;
  const max = Math.max(1, ...Object.values(s.sips));
  const sorted = [...s.players].sort((a, b) => (s.sips[b.name] || 0) - (s.sips[a.name] || 0));
  fill(boardEl, sorted.map((p, i) => h("div", `rl-board-row${p.name === s.current && s.phase === "play" ? " turn" : ""}${p.name === myName ? " me" : ""}`,
    avatarEl(p.name),
    h("strong", "", p.name),
    h("span", "rl-board-bar", Object.assign(h("i"), { style: `width:${((s.sips[p.name] || 0) / max) * 100}%` })),
    h("em", "", `${s.sips[p.name] || 0} 🍺${i === 0 && s.sips[p.name] ? " 👑" : ""}`),
    (s.bonuses[p.name] || []).length ? h("small", "", (s.bonuses[p.name] || []).map(k => BONUSES[k].icon).join("")) : null)));
}

function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  const s = state;
  const items = [];
  if (s.phase === "intro") items.push(button("Lancer la partie 🎡", () => mutate("start"), "btn primary big-btn", s.players.length < 2));
  if (s.phase === "play") items.push(button("Terminer la partie 🏁", () => { if (confirm("Terminer la roulette et afficher le classement ?")) mutate("end"); }, "btn small"));
  if (s.phase === "end") items.push(button("Rejouer 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  hostEl.hidden = !items.length;
  fill(hostEl, items.length ? [h("span", "rl-host-title", "👑 Hôte"), ...items] : []);
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
  if (data.roulette) applyState(data.roulette);
}, error => console.error("Roulette : synchro impossible", error));

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
