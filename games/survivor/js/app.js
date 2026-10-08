// Survivor — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `survivor`). Chaque action passe par une
// transaction qui applique survivor-logic.js : chaque joueur joue et vote depuis SON téléphone.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf, recordGameEnd } from "../../../game-common.js";
import { safeImageSrc } from "../../../html-safe.js";
import {
  START_LIVES, ADVANTAGES, PHONE_GAMES, FALSE_START,
  newGame, applyAction, ranking, candidatesFor, pending, alive, jury
} from "./survivor-logic.js";
import { mountMinigame } from "./minigames.js";

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
const settings = {
  mode: savedData?.selectedPartyMode || "Party",
  drinkLevel: savedData?.drinkLevel || "normal",
  alcohol: savedData?.alcoholMode !== false
};

if (spectator) document.body.classList.add("sv-tv");
if (params.get("embed") === "1") document.body.classList.add("sv-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const stageEl = $("svStage");
const meEl = $("svMe");
const tribeEl = $("svTribe");
const hostEl = $("svHost");
const logEl = $("svLog");
const roundEl = $("svRound");
$("roomBadge").textContent = `Room ${roomCode}`;

// ---------- Petits outils d'affichage ----------

function h(tag, cls, ...children) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  children.flat().forEach(child => {
    if (child == null || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return el;
}

// replaceChildren qui ignore les cases vides (sinon « null » s'affiche en texte).
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
  tick: () => fx()?.tone?.(520, 0.05, "triangle", 0.4),
  drum: () => { fx()?.tone?.(110, 0.25, "sine", 0.9); fx()?.tone?.(70, 0.35, "sine", 0.7, null, 0.05); },
  lose: () => fx()?.tone?.(150, 0.5, "sawtooth", 0.6),
  win: () => [523, 659, 784, 1046].forEach((f, i) => fx()?.tone?.(f, 0.2, "triangle", 0.7, null, i * 0.12))
};

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `sv-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || state?.tribe.find(t => t.name === name)?.avatar || "🌴";
  }
  return box;
}

function torches(lives, dead) {
  const box = h("span", "sv-torches");
  if (dead) { box.textContent = "💀"; return box; }
  for (let i = 0; i < Math.max(state?.startLives || START_LIVES, lives); i++) box.append(h("span", i < lives ? "on" : "off", "🔥"));
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `sv-toast tone-${tone}`, text);
  document.body.append(el);
  setTimeout(() => el.classList.add("leaving"), 3600);
  setTimeout(() => el.remove(), 4100);
}

// ---------- État & transactions ----------

let state = null;
let busy = false;

function ctx() {
  return { now: Date.now(), rng: Math.random, ...settings };
}

async function mutate(type, payload = {}) {
  if (spectator || busy) return;
  busy = true;
  render();
  let committed = null;
  try {
    await runTransaction(db, async t => {
      const snap = await t.get(roomRef);
      const data = snap.data() || {};
      const current = data.survivor;
      if (!current) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(current));
      // L'hôte est relu dans la room (pas la parole du téléphone).
      const me = { name: myName, host: hostNameOf(data.players) === myName };
      applyAction(next, type, payload, me, ctx());
      next.v = (current.v || 0) + 1;
      t.update(roomRef, { survivor: next });
      committed = next;
    });
  } catch (error) {
    toast(error.message || "Action impossible.", "lose");
    if (!error.message) console.error(error);
  } finally {
    busy = false;
    if (committed) applyState(committed);
    else render();
  }
}

// Nouvelle partie à chaque lancement depuis le lobby (session = activeGame.startedAt).
async function ensureGame(data) {
  const session = data.activeGame?.startedAt || 0;
  if (data.survivor && data.survivor.session === session) return;
  try {
    await runTransaction(db, async t => {
      const snap = await t.get(roomRef);
      const d = snap.data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.survivor && d.survivor.session === s) return;
      t.update(roomRef, { survivor: newGame(d.players || [], s) });
    });
  } catch (error) {
    console.error("Survivor : création de la partie impossible", error);
  }
}

function applyState(next) {
  if (state && (next?.v || 0) < (state.v || 0) && next.session === state.session) return;
  const before = state;
  state = next;
  // Fin de partie : journal de soirée (hôte) + XP du joueur.
  if (next.phase === "end" && !spectator) recordGameEnd({ roomCode, gameId: "survivor", state: next, isHost, myName });
  react(before, next);
  render();
}

// Vibrations / sons aux moments clés pour ce téléphone.
function react(before, next) {
  if (!before || spectator || before.session !== next.session) return;
  const me = next.tribe.find(p => p.name === myName);
  if (before.phase !== next.phase) {
    if (next.phase === "challenge" && me && !me.dead) { navigator.vibrate?.([60, 40, 60]); toast(`${next.challenge.icon} Épreuve : ${next.challenge.title} !`, "gold"); }
    if (next.phase === "council" && me && !me.dead) { navigator.vibrate?.([80, 60, 80]); toast("🔥 Le conseil commence : vote en secret.", "gold"); }
    if (next.phase === "final" && me?.dead) { navigator.vibrate?.([80, 60, 80]); toast("👑 Le jury vote : à toi de choisir le Survivant.", "gold"); }
  }
  const lostAdv = before.tribe.find(p => p.name === myName)?.advantages.length || 0;
  if (me && me.advantages.length > lostAdv) { navigator.vibrate?.(120); toast(`🤫 Avantage secret trouvé : ${ADVANTAGES[me.advantages[me.advantages.length - 1]].name}`, "gold"); }
}

// ---------- Rendu ----------

let stageKey = "";
let stageUpdate = null;

function render() {
  if (!state) {
    stageEl.replaceChildren(h("div", "sv-card", h("p", "muted", "Préparation de l'île…")));
    return;
  }
  roundEl.textContent = state.round ? `Manche ${state.round}` : "Avant-match";
  renderStage();
  renderMe();
  renderTribe();
  renderHost();
  logEl.replaceChildren(...(state.log || []).map(line => h("li", "", line)));
}

const me = () => state?.tribe.find(p => p.name === myName) || null;

function renderStage() {
  const s = state;
  const m = me();
  const key = [s.session, s.phase, s.round, s.challenge?.kind, s.challenge?.text,
    s.phase === "challenge" && s.challenge?.results?.[myName] != null,
    s.phase === "council" && Boolean(s.council?.votes?.[myName]),
    s.phase === "final" && Boolean(s.final?.jury?.[myName]),
    Boolean(m?.dead)].join("|");
  if (key !== stageKey) {
    stageKey = key;
    const builder = { intro: stageIntro, challenge: stageChallenge, challengeResult: stageChallengeResult, council: stageCouncil, reveal: stageReveal, final: stageFinal, end: stageEnd }[s.phase];
    const built = builder ? builder(s) : { el: h("div", "sv-card", "…") };
    stageUpdate = built.update || null;
    stageEl.replaceChildren(built.el);
    stageEl.classList.remove("sv-pop");
    void stageEl.offsetWidth;
    stageEl.classList.add("sv-pop");
  }
  stageUpdate?.(s);
}

function eventBanner(s) {
  return s.event ? h("div", "sv-event", h("strong", "", s.event.label), h("span", "", s.event.text)) : null;
}

function progress(s, verb) {
  const left = pending(s);
  const total = s.phase === "final" ? jury(s).length : s.phase === "council" ? alive(s).filter(p => candidatesFor(s, p.name).length).length : alive(s).length;
  const done = total - left.length;
  return h("div", "sv-progress",
    h("div", "sv-progress-bar", Object.assign(h("span"), { style: `width:${total ? (done / total) * 100 : 0}%` })),
    h("span", "", `${done}/${total} ${verb}${left.length ? ` · on attend ${left.join(", ")}` : ""}`));
}

// Intro
function stageIntro(s) {
  const el = h("div", "sv-card sv-intro",
    h("span", "sv-kicker", "🏝️ Survivor"),
    h("h3", "", "Bienvenue sur l'île"),
    h("ol", "sv-steps",
      h("li", "", h("strong", "", "Épreuve : "), "mini-jeu sur ton téléphone ou défi physique. Le meilleur gagne l'immunité, le dernier boit."),
      h("li", "", h("strong", "", "Conseil : "), "chacun vote en secret contre un autre survivant. Avantages cachés autorisés."),
      h("li", "", h("strong", "", "Dépouillement : "), "le plus voté perd un flambeau 🔥 et boit. À 0, il quitte l'île et rejoint le jury."),
      h("li", "", h("strong", "", "Finale : "), "les 2 derniers plaident leur cause, le jury des éliminés choisit le Survivant.")),
    h("p", "muted", s.tribe.length < 3 ? "Il faut au moins 3 joueurs (les joueurs test ne comptent pas)." : `${s.tribe.length} survivants, ${s.startLives || START_LIVES} flambeau${(s.startLives || START_LIVES) > 1 ? "x" : ""} chacun. ${isHost ? "Lance la première épreuve quand tout le monde est prêt." : "L'hôte lance la première épreuve."}`));
  return { el };
}

// Épreuve
function stageChallenge(s) {
  const c = s.challenge;
  const m = me();
  const playing = c.kind !== "physical" && m && !m.dead && c.results[myName] == null && !spectator;
  const area = h("div", "sv-game-area");
  const results = h("ol", "sv-results");

  const el = h("div", `sv-card sv-challenge kind-${c.kind}`,
    eventBanner(s),
    h("span", "sv-kicker", `${c.icon} Épreuve · ${c.title}`),
    h("h3", "", c.kind === "physical" ? c.text : c.title),
    h("p", "sv-lead", c.kind === "physical" ? "Défi en vrai ! L'hôte désigne le gagnant (immunité) et le perdant (il boit)." : c.text),
    area, results);

  if (playing) {
    mountMinigame(c.kind, area, score => mutate("submit", { score }));
  } else if (c.kind !== "physical") {
    const mine = c.results[myName];
    area.append(h("p", "sv-wait", m?.dead ? "Tu fais partie du jury : tu regardes l'épreuve." : spectator ? "Les survivants jouent sur leur téléphone…" : `Ton score : ${formatScore(c.kind, mine)} — en attente des autres…`));
  }

  return {
    el,
    update(next) {
      if (next.challenge.kind === "physical") return;
      const list = ranking(next);
      results.replaceChildren(...list.map((r, i) => h("li", r.name === myName ? "me" : "", avatarEl(r.name), h("strong", "", r.name), h("span", "", formatScore(next.challenge.kind, r.score)), i === 0 ? h("em", "", "👑") : null)));
      const old = el.querySelector(".sv-progress");
      const p = progress(next, "ont joué");
      old ? old.replaceWith(p) : el.append(p);
    }
  };
}

function formatScore(kind, score) {
  if (score == null) return "…";
  if (kind === "reflex") return score >= FALSE_START ? "Faux départ" : `${score} ms`;
  return `${score} ${PHONE_GAMES[kind]?.unit || ""}`;
}

// Résultat de l'épreuve
function stageChallengeResult(s) {
  const c = s.challenge;
  const iFound = c.found && c.found === myName;
  const el = h("div", "sv-card sv-challenge-result",
    eventBanner(s),
    h("span", "sv-kicker", `${c.icon} Résultat de l'épreuve`),
    h("div", "sv-podium",
      c.winner ? h("div", "sv-podium-win", avatarEl(c.winner, true), h("strong", "", c.winner), h("span", "", s.mods.noImmunity ? "🏆 Gagne l'épreuve (pas d'immunité ce soir)" : "🗿 Immunisé au conseil")) : h("p", "muted", "Pas de gagnant."),
      c.loser ? h("div", "sv-podium-lose", avatarEl(c.loser, true), h("strong", "", c.loser), h("span", "", `🍻 ${c.punishment}`)) : null),
    c.winner ? h("p", "sv-lead", iFound ? "🤫 En fouillant l'île, tu as trouvé un avantage secret ! Regarde ton sac." : `🔎 ${c.winner} a fouillé l'île… a-t-il trouvé quelque chose ?`) : null,
    h("p", "muted", isHost ? "Ouvre le conseil quand la punition est faite." : "Le conseil va bientôt commencer."));
  return { el };
}

