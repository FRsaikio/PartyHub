// Règles de « Je n'ai jamais », sans navigateur ni Firebase : testable seul dans Node.
//
// Chaque manche : une phrase « Je n'ai jamais… ». Chacun répond en secret sur son téléphone
// (« Déjà fait » ou « Jamais ») ET devine combien de joueurs l'ont déjà fait. Personne ne
// voit les réponses avant la révélation, qui montre tout d'un coup. Ceux qui l'ont fait
// boivent ; le ou les pronostics les plus proches gagnent un point.
//
// applyAction(state, type, payload, me, ctx) modifie `state` ou lève une Error.
// ctx = { rng, partyMode, drinkLevel, alcohol }.

import { QUESTIONS, RARE_QUESTIONS, PUNISHMENTS, BONUS } from "./never-content.js";

export const roundsFor = duration => ({ short: 8, medium: 15, long: 25, infinite: 999 }[duration] || 15);
export const RARE_CHANCE = 0.08;
export const STREAK = 3; // « déjà fait » d'affilée pour déclencher le bonus de série

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 30); };
const find = (s, name) => s.players.find(p => p.name === name);
const level = ctx => (ctx.drinkLevel === "extreme" ? "danger" : ctx.drinkLevel);

export function newGame(players, session = 0, duration = "medium") {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  return {
    v: 0, session, phase: "intro", round: 0, maxRounds: roundsFor(duration),
    players: real.map(p => ({ name: p.name, avatar: p.avatar || "🥂" })),
    question: null, rare: false, used: [], answers: {}, result: null,
    did: Object.fromEntries(real.map(p => [p.name, 0])),
    streak: Object.fromEntries(real.map(p => [p.name, 0])),
    points: Object.fromEntries(real.map(p => [p.name, 0])),
    history: [], log: ["🥂 Je n'ai jamais… Répondez en secret, devinez, assumez."]
  };
}

function nextQuestion(s, ctx) {
  const rng = ctx.rng;
  if (rng() < RARE_CHANCE) {
    s.question = pick(RARE_QUESTIONS[ctx.partyMode] || RARE_QUESTIONS.Party, rng);
    s.rare = true;
    return;
  }
  const pool = QUESTIONS[ctx.partyMode] || QUESTIONS.Party;
  let free = pool.filter(q => !s.used.includes(q));
  if (!free.length) { s.used = []; free = pool; }
  s.question = pick(free, rng);
  s.rare = false;
  s.used.push(s.question);
}

function startRound(s, ctx) {
  s.round += 1;
  s.phase = "answer";
  s.answers = {};
  s.result = null;
  nextQuestion(s, ctx);
}

export const pending = s => (s.phase === "answer" ? s.players.filter(p => !s.answers[p.name]).map(p => p.name) : []);

function reveal(s, ctx) {
  const entries = Object.entries(s.answers);
  const didList = entries.filter(([, a]) => a.did).map(([n]) => n);
  const count = didList.length;
  // Pronostics : le ou les plus proches du vrai nombre gagnent un point.
  const gaps = entries.map(([n, a]) => [n, Math.abs((a.guess ?? 0) - count)]);
  const best = gaps.length ? Math.min(...gaps.map(([, g]) => g)) : null;
  const winners = best === null ? [] : gaps.filter(([, g]) => g === best).map(([n]) => n);
  winners.forEach(n => { s.points[n] = (s.points[n] || 0) + 1; });

  // Séries : 3 « déjà fait » d'affilée → bonus.
  const streaks = [];
  s.players.forEach(p => {
    const a = s.answers[p.name];
    if (!a) return;
    if (a.did) {
      s.did[p.name] = (s.did[p.name] || 0) + 1;
      s.streak[p.name] = (s.streak[p.name] || 0) + 1;
      if (s.streak[p.name] >= STREAK) streaks.push({ name: p.name, n: s.streak[p.name] });
    } else s.streak[p.name] = 0;
  });

  const punishment = ctx.alcohol === false
    ? pick(["Ceux qui l'ont déjà fait font un mini-gage.", "Ceux qui l'ont déjà fait racontent une vérité.", "Ceux qui l'ont déjà fait font une imitation."], ctx.rng)
    : pick(PUNISHMENTS[level(ctx)] || PUNISHMENTS.normal, ctx.rng);
  const bonusPool = BONUS.did[level(ctx)] || BONUS.did.normal;
  s.result = {
    count, total: entries.length, did: didList, never: entries.filter(([, a]) => !a.did).map(([n]) => n),
    guesses: Object.fromEntries(entries.map(([n, a]) => [n, a.guess ?? 0])),
    winners, exact: best === 0,
    punishment: count ? punishment : null,
    bonus: count ? pick(bonusPool, ctx.rng) : pick(BONUS.safe, ctx.rng),
    streaks
  };
  s.history.push({ question: s.question, count, total: entries.length });
  s.phase = "reveal";
  say(s, count ? `🍻 ${count}/${entries.length} l'ont déjà fait : ${didList.join(", ")}` : `😇 Personne ne l'a jamais fait !`);
}

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  ctx = { rng: Math.random, partyMode: "Party", drinkLevel: "normal", alcohol: true, ...ctx };
  if (["start", "close", "next", "skip", "end", "restart"].includes(type) && !me.host) throw new Error("Seul l'hôte peut faire ça.");

  switch (type) {
    case "start": {
      if (s.phase !== "intro") return;
      if (s.players.length < 2) throw new Error("Il faut au moins 2 joueurs.");
      startRound(s, ctx);
      return;
    }

    // Réponse + pronostic envoyés ensemble.
    case "answer": {
      if (s.phase !== "answer") return;
      if (!find(s, me.name)) throw new Error("Tu ne joues pas cette partie.");
      if (s.answers[me.name]) throw new Error("Tu as déjà répondu.");
      if (typeof payload.did !== "boolean") throw new Error("Réponds « Déjà fait » ou « Jamais ».");
      const guess = Math.round(Number(payload.guess));
      if (!(guess >= 0 && guess <= s.players.length)) throw new Error(`Devine un nombre entre 0 et ${s.players.length}.`);
      s.answers[me.name] = { did: payload.did, guess };
      if (!pending(s).length) reveal(s, ctx);
      return;
    }

    case "close": {
      if (s.phase !== "answer") return;
      reveal(s, ctx);
      return;
    }

    case "skip": {
      if (s.phase !== "answer") return;
      s.answers = {};
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
      const next = newGame(payload.players || s.players, s.session);
      next.maxRounds = s.maxRounds;
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}
