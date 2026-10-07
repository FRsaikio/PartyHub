// Règles de Chaos Kings (Kings Cup revisité), sans navigateur ni Firebase.
//
// Un vrai paquet de 52 cartes, mélangé, avec quelques cartes spéciales glissées dedans.
// Chacun pioche à son tour ; la carte a un scénario (texte) et, pour certaines valeurs,
// une mécanique jouée sur les téléphones :
//   2 « Toi »           : le joueur choisit qui boit.
//   4 « Sol » / 7 « Ciel » : course de réflexe, tout le monde tape ; le plus lent boit.
//   8 « Pote »          : le joueur choisit son pote (le lien reste affiché).
//   Valet « Règle »     : le joueur écrit une règle, affichée sur tous les écrans.
//   Dame « Questions »  : le joueur devient Maître des questions.
//   Roi                 : on verse dans la coupe ; le 4e roi déclenche la finale Chaos Cup.
//
// applyAction(state, type, payload, me, ctx) modifie `state` ou lève une Error.
// ctx = { rng, partyMode, drinkLevel }.

import { baseRules, specialRules, specialCardWeights, cardIcons, chaosEffects, rareEvents } from "./kings-content.js";

export const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["♠", "♥", "♦", "♣"];
export const SPECIALS_IN_DECK = 6;
export const MAX_RULES = 5;
export const REFLEX_FAIL = 99999;

// Mécanique jouée sur les téléphones selon la valeur.
export const MECHANICS = { "2": "target", "4": "reflex", "7": "reflex", "8": "mate", J: "rule", Q: "master", K: "king" };

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 30); };
const fresh = () => ({ cards: 0, kings: 0, specials: 0, targeted: 0, reflexLost: 0, rules: 0 });
const stat = (s, name) => (s.stats[name] ||= fresh());

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildDeck(rng) {
  const cards = [];
  VALUES.forEach(v => SUITS.forEach(suit => cards.push(`${v}${suit}`)));
  for (let i = 0; i < SPECIALS_IN_DECK; i++) cards.push(`*${pick(specialCardWeights, rng)}`);
  return shuffle(cards, rng);
}

// Lecture d'un code de carte : « 10♥ », « K♠ », « *JOKER ».
export function parseCard(code) {
  if (code.startsWith("*")) {
    const key = code.slice(1);
    const rule = specialRules[key];
    return { code, special: true, key, value: rule.displayValue, suit: rule.displaySuit, icon: rule.icon, name: rule.name };
  }
  const value = code.slice(0, -1);
  return { code, special: false, key: value, value, suit: code.slice(-1), icon: cardIcons[value], name: baseRules[value].name };
}

// ---------- Nouvelle partie ----------

export function newGame(players, session = 0, rng = Math.random) {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  return {
    v: 0, session, phase: "intro", turn: 0,
    players: real.map(p => ({ name: p.name, avatar: p.avatar || "👑" })),
    current: real[0]?.name || null, direction: 1,
    deck: buildDeck(rng), drawn: null,
    kings: 0, cup: [], mates: {}, rules: [], master: null,
    chaos: 0, effects: [], rare: null,
    stats: Object.fromEntries(real.map(p => [p.name, fresh()])),
    log: ["👑 Le paquet est mélangé : 52 cartes, 4 rois… et quelques surprises."]
  };
}

const find = (s, name) => s.players.find(p => p.name === name);

// Les potes d'un joueur, dans les deux sens (A a choisi B, ou B a choisi A).
export const matesOf = (s, name) => [...new Set([
  s.mates?.[name],
  ...Object.entries(s.mates || {}).filter(([, m]) => m === name).map(([who]) => who)
].filter(Boolean))];
const withMates = (s, name) => { const m = matesOf(s, name); return m.length ? ` (avec ${m.length > 1 ? "ses potes" : "son pote"} ${m.join(", ")})` : ""; };

function nextPlayer(s, from = s.current) {
  const i = s.players.findIndex(p => p.name === from);
  const n = s.players.length;
  return s.players[((i < 0 ? 0 : i) + s.direction + n) % n].name;
}