// Conseil
let confirmTarget = null;
function stageCouncil(s) {
  const m = me();
  const voted = s.council.votes[myName];
  const el = h("div", "sv-card sv-council", eventBanner(s), h("span", "sv-kicker", "🔥 Conseil de la tribu"));
  const live = h("div", "sv-council-live");

  if (spectator) {
    el.append(h("h3", "", "Les survivants votent…"), h("p", "sv-lead", "Chacun vote en secret sur son téléphone."));
  } else if (!m || m.dead) {
    el.append(h("h3", "", "Tu fais partie du jury"), h("p", "sv-lead", "Observe bien : en finale, c'est toi qui choisiras le Survivant."));
  } else if (voted) {
    el.append(h("h3", "", "🔒 Ton vote est scellé"), h("p", "sv-lead", `Tu as voté contre ${voted}. Personne ne le saura avant le dépouillement.`));
  } else {
    const list = candidatesFor(s, myName);
    el.append(h("h3", "", "Contre qui votes-tu ?"));
    if (!list.length) el.append(h("p", "sv-lead", "Personne ne peut être visé par toi ce soir."));
    const grid = h("div", "sv-vote-grid");
    const confirmBox = h("div", "sv-confirm");
    const drawConfirm = () => {
      grid.querySelectorAll("button").forEach(b => b.classList.toggle("selected", b.dataset.name === confirmTarget));
      confirmBox.replaceChildren(...(confirmTarget ? [
        h("span", "", `Voter contre ${confirmTarget} ?`),
        button("✅ Confirmer", () => { const t = confirmTarget; confirmTarget = null; mutate("vote", { target: t }); }, "btn primary"),
        button("Changer", () => { confirmTarget = null; drawConfirm(); })
      ] : []));
    };
    list.forEach(name => {
      const b = h("button", "sv-vote", avatarEl(name, true), h("strong", "", name));
      b.type = "button";
      b.dataset.name = name;
      b.addEventListener("click", () => { confirmTarget = name; navigator.vibrate?.(15); drawConfirm(); });
      grid.append(b);
    });
    el.append(grid, confirmBox);
    drawConfirm();
  }
  el.append(live);
  return {
    el,
    update(next) {
      const immune = next.tribe.filter(p => p.immune && !p.dead).map(p => p.name);
      fill(live,
        progress(next, "ont voté"),
        immune.length ? h("p", "sv-note", `🗿 Immunisé : ${immune.join(", ")}`) : null,
        next.council.idols.length ? h("p", "sv-note sv-idol", `🗿 Idole jouée par ${next.council.idols.join(", ")} !`) : null);
    }
  };
}

