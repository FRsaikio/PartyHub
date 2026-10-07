// Règles de Most Likely (« Qui est le plus susceptible de… »), sans navigateur ni Firebase.
//
// Chaque manche : une question. Chacun vote en secret sur son téléphone pour la personne
// visée ET parie sur qui sera désigné. Quand tout le monde a voté, les votes sont révélés
// un par un. Le plus voté prend une punition (égalité : personne). Bonne prédiction = 1 point.
//
// applyAction(state, type, payload, me, ctx) modifie `state` ou lève une Error.
// ctx = { rng, partyMode, drinkLevel, alcohol }.

import { QUESTIONS, MORE_QUESTIONS, PENALTIES } from "./ml-content.js";

export const roundsFor = duration => ({ short: 5, medium: 10, long: 15, infinite: 999 }[duration] || 10);

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 30); };
const find = (s, name) => s.players.find(p => p.name === name);

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function questionPool(partyMode) {
  return [...(QUESTIONS[partyMode] || QUESTIONS.Party), ...(MORE_QUESTIONS[partyMode] || [])];
}

export function newGame(players, session = 0, duration = "medium") {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  return {
    v: 0, session, phase: "intro", round: 0, maxRounds: roundsFor(duration),
    players: real.map(p => ({ name: p.name, avatar: p.avatar || "🤔" })),
    question: null, used: [], votes: {}, predictions: {}, result: null,
    scores: Object.fromEntries(real.map(p => [p.name, 0])),
    prophet: Object.fromEntries(real.map(p => [p.name, 0])),
    history: [], log: ["🤔 Qui est le plus susceptible de… ? Votez, pariez, assumez."]
  };
}

function nextQuestion(s, ctx) {
  const pool = questionPool(ctx.partyMode);
  let free = pool.filter(q => !s.used.includes(q));
  if (!free.length) { s.used = []; free = pool; }
  s.question = pick(free, ctx.rng);
  s.used.push(s.question);
}

function startRound(s, ctx) {
  s.round += 1;
  s.phase = "vote";
  s.votes = {};
  s.predictions = {};
  s.result = null;
  nextQuestion(s, ctx);
}

function penalty(ctx) {
  if (ctx.alcohol === false) return pick(["Mini-gage choisi par le groupe 😇", "Vérité obligatoire", "Imitation ridicule", "Danse de 10 secondes"], ctx.rng);
  const level = ctx.drinkLevel === "extreme" ? "danger" : ctx.drinkLevel;
  return pick(PENALTIES[level] || PENALTIES.normal, ctx.rng);
}

export const pending = s => (s.phase === "vote" ? s.players.filter(p => !s.votes[p.name]).map(p => p.name) : []);

function reveal(s, ctx) {
  const tally = {};
  Object.values(s.votes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter(n => tally[n] === top);
  const designated = top > 0 && leaders.length === 1 ? leaders[0] : null;
  // Lecture : mélangée, avec un vote pour le désigné en dernier (suspense).
  let items = shuffle(Object.entries(s.votes).map(([voter, target]) => ({ voter, target })), ctx.rng);
  const last = items.map(i => i.target === designated).lastIndexOf(true);
  if (designated && last >= 0) items.push(items.splice(last, 1)[0]);
  const prophets = designated ? Object.entries(s.predictions).filter(([, p]) => p === designated).map(([n]) => n) : [];
  prophets.forEach(n => { s.prophet[n] = (s.prophet[n] || 0) + 1; });
  if (designated) s.scores[designated] = (s.scores[designated] || 0) + 1;
  s.result = {
    designated, tie: designated ? null : leaders, tally, items, prophets,
    predictions: { ...s.predictions },
    penalty: designated ? penalty(ctx) : null
  };
  s.history.push({ question: s.question, designated, tie: designated ? null : leaders });
  s.phase = "reveal";
  say(s, designated ? `🎯 ${designated} est désigné (${top} vote${top > 1 ? "s" : ""}) !` : `🤝 Égalité${leaders.length ? ` entre ${leaders.join(", ")}` : ""} : personne ne boit.`);
}

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  ctx = { rng: Math.random, partyMode: "Party", drinkLevel: "normal", alcohol: true, ...ctx };
  const hostOnly = ["start", "close", "next", "skip", "end", "restart"];
  if (hostOnly.includes(type) && !me.host) throw new Error("Seul l'hôte peut faire ça.");

  switch (type) {
    case "start": {
      if (s.phase !== "intro") return;
      if (s.players.length < 2) throw new Error("Il faut au moins 2 joueurs.");
      startRound(s, ctx);
      return;
    }

    // Vote + prédiction envoyés ensemble.
    case "vote": {
      if (s.phase !== "vote") return;
      if (!find(s, me.name)) throw new Error("Tu ne joues pas cette partie.");
      if (s.votes[me.name]) throw new Error("Tu as déjà voté.");
      if (!find(s, payload.target) || !find(s, payload.prediction)) throw new Error("Choisis ton vote et ton pari.");
      s.votes[me.name] = payload.target;
      s.predictions[me.name] = payload.prediction;
      if (!pending(s).length) reveal(s, ctx);
      return;
    }

    case "close": {
      if (s.phase !== "vote") return;
      reveal(s, ctx);
      return;
    }

    // Autre question pour la même manche.
    case "skip": {
      if (s.phase !== "vote") return;
      s.votes = {};
      s.predictions = {};
      nextQuestion(s, ctx);
      return;
    }

    case "next": {
      if (s.phase !== "reveal") return;
      if (s.round >= s.maxRounds) { s.phase = "end"; say(s, "🏁 Fin de la partie !"); return; }
      startRound(s, ctx);
      return;
    }

    case "end": {
      if (s.phase === "intro" || s.phase === "end") return;
      s.phase = "end";
      say(s, "🏁 Fin de la partie !");
      return;
    }

    case "restart": {
      const next = newGame(payload.players || s.players, s.session, payload.duration);
      next.maxRounds = s.maxRounds;
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}
