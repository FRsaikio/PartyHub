// Règles de Mission Traître (façon « Les Traîtres »), sans navigateur ni Firebase.
//
// Déroulé d'une manche :
//   « day »     : discussion libre. Chaque traître a une mission secrète à réussir en vrai ;
//                 il la valide discrètement sur son téléphone.
//   « council » : table ronde. Chaque joueur en vie vote en secret contre un suspect.
//   « banish »  : dépouillement ; le plus voté est banni et révèle son rôle.
//   « night »   : TOUT LE MONDE touche son écran (pour ne pas trahir les traîtres) :
//                 les traîtres choisissent leur victime, les innocents désignent un suspect.
//   « morning » : la victime est découverte, avec le classement des soupçons de la nuit.
// Les innocents gagnent quand tous les traîtres sont bannis. Les traîtres gagnent s'ils sont
// aussi nombreux que les innocents encore en jeu, ou s'ils réussissent assez de missions.
//
// applyAction(state, type, payload, me, ctx) modifie `state` en place ou lève une Error.
// ctx = { rng, drinkLevel, alcohol }.

import { MISSIONS, SECRET_WORDS, LOSER_PUNISHMENTS, WINNER_REWARDS } from "./traitor-content.js";

export const MIN_PLAYERS = 4;
export const traitorsFor = count => (count <= 6 ? 1 : count <= 11 ? 2 : 3);
// Missions à réussir pour une victoire des traîtres « par les missions ».
export const missionGoal = traitors => 3 * traitors;

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const shuffle = (list, rng) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 40); };

export const alive = s => s.players.filter(p => !p.out);
export const aliveTraitors = s => alive(s).filter(p => p.role === "traitor");
export const aliveInnocents = s => alive(s).filter(p => p.role === "innocent");
const find = (s, name) => s.players.find(p => p.name === name);

// ---------- Nouvelle partie ----------

export function newGame(players, session = 0, rng = Math.random) {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  const count = traitorsFor(real.length);
  const traitors = new Set(shuffle(real.map(p => p.name), rng).slice(0, count));
  return {
    v: 0, session, round: 0, phase: "intro",
    players: real.map(p => ({ name: p.name, avatar: p.avatar || "🎭", role: traitors.has(p.name) ? "traitor" : "innocent", out: null, mission: null })),
    traitorCount: count,
    goal: missionGoal(count),
    missionsDone: 0,
    usedMissions: [],
    missionLog: [],
    votes: {}, banish: null, night: {}, morning: null,
    result: null,
    log: ["🎭 Les rôles sont distribués. Chacun découvre le sien en secret."]
  };
}

function giveMissions(s, rng) {
  aliveTraitors(s).forEach(p => {
    let free = MISSIONS.map((_, i) => i).filter(i => !s.usedMissions.includes(i));
    if (!free.length) { s.usedMissions = []; free = MISSIONS.map((_, i) => i); }
    const index = pick(free, rng);
    s.usedMissions.push(index);
    const m = MISSIONS[index];
    p.mission = { index, title: m.title, objective: m.objective, rules: m.rules, example: m.example, secretWord: m.secretWord ? pick(SECRET_WORDS, rng) : null, done: false };
  });
}

function startDay(s, ctx) {
  s.round += 1;
  s.phase = "day";
  s.votes = {};
  s.night = {};
  s.banish = null;
  s.morning = null;
  giveMissions(s, ctx.rng);
  say(s, `☀️ Manche ${s.round} : discutez… les traîtres ont une nouvelle mission.`);
}

// ---------- Fin de partie ----------

function punishment(ctx) {
  const rng = ctx.rng;
  if (ctx.alcohol === false) return pick(["Les perdants font un gros gage 😇", "Les perdants racontent une vérité", "Les perdants font une imitation ridicule", "Le groupe choisit un gage pour les perdants"], rng);
  const level = ctx.drinkLevel === "extreme" ? "danger" : ctx.drinkLevel;
  return pick(LOSER_PUNISHMENTS[level] || LOSER_PUNISHMENTS.normal, rng);
}

function checkWinner(s) {
  if (!aliveTraitors(s).length) return { winner: "innocents", reason: "Tous les traîtres ont été démasqués !" };
  if (aliveTraitors(s).length >= aliveInnocents(s).length) return { winner: "traitors", reason: "Les traîtres sont aussi nombreux que les innocents : ils prennent le contrôle." };
  if (s.missionsDone >= s.goal) return { winner: "traitors", reason: `Les traîtres ont réussi ${s.goal} missions secrètes.` };
  return null;
}

function finish(s, verdict, ctx) {
  s.phase = "end";
  s.result = { ...verdict, punishment: punishment(ctx), reward: pick(WINNER_REWARDS, ctx.rng) };
  say(s, verdict.winner === "innocents" ? `🎉 Victoire des innocents : ${verdict.reason}` : `😈 Victoire des traîtres : ${verdict.reason}`);
}

// ---------- Table ronde ----------

function closeCouncil(s, ctx) {
  const tally = {};
  Object.values(s.votes).forEach(t => { if (find(s, t) && !find(s, t).out) tally[t] = (tally[t] || 0) + 1; });
  const top = Math.max(0, ...Object.values(tally));
  const tied = Object.keys(tally).filter(n => tally[n] === top);
  const name = top > 0 ? pick(tied, ctx.rng) : null;
  // Ordre de lecture : mélangé, avec un vote pour le banni en dernier (suspense).
  let items = shuffle(Object.entries(s.votes).map(([voter, target]) => ({ voter, target })), ctx.rng);
  const last = items.map(i => i.target === name).lastIndexOf(true);
  if (name && last >= 0) items.push(items.splice(last, 1)[0]);

  s.banish = { items, tally, tie: tied.length > 1 ? tied : null, name, role: null };
  if (name) {
    const p = find(s, name);
    p.out = { how: "banished", round: s.round };
    s.banish.role = p.role;
    say(s, `⚖️ ${name} est banni… et c'était ${p.role === "traitor" ? "un TRAÎTRE 😈" : "un innocent 😇"}.`);
  } else {
    say(s, "⚖️ Aucun vote : personne n'est banni.");
  }
  s.phase = "banish";
}

