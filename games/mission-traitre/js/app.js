// Mission Traître — page de jeu (téléphones) et vue TV (?tv=1 / ?spectator=1).
// L'état vit dans le doc de la room (champ `traitor`). Chaque action passe par une transaction
// qui applique traitor-logic.js. Les rôles ne s'affichent que sur le téléphone de chacun.

import { db, doc, onSnapshot, runTransaction, updateDoc } from "../../../firebase.js";
import { resolveIsHost, lobbyWrite, watchHost, hostNameOf } from "../../../game-common.js";
import { safeImageSrc } from "../../../html-safe.js";
import { newGame, applyAction, alive, aliveTraitors, pending, targetsFor, MIN_PLAYERS } from "./traitor-logic.js";

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

if (spectator) document.body.classList.add("mt-tv");
if (params.get("embed") === "1") document.body.classList.add("mt-embed");

const roomRef = doc(db, "rooms", roomCode);
const $ = id => document.getElementById(id);
const stageEl = $("mtStage");
const roleEl = $("mtRole");
const playersEl = $("mtPlayers");
const hostEl = $("mtHost");
const logEl = $("mtLog");
const roundEl = $("mtRound");
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
  sting: () => [440, 415, 392, 330].forEach((f, i) => fx()?.tone?.(f, 0.25, "sawtooth", 0.4, null, i * 0.15)),
  win: () => [523, 659, 784, 1046].forEach((f, i) => fx()?.tone?.(f, 0.2, "triangle", 0.7, null, i * 0.12)),
  night: () => [196, 165, 131].forEach((f, i) => fx()?.tone?.(f, 0.5, "sine", 0.5, null, i * 0.3))
};

let roomPlayers = [];
function avatarEl(name, big = false) {
  const box = h("span", `mt-avatar${big ? " big" : ""}`);
  const p = roomPlayers.find(rp => rp?.name === name);
  const src = safeImageSrc(p?.avatarBase64 || p?.avatarUrl);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    box.append(img);
  } else {
    box.textContent = p?.avatar || state?.players.find(t => t.name === name)?.avatar || "🎭";
  }
  return box;
}

