// Action ou Vérité… ou Bois — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `truth`) ; chaque action passe par une transaction
// qui applique truth-logic.js. La cible choisit et répond sur son téléphone, les autres jugent.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf } from "../../../game-common.js";
import { safeImageSrc } from "../../../html-safe.js";
import { newGame, applyAction, pending, judgesOf, maxTurns } from "./truth-logic.js";

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
const settings = { partyMode, alcohol: savedData?.alcoholMode !== false };

if (spectator) document.body.classList.add("tr-tv");
if (params.get("embed") === "1") document.body.classList.add("tr-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const stageEl = $("trStage");
const orderEl = $("trOrder");
const hostEl = $("trHost");
const roundEl = $("trRound");
const logEl = $("trLog");
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
  pick: () => fx()?.tone?.(520, 0.1, "triangle", 0.6),
  ok: () => [523, 659, 784].forEach((f, i) => fx()?.tone?.(f, 0.15, "triangle", 0.6, null, i * 0.08)),
  bad: () => fx()?.tone?.(170, 0.35, "sawtooth", 0.5)
};

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `tr-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || "🎯";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `tr-toast tone-${tone}`, text);
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
      if (!data.truth) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.truth));
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName }, { rng: Math.random, ...settings });
      next.v = (data.truth.v || 0) + 1;
      t.update(roomRef, { truth: next });
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
  if (data.truth && data.truth.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.truth && d.truth.session === s) return;
      t.update(roomRef, { truth: newGame(d.players || [], s, d.gameDuration || "medium") });
    });
  } catch (error) {
    console.error("Action ou Vérité : création de la partie impossible", error);
  }
}

let firstState = true;
function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  if (before && !spectator) {
    if (next.phase === "choose" && next.current === myName && (before.current !== myName || before.phase !== "choose")) { navigator.vibrate?.([80, 60, 80]); toast("🎯 C'est ton tour : Action ou Vérité ?", "gold"); }
    if (next.phase === "judge" && before.phase !== "judge" && next.current !== myName) { navigator.vibrate?.([50, 40, 50]); toast(`⚖️ Juge la réponse de ${next.current} !`, "gold"); }
    if (next.phase === "result" && before.phase !== "result") {
      if (next.result.outcome === "validated") sound.ok(); else sound.bad();
      if (next.current === myName && next.result.outcome !== "validated") navigator.vibrate?.(300);
    }
  }
  render();
  firstState = false;
}

// ---------- Rendu ----------

let stageKey = "";

function render() {
  if (!state) return;
  const s = state;
  roundEl.textContent = s.turn ? `Tour ${s.turn}${s.laps < 999 ? `/${maxTurns(s)}` : ""}` : "Avant-partie";
  const key = [s.session, s.phase, s.turn, s.kind, s.judges?.[myName] !== undefined].join("|");
  const fresh = key !== stageKey;
  if (fresh || s.phase === "judge") {
    stageKey = key;
    const builder = { intro: stageIntro, choose: stageChoose, answer: stageAnswer, judge: stageJudge, result: stageResult, end: stageEnd }[s.phase];
    if (builder) fill(stageEl, builder(s));
    if (fresh) { stageEl.classList.remove("tr-pop"); void stageEl.offsetWidth; stageEl.classList.add("tr-pop"); }
  }
  renderOrder();
  renderHost();
  fill(logEl, (s.log || []).map(line => h("li", "", line)));
}

const isTarget = s => s.current === myName;

function targetHead(s) {
  return h("div", "tr-target", avatarEl(s.current, true), h("div", "", h("small", "", "🎯 Sur la sellette"), h("strong", "", isTarget(s) ? `${s.current} (toi !)` : s.current)));
}

function stageIntro(s) {
  return h("div", "tr-card",
    h("span", "tr-kicker", "🎯 Action ou Vérité"),
    h("h3", "", "…ou tu bois."),
    h("ol", "tr-steps",
      h("li", "", "Chacun son tour, tu choisis 🔥 Action ou 💬 Vérité."),
      h("li", "", "Tu réponds / fais le défi… ou tu refuses et tu prends la punition."),
      h("li", "", "Les autres jugent en secret : ✅ Validé ou 🙄 Bidon."),
      h("li", "", "Bidon à la majorité = punition quand même !")),
    h("p", "muted", `${s.players.length} joueurs, ${s.laps < 999 ? `${s.laps} passages chacun` : "partie infinie"}. ${isHost ? "Lance la partie quand tout le monde est là." : "L'hôte lance la partie."}`));
}

function stageChoose(s) {
  const card = h("div", "tr-card", targetHead(s));
  if (!spectator && (isTarget(s) || isHost)) {
    card.append(h("h3", "", isTarget(s) ? "Action ou Vérité ?" : `Choisir pour ${s.current} (absent)`),
      h("div", "tr-choice",
        button("💬 Vérité", () => { sound.pick(); mutate("choose", { kind: "truth" }); }, "tr-pick truth"),
        button("🔥 Action", () => { sound.pick(); mutate("choose", { kind: "dare" }); }, "tr-pick dare")));
  } else card.append(h("h3", "", `${s.current} choisit…`), h("p", "tr-lead", "Action ou Vérité ? Le suspense est insoutenable."));
  return card;
}

function promptCard(s) {
  return h("div", `tr-prompt ${s.kind}`,
    h("span", "tr-kind", s.kind === "truth" ? "💬 VÉRITÉ" : "🔥 ACTION"),
    h("p", "", s.prompt),
    h("small", "", `🍺 Si tu refuses : ${s.punishment}`));
}

function stageAnswer(s) {
  const card = h("div", "tr-card", targetHead(s), promptCard(s));
  if (!spectator && (isTarget(s) || isHost)) {
    card.append(h("div", "tr-actions",
      button(s.kind === "truth" ? "✅ J'ai répondu" : "✅ Défi fait", () => mutate("done"), "btn primary big-btn"),
      button("🍺 Je refuse, je bois", () => mutate("refuse"), "btn danger")));
  } else card.append(h("p", "tr-lead", s.kind === "truth" ? `${s.current} répond…` : `${s.current} relève le défi…`));
  return card;
}

function stageJudge(s) {
  const card = h("div", "tr-card", targetHead(s), promptCard(s), h("h3", "", "⚖️ Le groupe juge"));
  const mine = s.judges[myName];
  if (!spectator && judgesOf(s).includes(myName)) {
    if (mine === undefined) {
      card.append(h("p", "tr-lead", s.kind === "truth" ? "Sa réponse était-elle honnête ?" : "Le défi a-t-il vraiment été fait ?"),
        h("div", "tr-choice",
          button("✅ Validé", () => mutate("judge", { ok: true }), "tr-pick ok"),
          button("🙄 Bidon", () => mutate("judge", { ok: false }), "tr-pick bidon")));
    } else card.append(h("p", "tr-lead", `🔒 Ton jugement : ${mine ? "✅ Validé" : "🙄 Bidon"}`));
  } else card.append(h("p", "tr-lead", isTarget(s) ? "Le groupe délibère… croise les doigts." : "Le groupe délibère…"));
  const total = judgesOf(s).length;
  const left = pending(s).length;
  card.append(h("div", "tr-progress",
    h("div", "tr-progress-bar", Object.assign(h("span"), { style: `width:${((total - left) / total) * 100}%` })),
    h("span", "", `${total - left}/${total} jugements`)));
  return card;
}

function stageResult(s) {
  const r = s.result;
  const tone = r.outcome === "validated" ? "ok" : "bad";
  const title = r.outcome === "validated" ? `✅ ${s.current} s'en sort !` : r.outcome === "refused" ? `🍺 ${s.current} se dégonfle !` : `🙄 Bidon ! ${s.current} boit quand même`;
  const card = h("div", "tr-card", targetHead(s), promptCard(s),
    h("div", `tr-verdict ${tone}`,
      h("strong", "", title),
      r.outcome !== "refused" ? h("span", "", `✅ ${r.ok} · 🙄 ${r.bidon}`) : null,
      r.punishment ? h("span", "tr-punish", `🍺 ${r.punishment}`) : h("span", "", "Aucune punition, bien joué.")));
  if (!spectator && (isTarget(s) || isHost)) card.append(button(s.turn >= maxTurns(s) ? "Voir le classement final 🏁" : "Joueur suivant ➡️", () => mutate("next"), "btn primary big-btn"));
  return card;
}

