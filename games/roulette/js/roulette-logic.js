// Règles de la Roulette, sans navigateur ni Firebase : testable seul dans Node.
//
// Chacun son tour, le joueur fait tourner la roue sur SON téléphone ; le résultat est pour lui :
//   BOIS      : il boit.
//   DISTRIBUE : il répartit des gorgées entre les autres (choix sur son téléphone).
//   DUEL      : il choisit un adversaire ; mini-duel sur les deux téléphones, le perdant boit.
//   TOUS      : tout le monde boit.
//   CHANCE    : il gagne un bonus qu'il garde (bouclier, miroir, cadeau).
//   CHAOS     : une action chaos pour le groupe.
// Événements rares : DOUBLE SPIN (il rejoue), MODE FURIE (gorgées ×2 pendant 3 tours),
// MORT SUBITE (le prochain résultat compte double), JACKPOT (bonus), MEGA CHAOS (tout le monde boit).
// Le jeu compte les gorgées de chacun.
//
// applyAction(state, type, payload, me, ctx) modifie `state` ou lève une Error.
// ctx = { rng, partyMode, drinkLevel, alcohol }.

import { ACTIONS, GAGES_BOIS, GAGES_TOUS } from "./roulette-content.js";
import { punishment as drawPunishment, normalizeLevel } from "../../../punishments.js";

export const CATEGORIES = ["BOIS", "DISTRIBUE", "DUEL", "TOUS", "CHANCE", "CHAOS"];
export const SEGMENT = 360 / CATEGORIES.length;
export const SPIN_MS = 4850;

export const BONUSES = {
  shield: { icon: "🛡️", name: "Bouclier", text: "Annule une punition qui te tombe dessus." },
  mirror: { icon: "🪞", name: "Miroir", text: "Renvoie une punition qui te tombe dessus à quelqu'un d'autre." },
  gift: { icon: "🎁", name: "Cadeau empoisonné", text: "Fais boire 3 gorgées à qui tu veux, quand tu veux." }
};

export const RARE = {
  double: { label: "🔥 DOUBLE SPIN", text: "Tu rejoues juste après !" },
  furie: { label: "⚡ MODE FURIE", text: "Toutes les gorgées comptent double pendant 3 tours." },
  sudden: { label: "☠️ MORT SUBITE", text: "Le prochain résultat comptera double." },
  jackpot: { label: "🎯 JACKPOT", text: "Tu gagnes un bonus en plus !" },
  mega: { label: "💀 MEGA CHAOS", text: "Tout le monde boit 2 gorgées en plus." }
};

export const DUELS = {
  reflex: { icon: "⚡", name: "Duel de réflexe", text: "Tape dès que l'écran passe au vert. Le plus lent boit (un faux départ = perdu).", better: "low" },
  tap: { icon: "👆", name: "Sprint de taps", text: "Tape le plus vite possible pendant 5 secondes. Le moins rapide boit.", better: "high" }
};
export const DUEL_FAIL = 99999;

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 30); };
const find = (s, name) => s.players.find(p => p.name === name);

export function baseSips(drinkLevel) {
  return { soft: 2, normal: 3, hard: 5, extreme: 7, danger: 7 }[drinkLevel] || 3;
}

const gorgees = n => `${n} gorgée${n > 1 ? "s" : ""}`;

// Texte de la case tirée. {n} / {h} reprennent les gorgées réellement comptées par le jeu.
// Sans alcool : gages à la place des gorgées.
export function actionText(category, sips, ctx) {
  const rng = ctx.rng || Math.random;
  if (ctx.alcohol === false) {
    if (category === "BOIS") return pick(GAGES_BOIS, rng);
    if (category === "TOUS") return pick(GAGES_TOUS, rng);
    if (category === "CHAOS") return drawPunishment({ alcohol: false, rng });
    if (category === "DISTRIBUE") return `Distribue ${sips} gage${sips > 1 ? "s" : ""} (pompes, imitations…) 🎁`;
    return "";
  }
  const pool = category === "CHAOS" ? ACTIONS.CHAOS[normalizeLevel(ctx.drinkLevel)] : ACTIONS[category];
  if (!pool?.length) return "";
  return pick(pool, rng).replaceAll("{n}", gorgees(sips)).replaceAll("{h}", gorgees(Math.ceil(sips / 2)));
}

// ---------- Partie ----------

export function newGame(players, session = 0) {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  return {
    v: 0, session, phase: "intro", turn: 0, rotation: 0,
    players: real.map(p => ({ name: p.name, avatar: p.avatar || "🎡" })),
    current: real[0]?.name || null,
    spin: null, furie: 0, sudden: false,
    bonuses: Object.fromEntries(real.map(p => [p.name, []])),
    sips: Object.fromEntries(real.map(p => [p.name, 0])),
    stats: Object.fromEntries(real.map(p => [p.name, { spins: 0, duelsWon: 0, duelsLost: 0, distributed: 0, bonusesUsed: 0 }])),
    recent: [], log: ["🎡 La roue est prête. Chacun son tour !"]
  };
}

