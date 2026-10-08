// Règles du Monopoly Party, sans navigateur ni Firebase : testable seul dans Node.
//
// Chacun son tour : on lance 2 dés sur son téléphone (un double = on rejoue ; 3 doubles = prison),
// on avance sur un plateau de 28 cases, puis on résout la case (acheter, payer un loyer en jetons
// ET en gorgées, carte Chance, défi, duel, casino…). Les lieux sont groupés en 4 quartiers :
// posséder tout un quartier double le loyer. On peut rénover ses lieux (⭐ jusqu'à ⭐⭐⭐).
// Après X tours, le plus riche (jetons + valeur des lieux) gagne.
//
// applyAction(state, type, payload, me, ctx) modifie `state` ou lève une Error.
// ctx = { rng, drinkLevel, alcohol }.

import { CATALOG } from "../../../punishments.js";

export const START_COINS = 15;
export const PASS_START = 4;
export const MAX_LEVEL = 3;
export const roundsFor = duration => ({ short: 8, medium: 12, long: 18, infinite: 999 }[duration] || 12);

export const QUARTERS = {
  neon: { name: "Quartier Néon", color: "#fb2f74" },
  roof: { name: "Les Rooftops", color: "#fbbf24" },
  club: { name: "Les Boîtes", color: "#22d3ee" },
  vip: { name: "Prestige", color: "#a78bfa" }
};

export const TILES = [
  { name: "Départ", type: "start", icon: "🚀" },
  { name: "Bar Néon", type: "property", quarter: "neon", price: 3, rent: 1 },
  { name: "Carte Chance", type: "chance", icon: "🍀" },
  { name: "Taxe soirée", type: "tax", icon: "💸" },
  { name: "Karaoké Shot", type: "challenge", icon: "🎤" },
  { name: "Snack", type: "bonus", icon: "🍕" },
  { name: "Club Luna", type: "property", quarter: "neon", price: 4, rent: 2 },
  { name: "Prison chill", type: "jail", icon: "🚔" },
  { name: "Rooftop", type: "property", quarter: "roof", price: 5, rent: 2 },
  { name: "Duel", type: "duel", icon: "⚔️" },
  { name: "Mystère", type: "chance", icon: "❓" },
  { name: "After", type: "property", quarter: "roof", price: 6, rent: 3 },
  { name: "Pause bonus", type: "bonus", icon: "🛋️" },
  { name: "Punition", type: "challenge", icon: "😈" },
  { name: "Casino", type: "casino", icon: "🎰" },
  { name: "Boîte Mirage", type: "property", quarter: "club", price: 7, rent: 3 },
  { name: "Tournée", type: "social", icon: "🍻" },
  { name: "Défi alcool", type: "challenge", icon: "🥃" },
  { name: "Taxi", type: "move", icon: "🚕" },
  { name: "Pub Royal", type: "property", quarter: "club", price: 8, rent: 4 },
  { name: "Carte Chaos", type: "chance", icon: "🌪️" },
  { name: "Repos", type: "bonus", icon: "😴" },
  { name: "Duel final", type: "duel", icon: "🥊" },
  { name: "Penthouse", type: "property", quarter: "vip", price: 10, rent: 5 },
  { name: "Impôt fun", type: "tax", icon: "🧾" },
  { name: "Défi shot", type: "challenge", icon: "🔥" },
  { name: "Carte Chance", type: "chance", icon: "🍀" },
  { name: "VIP Club", type: "property", quarter: "vip", price: 12, rent: 6 }
];

// Cartes Chance : chacune a un vrai effet.
export const CHANCE = [
  { text: "Tournée offerte : +3 jetons.", effect: { coins: 3 } },
  { text: "Tu casses un verre : -2 jetons.", effect: { coins: -2 } },
  { text: "Anniversaire : chaque joueur te donne 1 jeton.", effect: { collect: 1 } },
  { text: "Tu paies une tournée : tu donnes 1 jeton à chaque joueur.", effect: { payEach: 1 } },
  { text: "Avance de 3 cases.", effect: { move: 3 } },
  { text: "Retour au Départ (tu touches le bonus).", effect: { toStart: true } },
  { text: "Bouclier : ta prochaine punition en gorgées est annulée.", effect: { shield: 1 } },
  { text: "Tout le monde boit 1 gorgée.", effect: { everyone: 1 } },
  { text: "Distribue 4 gorgées à qui tu veux.", effect: { distribute: 4 } },
  { text: "Échange ta place avec le joueur de ton choix.", effect: { swap: true } },
  { text: "Rénovation gratuite d'un de tes lieux.", effect: { freeUpgrade: true } },
  { text: "Contrôle de police : prison chill, tu passes ton prochain tour.", effect: { jail: true } }
];

