// Règles de Survivor, sans navigateur ni Firebase : testable seul dans Node.
//
// Une manche :
//   1. Épreuve (« challenge ») : mini-jeu sur chaque téléphone (réflexe, sprint de taps, mémoire)
//      ou défi physique arbitré par l'hôte. Le meilleur gagne l'immunité, le dernier boit.
//   2. Conseil (« council ») : chaque survivant vote en secret sur son téléphone. Les avantages
//      secrets se jouent à ce moment-là (idole, vote double, vote bloqué).
//   3. Dépouillement (« reveal ») : les votes sont révélés un par un. Le plus voté perd un
//      flambeau (une vie) et prend une punition ; sans flambeau, il quitte l'île et rejoint le jury.
//   Quand il ne reste que 2 survivants : finale (« final »), le jury des éliminés vote pour le gagnant.
//
// applyAction(state, type, payload, me, ctx) modifie `state` en place, ou lève une Error
// dont le message s'affiche au joueur. ctx = { now, rng, mode, drinkLevel, alcohol }.

import { punishment as drawPunishment } from "../../../punishments.js";
import { PHYSICAL_CHALLENGES } from "./survivor-content.js";

export const START_LIVES = 3;
// Flambeaux de départ selon la taille de la tribu (la room accepte 20 joueurs) :
// 3 jusqu'à 5 joueurs, 2 jusqu'à 9, puis 1 (élimination directe) pour garder des parties courtes.
export const livesFor = count => (count <= 5 ? 3 : count <= 9 ? 2 : 1);
export const MAX_LIVES = 5;
export const MIN_PLAYERS = 3;
export const FALSE_START = 9999; // score du réflexe en cas de faux départ

export const PHONE_GAMES = {
  reflex: { icon: "⚡", title: "Réflexe", text: "Tape dès que l'écran passe au VERT. Le plus rapide gagne l'immunité, le plus lent boit. Un faux départ = dernier !", better: "low", unit: "ms" },
  tap: { icon: "👆", title: "Sprint de taps", text: "Tape le plus de fois possible en 5 secondes.", better: "high", unit: "taps" },
  simon: { icon: "🧠", title: "Mémoire de la tribu", text: "Retiens la suite de symboles et reproduis-la. Elle s'allonge à chaque tour.", better: "high", unit: "symboles" }
};

export const ADVANTAGES = {
  idol: { icon: "🗿", name: "Idole d'immunité", text: "À jouer pendant le conseil : tous les votes contre toi seront annulés." },
  double: { icon: "🗳️", name: "Vote double", text: "À jouer pendant le conseil : ton vote compte deux fois." },
  block: { icon: "🚫", name: "Vote bloqué", text: "À jouer pendant le conseil : le vote d'un joueur de ton choix ne comptera pas." },
  life: { icon: "🔥", name: "Flambeau bonus", text: "À jouer quand tu veux : tu récupères un flambeau." }
};

const EVENTS = [
  { key: "storm", label: "🌪️ Tempête", text: "Tout le monde boit une gorgée avant l'épreuve." },
  { key: "blood", label: "☠️ Conseil sanglant", text: "Ce soir, le plus voté perd DEUX flambeaux." },
  { key: "doubleVotes", label: "🗳️ Votes doublés", text: "Tous les votes de ce conseil comptent double." },
  { key: "treasure", label: "🏴‍☠️ Coffre caché", text: "Un survivant trouve un avantage secret." },
  { key: "rebellion", label: "🔥 Rébellion", text: "Un éliminé revient sur l'île avec un flambeau." },
  { key: "curse", label: "💀 Vote maudit", text: "Un survivant commence le conseil avec un vote contre lui." },
  { key: "noImmunity", label: "🚫 Pas d'immunité", text: "Le gagnant de l'épreuve ne sera pas protégé ce soir." },
  { key: "tax", label: "🍻 Taxe de la tribu", text: "Tous les survivants boivent une gorgée avant de voter." }
];

// ---------- Outils ----------