// Dépouillement animé (chaque appareil l'anime à partir du moment où il le reçoit).
const REVEAL_STEP = 2200;
let revealSeen = null;
function stageReveal(s) {
  const r = s.reveal;
  const id = `${s.session}:${s.round}`;
  const instant = revealSeen === null && firstState; // page ouverte en plein dépouillement
  revealSeen = id;
  const tally = h("div", "sv-tally");
  const cards = h("div", "sv-reveal-cards");
  const verdict = h("div", "sv-verdict");
  const el = h("div", "sv-card sv-reveal",
    h("span", "sv-kicker", "🗳️ Dépouillement"),
    h("h3", "", r.items.length ? "Je vais lire les votes…" : "Aucun vote…"),
    r.idols.length ? h("p", "sv-note sv-idol", `🗿 ${r.idols.join(", ")} ${r.idols.length > 1 ? "ont joué" : "a joué"} une idole : les votes contre ${r.idols.length > 1 ? "eux" : "lui"} ne comptent pas !`) : null,
    cards, tally, verdict);

  const counts = {};
  const drawTally = () => {
    const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const max = Math.max(1, ...Object.values(counts));
    tally.replaceChildren(...names.map(n => h("div", "sv-tally-row", h("strong", "", n), h("span", "sv-tally-bar", Object.assign(h("i"), { style: `width:${(counts[n] / max) * 100}%` })), h("em", "", String(counts[n])))));
  };

  const showItem = (it, k) => {
    const card = h("div", `sv-vote-card${it.void ? " void" : ""}`,
      h("small", "", `Vote ${k + 1}${it.weight > 1 ? ` · ×${it.weight}` : ""}`),
      avatarEl(it.target, true),
      h("strong", "", it.target),
      it.void ? h("span", "sv-void", it.void === "idole" ? "🗿 Annulé (idole)" : "🚫 Vote bloqué") : null);
    cards.append(card);
    if (!it.void) counts[it.target] = (counts[it.target] || 0) + it.weight;
    drawTally();
    if (!instant) sound.drum();
  };

  const showVerdict = () => {
    if (!r.loser) {
      verdict.replaceChildren(h("strong", "", "🗿 Personne ne perd de flambeau ce soir."));
      return;
    }
    const p = s.tribe.find(t => t.name === r.loser);
    verdict.className = `sv-verdict ${r.eliminated ? "out" : "hit"}`;
    fill(verdict,
      r.tie ? h("p", "sv-note", `⚖️ Égalité entre ${r.tie.join(" et ")} : le sort a désigné ${r.loser}.`) : null,
      avatarEl(r.loser, true),
      h("strong", "", r.eliminated ? `🔥 ${r.loser}, la tribu a parlé.` : `💔 ${r.loser} perd ${r.lifeLoss > 1 ? `${r.lifeLoss} flambeaux` : "un flambeau"}`),
      h("span", "", r.eliminated ? "Éteins ton flambeau : tu quittes l'île et rejoins le jury." : `Il lui reste ${p?.lives} flambeau${p?.lives > 1 ? "x" : ""}.`),
      h("span", "sv-punish", `🍻 ${r.punishment}`));
    if (!instant) {
      (r.eliminated ? sound.lose : sound.drum)();
      if (r.loser === myName) navigator.vibrate?.([200, 80, 200]);
      document.body.classList.add("sv-shake");
      setTimeout(() => document.body.classList.remove("sv-shake"), 500);
    }
  };

  if (instant) {
    r.items.forEach(showItem);
    showVerdict();
  } else {
    r.items.forEach((it, k) => setTimeout(() => showItem(it, k), 1400 + k * REVEAL_STEP));
    setTimeout(showVerdict, 1400 + r.items.length * REVEAL_STEP + 600);
  }
  return { el };
}

