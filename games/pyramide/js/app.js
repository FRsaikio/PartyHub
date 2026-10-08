// La Pyramide — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `pyramid`). Chaque téléphone ne montre que ses
// propres cartes, et seulement pendant la mémorisation (ou quelques secondes quand une carte
// est remplacée). La TV ne montre jamais les mains avant la fin.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf, recordGameEnd } from "../../../game-common.js";
import { safeImageSrc } from "../../../html-safe.js";
import { newGame, applyAction, RANKS, HAND, RECALL_PENALTY, rankOf, currentCard, currentSips, openAttacks, sipsFor } from "./pyr-logic.js";

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

if (spectator) document.body.classList.add("pc-tv");
if (params.get("embed") === "1") document.body.classList.add("pc-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const stageEl = $("pcStage");
const pyramidEl = $("pcPyramid");
const boardEl = $("pcBoard");
const hostEl = $("pcHost");
const roundEl = $("pcRound");
const logEl = $("pcLog");
$("roomBadge").textContent = `Room ${roomCode}`;
// Règles ouvertes d'office sur grand écran, repliées sur téléphone.
if (spectator || window.matchMedia("(min-width: 900px)").matches) $("pcRules").open = true;

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

let roomPlayers = [];
let alcohol = true;
const unit = n => (alcohol ? `${n} gorgée${n > 1 ? "s" : ""}` : `${n} pénalité${n > 1 ? "s" : ""}`);

function avatarEl(name, big = false) {
  const box = h("span", `pc-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || "🃏";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `pc-toast tone-${tone}`, text);
  document.body.append(el);
  setTimeout(() => el.classList.add("leaving"), 3200);
  setTimeout(() => el.remove(), 3700);
}

// ---------- Cartes ----------

const RANK_FR = { J: "V", Q: "D", K: "R" };
const RANK_NAME = { A: "As", J: "Valet", Q: "Dame", K: "Roi" };
const SUIT_ICON = { S: "♠", H: "♥", D: "♦", C: "♣" };
const rankLabel = r => RANK_FR[r] || r;
const rankName = r => RANK_NAME[r] || r;

function cardEl(card, { down = false, cls = "", onClick = null } = {}) {
  const el = h(onClick ? "button" : "div", `pc-card${down ? " down" : ""}${cls ? ` ${cls}` : ""}`);
  if (onClick) { el.type = "button"; el.addEventListener("click", onClick); }
  if (!down && card) {
    const suit = String(card).slice(-1);
    el.classList.add(suit === "H" || suit === "D" ? "red" : "black");
    el.append(h("b", "", rankLabel(rankOf(card))), h("i", "", SUIT_ICON[suit] || ""));
  }
  return el;
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
      if (!data.pyramid) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.pyramid));
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName });
      next.v = (data.pyramid.v || 0) + 1;
      t.update(roomRef, { pyramid: next });
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
  if (data.pyramid && data.pyramid.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.pyramid && d.pyramid.session === s) return;
      const level = d.drinkLevel === "danger" ? "extreme" : d.drinkLevel || "normal";
      t.update(roomRef, { pyramid: newGame(d.players || [], s, d.gameDuration || "medium", level) });
    });
  } catch (error) {
    console.error("Pyramide : création de la partie impossible", error);
  }
}

// Carte remplacée : on la montre à son propriétaire pendant 5 s (montre locale).
let freshSeen = null;
let freshUntil = 0;
let freshPos = -1;

function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  // Fin de partie : journal de soirée (hôte) + XP du joueur.
  if (next.phase === "end" && !spectator) recordGameEnd({ roomCode, gameId: "pyramid", state: next, isHost, myName });
  const fresh = next.fresh?.[myName];
  if (fresh && freshSeen !== null && fresh.n !== freshSeen) {
    freshUntil = Date.now() + 5000;
    freshPos = fresh.pos;
    setTimeout(render, 5100);
  }
  freshSeen = fresh?.n || 0;
  if (before && !spectator) notify(before, next);
  if (before && next.flipped !== before.flipped && next.flipped >= 0) window.PartyHubFX?.play?.("flip");
  render();
}

// Vibrations / annonces pour ce téléphone.
function notify(before, next) {
  const was = new Map((before.attacks || []).map(a => [a.id, a.status]));
  (next.attacks || []).forEach(a => {
    const old = was.get(a.id);
    if (a.to === myName && !old) { navigator.vibrate?.([80, 60, 80]); toast(`🫵 ${a.from} te donne ${unit(a.sips)} !`, "bad"); }
    if (a.from === myName && a.status === "challenged" && old === "pending") { navigator.vibrate?.(200); toast(`🤨 ${a.to} crie MENTEUR ! Montre ta carte.`, "bad"); }
    if ((a.status === "truth" || a.status === "lie") && old === "challenged" && (a.to === myName || a.from === myName)) {
      toast(a.loser === myName ? `🍺 Tu bois ${unit(a.sips * 2)}` : "😎 C'est l'autre qui boit !", a.loser === myName ? "bad" : "gold");
    }
  });
}

// ---------- Rendu ----------

function render() {
  if (!state) return;
  const s = state;
  roundEl.textContent = {
    intro: "Avant-partie", memo: "Mémorisation", recall: "Récitation", end: "Terminé"
  }[s.phase] || `Carte ${s.flipped + 1}/${s.pyramid.length}`;
  renderPyramid();
  const builder = { intro: stageIntro, memo: stageMemo, play: stagePlay, recall: stageRecall, end: stageEnd }[s.phase];
  if (builder && !(s.phase === "recall" && stageEl.contains(document.activeElement) && document.activeElement.tagName === "SELECT")) fill(stageEl, builder(s));
  renderBoard();
  renderHost();
  renderLog();
}

function renderPyramid() {
  const s = state;
  if (!s.pyramid.length) { fill(pyramidEl); pyramidEl.hidden = true; return; }
  pyramidEl.hidden = false;
  const rows = [];
  for (let row = s.rows - 1; row >= 0; row--) {
    const cards = s.pyramid.map((p, i) => ({ ...p, i })).filter(p => p.row === row);
    rows.push(h("div", "pc-row",
      h("span", "pc-row-sips", `${sipsFor(row, s.level)}🍺`),
      h("div", "pc-row-cards", cards.map(p => cardEl(p.card, {
        down: p.i > s.flipped,
        cls: p.i === s.flipped && s.phase === "play" ? "current" : ""
      })))));
  }
  fill(pyramidEl, rows);
}

function myHand() {
  return h("div", "pc-hand", (state.hands?.[myName] || []).map((c, i) =>
    cardEl(c, { down: !(Date.now() < freshUntil && i === freshPos), cls: Date.now() < freshUntil && i === freshPos ? "fresh" : "" })));
}

function stageIntro(s) {
  const card = h("div", "pc-card-box",
    h("span", "pc-kicker", "🔺 La Pyramide"),
    h("h3", "", "Mémoire, bluff et gorgées"),
    h("p", "pc-lead", `${s.players.length} joueurs · ${s.rows} étages (${s.rows * (s.rows + 1) / 2} cartes). Lis les règles sur le côté !`));
  if (isHost && !spectator) {
    card.append(h("strong", "", "Nombre d'étages :"), h("div", "pc-rows-pick", [3, 4, 5, 6, 7].map(n =>
      button(String(n), () => mutate("rows", { rows: n }), `pc-pick${s.rows === n ? " selected" : ""}`))));
  } else card.append(h("p", "muted", "L'hôte distribue les cartes…"));
  return card;
}

function stageMemo(s) {
  const ready = Object.keys(s.ready || {}).length;
  const box = h("div", "pc-card-box",
    h("span", "pc-kicker", "🧠 Mémorisation"),
    h("p", "muted", `${ready}/${s.players.length} prêts`));
  if (spectator || !s.hands[myName]) {
    box.append(h("h3", "", "Mémorisez vos 4 cartes !"), h("p", "pc-lead", "Chacun regarde ses cartes sur son téléphone. Elles se cachent ensuite pour toute la partie."));
  } else if (!s.ready[myName]) {
    box.append(
      h("h3", "", "Retiens bien tes cartes"),
      h("div", "pc-hand", s.hands[myName].map(c => cardEl(c))),
      h("p", "pc-lead", `Dans l'ordre : ${s.hands[myName].map(c => rankName(rankOf(c))).join(" · ")}`),
      button("C'est mémorisé ✓ (cacher mes cartes)", () => mutate("ready"), "btn primary big-btn"));
  } else {
    box.append(h("h3", "", "Cartes cachées 🙈"), myHand(), h("p", "muted", "En attente du lancement de la pyramide…"));
  }
  return box;
}