function stageEnd(s) {
  const st = Object.entries(s.stats);
  const top = key => { const b = st.filter(([, v]) => v[key] > 0).sort((x, y) => y[1][key] - x[1][key])[0]; return b ? `${b[0]} (${b[1][key]})` : "—"; };
  if (!firstState) fx()?.confetti?.();
  return h("div", "tr-card tr-end",
    h("span", "tr-kicker", "🏁 Fin de partie"),
    h("h3", "", "Les comptes sont faits"),
    h("div", "tr-awards",
      award("🏅 Le plus honnête", top("validated")),
      award("🔥 Casse-cou (actions)", top("dares")),
      award("🐔 Le plus froussard", top("refused")),
      award("🙄 Roi du bidon", top("bidon"))));
}

const award = (title, value) => h("div", "tr-award", h("small", "", title), h("strong", "", value));

function renderOrder() {
  const s = state;
  fill(orderEl, s.players.map(p => {
    const st = s.stats[p.name] || {};
    return h("div", `tr-member${p.name === s.current && s.phase !== "end" ? " turn" : ""}${p.name === myName ? " me" : ""}`,
      avatarEl(p.name),
      h("strong", "", p.name),
      h("span", "tr-stat", `✅${st.validated || 0}`),
      h("span", "tr-stat", `🍺${(st.refused || 0) + (st.bidon || 0)}`),
      s.phase === "judge" && p.name !== s.current ? h("span", `tr-check${s.judges[p.name] !== undefined ? " done" : ""}`, s.judges[p.name] !== undefined ? "✓" : "…") : null);
  }));
}

function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  const s = state;
  const items = [];
  const left = pending(s);
  if (s.phase === "intro") items.push(button("Lancer la partie 🎯", () => mutate("start"), "btn primary big-btn", s.players.length < 2));
  if (s.phase === "judge" && left.length) items.push(button(`Clore le jugement (sans ${left.join(", ")})`, () => mutate("close"), "btn secondary"));
  if (!["intro", "end"].includes(s.phase)) items.push(button("Terminer la partie", () => { if (confirm("Terminer la partie maintenant ?")) mutate("end"); }, "btn small"));
  if (s.phase === "end") items.push(button("Rejouer 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  hostEl.hidden = !items.length;
  fill(hostEl, items.length ? [h("span", "tr-host-title", "👑 Hôte"), ...items] : []);
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
  if (data.truth) applyState(data.truth);
}, error => console.error("Action ou Vérité : synchro impossible", error));

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