// Finale
function stageFinal(s) {
  const m = me();
  const [a, b] = s.final.finalists;
  const voted = s.final.jury[myName];
  const el = h("div", "sv-card sv-final",
    h("span", "sv-kicker", "👑 Finale"),
    h("h3", "", `${a} contre ${b}`),
    h("div", "sv-finalists", ...s.final.finalists.map(f => h("div", "sv-finalist", avatarEl(f, true), h("strong", "", f), torches(s.tribe.find(t => t.name === f)?.lives || 0)))),
    h("p", "sv-lead", "Plaidoyer : chaque finaliste a 30 secondes pour convaincre le jury (en vrai !)."));
  const live = h("div");
  if (!spectator && m?.dead) {
    if (voted) el.append(h("p", "sv-wait", `🔒 Tu as voté pour ${voted}.`));
    else {
      el.append(h("p", "", h("strong", "", "Juré, qui mérite de gagner ?")));
      el.append(h("div", "sv-vote-grid", ...s.final.finalists.map(f => {
        const btn = h("button", "sv-vote", avatarEl(f, true), h("strong", "", `Voter ${f}`));
        btn.type = "button";
        btn.addEventListener("click", () => mutate("juryVote", { finalist: f }));
        return btn;
      })));
    }
  } else if (!spectator) {
    el.append(h("p", "sv-wait", m && !m.dead ? "Le jury délibère… croise les doigts." : "Le jury délibère…"));
  }
  el.append(live);
  return { el, update: next => live.replaceChildren(progress(next, "jurés ont voté")) };
}