const fresh = () => ({ challengesWon: 0, challengesLost: 0, votesReceived: 0, votesGiven: 0, livesLost: 0, idolsPlayed: 0, advantagesFound: 0, punishments: 0 });
const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const alive = s => s.tribe.filter(p => !p.dead);
const jury = s => s.tribe.filter(p => p.dead);
const find = (s, name) => s.tribe.find(p => p.name === name);
const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 30); };
const stat = (s, name) => (s.stats[name] ||= fresh());
const flames = n => `${n} flambeau${n > 1 ? "x" : ""}`;

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function punishmentFor(ctx) {
  return drawPunishment({ level: ctx.drinkLevel, alcohol: ctx.alcohol !== false, rng: ctx.rng || Math.random });
}

// ---------- Nouvelle partie ----------

// players = joueurs de la room ; les joueurs « test » (fake) ne jouent pas.
export function newGame(players, session = 0) {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  const startLives = livesFor(real.length);
  const tribe = real.map(p => ({
    name: p.name, avatar: p.avatar || "🌴", lives: startLives, dead: false, out: 0, advantages: [], immune: false
  }));
  return {
    v: 0, session, round: 0, phase: "intro", tribe, startLives,
    challenge: null, event: null, mods: {}, council: null, reveal: null, final: null, result: null,
    stats: Object.fromEntries(tribe.map(p => [p.name, fresh()])),
    firstOut: null, log: ["🏝️ Bienvenue sur l'île. Que la meilleure stratégie gagne."]
  };
}

// ---------- Manche ----------

// reroll = autre épreuve pour la même manche : on garde le numéro et l'événement.
function startRound(s, ctx, reroll = false) {
  const rng = ctx.rng;
  if (!reroll) {
    s.round += 1;
    s.tribe.forEach(p => { p.immune = false; });
    s.council = null;
    s.reveal = null;
    s.mods = {};
    s.event = null;
    // Un événement de l'île une manche sur trois environ (pas à la toute première).
    if (s.round > 1 && rng() < 0.35) applyEvent(s, pick(EVENTS, rng), ctx);
  }

  const kind = rng() < 0.6 ? pick(Object.keys(PHONE_GAMES), rng) : "physical";
  const pool = PHYSICAL_CHALLENGES[ctx.mode] || PHYSICAL_CHALLENGES.Party;
  s.challenge = kind === "physical"
    ? { kind, icon: "🏃", title: "Défi physique", text: pick(pool, rng), results: {} }
    : { kind, ...PHONE_GAMES[kind], results: {} };
  s.phase = "challenge";
  say(s, `${s.challenge.icon} Manche ${s.round} — ${s.challenge.title}${kind === "physical" ? ` : ${s.challenge.text}` : ""}`);
}

function applyEvent(s, event, ctx) {
  const rng = ctx.rng;
  s.event = { key: event.key, label: event.label, text: event.text };
  if (event.key === "blood") s.mods.lifeLoss = 2;
  if (event.key === "doubleVotes") s.mods.voteMult = 2;
  if (event.key === "noImmunity") s.mods.noImmunity = true;
  if (event.key === "treasure") {
    const lucky = pick(alive(s), rng);
    if (lucky) { giveAdvantage(s, lucky, ctx); s.event.text = `${lucky.name} a trouvé quelque chose… mais quoi ?`; }
  }
  if (event.key === "curse") {
    const target = pick(alive(s), rng);
    if (target) { s.mods.cursed = target.name; s.event.text = `${target.name} commence le conseil avec un vote contre lui.`; }
  }
  if (event.key === "rebellion") {
    const back = pick(jury(s), rng);
    if (back && alive(s).length >= 3) {
      back.dead = false; back.out = 0; back.lives = 1;
      s.event.text = `${back.name} revient sur l'île avec un flambeau !`;
    } else {
      s.event = { key: "storm", label: EVENTS[0].label, text: EVENTS[0].text };
    }
  }
  say(s, `${s.event.label} : ${s.event.text}`);
}

function giveAdvantage(s, player, ctx) {
  const key = pick(Object.keys(ADVANTAGES), ctx.rng);
  player.advantages.push(key);
  stat(s, player.name).advantagesFound += 1;
  return key;
}