// Défis de la case « Défi » : des gages sans alcool (catalogue commun). Refusé ou raté = gorgées.
export const CHALLENGES = CATALOG.GAGES;

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 40); };
const sipsBase = ctx => ({ soft: 1, normal: 2, hard: 3, extreme: 4, danger: 4 }[ctx.drinkLevel] || 2);

export function newGame(players, session = 0, duration = "medium") {
  const real = (players || []).filter(p => p && p.name && !p.fake).slice(0, 10);
  const colors = ["#fb2f74", "#22d3ee", "#34d399", "#fbbf24", "#a78bfa", "#f87171", "#60a5fa", "#f472b6", "#4ade80", "#fb923c"];
  return {
    v: 0, session, phase: "intro", round: 1, maxRounds: roundsFor(duration),
    players: real.map((p, i) => ({ name: p.name, avatar: p.avatar || "🎩", color: colors[i % colors.length], pos: 0, coins: START_COINS, shield: 0, skip: false, sips: 0 })),
    current: 0, doubles: 0, dice: null, rolled: false, moveFrom: null,
    owners: {}, levels: {}, pending: null, last: null, result: null,
    log: ["🎩 Monopoly Party : achetez les quartiers, faites boire les visiteurs !"]
  };
}

// ---------- Outils ----------

const cur = s => s.players[s.current];
const byName = (s, name) => s.players.find(p => p.name === name);
export const ownerOf = (s, i) => s.owners[i] ?? null;
export const quarterOwned = (s, quarter, name) => TILES.every((t, i) => t.quarter !== quarter || s.owners[i] === name);

export function rentOf(s, i) {
  const t = TILES[i];
  const owner = s.owners[i];
  const level = s.levels[i] || 0;
  const full = owner && quarterOwned(s, t.quarter, owner);
  return { coins: t.rent * [1, 2, 3, 5][level] * (full ? 2 : 1), full, level };
}

export function wealth(s, p) {
  let total = p.coins;
  Object.entries(s.owners).forEach(([i, owner]) => {
    if (owner !== p.name) return;
    const t = TILES[i];
    total += t.price + (s.levels[i] || 0) * upgradeCost(t);
  });
  return total;
}

export const upgradeCost = t => Math.max(2, Math.ceil(t.price / 2));

// Gorgées (le bouclier en annule une série).
function drink(s, p, sips, why) {
  if (sips <= 0) return;
  if (p.shield > 0) {
    p.shield -= 1;
    say(s, `🛡️ ${p.name} utilise un bouclier : pas de gorgées (${why}).`);
    return;
  }
  p.sips += sips;
  say(s, `🍺 ${p.name} boit ${sips} gorgée${sips > 1 ? "s" : ""} (${why}).`);
}

function pay(s, from, to, amount) {
  const paid = Math.min(from.coins, Math.max(0, amount));
  from.coins -= paid;
  if (to) to.coins += paid;
  return paid;
}

// ---------- Déplacement & cases ----------

function moveBy(s, p, steps, ctx) {
  const from = p.pos;
  p.pos = (p.pos + steps + TILES.length) % TILES.length;
  if (steps > 0 && p.pos < from) { p.coins += PASS_START; say(s, `🚀 ${p.name} passe par le Départ : +${PASS_START} jetons.`); }
  s.moveFrom = from;
  landOn(s, p, ctx);
}