// Fin
function stageEnd(s) {
  const res = s.result;
  const stats = Object.entries(s.stats || {});
  const top = (key, minimum = 1) => {
    const best = stats.filter(([, st]) => (st[key] || 0) >= minimum).sort((x, y) => (y[1][key] || 0) - (x[1][key] || 0))[0];
    return best ? `${best[0]} (${best[1][key]})` : "—";
  };
  const juryBox = h("div", "sv-jury-reveal");
  const el = h("div", "sv-card sv-end",
    h("span", "sv-kicker", "🏝️ Fin de l'aventure"),
    avatarEl(res.winner, true),
    h("h3", "sv-winner", `👑 ${res.winner || "?"}`),
    h("p", "sv-lead", res.items.length ? `est le Survivant, élu par le jury${res.tie ? " (égalité tranchée par le sort)" : ""}.` : "est le dernier survivant."),
    juryBox,
    h("div", "sv-awards",
      award("💀 Première victime", s.firstOut || "—"),
      award("🏆 Roi des épreuves", top("challengesWon")),
      award("🎯 Aimant à votes", top("votesReceived")),
      award("🔥 Plus gros martyr", top("livesLost")),
      award("🗿 Maître des idoles", top("idolsPlayed")),
      award("🍻 Plus assoiffé", top("punishments"))));
  res.items.forEach((it, k) => setTimeout(() => {
    juryBox.append(h("span", "sv-jury-vote", `${it.juror} → ${it.finalist}`));
    sound.tick();
  }, firstState ? 0 : 400 + k * 900));
  if (!firstState) setTimeout(() => { sound.win(); confetti(); }, 400 + res.items.length * 900);
  return { el };
}