const STATUS = {
  pending: "⏳ attend sa réponse",
  challenged: "🤨 MENTEUR ! carte à montrer",
  drunk: "🍺 a bu",
  truth: "✅ disait vrai",
  lie: "❌ mauvaise carte"
};

function attackLine(a) {
  const loser = a.status === "drunk" ? a.to : a.loser;
  const sips = a.status === "drunk" ? a.sips : a.sips * 2;
  return h("li", `pc-attack st-${a.status}`,
    h("span", "", h("strong", "", a.from), " → ", h("strong", "", a.to), ` · ${unit(a.sips)}`),
    h("small", "", STATUS[a.status], a.shown ? ` (a montré ${rankLabel(rankOf(a.shown))}${SUIT_ICON[a.shown.slice(-1)]})` : "", loser ? ` · ${loser} boit ${sips}` : ""));
}

function stagePlay(s) {
  const cur = currentCard(s);
  const box = h("div", "pc-card-box pc-play");
  if (!cur) {
    box.append(h("h3", "", "La pyramide est prête"), h("p", "pc-lead", isHost ? "Retourne la première carte !" : "L'hôte va retourner la première carte…"));
    if (!spectator && s.hands[myName]) box.append(h("small", "muted", "Tes cartes :"), myHand());
    return box;
  }
  const rank = rankOf(cur.card);
  const sips = currentSips(s);
  const top = s.flipped === s.pyramid.length - 1;
  box.append(h("div", "pc-current",
    cardEl(cur.card, { cls: "big" }),
    h("div", "",
      h("span", "pc-kicker", top ? "👑 Sommet" : `Étage ${cur.row + 1}`),
      h("h3", "", `${rankName(rank)} · ${unit(sips)}`),
      h("p", "muted", `Tu as un ${rankName(rank)} ? Donne ${unit(sips)}… ou bluffe.`))));

  const here = s.attacks.filter(a => a.flip === s.flipped);
  if (!spectator && s.hands[myName]) {
    const incoming = here.filter(a => a.to === myName && a.status === "pending");
    const accused = here.filter(a => a.from === myName && a.status === "challenged");
    incoming.forEach(a => box.append(h("div", "pc-alert",
      h("strong", "", `🫵 ${a.from} te donne ${unit(a.sips)}`),
      h("span", "", `Il prétend avoir un ${rankName(a.rank)}.`),
      h("div", "pc-actions",
        button(`🍺 Je bois ${a.sips}`, () => mutate("accept", { id: a.id }), "btn secondary"),
        button("🤨 MENTEUR !", () => mutate("challenge", { id: a.id }), "btn primary")))));
    accused.forEach(a => box.append(h("div", "pc-alert hot",
      h("strong", "", `🤨 ${a.to} t'accuse de bluffer !`),
      h("span", "", `Touche ta carte qui est un ${rankName(a.rank)}. Si tu te trompes, tu bois ${unit(a.sips * 2)}.`),
      h("div", "pc-hand pick", (s.hands[myName] || []).map((c, i) => cardEl(c, { down: true, onClick: () => mutate("reveal", { id: a.id, pos: i }) }))))));
    if (!accused.length) {
      const gave = here.some(a => a.from === myName);
      box.append(h("small", "muted", "Tes cartes (cachées) :"), myHand());
      if (gave) box.append(h("p", "muted", "Tu as déjà donné sur cette carte."));
      else box.append(h("strong", "", `Donner ${unit(sips)} à :`), h("div", "pc-targets",
        s.players.filter(p => p.name !== myName).map(p =>
          button(h("span", "", avatarEl(p.name), p.name), () => mutate("give", { to: p.name }), "pc-target"))));
    }
  }
  if (here.length) box.append(h("ul", "pc-attacks", here.map(attackLine)));
  else box.append(h("p", "muted", "Personne n'a encore donné sur cette carte."));
  return box;
}