function landOn(s, p, ctx) {
  const i = p.pos;
  const t = TILES[i];
  const base = sipsBase(ctx);
  s.pending = null;
  s.last = { tile: i, name: t.name, text: "" };

  if (t.type === "property") {
    const owner = s.owners[i];
    if (!owner) {
      s.pending = { type: "buy", tile: i };
      s.last.text = p.coins >= t.price ? `À vendre : ${t.price} jetons (loyer de base ${t.rent}).` : `À vendre : ${t.price} jetons… pas assez de jetons.`;
    } else if (owner === p.name) {
      s.last.text = "Tu es chez toi : +1 jeton.";
      p.coins += 1;
    } else {
      const r = rentOf(s, i);
      const ownerP = byName(s, owner);
      const paid = pay(s, p, ownerP, r.coins);
      const sips = base + r.level + (r.full ? 1 : 0);
      s.last.text = `Chez ${owner}${r.full ? " (quartier complet ×2)" : ""} : ${paid} jeton${paid > 1 ? "s" : ""} payé${paid > 1 ? "s" : ""} + ${sips} gorgées.`;
      say(s, `🏠 ${p.name} paie ${paid} jetons de loyer à ${owner} pour ${t.name}.`);
      drink(s, p, sips, `loyer de ${t.name}`);
      if (paid < r.coins) drink(s, p, 2, "pas assez de jetons pour le loyer");
    }
  } else if (t.type === "chance") {
    const card = pick(CHANCE, ctx.rng);
    s.last.text = card.text;
    s.last.card = true;
    say(s, `🍀 ${p.name} pioche : ${card.text}`);
    applyChance(s, p, card.effect, ctx);
    return;
  } else if (t.type === "tax") {
    const paid = pay(s, p, null, 2);
    s.last.text = `Taxe : -${paid} jetons et ${base} gorgées.`;
    drink(s, p, base, t.name);
  } else if (t.type === "jail") {
    p.skip = true;
    s.last.text = `En prison : ${base + 1} gorgées et tu passes ton prochain tour.`;
    drink(s, p, base + 1, "prison");
  } else if (t.type === "bonus") {
    p.coins += 2;
    p.shield += 1;
    s.last.text = "+2 jetons et 1 bouclier 🛡️.";
  } else if (t.type === "social") {
    s.last.text = `Tournée générale : tout le monde boit ${base} gorgée${base > 1 ? "s" : ""}.`;
    s.players.forEach(o => drink(s, o, base, "tournée"));
  } else if (t.type === "challenge") {
    const ch = pick(CHALLENGES, ctx.rng);
    s.last.text = ch;
    s.pending = { type: "challenge", text: ch, sips: base + 2 };
  } else if (t.type === "casino") {
    s.last.text = "Mise 2 jetons : une chance sur deux de repartir avec 5.";
    s.pending = { type: "casino" };
  } else if (t.type === "duel") {
    s.last.text = "Choisis ton adversaire : duel en vrai (pierre-feuille-ciseaux, bras de fer, regard…). Le perdant boit et donne 2 jetons.";
    s.pending = { type: "duel", opponent: null };
  } else if (t.type === "move") {
    s.last.text = "Taxi ! Tu avances de 2 cases.";
    say(s, `🚕 ${p.name} prend le taxi.`);
    moveBy(s, p, 2, ctx);
    return;
  } else {
    s.last.text = "Case départ.";
  }
}

function applyChance(s, p, e, ctx) {
  if (e.coins) { if (e.coins > 0) p.coins += e.coins; else pay(s, p, null, -e.coins); }
  if (e.collect) s.players.forEach(o => { if (o !== p) pay(s, o, p, e.collect); });
  if (e.payEach) s.players.forEach(o => { if (o !== p) pay(s, p, o, e.payEach); });
  if (e.shield) p.shield += e.shield;
  if (e.everyone) s.players.forEach(o => drink(s, o, e.everyone, "carte Chance"));
  if (e.jail) { p.skip = true; drink(s, p, sipsBase(ctx), "contrôle de police"); }
  if (e.distribute) s.pending = { type: "distribute", sips: e.distribute };
  if (e.swap) s.pending = { type: "swap" };
  if (e.freeUpgrade) {
    const mine = Object.keys(s.owners).filter(i => s.owners[i] === p.name && (s.levels[i] || 0) < MAX_LEVEL);
    if (mine.length) s.pending = { type: "freeUpgrade" };
    else { p.coins += 2; s.last.text += " (aucun lieu à rénover : +2 jetons à la place)"; }
  }
  // La carte déplace le joueur : on garde son texte devant celui de la nouvelle case.
  const cardText = s.last.text;
  if (e.toStart) { moveBy(s, p, TILES.length - p.pos, ctx); s.last.text = `${cardText} → ${s.last.text}`; return; }
  if (e.move) { moveBy(s, p, e.move, ctx); s.last.text = `${cardText} → ${s.last.text}`; }
}