const award = (title, value) => h("div", "sv-award", h("small", "", title), h("strong", "", value));

function confetti() {
  fx()?.confetti?.();
}

// Mon sac : flambeaux, immunité, avantages secrets (jamais affiché sur la TV).
function renderMe() {
  const m = me();
  if (spectator || !m) { meEl.replaceChildren(); meEl.hidden = true; return; }
  meEl.hidden = false;
  const items = m.advantages.map((key, i) => {
    const a = ADVANTAGES[key];
    const usable = key === "life" ? !m.dead : state.phase === "council" && !m.dead;
    const row = h("div", "sv-adv", h("span", "sv-adv-icon", a.icon), h("div", "", h("strong", "", a.name), h("small", "", a.text)));
    if (key === "block" && usable) {
      const select = document.createElement("select");
      alive(state).filter(p => p.name !== myName).forEach(p => select.append(new Option(p.name, p.name)));
      row.append(select, button("Jouer", () => mutate("play", { advantage: key, target: select.value }), "btn small primary"));
    } else {
      row.append(button("Jouer", () => mutate("play", { advantage: key }), "btn small primary", !usable));
    }
    row.dataset.i = i;
    return row;
  });
  meEl.replaceChildren(
    h("div", "sv-me-head",
      avatarEl(myName),
      h("div", "", h("strong", "", m.dead ? `${myName} · juré` : myName), torches(m.lives, m.dead)),
      m.immune && !m.dead ? h("span", "sv-badge immune", "🗿 Immunisé") : null),
    h("div", "sv-bag",
      h("span", "sv-bag-title", "🎒 Ton sac secret"),
      items.length ? items : h("p", "muted", m.dead ? "Les éliminés n'ont plus d'avantages." : "Vide. Gagne une épreuve pour fouiller l'île.")));
}

function renderTribe() {
  const s = state;
  const waiting = new Set(pending(s));
  const sorted = [...s.tribe].sort((a, b) => Number(a.dead) - Number(b.dead));
  tribeEl.replaceChildren(...sorted.map(p => {
    const tags = [];
    if (p.name === myName) tags.push(h("span", "sv-badge me", "toi"));
    if (p.immune && !p.dead) tags.push(h("span", "sv-badge immune", "🗿"));
    const tracked = s.phase === "council" || s.phase === "final" || (s.phase === "challenge" && s.challenge.kind !== "physical");
    if (tracked && !waiting.has(p.name) && (s.phase === "final" ? p.dead : !p.dead && candidatesFor(s, p.name).length > 0)) tags.push(h("span", "sv-badge done", "✓"));
    if (s.phase === "final" && s.final.finalists.includes(p.name)) tags.push(h("span", "sv-badge final", "finaliste"));
    return h("div", `sv-member${p.dead ? " dead" : ""}${s.phase === "reveal" && s.reveal?.loser === p.name ? " hit" : ""}`,
      avatarEl(p.name),
      h("div", "sv-member-info", h("strong", "", p.name), torches(p.lives, p.dead), p.dead ? h("small", "", `Jury · éliminé manche ${p.out}`) : null),
      h("div", "sv-member-tags", tags));
  }));
}