const recallDraft = {};
function stageRecall(s) {
  const box = h("div", "pc-card-box", h("span", "pc-kicker", "🧠 Récitation"));
  const done = Object.keys(s.recall || {}).length;
  if (spectator || !s.hands[myName]) {
    box.append(h("h3", "", "Chacun récite ses 4 cartes"), h("p", "pc-lead", `Chaque erreur = ${unit(RECALL_PENALTY)}.`), h("p", "muted", `${done}/${s.players.length} ont répondu`));
    return box;
  }
  if (s.recall[myName]) {
    box.append(h("h3", "", "Réponse envoyée 🔒"), h("p", "muted", `${done}/${s.players.length} ont répondu`));
    return box;
  }
  box.append(h("h3", "", "Quelles sont tes 4 cartes ?"), h("p", "pc-lead", `Dans l'ordre. Chaque erreur = ${unit(RECALL_PENALTY)}.`));
  const selects = Array.from({ length: HAND }, (_, i) => {
    const sel = h("select", "pc-select", h("option", "", "?"), RANKS.map(r => {
      const o = h("option", "", rankName(r));
      o.value = r;
      return o;
    }));
    sel.value = recallDraft[i] || "?";
    sel.addEventListener("change", () => { recallDraft[i] = sel.value; });
    return h("label", "pc-slot", cardEl(null, { down: true }), sel);
  });
  box.append(h("div", "pc-recall", selects), button("Valider mes cartes", () => {
    const guesses = Array.from({ length: HAND }, (_, i) => recallDraft[i]);
    if (guesses.some(g => !RANKS.includes(g))) { toast("Choisis une valeur pour chaque carte.", "bad"); return; }
    mutate("recall", { guesses });
  }, "btn primary big-btn"));
  return box;
}