function chaosGain(ctx) {
  return { Chill: 5, Party: 9, Chaos: 14, Hardcore: 19 }[ctx.partyMode] || 9;
}

// ---------- Pioche ----------

function draw(s, ctx) {
  const rng = ctx.rng;
  if (!s.deck.length) s.deck = buildDeck(rng); // ne devrait pas arriver (le 4e roi finit avant)
  const code = s.deck.pop();
  const card = parseCard(code);
  const rule = card.special ? specialRules[card.key] : baseRules[card.key];
  const scenario = pick(rule.scenarios, rng);
  const mech = card.special ? null : MECHANICS[card.key] || null;
  s.turn += 1;
  s.drawn = {
    code, by: s.current, mech, scenario: { text: scenario.text, consequence: scenario.consequence },
    target: null, mate: null, rule: null, reflex: mech === "reflex" ? {} : null, loser: null, done: !mech || mech === "master"
  };
  const st = stat(s, s.current);
  st.cards += 1;
  if (card.special) st.specials += 1;

  // Effets actifs : ils s'usent à chaque carte.
  s.effects = s.effects.map(e => ({ ...e, turns: e.turns - 1 })).filter(e => e.turns > 0);
  s.chaos = Math.min(100, s.chaos + chaosGain(ctx) + (card.special ? 6 : 0) + (card.key === "K" ? 13 : 0));
  s.rare = null;
  const turns = { soft: 2, normal: 3, hard: 4, extreme: 5, danger: 5 }[ctx.drinkLevel] || 3;
  const addEffect = () => {
    const text = pick(chaosEffects[ctx.partyMode] || chaosEffects.Party, rng);
    s.effects = [{ text, turns }, ...s.effects].slice(0, 5);
    say(s, `⚡ Effet actif : ${text}`);
  };
  if (s.chaos >= 100) { addEffect(); s.chaos = 35; }
  const rareChance = { Chill: 0.04, Party: 0.08, Chaos: 0.14, Hardcore: 0.2 }[ctx.partyMode] || 0.08;
  if (rng() < rareChance) {
    s.rare = pick(rareEvents[ctx.partyMode] || rareEvents.Party, rng);
    say(s, `💀 Événement rare : ${s.rare}`);
  }

  say(s, `${s.current} pioche ${card.value}${card.special ? "" : card.suit} — ${card.name}`);

  if (mech === "master") {
    s.master = s.current;
    say(s, `❓ ${s.current} devient Maître des questions.`);
  }
  if (mech === "king") {
    s.kings += 1;
    s.cup.push(s.current);
    st.kings += 1;
    if (s.kings >= 4) {
      s.phase = "final";
      s.drawn.done = true;
      say(s, `👑 4e roi ! ${s.current} doit boire la Chaos Cup !`);
      return;
    }
    s.drawn.done = true;
    say(s, `👑 Roi n°${s.kings} : ${s.current} verse dans la coupe.`);
  }
}

