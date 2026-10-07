// Chaos Kings — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `kings`) ; chaque action passe par une transaction
// qui applique kings-logic.js.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf } from "../../../game-common.js";
import { safeImageSrc } from "../../../html-safe.js";
import { newGame, applyAction, parseCard, matesOf, REFLEX_FAIL } from "./kings-logic.js";

const withMates = (s, name) => { const m = matesOf(s, name); return m.length ? ` (+ ${m.join(", ")})` : ""; };

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
const settings = { partyMode, drinkLevel: savedData?.drinkLevel || "normal" };

if (spectator) document.body.classList.add("ck-tv");
if (params.get("embed") === "1") document.body.classList.add("ck-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const cardEl = $("ckCard");
const cupEl = $("ckCup");
const deckEl = $("ckDeck");
const chaosEl = $("ckChaos");
const panelEl = $("ckPanel");
const playersEl = $("ckPlayers");
const rulesEl = $("ckRules");
const logEl = $("ckLog");
const hostEl = $("ckHost");
const turnEl = $("ckTurn");
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
  flip: () => fx()?.tone?.(420, 0.08, "triangle", 0.5),
  king: () => [392, 523, 659].forEach((f, i) => fx()?.tone?.(f, 0.25, "triangle", 0.8, null, i * 0.15)),
  go: () => fx()?.tone?.(980, 0.08, "square", 0.5),
  bad: () => fx()?.tone?.(170, 0.3, "sawtooth", 0.5)
};

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `ck-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || "👑";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `ck-toast tone-${tone}`, text);
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
      if (!data.kings) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.kings));
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName }, { rng: Math.random, ...settings });
      next.v = (data.kings.v || 0) + 1;
      t.update(roomRef, { kings: next });
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
  if (data.kings && data.kings.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.kings && d.kings.session === s) return;
      t.update(roomRef, { kings: newGame(d.players || [], s) });
    });
  } catch (error) {
    console.error("Chaos Kings : création de la partie impossible", error);
  }
}

function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  react(before, next);
  render();
}

function react(before, next) {
  if (!before || before.session !== next.session) return;
  if (next.turn !== before.turn) reflexState = null; // nouvelle carte : nouvelle course
  if (next.turn !== before.turn) {
    flipCard();
    const card = next.drawn && parseCard(next.drawn.code);
    if (card?.key === "K") sound.king(); else sound.flip();
    if (next.drawn?.mech === "reflex" && !spectator) navigator.vibrate?.([60, 40, 60]);
  }
  if (next.phase === "play" && next.current === myName && before.current !== myName) {
    navigator.vibrate?.([80, 60, 80]);
    toast("🃏 À toi de piocher !", "gold");
  }
  if (next.drawn?.target === myName && before.drawn?.target !== myName) { navigator.vibrate?.(300); toast(`🍻 ${next.drawn.by} te fait boire !`, "bad"); }
  if (next.drawn?.loser === myName && before.drawn?.loser !== myName) { navigator.vibrate?.(300); toast("🐢 Tu es le plus lent : tu bois !", "bad"); }
  if (next.phase === "final" && before.phase !== "final") fx()?.confetti?.();
}

function flipCard() {
  cardEl.classList.remove("flip");
  void cardEl.offsetWidth;
  cardEl.classList.add("flip");
}

// ---------- Rendu ----------

function render() {
  if (!state) return;
  const s = state;
  turnEl.textContent = s.turn ? `Carte ${s.turn}` : "Avant-partie";
  renderCard();
  renderTable();
  renderPanel();
  renderPlayers();
  renderRules();
  renderHost();
  fill(logEl, (s.log || []).map(line => h("li", "", line)));
}

function renderCard() {
  const s = state;
  if (!s.drawn) {
    cardEl.className = "ck-card back";
    fill(cardEl, h("span", "ck-card-logo", "👑"));
    return;
  }
  const card = parseCard(s.drawn.code);
  const red = card.suit === "♥" || card.suit === "♦";
  cardEl.className = `ck-card${card.special ? " special" : ""}${red ? " red" : ""}${card.key === "K" ? " king" : ""}${cardEl.classList.contains("flip") ? " flip" : ""}`;
  fill(cardEl,
    h("span", "ck-corner", card.special ? card.icon : `${card.value}${card.suit}`),
    h("span", "ck-card-icon", card.special ? card.icon : card.suit),
    h("strong", "ck-card-name", card.special ? card.name : `${card.value} · ${card.name}`),
    h("span", "ck-corner bottom", card.special ? card.icon : `${card.value}${card.suit}`));
}

// La coupe (4 rois), le paquet et la jauge de chaos.
function renderTable() {
  const s = state;
  cupEl.style.setProperty("--fill", `${(s.kings / 4) * 100}%`);
  fill(cupEl.querySelector(".ck-cup-label"), `${s.kings}/4 rois`);
  fill(deckEl, `🂠 ${s.deck.length} cartes`);
  chaosEl.style.setProperty("--chaos", `${s.chaos}%`);
  chaosEl.querySelector("em").textContent = `${s.chaos}%`;
}

let ruleDraft = "";
let reflexState = null; // { phase: "wait"|"go"|"done", goAt }

function renderPanel() {
  const s = state;
  const d = s.drawn;
  const items = [];
  if (s.phase === "intro") {
    items.push(h("span", "ck-kicker", "👑 Chaos Kings"),
      h("h3", "", "Le paquet est prêt"),
      h("p", "ck-lead", "Chacun pioche à son tour. Certaines cartes se jouent sur tous les téléphones : 4 et 7 (le plus lent boit), 2 (tu choisis qui boit), 8 (ton pote), Valet (ta règle), Dame (maître des questions). Le 4e roi boit la Chaos Cup !"),
      h("p", "muted", isHost ? "Lance la partie quand tout le monde est prêt." : "L'hôte lance la partie."));
    fill(panelEl, items);
    return;
  }
  if (s.phase === "end") {
    const st = Object.entries(s.stats || {});
    const top = key => { const b = st.filter(([, v]) => v[key] > 0).sort((x, y) => y[1][key] - x[1][key])[0]; return b ? `${b[0]} (${b[1][key]})` : "—"; };
    fill(panelEl,
      h("span", "ck-kicker", "🏁 Fin de partie"),
      h("h3", "", `${s.drawn?.by || "?"} a bu la Chaos Cup !`),
      h("div", "ck-awards",
        award("👑 Collectionneur de rois", top("kings")),
        award("🎯 Cible préférée", top("targeted")),
        award("🐢 Le plus lent", top("reflexLost")),
        award("📜 Législateur", top("rules")),
        award("✨ Aimant à cartes spéciales", top("specials"))));
    return;
  }
  if (s.phase === "final") {
    fill(panelEl,
      h("span", "ck-kicker", "👑👑👑👑 CHAOS CUP"),
      avatarEl(d.by, true),
      h("h3", "", `${d.by} a pioché le 4e roi !`),
      h("p", "ck-lead", "Il doit boire la Chaos Cup, remplie par les 4 rois de la soirée."),
      h("p", "muted", `Ont versé dans la coupe : ${s.cup.join(", ")}`),
      !spectator && (d.by === myName || isHost) ? button("La coupe est bue 🏆", () => mutate("finish"), "btn primary big-btn") : null);
    return;
  }

  // Partie en cours
  if (!d || d.closed) {
    items.push(h("span", "ck-kicker", s.current === myName ? "🃏 À TOI !" : `🃏 Au tour de ${s.current}`));
    items.push(h("h3", "", s.current === myName ? "Pioche une carte" : `${s.current} va piocher…`));
    if (!spectator && (s.current === myName || isHost)) items.push(button(s.current === myName ? "Piocher 🃏" : `Piocher pour ${s.current} (absent)`, () => mutate("draw"), s.current === myName ? "btn primary big-btn ck-draw" : "btn secondary"));
    if (d) items.push(h("p", "muted", `Dernière carte : ${parseCard(d.code).name} (${d.by})`));
    fill(panelEl, items);
    return;
  }

  const card = parseCard(d.code);
  const drawer = d.by === myName;
  items.push(h("span", "ck-kicker", `${d.by} · ${card.name}`),
    s.rare ? h("p", "ck-rare", s.rare) : null,
    h("p", "ck-scenario", d.scenario.text),
    h("p", "ck-consequence", `👉 ${d.scenario.consequence}`));

  if (d.mech === "target" || d.mech === "mate") {
    if (d.done) items.push(h("p", "ck-result", d.mech === "target" ? `🎯 ${d.by} fait boire ${d.target}${withMates(s, d.target)}` : `🤝 ${d.by} et ${d.mate} sont potes`));
    else if (!spectator && (drawer || isHost)) {
      items.push(h("strong", "", d.mech === "target" ? "Qui doit boire ?" : "Choisis ton pote :"),
        h("div", "ck-grid", s.players.filter(p => p.name !== d.by).map(p => {
          const b = h("button", "ck-pick", avatarEl(p.name), h("span", "", p.name));
          b.type = "button";
          b.disabled = busy;
          b.addEventListener("click", () => mutate(d.mech, { target: p.name }));
          return b;
        })));
    } else items.push(h("p", "muted", `${d.by} choisit…`));
  }

  if (d.mech === "rule") {
    if (d.done) items.push(h("p", "ck-result", `📜 Nouvelle règle : « ${d.rule} »`));
    else if (!spectator && (drawer || isHost)) {
      const input = h("input", "ck-rule-input");
      input.type = "text";
      input.maxLength = 120;
      input.placeholder = "Ex : interdit de dire « boire »";
      input.value = ruleDraft;
      input.addEventListener("input", () => { ruleDraft = input.value; });
      items.push(h("strong", "", "Écris ta règle (elle s'affiche partout) :"),
        h("div", "ck-rule-row", input, button("Valider 📜", () => { const t = ruleDraft; ruleDraft = ""; mutate("rule", { text: t }); }, "btn primary")));
    } else items.push(h("p", "muted", `${d.by} écrit une règle…`));
  }

  if (d.mech === "reflex") items.push(reflexBox(s));

  if (d.mech === "master") items.push(h("p", "ck-result", `❓ ${d.by} est Maître des questions : qui répond à ses questions boit !`));
  if (d.mech === "king") items.push(h("p", "ck-result", `👑 ${d.by} verse dans la coupe (${s.kings}/4)`));

  if (d.done && !spectator && (drawer || isHost)) items.push(button("Fin du tour ➡️", () => mutate("next"), "btn primary big-btn"));
  else if (d.done) items.push(h("p", "muted", `${d.by} passe au suivant…`));
  fill(panelEl, items);
}

const award = (title, value) => h("div", "ck-award", h("small", "", title), h("strong", "", value));

// 4 / 7 : course de réflexe. Mesurée localement : on attend le « TAPE ! » puis on chronomètre.
function reflexBox(s) {
  const d = s.drawn;
  const box = h("div", "ck-reflex");
  const results = Object.entries(d.reflex || {}).sort((a, b) => a[1] - b[1]);
  if (d.done) {
    box.append(h("p", "ck-result", `🐢 ${d.loser} est le plus lent et boit${withMates(s, d.loser)} !`));
  } else if (!spectator && d.reflex[myName] == null) {
    const pad = h("button", `ck-pad ${reflexState?.phase || ""}`, reflexState?.phase === "go" ? (d.code.startsWith("4") ? "MAIN AU SOL !" : "MAIN AU CIEL !") : reflexState?.phase === "wait" ? "Attends…" : "Touche pour te préparer");
    pad.type = "button";
    pad.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (!reflexState) {
        reflexState = { phase: "wait" };
        setTimeout(() => { if (reflexState?.phase === "wait") { reflexState = { phase: "go", goAt: performance.now() }; sound.go(); render(); } }, 800 + Math.random() * 2200);
        render();
      } else if (reflexState.phase === "wait") {
        reflexState = { phase: "done" };
        sound.bad();
        mutate("reflex", { ms: REFLEX_FAIL });
      } else if (reflexState.phase === "go") {
        const ms = Math.round(performance.now() - reflexState.goAt);
        reflexState = { phase: "done" };
        mutate("reflex", { ms });
      }
    });
    box.append(pad);
  } else if (!spectator) {
    box.append(h("p", "muted", `Ton temps : ${d.reflex[myName] >= REFLEX_FAIL ? "trop tôt 💀" : `${d.reflex[myName]} ms`} — on attend les autres…`));
  }
  if (results.length) box.append(h("ol", "ck-times", results.map(([n, ms]) => h("li", n === d.loser ? "loser" : "", h("strong", "", n), h("span", "", ms >= REFLEX_FAIL ? "trop lent / trop tôt" : `${ms} ms`)))));
  if (!d.done && !spectator && (d.by === myName || isHost)) {
    const missing = s.players.filter(p => d.reflex[p.name] == null).map(p => p.name);
    if (missing.length && Object.keys(d.reflex).length) box.append(button(`Clore la course (sans ${missing.join(", ")})`, () => mutate("closeReflex"), "btn small"));
  }
  return box;
}

function renderPlayers() {
  const s = state;
  fill(playersEl, s.players.map(p => {
    const tags = [];
    if (p.name === myName) tags.push(h("span", "ck-badge me", "toi"));
    if (s.master === p.name) tags.push(h("span", "ck-badge master", "❓ Maître"));
    const mates = matesOf(s, p.name);
    if (mates.length) tags.push(h("span", "ck-badge mate", `🤝 ${mates.join(", ")}`));
    const kings = s.stats[p.name]?.kings || 0;
    if (kings) tags.push(h("span", "ck-badge king", "👑".repeat(kings)));
    return h("div", `ck-member${s.phase === "play" && s.current === p.name ? " turn" : ""}`, avatarEl(p.name), h("strong", "", p.name), h("div", "ck-member-tags", tags));
  }));
}

function renderRules() {
  const s = state;
  const items = [];
  s.rules.forEach(r => items.push(h("li", "", h("strong", "", `📜 ${r.text}`), h("small", "", ` (${r.by})`))));
  s.effects.forEach(e => items.push(h("li", "effect", h("strong", "", `⚡ ${e.text}`), h("small", "", ` (${e.turns} tour${e.turns > 1 ? "s" : ""})`))));
  fill(rulesEl, items.length ? items : h("li", "muted", "Aucune règle pour l'instant."));
}

function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  const s = state;
  const items = [];
  if (s.phase === "intro") items.push(button("Lancer la partie 👑", () => mutate("start"), "btn primary big-btn", s.players.length < 2));
  if (s.phase === "end") items.push(button("Rejouer (nouveau paquet) 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  hostEl.hidden = !items.length;
  fill(hostEl, items.length ? [h("span", "ck-host-title", "👑 Hôte"), ...items] : []);
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
  if (data.kings) applyState(data.kings);
}, error => console.error("Chaos Kings : synchro impossible", error));

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