function stageEnd(s) {
  const ranking = s.players.map(p => p.name).sort((a, b) => (s.drinks[b] || 0) - (s.drinks[a] || 0));
  const best = (map, label) => {
    const top = Object.entries(map || {}).sort((a, b) => b[1] - a[1])[0];
    return h("div", "pc-award", h("small", "", label), h("strong", "", top?.[1] ? `${top[0]} (${top[1]})` : "—"));
  };
  const memory = (s.recallResult || []).slice().sort((a, b) => b.good - a.good)[0];
  if (!firstRender) window.PartyHubFX?.confetti?.();
  return h("div", "pc-card-box pc-end",
    h("span", "pc-kicker", "🏁 Fin de la pyramide"),
    ranking[0] ? avatarEl(ranking[0], true) : null,
    h("h3", "", ranking[0] ? `🍺 ${ranking[0]} a le plus bu (${unit(s.drinks[ranking[0]] || 0)})` : "Fin !"),
    h("div", "pc-awards",
      best(s.bluffs, "🃏 Meilleur bluffeur (jamais pris)"),
      best(s.sniffs, "🕵️ Détecteur de mensonges"),
      best(s.given, "🫵 A fait le plus boire"),
      h("div", "pc-award", h("small", "", "🐘 Mémoire d'éléphant"), h("strong", "", memory ? `${memory.name} (${memory.good}/${HAND})` : "—"))),
    h("div", "pc-hands", s.players.map(p => {
      const r = (s.recallResult || []).find(x => x.name === p.name);
      return h("div", "pc-hand-line",
        h("strong", "", p.name),
        h("div", "pc-hand small", (s.hands[p.name] || []).map(c => cardEl(c))),
        h("small", "muted", r ? `${r.good}/${HAND} bonnes · +${unit(r.sips)}` : "pas récité"));
    })));
}

function renderBoard() {
  const s = state;
  const sorted = [...s.players].sort((a, b) => (s.drinks[b.name] || 0) - (s.drinks[a.name] || 0));
  fill(boardEl, sorted.map(p => h("div", `pc-member${p.name === myName ? " me" : ""}`,
    avatarEl(p.name),
    h("strong", "", p.name),
    s.phase === "memo" ? h("span", "pc-ready", s.ready[p.name] ? "✓" : "…") : null,
    h("span", "pc-drinks", `${s.drinks[p.name] || 0} 🍺`))));
}

function renderLog() {
  fill(logEl, (state.log || []).slice(0, 12).map(line => h("li", "", line)));
}

function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  const s = state;
  const items = [];
  if (s.phase === "intro") items.push(button("Distribuer les cartes 🃏", () => mutate("start"), "btn primary big-btn"));
  if (s.phase === "memo") {
    const ready = Object.keys(s.ready || {}).length;
    items.push(button(`Lancer la pyramide 🔺 (${ready}/${s.players.length} prêts)`, () => mutate("go"), "btn primary big-btn"));
  }
  if (s.phase === "play") {
    const open = openAttacks(s).length;
    const last = s.flipped + 1 >= s.pyramid.length;
    items.push(button(last ? "Passer à la récitation 🧠" : `Retourner la carte suivante${open ? ` (${open} en attente)` : ""}`, () => {
      if (open && !confirm(`${open} don(s) sans réponse : la cible boit, et un accusé qui n'a pas montré sa carte boit double. Continuer ?`)) return;
      mutate("flip");
    }, "btn primary big-btn"));
  }
  if (s.phase === "recall") items.push(button(`Terminer la récitation (${Object.keys(s.recall || {}).length}/${s.players.length})`, () => mutate("closeRecall"), "btn primary big-btn"));
  if (s.phase === "memo" || s.phase === "play") items.push(button("Terminer la partie", () => { if (confirm("Terminer la pyramide ?")) mutate("end"); }, "btn small"));
  if (s.phase === "end") items.push(button("Rejouer 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  hostEl.hidden = !items.length;
  fill(hostEl, items.length ? [h("span", "pc-host-title", "👑 Hôte"), ...items] : []);
}

// ---------- Démarrage ----------

let firstRender = true;
onSnapshot(roomRef, snap => {
  if (!snap.exists()) return;
  const data = snap.data();
  if (!spectator && data.gameStarted === false) {
    localStorage.setItem("partyhubReturnLobby", "true");
    window.location.href = "../../index.html";
    return;
  }
  roomPlayers = Array.isArray(data.players) ? data.players : [];
  alcohol = data.alcoholMode !== false;
  if (!spectator) ensureGame(data);
  if (data.pyramid) { applyState(data.pyramid); firstRender = false; }
}, error => console.error("Pyramide : synchro impossible", error));

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