// Classement de l'épreuve téléphone : [{ name, score }] du meilleur au moins bon.
export function ranking(s) {
  const c = s.challenge;
  if (!c || c.kind === "physical") return [];
  const low = PHONE_GAMES[c.kind].better === "low";
  return Object.entries(c.results).map(([name, score]) => ({ name, score }))
    .sort((a, b) => (low ? a.score - b.score : b.score - a.score));
}

function finishChallenge(s, winner, loser, ctx) {
  const c = s.challenge;
  c.winner = winner || null;
  c.loser = loser && loser !== winner ? loser : null;
  c.punishment = c.loser ? punishmentFor(ctx) : null;
  c.found = null;

  if (c.winner) {
    stat(s, c.winner).challengesWon += 1;
    if (!s.mods.noImmunity) find(s, c.winner).immune = true;
    // Le gagnant fouille l'île : une chance sur deux de trouver un avantage secret.
    if (ctx.rng() < 0.5) c.found = giveAdvantage(s, find(s, c.winner), ctx) ? c.winner : null;
  }
  if (c.loser) {
    stat(s, c.loser).challengesLost += 1;
    stat(s, c.loser).punishments += 1;
  }
  s.phase = "challengeResult";
  say(s, [
    c.winner ? `🏆 ${c.winner} remporte l'épreuve${s.mods.noImmunity ? "" : " et l'immunité"}` : "Personne ne remporte l'épreuve",
    c.loser ? `🍻 ${c.loser} → ${c.punishment}` : ""
  ].filter(Boolean).join(" · "));
}

function closePhoneChallenge(s, ctx) {
  const list = ranking(s);
  // Égalités : on tire au sort parmi les ex aequo.
  const best = list.filter(r => r.score === list[0]?.score).map(r => r.name);
  const worst = list.filter(r => r.score === list[list.length - 1]?.score).map(r => r.name);
  finishChallenge(s, best.length ? pick(best, ctx.rng) : null, list.length > 1 ? pick(worst, ctx.rng) : null, ctx);
}

// ---------- Conseil ----------

// Qui `voter` peut viser : un survivant, pas lui-même, pas l'immunisé.
export function candidatesFor(s, voter) {
  return alive(s).filter(p => p.name !== voter && !p.immune).map(p => p.name);
}

const voters = s => alive(s).filter(p => candidatesFor(s, p.name).length > 0).map(p => p.name);

function openCouncil(s) {
  s.council = { votes: {}, idols: [], doubled: [], blocked: [] };
  s.phase = "council";
  say(s, "🔥 Le conseil commence. Votez en secret sur vos téléphones.");
}

function closeCouncil(s, ctx) {
  const rng = ctx.rng;
  const c = s.council;
  const mult = s.mods.voteMult || 1;
  let items = Object.entries(c.votes).map(([voter, target]) => ({
    voter, target,
    weight: mult * (c.doubled.includes(voter) ? 2 : 1),
    void: c.blocked.includes(voter) ? "bloqué" : c.idols.includes(target) ? "idole" : null
  }));
  if (s.mods.cursed && find(s, s.mods.cursed) && !find(s, s.mods.cursed).dead) {
    items.push({ voter: "💀 Malédiction", target: s.mods.cursed, weight: 1, void: c.idols.includes(s.mods.cursed) ? "idole" : null });
  }

  const tally = {};
  items.forEach(it => { if (!it.void) tally[it.target] = (tally[it.target] || 0) + it.weight; });
  const top = Math.max(0, ...Object.values(tally));
  const tied = Object.keys(tally).filter(name => tally[name] === top);
  const loser = top > 0 ? pick(tied, rng) : null;

  // Suspense : votes annulés d'abord, puis mélangés, et un vote décisif pour la fin.
  items = shuffle(items, rng);
  items.sort((a, b) => (b.void ? 1 : 0) - (a.void ? 1 : 0));
  const lastIdx = items.map(it => !it.void && it.target === loser).lastIndexOf(true);
  if (loser && lastIdx >= 0) items.push(items.splice(lastIdx, 1)[0]);

  const reveal = { items, tally, tie: tied.length > 1 ? tied : null, loser, idols: [...c.idols], lifeLoss: 0, eliminated: false, punishment: null };
  items.forEach(it => {
    if (find(s, it.voter)) stat(s, it.voter).votesGiven += 1;
    if (!it.void) stat(s, it.target).votesReceived += it.weight;
  });

  if (loser) {
    const p = find(s, loser);
    const loss = Math.min(p.lives, s.mods.lifeLoss || 1);
    p.lives -= loss;
    reveal.lifeLoss = loss;
    reveal.punishment = punishmentFor(ctx);
    stat(s, loser).livesLost += loss;
    stat(s, loser).punishments += 1;
    if (p.lives <= 0) {
      p.dead = true;
      p.out = s.round;
      p.advantages = [];
      reveal.eliminated = true;
      s.firstOut ||= loser;
    }
    say(s, reveal.eliminated
      ? `🔥 La tribu a parlé : ${loser} quitte l'île et rejoint le jury.`
      : `💔 ${loser} perd ${flames(loss)} (${flames(p.lives)} restant${p.lives > 1 ? "s" : ""}) → ${reveal.punishment}`);
  } else {
    say(s, "🗿 Aucun vote valable : personne ne perd de flambeau ce soir.");
  }

  s.reveal = reveal;
  s.council = null;
  s.phase = "reveal";
}