// ---------- Actions ----------

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  ctx = { rng: Math.random, partyMode: "Party", drinkLevel: "normal", ...ctx };
  const drawn = s.drawn;
  // Le joueur qui a pioché décide ; l'hôte peut le faire à la place d'un absent.
  const isDrawer = Boolean(drawn) && (drawn.by === me.name || me.host);

  switch (type) {
    case "start": {
      if (!me.host) throw new Error("Seul l'hôte peut faire ça.");
      if (s.phase !== "intro") return;
      if (s.players.length < 2) throw new Error("Il faut au moins 2 joueurs.");
      s.phase = "play";
      s.current = pick(s.players, ctx.rng).name;
      say(s, `🃏 C'est parti ! ${s.current} pioche en premier.`);
      return;
    }

    case "draw": {
      if (s.phase !== "play") return;
      if (s.current !== me.name && !me.host) throw new Error(`C'est à ${s.current} de piocher.`);
      if (drawn && !drawn.closed) throw new Error("Termine d'abord la carte en cours.");
      draw(s, ctx);
      return;
    }

    // 2 : le joueur choisit qui boit.
    case "target": {
      if (!drawn || drawn.mech !== "target" || drawn.done) return;
      if (!isDrawer) throw new Error("C'est au joueur qui a pioché de choisir.");
      if (!find(s, payload.target) || payload.target === drawn.by) throw new Error("Choisis un autre joueur.");
      drawn.target = payload.target;
      drawn.done = true;
      stat(s, payload.target).targeted += 1;
      say(s, `🎯 ${drawn.by} fait boire ${payload.target}${withMates(s, payload.target)}.`);
      return;
    }

    // 8 : le joueur choisit son pote.
    case "mate": {
      if (!drawn || drawn.mech !== "mate" || drawn.done) return;
      if (!isDrawer) throw new Error("C'est au joueur qui a pioché de choisir.");
      if (!find(s, payload.target) || payload.target === drawn.by) throw new Error("Choisis un autre joueur.");
      s.mates[drawn.by] = payload.target;
      drawn.mate = payload.target;
      drawn.done = true;
      say(s, `🤝 ${drawn.by} et ${payload.target} sont potes : quand l'un boit, l'autre aussi.`);
      return;
    }

    // Valet : le joueur écrit une règle.
    case "rule": {
      if (!drawn || drawn.mech !== "rule" || drawn.done) return;
      if (!isDrawer) throw new Error("C'est au joueur qui a pioché d'écrire la règle.");
      const text = String(payload.text || "").replace(/\s+/g, " ").trim().slice(0, 120);
      if (text.length < 3) throw new Error("Écris une vraie règle.");
      s.rules = [{ by: drawn.by, text, turn: s.turn }, ...s.rules].slice(0, MAX_RULES);
      drawn.rule = text;
      drawn.done = true;
      stat(s, drawn.by).rules += 1;
      say(s, `📜 Nouvelle règle de ${drawn.by} : « ${text} »`);
      return;
    }

    // 4 / 7 : course de réflexe. Chaque téléphone envoie son temps (mesuré localement).
    case "reflex": {
      if (!drawn || drawn.mech !== "reflex" || drawn.done) return;
      if (!find(s, me.name)) throw new Error("Tu ne joues pas.");
      if (drawn.reflex[me.name] != null) return;
      drawn.reflex[me.name] = Math.max(0, Math.round(Number(payload.ms) || REFLEX_FAIL));
      if (s.players.every(p => drawn.reflex[p.name] != null)) closeReflex(s, ctx);
      return;
    }

    case "closeReflex": {
      if (!drawn || drawn.mech !== "reflex" || drawn.done) return;
      if (!isDrawer) throw new Error("Le joueur qui a pioché (ou l'hôte) clôt la course.");
      // Ceux qui n'ont pas tapé sont les plus lents.
      s.players.forEach(p => { if (drawn.reflex[p.name] == null) drawn.reflex[p.name] = REFLEX_FAIL; });
      closeReflex(s, ctx);
      return;
    }

    // Fin du tour : la main passe au suivant.
    case "next": {
      if (s.phase !== "play" || !drawn) return;
      if (!isDrawer) throw new Error("Le joueur qui a pioché (ou l'hôte) passe au suivant.");
      if (!drawn.done) throw new Error("La carte n'est pas encore terminée.");
      drawn.closed = true;
      s.current = nextPlayer(s, drawn.by);
      return;
    }

    case "finish": {
      if (s.phase !== "final") return;
      if (!isDrawer) throw new Error("Le buveur de la coupe (ou l'hôte) termine la partie.");
      s.phase = "end";
      say(s, "🏁 La Chaos Cup est bue. Fin de la partie !");
      return;
    }

    case "restart": {
      if (!me.host) throw new Error("Seul l'hôte peut faire ça.");
      const next = newGame(payload.players || s.players, s.session, ctx.rng);
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}

function closeReflex(s, ctx) {
  const d = s.drawn;
  const entries = Object.entries(d.reflex);
  const worst = Math.max(...entries.map(([, ms]) => ms));
  const slowest = entries.filter(([, ms]) => ms === worst).map(([n]) => n);
  d.loser = pick(slowest, ctx.rng);
  d.done = true;
  stat(s, d.loser).reflexLost += 1;
  say(s, `🐢 ${d.loser} est le plus lent et boit${withMates(s, d.loser)} !`);
}

export { find };