function nextPlayer(s, from) {
  const i = s.players.findIndex(p => p.name === from);
  return s.players[((i < 0 ? 0 : i) + 1) % s.players.length].name;
}

// Ajoute des gorgées à quelqu'un (avec Furie / Mort subite déjà intégrées dans `mult`).
function drink(s, name, amount) {
  if (!find(s, name) || amount <= 0) return;
  s.sips[name] = (s.sips[name] || 0) + amount;
}

function spin(s, ctx) {
  const rng = ctx.rng;
  const category = pick(CATEGORIES, rng);
  // Angle : le pointeur est en haut (0°), on aligne le centre de la case tirée dessous.
  const index = CATEGORIES.indexOf(category);
  const center = index * SEGMENT + SEGMENT / 2;
  const jitter = (rng() * (SEGMENT - 14)) - (SEGMENT - 14) / 2;
  const target = ((-center + jitter) % 360 + 360) % 360;
  const currentAngle = ((s.rotation % 360) + 360) % 360;
  const delta = ((target - currentAngle) % 360 + 360) % 360;
  const startRotation = s.rotation;
  s.rotation = s.rotation + 1440 + delta;

  const rareKey = rng() < 0.1 ? pick(Object.keys(RARE), rng) : null;

  // Multiplicateur de gorgées : Furie (×2) et Mort subite (×2) se cumulent.
  const mult = (s.furie > 0 ? 2 : 1) * (s.sudden ? 2 : 1);
  if (s.furie > 0) s.furie -= 1;
  s.sudden = false;

  s.turn += 1;
  const by = s.current;
  s.stats[by].spins += 1;
  const sips = baseSips(ctx.drinkLevel) * mult;
  s.spin = {
    id: s.turn, by, category, startRotation, rotation: s.rotation, rare: rareKey, mult,
    text: category === "DUEL" || category === "CHANCE" ? "" : actionText(category, baseSips(ctx.drinkLevel) * mult, ctx),
    sips, victims: [], resolved: false, protectedBy: null
  };

  if (category === "BOIS") { s.spin.victims = [by]; drink(s, by, sips); s.spin.resolved = true; }
  if (category === "TOUS") { s.players.forEach(p => drink(s, p.name, Math.ceil(sips / 2))); s.spin.victims = s.players.map(p => p.name); s.spin.resolved = true; }
  if (category === "CHAOS") s.spin.resolved = true;
  if (category === "CHANCE") {
    const bonus = pick(Object.keys(BONUSES), rng);
    s.bonuses[by].push(bonus);
    s.spin.bonus = bonus;
    s.spin.resolved = true;
  }
  if (category === "DISTRIBUE") s.spin.budget = sips;
  if (category === "DUEL") s.spin.duel = { kind: pick(Object.keys(DUELS), rng), opponent: null, scores: {}, loser: null };

  if (rareKey === "furie") s.furie = 3;
  if (rareKey === "sudden") s.sudden = true;
  if (rareKey === "jackpot") { const b = pick(Object.keys(BONUSES), rng); s.bonuses[by].push(b); s.spin.jackpot = b; }
  if (rareKey === "mega") s.players.forEach(p => drink(s, p.name, 2));

  say(s, `🎡 ${by} tombe sur ${category}${rareKey ? ` + ${RARE[rareKey].label}` : ""}`);
}

function closeDuel(s, ctx) {
  const d = s.spin.duel;
  const better = DUELS[d.kind].better;
  const [a, b] = [s.spin.by, d.opponent];
  const sa = d.scores[a] ?? (better === "low" ? DUEL_FAIL : 0);
  const sb = d.scores[b] ?? (better === "low" ? DUEL_FAIL : 0);
  let loser;
  if (sa === sb) loser = pick([a, b], ctx.rng);
  else loser = better === "low" ? (sa > sb ? a : b) : (sa < sb ? a : b);
  d.loser = loser;
  const winner = loser === a ? b : a;
  s.stats[winner].duelsWon += 1;
  s.stats[loser].duelsLost += 1;
  s.spin.victims = [loser];
  drink(s, loser, s.spin.sips);
  s.spin.resolved = true;
  say(s, `⚔️ ${winner} gagne le duel : ${loser} boit ${s.spin.sips} gorgées.`);
}