// ---------- Finale ----------

function openFinal(s) {
  s.tribe.forEach(p => { p.immune = false; });
  s.final = { finalists: alive(s).map(p => p.name), jury: {} };
  s.phase = "final";
  say(s, `👑 Finale : ${s.final.finalists.join(" contre ")}. Le jury des éliminés va désigner le Survivant.`);
}

function closeFinal(s, ctx) {
  const votes = {};
  s.final.finalists.forEach(f => { votes[f] = 0; });
  Object.values(s.final.jury).forEach(f => { votes[f] = (votes[f] || 0) + 1; });
  const top = Math.max(...Object.values(votes));
  const tied = Object.keys(votes).filter(f => votes[f] === top);
  const winner = pick(tied, ctx.rng);
  s.result = { winner, votes, tie: tied.length > 1, items: shuffle(Object.entries(s.final.jury).map(([juror, finalist]) => ({ juror, finalist })), ctx.rng) };
  s.phase = "end";
  say(s, `👑 ${winner} est le Survivant de la soirée !`);
}

function finishGame(s) {
  s.tribe.forEach(p => { p.immune = false; });
  const winner = alive(s)[0]?.name || null;
  s.result = { winner, votes: {}, tie: false, items: [] };
  s.phase = "end";
  if (winner) say(s, `👑 ${winner} est le dernier survivant !`);
}

// ---------- Actions ----------