function renderHost() {
  if (spectator || !isHost || !state) { hostEl.replaceChildren(); hostEl.hidden = true; return; }
  hostEl.hidden = false;
  const s = state;
  const items = [h("span", "sv-host-title", "👑 Hôte")];
  const missing = pending(s);
  if (s.phase === "intro") items.push(button("Lancer la 1re épreuve 🏝️", () => mutate("start"), "btn primary big-btn", s.tribe.length < 3));
  if (s.phase === "challenge") {
    if (s.challenge.kind === "physical") items.push(judgeBox(s));
    else items.push(button(missing.length ? `Clore l'épreuve (sans ${missing.join(", ")})` : "Clore l'épreuve", () => mutate("closeChallenge"), "btn secondary"));
    items.push(button("🔄 Autre épreuve", () => mutate("reroll"), "btn small"));
  }
  if (s.phase === "challengeResult") items.push(button("Ouvrir le conseil 🔥", () => mutate("openCouncil"), "btn primary big-btn"));
  if (s.phase === "council") items.push(button(missing.length ? `Clore les votes (${missing.join(", ")} n'${missing.length > 1 ? "ont" : "a"} pas voté)` : "Clore les votes", () => mutate("closeCouncil"), "btn secondary"));
  if (s.phase === "reveal") items.push(button(alive(s).length <= 2 ? "Passer à la finale 👑" : "Manche suivante ⚡", () => mutate("next"), "btn primary big-btn"));
  if (s.phase === "final") items.push(button(missing.length ? `Clore le vote du jury (sans ${missing.join(", ")})` : "Clore le vote du jury", () => mutate("closeFinal"), "btn secondary"));
  if (s.phase === "end") items.push(button("Rejouer 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  hostEl.replaceChildren(...items);
}

// Défi physique : l'hôte choisit le gagnant et le perdant.
let judge = { winner: null, loser: null };
function judgeBox(s) {
  const box = h("div", "sv-judge");
  const names = alive(s).map(p => p.name);
  const row = (label, field) => h("div", "sv-judge-row", h("small", "", label), h("div", "sv-chips", ...names.map(n => {
    const b = h("button", `sv-chip${judge[field] === n ? " selected" : ""}`, n);
    b.type = "button";
    b.addEventListener("click", () => { judge = { ...judge, [field]: judge[field] === n ? null : n }; renderHost(); });
    return b;
  })));
  box.append(row("🏆 Gagnant (immunité)", "winner"), row("🍻 Perdant (boit)", "loser"),
    button("Valider le défi", () => { const j = judge; judge = { winner: null, loser: null }; mutate("judge", j); }, "btn primary", !judge.winner && !judge.loser));
  return box;
}

// ---------- Démarrage ----------

let firstState = true;
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
  if (data.survivor) {
    applyState(data.survivor);
    firstState = false;
  } else render();
}, error => console.error("Survivor : synchro impossible", error));

if (!spectator) watchHost(roomCode, savedData, value => { isHost = value; render(); });

async function backToLobby() {
  if (isHost) {
    try {
      await lobbyWrite(updateDoc(roomRef, {
        gameStarted: false,
        roomStatus: "lobby",
        screen: "lobby",
        activeGame: null,
        gameState: {},
        forceNavigation: { target: "lobby", at: Date.now() }
      }));
    } catch (error) {
      console.error("Erreur retour lobby global :", error);
    }
  }
  localStorage.setItem("partyhubReturnLobby", "true");
  window.location.href = "../../index.html";
}

$("backToLobbyBtn").addEventListener("click", backToLobby);
render();