// ---------- Nuit ----------

function closeNight(s, ctx) {
  const innocents = aliveInnocents(s).map(p => p.name);
  const traitorPicks = {};
  const suspicions = {};
  Object.entries(s.night).forEach(([who, target]) => {
    const p = find(s, who);
    if (!p || p.out) return;
    if (p.role === "traitor" && innocents.includes(target)) traitorPicks[target] = (traitorPicks[target] || 0) + 1;
    if (p.role === "innocent") suspicions[target] = (suspicions[target] || 0) + 1;
  });
  const top = Math.max(0, ...Object.values(traitorPicks));
  // Égalité entre traîtres, ou traîtres absents : la victime est tirée parmi leurs choix (ou au hasard).
  const pool = top > 0 ? Object.keys(traitorPicks).filter(n => traitorPicks[n] === top) : innocents;
  const victim = pool.length ? pick(pool, ctx.rng) : null;
  if (victim) {
    find(s, victim).out = { how: "murdered", round: s.round };
    say(s, `🌙 Cette nuit, ${victim} a été éliminé par les traîtres.`);
  }
  s.morning = {
    victim,
    suspicions: Object.entries(suspicions).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  };
  s.phase = "morning";
}

// Qui doit encore agir (affichage « 3/5 » et bouton « clore » de l'hôte).
export function pending(s) {
  if (s.phase === "council") return alive(s).filter(p => !s.votes[p.name]).map(p => p.name);
  if (s.phase === "night") return alive(s).filter(p => !s.night[p.name]).map(p => p.name);
  return [];
}

// Cibles possibles pour `name` (vote du jour ou choix de nuit).
export function targetsFor(s, name, phase = s.phase) {
  const me = find(s, name);
  if (!me || me.out) return [];
  if (phase === "night" && me.role === "traitor") return aliveInnocents(s).map(p => p.name);
  return alive(s).filter(p => p.name !== name).map(p => p.name);
}

// ---------- Actions ----------

const HOST_ONLY = ["start", "council", "closeCouncil", "night", "closeNight", "nextRound", "restart"];

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  ctx = { rng: Math.random, drinkLevel: "normal", alcohol: true, ...ctx };
  if (HOST_ONLY.includes(type) && !me.host) throw new Error("Seul l'hôte peut faire ça.");
  const mine = find(s, me.name);

  switch (type) {
    case "start": {
      if (s.phase !== "intro") return;
      if (s.players.length < MIN_PLAYERS) throw new Error(`Il faut au moins ${MIN_PLAYERS} joueurs.`);
      startDay(s, ctx);
      return;
    }

    // Le traître déclare sa mission réussie (discrètement).
    case "mission": {
      if (s.phase !== "day" && s.phase !== "council") throw new Error("Les missions se valident pendant la journée.");
      if (!mine || mine.out || mine.role !== "traitor" || !mine.mission) throw new Error("Tu n'as pas de mission.");
      if (mine.mission.done) return;
      mine.mission.done = true;
      s.missionsDone += 1;
      s.missionLog.push({ name: mine.name, title: mine.mission.title, round: s.round });
      say(s, `🎯 Une mission secrète vient d'être accomplie… (${s.missionsDone}/${s.goal})`);
      const verdict = checkWinner(s);
      if (verdict) finish(s, verdict, ctx);
      return;
    }

    case "council": {
      if (s.phase !== "day") return;
      s.phase = "council";
      s.votes = {};
      say(s, "⚖️ Table ronde : votez en secret contre celui que vous soupçonnez.");
      return;
    }

    case "vote": {
      if (s.phase !== "council") return;
      if (!mine || mine.out) throw new Error("Seuls les joueurs en jeu votent.");
      if (s.votes[me.name]) throw new Error("Tu as déjà voté.");
      if (!targetsFor(s, me.name).includes(payload.target)) throw new Error("Vote impossible contre ce joueur.");
      s.votes[me.name] = payload.target;
      if (!pending(s).length) closeCouncil(s, ctx);
      return;
    }

    case "closeCouncil": {
      if (s.phase !== "council") return;
      closeCouncil(s, ctx);
      return;
    }

    case "night": {
      if (s.phase !== "banish") return;
      const verdict = checkWinner(s);
      if (verdict) { finish(s, verdict, ctx); return; }
      s.phase = "night";
      s.night = {};
      say(s, "🌙 La nuit tombe. Tout le monde choisit quelqu'un sur son téléphone…");
      return;
    }

    case "nightPick": {
      if (s.phase !== "night") return;
      if (!mine || mine.out) throw new Error("Tu n'es plus en jeu.");
      if (s.night[me.name]) throw new Error("Ton choix est déjà fait.");
      if (!targetsFor(s, me.name).includes(payload.target)) throw new Error("Choix impossible.");
      s.night[me.name] = payload.target;
      if (!pending(s).length) closeNight(s, ctx);
      return;
    }

    case "closeNight": {
      if (s.phase !== "night") return;
      closeNight(s, ctx);
      return;
    }

    case "nextRound": {
      if (s.phase !== "morning") return;
      const verdict = checkWinner(s);
      if (verdict) { finish(s, verdict, ctx); return; }
      startDay(s, ctx);
      return;
    }

    case "restart": {
      const next = newGame(payload.players || s.players, s.session, ctx.rng);
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}