// ---------- Actions ----------

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  ctx = { rng: Math.random, partyMode: "Party", drinkLevel: "normal", alcohol: true, ...ctx };
  const sp = s.spin;
  const drives = sp && (sp.by === me.name || me.host); // le lanceur décide (l'hôte en secours)

  switch (type) {
    case "start": {
      if (!me.host) throw new Error("Seul l'hôte peut faire ça.");
      if (s.phase !== "intro") return;
      if (s.players.length < 2) throw new Error("Il faut au moins 2 joueurs.");
      s.phase = "play";
      s.current = pick(s.players, ctx.rng).name;
      say(s, `🎡 C'est parti ! ${s.current} commence.`);
      return;
    }

    case "spin": {
      if (s.phase !== "play") return;
      if (s.current !== me.name && !me.host) throw new Error(`C'est à ${s.current} de faire tourner la roue.`);
      if (sp && !sp.closed) throw new Error("Termine d'abord le tour en cours.");
      spin(s, ctx);
      return;
    }

    // DISTRIBUE : { give: { nom: gorgées } } (total = budget)
    case "distribute": {
      if (!sp || sp.category !== "DISTRIBUE" || sp.resolved) return;
      if (!drives) throw new Error("C'est au lanceur de distribuer.");
      const give = payload.give || {};
      const total = Object.values(give).reduce((a, b) => a + (Number(b) || 0), 0);
      if (total !== sp.budget) throw new Error(`Distribue exactement ${sp.budget} gorgées.`);
      if (Object.keys(give).some(n => !find(s, n) || n === sp.by || give[n] < 0)) throw new Error("Distribution impossible.");
      Object.entries(give).forEach(([n, k]) => { if (k > 0) drink(s, n, k); });
      sp.given = give;
      sp.victims = Object.keys(give).filter(n => give[n] > 0);
      sp.resolved = true;
      s.stats[sp.by].distributed += total;
      say(s, `🎁 ${sp.by} distribue : ${sp.victims.map(n => `${n} ${give[n]}`).join(", ")}.`);
      return;
    }

    case "duelPick": {
      if (!sp || sp.category !== "DUEL" || sp.resolved || sp.duel.opponent) return;
      if (!drives) throw new Error("C'est au lanceur de choisir son adversaire.");
      if (!find(s, payload.opponent) || payload.opponent === sp.by) throw new Error("Choisis un autre joueur.");
      sp.duel.opponent = payload.opponent;
      say(s, `⚔️ ${sp.by} défie ${payload.opponent} : ${DUELS[sp.duel.kind].name} !`);
      return;
    }

    case "duelScore": {
      if (!sp || sp.category !== "DUEL" || sp.resolved || !sp.duel.opponent) return;
      if (me.name !== sp.by && me.name !== sp.duel.opponent) throw new Error("Tu ne participes pas au duel.");
      if (sp.duel.scores[me.name] != null) return;
      sp.duel.scores[me.name] = Math.max(0, Math.round(Number(payload.score) || 0));
      if (sp.duel.scores[sp.by] != null && sp.duel.scores[sp.duel.opponent] != null) closeDuel(s, ctx);
      return;
    }

    case "closeDuel": {
      if (!sp || sp.category !== "DUEL" || sp.resolved || !sp.duel.opponent) return;
      if (!drives) throw new Error("Le lanceur (ou l'hôte) clôt le duel.");
      closeDuel(s, ctx);
      return;
    }

    // Bonus : bouclier / miroir quand on vient de prendre une punition ; cadeau quand on veut.
    case "bonus": {
      const key = payload.bonus;
      const list = s.bonuses[me.name] || [];
      const idx = list.indexOf(key);
      if (idx < 0) throw new Error("Tu n'as pas ce bonus.");
      if (key === "gift") {
        if (!find(s, payload.target) || payload.target === me.name) throw new Error("Choisis un autre joueur.");
        drink(s, payload.target, 3);
        say(s, `🎁 ${me.name} offre 3 gorgées empoisonnées à ${payload.target} !`);
      } else {
        if (!sp || !sp.resolved || sp.closed || !sp.victims.includes(me.name) || sp.protectedBy?.includes(me.name)) throw new Error("Ce bonus se joue quand une punition te tombe dessus.");
        if (key === "mirror" && (!find(s, payload.target) || payload.target === me.name)) throw new Error("Choisis à qui renvoyer la punition.");
        const amount = sp.category === "TOUS" ? Math.ceil(sp.sips / 2) : sp.given?.[me.name] || sp.sips;
        s.sips[me.name] = Math.max(0, (s.sips[me.name] || 0) - amount);
        sp.protectedBy = [...(sp.protectedBy || []), me.name];
        if (key === "shield") say(s, `🛡️ ${me.name} se protège avec son bouclier !`);
        if (key === "mirror") {
          drink(s, payload.target, amount);
          say(s, `🪞 ${me.name} renvoie sa punition à ${payload.target} !`);
        }
      }
      list.splice(idx, 1);
      s.stats[me.name].bonusesUsed += 1;
      return;
    }

    // Fin du tour : joueur suivant (ou le même avec DOUBLE SPIN).
    case "next": {
      if (s.phase !== "play" || !sp || sp.closed) return;
      if (!drives) throw new Error("Le lanceur (ou l'hôte) passe au suivant.");
      if (!sp.resolved) throw new Error("Le tour n'est pas terminé.");
      sp.closed = true;
      s.current = sp.rare === "double" ? sp.by : nextPlayer(s, sp.by);
      return;
    }

    case "end": {
      if (!me.host) throw new Error("Seul l'hôte peut faire ça.");
      if (s.phase !== "play") return;
      s.phase = "end";
      say(s, "🏁 Fin de la roulette !");
      return;
    }

    case "restart": {
      if (!me.host) throw new Error("Seul l'hôte peut faire ça.");
      const next = newGame(payload.players || s.players, s.session);
      next.rotation = s.rotation;
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}