const HOST_ONLY = ["start", "reroll", "closeChallenge", "judge", "openCouncil", "closeCouncil", "next", "closeFinal", "restart"];

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  ctx = { now: Date.now(), rng: Math.random, mode: "Party", drinkLevel: "normal", alcohol: true, ...ctx };
  if (HOST_ONLY.includes(type) && !me.host) throw new Error("Seul l'hôte peut faire ça.");
  const mine = find(s, me.name);

  switch (type) {
    case "start": {
      if (s.phase !== "intro") return;
      if (s.tribe.length < MIN_PLAYERS) throw new Error(`Il faut au moins ${MIN_PLAYERS} joueurs sur l'île.`);
      startRound(s, ctx);
      return;
    }

    // Autre épreuve pour la même manche (défi raté, pas adapté…).
    case "reroll": {
      if (s.phase !== "challenge") return;
      startRound(s, ctx, true);
      return;
    }

    case "submit": {
      if (s.phase !== "challenge" || s.challenge.kind === "physical") return;
      if (!mine || mine.dead) throw new Error("Seuls les survivants participent à l'épreuve.");
      if (s.challenge.results[me.name] != null) return; // un seul essai
      const score = Math.max(0, Math.round(Number(payload.score) || 0));
      s.challenge.results[me.name] = score;
      if (alive(s).every(p => s.challenge.results[p.name] != null)) closePhoneChallenge(s, ctx);
      return;
    }

    case "closeChallenge": {
      if (s.phase !== "challenge" || s.challenge.kind === "physical") return;
      closePhoneChallenge(s, ctx);
      return;
    }

    // Défi physique : l'hôte désigne le gagnant (immunité) et le perdant (punition).
    case "judge": {
      if (s.phase !== "challenge" || s.challenge.kind !== "physical") return;
      const ok = n => !n || (find(s, n) && !find(s, n).dead);
      if (!ok(payload.winner) || !ok(payload.loser)) throw new Error("Choisis des survivants encore en jeu.");
      finishChallenge(s, payload.winner || null, payload.loser || null, ctx);
      return;
    }

    case "openCouncil": {
      if (s.phase !== "challengeResult") return;
      openCouncil(s);
      return;
    }

    case "vote": {
      if (s.phase !== "council") return;
      if (!mine || mine.dead) throw new Error("Seuls les survivants votent au conseil.");
      if (s.council.votes[me.name]) throw new Error("Tu as déjà voté.");
      if (!candidatesFor(s, me.name).includes(payload.target)) throw new Error("Tu ne peux pas voter contre ce joueur.");
      s.council.votes[me.name] = payload.target;
      if (voters(s).every(name => s.council.votes[name])) closeCouncil(s, ctx);
      return;
    }

    // Jouer un avantage secret.
    case "play": {
      const key = payload.advantage;
      if (!mine || mine.dead) throw new Error("Tu n'es plus sur l'île.");
      const idx = mine.advantages.indexOf(key);
      if (idx < 0) throw new Error("Tu n'as pas cet avantage.");
      if (key !== "life" && s.phase !== "council") throw new Error("Cet avantage se joue pendant le conseil.");
      if (key === "life") {
        if (mine.lives >= MAX_LIVES) throw new Error(`Maximum ${MAX_LIVES} flambeaux.`);
        mine.lives += 1;
        say(s, `🔥 ${me.name} rallume un flambeau !`);
      }
      if (key === "idol") {
        if (s.council.idols.includes(me.name)) throw new Error("Ton idole est déjà jouée.");
        s.council.idols.push(me.name);
        stat(s, me.name).idolsPlayed += 1;
        say(s, `🗿 ${me.name} joue une idole d'immunité !`);
      }
      if (key === "double") {
        if (s.council.doubled.includes(me.name)) throw new Error("Ton vote compte déjà double.");
        s.council.doubled.push(me.name);
        // Reste secret jusqu'au dépouillement.
      }
      if (key === "block") {
        const target = find(s, payload.target);
        if (!target || target.dead || target.name === me.name) throw new Error("Choisis un autre survivant.");
        if (!s.council.blocked.includes(target.name)) s.council.blocked.push(target.name);
      }
      mine.advantages.splice(idx, 1);
      return;
    }

    case "closeCouncil": {
      if (s.phase !== "council") return;
      closeCouncil(s, ctx);
      return;
    }

    case "next": {
      if (s.phase !== "reveal") return;
      const left = alive(s).length;
      if (left <= 1) finishGame(s);
      else if (left === 2 && jury(s).length > 0) openFinal(s);
      else startRound(s, ctx);
      return;
    }

    case "juryVote": {
      if (s.phase !== "final") return;
      if (!mine || !mine.dead) throw new Error("Seul le jury (les éliminés) vote en finale.");
      if (!s.final.finalists.includes(payload.finalist)) throw new Error("Vote pour un des deux finalistes.");
      if (s.final.jury[me.name]) throw new Error("Tu as déjà voté.");
      s.final.jury[me.name] = payload.finalist;
      if (jury(s).every(p => s.final.jury[p.name])) closeFinal(s, ctx);
      return;
    }

    case "closeFinal": {
      if (s.phase !== "final") return;
      closeFinal(s, ctx);
      return;
    }

    case "restart": {
      // payload.players : les joueurs actuels de la room (nouveaux arrivants compris).
      const next = newGame(payload.players || s.tribe, s.session);
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}

// Qui doit encore jouer / voter (pour l'affichage « 3/5 ont voté » et le bouton « clore »).
export function pending(s) {
  if (s.phase === "challenge" && s.challenge.kind !== "physical") return alive(s).filter(p => s.challenge.results[p.name] == null).map(p => p.name);
  if (s.phase === "council") return voters(s).filter(n => !s.council.votes[n]);
  if (s.phase === "final") return jury(s).filter(p => !s.final.jury[p.name]).map(p => p.name);
  return [];
}

export { alive, jury };