function endGame(s) {
  s.phase = "end";
  const ranking = s.players.map(p => ({ name: p.name, wealth: wealth(s, p), coins: p.coins, sips: p.sips })).sort((a, b) => b.wealth - a.wealth);
  s.result = { ranking };
  say(s, `🏆 ${ranking[0].name} est le magnat de la soirée (${ranking[0].wealth} de fortune) !`);
}

function nextTurn(s) {
  s.pending = null;
  s.rolled = false;
  s.doubles = 0;
  s.dice = null;
  s.moveFrom = null;
  // On saute les joueurs en prison (une fois).
  for (let k = 0; k < s.players.length; k++) {
    s.current = (s.current + 1) % s.players.length;
    if (s.current === 0) s.round += 1;
    if (s.round > s.maxRounds) { endGame(s); return; }
    const p = cur(s);
    if (p.skip) { p.skip = false; say(s, `🚔 ${p.name} passe son tour (prison).`); continue; }
    return;
  }
}

// ---------- Actions ----------

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  ctx = { rng: Math.random, drinkLevel: "normal", alcohol: true, ...ctx };
  const p = cur(s);
  const isTurn = p && (me.name === p.name || me.host); // l'hôte peut jouer pour un absent
  const turnOnly = () => { if (!isTurn) throw new Error(`C'est le tour de ${p.name}.`); };

  switch (type) {
    case "start": {
      if (!me.host) throw new Error("Seul l'hôte peut faire ça.");
      if (s.phase !== "intro") return;
      if (s.players.length < 2) throw new Error("Il faut au moins 2 joueurs.");
      s.phase = "play";
      s.current = Math.floor(ctx.rng() * s.players.length);
      say(s, `🎲 ${cur(s).name} commence !`);
      return;
    }

    case "roll": {
      if (s.phase !== "play") return;
      turnOnly();
      if (s.rolled) throw new Error("Tu as déjà lancé les dés.");
      const d1 = 1 + Math.floor(ctx.rng() * 6);
      const d2 = 1 + Math.floor(ctx.rng() * 6);
      s.dice = [d1, d2];
      s.rolled = true;
      const double = d1 === d2;
      if (double) s.doubles += 1;
      if (double && s.doubles >= 3) {
        say(s, `🎲 ${p.name} fait 3 doubles d'affilée : direction la prison !`);
        s.moveFrom = p.pos;
        p.pos = TILES.findIndex(t => t.type === "jail");
        landOn(s, p, ctx);
        s.doubles = 0;
        s.replay = false;
        return;
      }
      s.replay = double;
      say(s, `🎲 ${p.name} fait ${d1} + ${d2}${double ? " (double : il rejoue !)" : ""}.`);
      moveBy(s, p, d1 + d2, ctx);
      return;
    }

    // Décisions sur la case.
    case "buy": {
      turnOnly();
      if (s.pending?.type !== "buy") return;
      const i = s.pending.tile;
      const t = TILES[i];
      if (payload.yes) {
        if (p.coins < t.price) throw new Error("Pas assez de jetons.");
        p.coins -= t.price;
        s.owners[i] = p.name;
        s.levels[i] = 0;
        say(s, `🏠 ${p.name} achète ${t.name}${quarterOwned(s, t.quarter, p.name) ? ` et possède tout le ${QUARTERS[t.quarter].name} (loyers ×2) !` : "."}`);
      }
      s.pending = null;
      return;
    }

    case "challenge": {
      turnOnly();
      if (s.pending?.type !== "challenge") return;
      if (payload.done) { p.coins += 1; say(s, `✅ ${p.name} relève le défi : +1 jeton.`); }
      else drink(s, p, s.pending.sips, "défi refusé");
      s.pending = null;
      return;
    }

    case "casino": {
      turnOnly();
      if (s.pending?.type !== "casino") return;
      if (payload.play) {
        if (p.coins < 2) throw new Error("Il te faut 2 jetons.");
        p.coins -= 2;
        const win = ctx.rng() < 0.5;
        if (win) p.coins += 5;
        s.last.text = win ? "🎰 Gagné : +5 jetons !" : "🎰 Perdu : la maison garde ta mise.";
        say(s, `🎰 ${p.name} ${win ? "gagne 5 jetons" : "perd sa mise"} au casino.`);
      }
      s.pending = null;
      return;
    }

    case "duelPick": {
      turnOnly();
      if (s.pending?.type !== "duel" || s.pending.opponent) return;
      if (!byName(s, payload.opponent) || payload.opponent === p.name) throw new Error("Choisis un autre joueur.");
      s.pending.opponent = payload.opponent;
      say(s, `⚔️ ${p.name} défie ${payload.opponent} !`);
      return;
    }

    case "duelWinner": {
      if (s.pending?.type !== "duel" || !s.pending.opponent) return;
      if (!isTurn && me.name !== s.pending.opponent) throw new Error("Seuls les duellistes (ou l'hôte) déclarent le gagnant.");
      const a = p, b = byName(s, s.pending.opponent);
      if (payload.winner !== a.name && payload.winner !== b.name) throw new Error("Choisis le gagnant.");
      const winner = payload.winner === a.name ? a : b;
      const loser = winner === a ? b : a;
      const paid = pay(s, loser, winner, 2);
      drink(s, loser, sipsBase(ctx) + 1, "duel perdu");
      s.last.text = `🏆 ${winner.name} gagne le duel : ${loser.name} boit et donne ${paid} jeton${paid > 1 ? "s" : ""}.`;
      s.pending = null;
      return;
    }

    case "distribute": {
      turnOnly();
      if (s.pending?.type !== "distribute") return;
      const give = payload.give || {};
      const total = Object.values(give).reduce((x, y) => x + (Number(y) || 0), 0);
      if (total !== s.pending.sips) throw new Error(`Distribue exactement ${s.pending.sips} gorgées.`);
      Object.entries(give).forEach(([n, k]) => { const o = byName(s, n); if (o && o !== p && k > 0) drink(s, o, k, `distribution de ${p.name}`); });
      s.pending = null;
      return;
    }

    case "swap": {
      turnOnly();
      if (s.pending?.type !== "swap") return;
      const o = byName(s, payload.target);
      if (!o || o === p) throw new Error("Choisis un autre joueur.");
      [p.pos, o.pos] = [o.pos, p.pos];
      say(s, `🔀 ${p.name} échange sa place avec ${o.name}.`);
      s.pending = null;
      return;
    }

    // Rénover : pendant son tour (gratuit si carte Chance).
    case "upgrade": {
      turnOnly();
      if (s.phase !== "play") return;
      const i = Number(payload.tile);
      if (s.owners[i] !== p.name) throw new Error("Ce lieu n'est pas à toi.");
      const level = s.levels[i] || 0;
      if (level >= MAX_LEVEL) throw new Error("Lieu déjà au maximum ⭐⭐⭐.");
      const free = s.pending?.type === "freeUpgrade";
      const cost = free ? 0 : upgradeCost(TILES[i]);
      if (p.coins < cost) throw new Error(`Rénovation : ${cost} jetons.`);
      p.coins -= cost;
      s.levels[i] = level + 1;
      if (free) s.pending = null;
      say(s, `🔨 ${p.name} rénove ${TILES[i].name} (${"⭐".repeat(level + 1)})${free ? " gratuitement" : ` pour ${cost} jetons`}.`);
      return;
    }

    case "end": {
      // Fin du tour (ou on rejoue sur un double).
      turnOnly();
      if (s.phase !== "play" || !s.rolled) throw new Error("Lance d'abord les dés.");
      if (s.pending && s.pending.type !== "freeUpgrade") throw new Error("Termine d'abord l'action de la case.");
      s.pending = null;
      if (s.replay && !p.skip) { s.rolled = false; s.replay = false; s.dice = null; s.moveFrom = null; say(s, `🎲 ${p.name} rejoue (double).`); return; }
      nextTurn(s);
      return;
    }

    case "finish": {
      if (!me.host) throw new Error("Seul l'hôte peut faire ça.");
      if (s.phase === "play") endGame(s);
      return;
    }

    case "restart": {
      if (!me.host) throw new Error("Seul l'hôte peut faire ça.");
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