function toast(text, tone = "info") {
  const el = h("div", `mt-toast tone-${tone}`, text);
  document.body.append(el);
  setTimeout(() => el.classList.add("leaving"), 3600);
  setTimeout(() => el.remove(), 4100);
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
      if (!data.traitor) throw new Error("La partie n'a pas encore commencé.");
      const next = JSON.parse(JSON.stringify(data.traitor));
      // L'hôte est relu dans la room (pas la parole du téléphone).
      applyAction(next, type, payload, { name: myName, host: hostNameOf(data.players) === myName }, { rng: Math.random, ...settings });
      next.v = (data.traitor.v || 0) + 1;
      t.update(roomRef, { traitor: next });
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

// Nouvelle partie à chaque lancement depuis le lobby (session = activeGame.startedAt).
async function ensureGame(data) {
  const session = data.activeGame?.startedAt || 0;
  if (data.traitor && data.traitor.session === session) return;
  try {
    await runTransaction(db, async t => {
      const d = (await t.get(roomRef)).data() || {};
      const s = d.activeGame?.startedAt || 0;
      if (d.traitor && d.traitor.session === s) return;
      t.update(roomRef, { traitor: newGame(d.players || [], s) });
    });
  } catch (error) {
    console.error("Mission Traître : création de la partie impossible", error);
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
  if (before && before.phase !== "intro" && next.phase === "intro") roleShown = false; // « Rejouer » : nouveaux rôles
  if (!before || spectator || before.session !== next.session || before.phase === next.phase) return;
  const m = me();
  if (!m || m.out) return;
  if (next.phase === "day" && m.role === "traitor") { navigator.vibrate?.([60, 40, 60]); toast("😈 Nouvelle mission secrète ! (regarde ton rôle)", "bad"); }
  if (next.phase === "council") { navigator.vibrate?.([80, 60, 80]); toast("⚖️ Table ronde : vote en secret.", "gold"); }
  if (next.phase === "night") { navigator.vibrate?.([80, 60, 80]); sound.night(); toast("🌙 La nuit tombe : fais ton choix.", "gold"); }
}

// ---------- Rendu ----------

const me = () => state?.players.find(p => p.name === myName) || null;
let stageKey = "";
let stageUpdate = null;

function render() {
  if (!state) { fill(stageEl, h("div", "mt-card", h("p", "muted", "Distribution des rôles…"))); return; }
  roundEl.textContent = state.round ? `Manche ${state.round}` : "Avant-partie";
  document.body.classList.toggle("mt-night-mode", state.phase === "night");
  renderStage();
  renderRole();
  renderPlayers();
  renderHost();
  fill(logEl, (state.log || []).map(line => h("li", "", line)));
}

function renderStage() {
  const s = state;
  const m = me();
  const key = [s.session, s.phase, s.round, Boolean(s.votes?.[myName]), Boolean(s.night?.[myName]), Boolean(m?.out)].join("|");
  if (key !== stageKey) {
    stageKey = key;
    const builder = { intro: stageIntro, day: stageDay, council: stageCouncil, banish: stageBanish, night: stageNight, morning: stageMorning, end: stageEnd }[s.phase];
    const built = builder ? builder(s) : { el: h("div", "mt-card", "…") };
    stageUpdate = built.update || null;
    fill(stageEl, built.el);
    stageEl.classList.remove("mt-pop");
    void stageEl.offsetWidth;
    stageEl.classList.add("mt-pop");
  }
  stageUpdate?.(s);
}

function missionMeter(s) {
  const box = h("div", "mt-meter", h("span", "", `🎯 Missions des traîtres : ${s.missionsDone}/${s.goal}`));
  const bar = h("div", "mt-meter-bar");
  bar.append(Object.assign(h("i"), { style: `width:${Math.min(100, (s.missionsDone / s.goal) * 100)}%` }));
  box.append(bar);
  return box;
}

function progress(s, verb) {
  const left = pending(s);
  const total = alive(s).length;
  const done = total - left.length;
  return h("div", "mt-progress",
    h("div", "mt-progress-bar", Object.assign(h("span"), { style: `width:${total ? (done / total) * 100 : 0}%` })),
    h("span", "", `${done}/${total} ${verb}`));
}

function stageIntro(s) {
  return {
    el: h("div", "mt-card mt-intro",
      h("span", "mt-kicker", "🎭 Mission Traître"),
      h("h3", "", "Les rôles sont distribués"),
      h("p", "mt-lead", spectator ? `${s.players.length} joueurs. ${s.traitorCount} traître${s.traitorCount > 1 ? "s se cachent" : " se cache"} parmi eux…` : "Regarde ton rôle en secret (en bas), puis range ton téléphone avec un air innocent."),
      h("ol", "mt-steps",
        h("li", "", h("strong", "", "Journée : "), "on discute. Les traîtres ont une mission secrète à réussir en vrai."),
        h("li", "", h("strong", "", "Table ronde : "), "vote secret, le plus voté est banni et révèle son rôle."),
        h("li", "", h("strong", "", "Nuit : "), "tout le monde touche son téléphone ; les traîtres éliminent quelqu'un."),
        h("li", "", h("strong", "", "Victoire : "), `innocents s'ils bannissent tous les traîtres ; traîtres s'ils deviennent aussi nombreux ou réussissent ${s.goal} missions.`)),
      s.players.length < MIN_PLAYERS ? h("p", "mt-warn", `Il faut au moins ${MIN_PLAYERS} joueurs (les joueurs test ne comptent pas).`) : null)
  };
}

function stageDay(s) {
  return {
    el: h("div", "mt-card mt-day",
      h("span", "mt-kicker", `☀️ Journée · manche ${s.round}`),
      h("h3", "", "Discutez… et observez."),
      h("p", "mt-lead", "Les traîtres essaient de réussir leur mission sans se faire remarquer. Qui agit bizarrement ?"),
      missionMeter(s),
      h("p", "muted", isHost ? "Lance la table ronde quand vous êtes prêts." : "L'hôte lancera la table ronde."))
  };
}

// Grille de choix (vote du jour ou choix de nuit) avec confirmation.
let confirmTarget = null;
function choiceGrid(list, verb, onConfirm) {
  const wrap = h("div", "mt-choice");
  const grid = h("div", "mt-grid");
  const confirmBox = h("div", "mt-confirm");
  const draw = () => {
    grid.querySelectorAll("button").forEach(b => b.classList.toggle("selected", b.dataset.name === confirmTarget));
    fill(confirmBox, confirmTarget ? [
      h("span", "", `${verb} ${confirmTarget} ?`),
      button("✅ Confirmer", () => { const t = confirmTarget; confirmTarget = null; onConfirm(t); }, "btn primary"),
      button("Changer", () => { confirmTarget = null; draw(); })
    ] : []);
  };
  list.forEach(name => {
    const b = h("button", "mt-pick", avatarEl(name, true), h("strong", "", name));
    b.type = "button";
    b.dataset.name = name;
    b.addEventListener("click", () => { confirmTarget = name; navigator.vibrate?.(15); draw(); });
    grid.append(b);
  });
  wrap.append(grid, confirmBox);
  draw();
  return wrap;
}

function stageCouncil(s) {
  const m = me();
  const voted = s.votes[myName];
  const live = h("div");
  const el = h("div", "mt-card mt-council", h("span", "mt-kicker", "⚖️ Table ronde"));
  if (spectator) el.append(h("h3", "", "Les joueurs votent…"), h("p", "mt-lead", "Chacun désigne en secret celui qu'il pense être un traître."));
  else if (!m || m.out) el.append(h("h3", "", "Tu es hors jeu"), h("p", "mt-lead", "Regarde les autres s'accuser…"));
  else if (voted) el.append(h("h3", "", "🔒 Vote scellé"), h("p", "mt-lead", `Tu as voté contre ${voted}.`));
  else el.append(h("h3", "", "Qui est un traître ?"), choiceGrid(targetsFor(s, myName), "Voter contre", t => mutate("vote", { target: t })));
  el.append(live);
  return { el, update: next => fill(live, progress(next, "ont voté")) };
}

// Dépouillement animé puis révélation du rôle du banni.
const STEP = 2000;
let banishSeen = null;
function stageBanish(s) {
  const b = s.banish;
  const instant = banishSeen === null && firstState;
  banishSeen = `${s.session}:${s.round}`;
  const cards = h("div", "mt-votes");
  const tally = h("div", "mt-tally");
  const verdict = h("div", "mt-verdict");
  const el = h("div", "mt-card mt-banish", h("span", "mt-kicker", "⚖️ Dépouillement"), h("h3", "", b.items.length ? "Les votes…" : "Aucun vote"), cards, tally, verdict);
  const counts = {};
  const drawTally = () => {
    const names = Object.keys(counts).sort((x, y) => counts[y] - counts[x]);
    const max = Math.max(1, ...Object.values(counts));
    fill(tally, names.map(n => h("div", "mt-tally-row", h("strong", "", n), h("span", "mt-tally-bar", Object.assign(h("i"), { style: `width:${(counts[n] / max) * 100}%` })), h("em", "", String(counts[n])))));
  };
  const showItem = (it, k) => {
    cards.append(h("div", "mt-vote-card", h("small", "", `Vote ${k + 1}`), avatarEl(it.target, true), h("strong", "", it.target)));
    counts[it.target] = (counts[it.target] || 0) + 1;
    drawTally();
    if (!instant) sound.drum();
  };
  const showVerdict = () => {
    if (!b.name) { fill(verdict, h("strong", "", "Personne n'est banni.")); return; }
    const traitor = b.role === "traitor";
    verdict.className = `mt-verdict ${traitor ? "traitor" : "innocent"}`;
    fill(verdict,
      b.tie ? h("p", "mt-note", `⚖️ Égalité entre ${b.tie.join(" et ")} : le sort désigne ${b.name}.`) : null,
      avatarEl(b.name, true),
      h("span", "mt-suspense", `${b.name} est banni… et c'était…`),
      h("strong", "mt-role-reveal", traitor ? "😈 UN TRAÎTRE !" : "😇 UN INNOCENT…"));
    if (!instant) {
      (traitor ? sound.win : sound.sting)();
      if (b.name === myName) navigator.vibrate?.([200, 80, 200]);
    }
  };
  if (instant) { b.items.forEach(showItem); showVerdict(); }
  else {
    b.items.forEach((it, k) => setTimeout(() => showItem(it, k), 1200 + k * STEP));
    setTimeout(() => {
      verdict.className = "mt-verdict";
      fill(verdict, h("span", "mt-suspense", b.name ? `${b.name}, tu es banni. Révèle ton rôle…` : ""));
    }, 1200 + b.items.length * STEP + 300);
    setTimeout(showVerdict, 1200 + b.items.length * STEP + 2600);
  }
  return { el };
}

// La nuit : même écran pour tout le monde (pour ne rien trahir), seul le texte change.
function stageNight(s) {
  const m = me();
  const picked = s.night[myName];
  const live = h("div");
  const el = h("div", "mt-card mt-night", h("span", "mt-kicker", "🌙 La nuit"));
  if (spectator) {
    el.append(h("h3", "", "La nuit tombe sur le village…"), h("p", "mt-lead", "Tout le monde fait un choix sur son téléphone. Les traîtres choisissent leur victime."));
  } else if (!m || m.out) {
    el.append(h("h3", "", "Tu dors (pour toujours)…"), h("p", "mt-lead", "Les vivants font leur choix."));
  } else if (picked) {
    el.append(h("h3", "", "🔒 Choix fait"), h("p", "mt-lead", "Range ton téléphone et attends le matin."));
  } else if (m.role === "traitor") {
    const allies = aliveTraitors(s).filter(p => p.name !== myName);
    const allyPicks = allies.map(a => s.night[a.name] ? `${a.name} vise ${s.night[a.name]}` : null).filter(Boolean);
    el.append(h("h3", "", "Qui éliminez-vous cette nuit ?"),
      allyPicks.length ? h("p", "mt-note", `🤫 ${allyPicks.join(" · ")}`) : null,
      choiceGrid(targetsFor(s, myName), "Choisir", t => mutate("nightPick", { target: t })));
  } else {
    el.append(h("h3", "", "Qui soupçonnes-tu le plus ?"),
      choiceGrid(targetsFor(s, myName), "Choisir", t => mutate("nightPick", { target: t })));
  }
  el.append(live);
  return { el, update: next => fill(live, progress(next, "ont fait leur choix")) };
}

function stageMorning(s) {
  const mo = s.morning;
  return {
    el: h("div", "mt-card mt-morning",
      h("span", "mt-kicker", "🌅 Le matin"),
      mo.victim ? avatarEl(mo.victim, true) : null,
      h("h3", "", mo.victim ? `${mo.victim} a été éliminé cette nuit…` : "Personne n'a été éliminé cette nuit."),
      mo.victim ? h("p", "mt-lead", "C'était un innocent. Les traîtres sont toujours parmi vous.") : null,
      mo.suspicions.length ? h("div", "mt-suspicions", h("small", "", "Les soupçons de la nuit"),
        mo.suspicions.map(x => h("div", "mt-tally-row", h("strong", "", x.name), h("span", "mt-tally-bar", Object.assign(h("i"), { style: `width:${(x.count / mo.suspicions[0].count) * 100}%` })), h("em", "", String(x.count))))) : null,
      missionMeter(s))
  };
}

function stageEnd(s) {
  const r = s.result;
  const traitorsWin = r.winner === "traitors";
  const m = me();
  const iWon = m && ((m.role === "traitor") === traitorsWin);
  if (!firstState) { (traitorsWin ? sound.sting : sound.win)(); fx()?.confetti?.(); }
  return {
    el: h("div", `mt-card mt-end ${traitorsWin ? "traitors" : "innocents"}`,
      h("span", "mt-kicker", "🏁 Fin de partie"),
      h("h3", "", traitorsWin ? "😈 Victoire des traîtres" : "🎉 Victoire des innocents"),
      h("p", "mt-lead", r.reason),
      m ? h("p", `mt-you ${iWon ? "won" : "lost"}`, iWon ? "Tu as gagné !" : "Tu as perdu…") : null,
      h("div", "mt-roles", s.players.map(p => h("div", `mt-role-chip ${p.role}`, avatarEl(p.name), h("strong", "", p.name), h("span", "", p.role === "traitor" ? "😈 Traître" : "😇 Innocent")))),
      s.missionLog.length ? h("div", "mt-missions-done", h("small", "", "Missions réussies"), s.missionLog.map(x => h("span", "", `🎯 ${x.name} : ${x.title} (manche ${x.round})`))) : null,
      h("div", "mt-sanctions",
        h("p", "", h("strong", "", "🍻 Les perdants, chacun : "), r.punishment),
        h("p", "", h("strong", "", "👑 Gagnants : "), r.reward)))
  };
}

// Mon rôle : caché par défaut, on le dévoile en touchant (pour les voisins curieux).
let roleShown = false;
function renderRole() {
  const m = me();
  if (spectator || !m) { fill(roleEl); roleEl.hidden = true; return; }
  roleEl.hidden = false;
  const traitor = m.role === "traitor";
  const toggle = button(roleShown ? "🙈 Cacher mon rôle" : "👀 Voir mon rôle (en secret)", () => { roleShown = !roleShown; renderRole(); }, "btn secondary mt-role-toggle");
  if (!roleShown) {
    fill(roleEl, h("div", "mt-role-hidden", h("span", "", "🎭"), h("p", "", m.out ? "Tu es hors jeu, mais tu connais ton rôle." : "Ton rôle est caché.")), toggle);
    roleEl.className = "mt-role";
    return;
  }
  roleEl.className = `mt-role shown ${traitor ? "traitor" : "innocent"}`;
  const items = [
    h("span", "mt-kicker", traitor ? "😈 Tu es TRAÎTRE" : "😇 Tu es INNOCENT"),
    h("p", "mt-role-text", traitor
      ? "Ne te fais pas démasquer. Élimine les innocents la nuit et réussis tes missions."
      : "Trouve les traîtres et fais-les bannir à la table ronde.")
  ];
  if (traitor) {
    const allies = state.players.filter(p => p.role === "traitor" && p.name !== myName);
    if (allies.length) items.push(h("p", "mt-allies", `🤝 Tes complices : ${allies.map(a => `${a.name}${a.out ? " (hors jeu)" : ""}`).join(", ")}`));
    const mission = m.mission;
    if (mission && !m.out && ["day", "council"].includes(state.phase)) {
      items.push(h("div", `mt-mission${mission.done ? " done" : ""}`,
        h("strong", "", `🎯 ${mission.title}`),
        h("p", "", mission.objective),
        mission.secretWord ? h("p", "mt-secret", "Mot secret : ", h("b", "", mission.secretWord)) : null,
        h("ul", "", mission.rules.map(r => h("li", "", r))),
        h("small", "", `💡 ${mission.example}`),
        mission.done ? h("p", "mt-done", "✅ Mission validée") : button("✅ Mission réussie", () => {
          if (confirm("Mission vraiment réussie ? Tout le monde va voir qu'une mission secrète a été accomplie (sans savoir par qui).")) mutate("mission");
        }, "btn primary")));
    } else if (traitor && !m.out) {
      items.push(h("p", "muted", "Ta prochaine mission arrivera au début de la journée."));
    }
  }
  fill(roleEl, items, toggle);
}

function renderPlayers() {
  const s = state;
  const waiting = new Set(pending(s));
  const tracked = s.phase === "council" || s.phase === "night";
  const sorted = [...s.players].sort((a, b) => Number(Boolean(a.out)) - Number(Boolean(b.out)));
  fill(playersEl, sorted.map(p => {
    const tags = [];
    if (p.name === myName) tags.push(h("span", "mt-badge me", "toi"));
    if (tracked && !p.out && !waiting.has(p.name)) tags.push(h("span", "mt-badge done", "✓"));
    // Les rôles ne se voient que pour les bannis (et à la fin) ; les victimes de la nuit sont innocentes.
    const revealed = s.phase === "end" || p.out;
    if (revealed) tags.push(h("span", `mt-badge ${p.role}`, p.role === "traitor" ? "😈" : "😇"));
    const status = p.out ? (p.out.how === "banished" ? `Banni · manche ${p.out.round}` : `Éliminé la nuit · manche ${p.out.round}`) : null;
    return h("div", `mt-member${p.out ? " out" : ""}`, avatarEl(p.name),
      h("div", "mt-member-info", h("strong", "", p.name), status ? h("small", "", status) : null),
      h("div", "mt-member-tags", tags));
  }));
}

function renderHost() {
  if (spectator || !isHost || !state) { fill(hostEl); hostEl.hidden = true; return; }
  hostEl.hidden = false;
  const s = state;
  const missing = pending(s);
  const items = [h("span", "mt-host-title", "👑 Hôte")];
  if (s.phase === "intro") items.push(button("Commencer la 1re journée ☀️", () => mutate("start"), "btn primary big-btn", s.players.length < MIN_PLAYERS));
  if (s.phase === "day") items.push(button("Lancer la table ronde ⚖️", () => mutate("council"), "btn primary big-btn"));
  if (s.phase === "council") items.push(button(missing.length ? `Clore les votes (${missing.join(", ")} n'${missing.length > 1 ? "ont" : "a"} pas voté)` : "Clore les votes", () => mutate("closeCouncil")));
  if (s.phase === "banish") items.push(button("La nuit tombe 🌙", () => mutate("night"), "btn primary big-btn"));
  if (s.phase === "night") items.push(button(missing.length ? `Lever le jour (sans ${missing.join(", ")})` : "Lever le jour", () => mutate("closeNight")));
  if (s.phase === "morning") items.push(button("Nouvelle journée ☀️", () => mutate("nextRound"), "btn primary big-btn"));
  if (s.phase === "end") items.push(button("Rejouer (nouveaux rôles) 🔁", () => mutate("restart", { players: roomPlayers }), "btn primary big-btn"));
  fill(hostEl, items);
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
  if (data.traitor) {
    // Nouvelle partie : on recache le rôle.
    if (state && data.traitor.session !== state.session) roleShown = false;
    applyState(data.traitor);
    firstState = false;
  } else render();
}, error => console.error("Mission Traître : synchro impossible", error));

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
