// Règles de la Bombe, sans navigateur ni Firebase : testable seul dans Node.
//
// La bombe tourne dans le cercle. Celui qui la tient répond (catégorie, syllabe ou question)
// puis la passe au suivant. La mèche est cachée ; quand elle arrive au bout, celui qui tient
// la bombe perd une vie et prend une punition. Dernier en vie = gagnant.
//
// Le temps : on ne compare JAMAIS les horloges des téléphones. L'état garde la mèche restante
// (`fuse`, en ms) au moment où la bombe change de main, et un numéro de main (`handId`).
// Chaque téléphone compte à partir du moment où il reçoit cette main. C'est le téléphone de
// celui qui tient la bombe qui envoie « explode » (les autres le font en secours, avec retard) ;
// une action qui vise une ancienne main est ignorée.
//
// applyAction(state, type, payload, me, ctx) modifie `state` ou lève une Error.
// ctx = { rng, partyMode, drinkLevel, alcohol }.

import { CATEGORIES, MORE_CATEGORIES, QUESTIONS, PUNISHMENTS, MODIFIERS } from "./bomb-content.js";

export const MODES = {
  categories: { icon: "🗂️", name: "Catégories", text: "Une catégorie par bombe : chacun donne une réponse différente à voix haute, puis passe. Le groupe peut contester." },
  syllables: { icon: "🔤", name: "Syllabes", text: "Tape un vrai mot qui contient la syllabe (vérifié dans le dictionnaire), sans réutiliser un mot." },
  questions: { icon: "❓", name: "Questions & défis", text: "Chacun reçoit sa question ou son défi : réponds ou fais-le, puis passe." }
};

export const POWERS = {
  bonus: { icon: "⏳", name: "+5 secondes", text: "La mèche s'allonge de 5 secondes." },
  reverse: { icon: "🔄", name: "Demi-tour", text: "Le sens de la bombe s'inverse." },
  skip: { icon: "⏭️", name: "Saut", text: "Tu passes la bombe en sautant le joueur suivant, sans répondre." },
  trap: { icon: "🪤", name: "Piège", text: "Le prochain à recevoir la bombe n'aura que la moitié du temps restant." },
  hot: { icon: "🔥", name: "Patate chaude", text: "Tu passes la bombe tout de suite, sans répondre." }
};

export const MIN_PLAYERS = 2;
export const GHOST_SHAKE_MS = 3000;
export const BACKUP_DELAY_MS = 4000; // les autres téléphones font exploser si celui qui tient la bombe ne répond plus
export const livesFor = n => (n <= 6 ? 3 : n <= 12 ? 2 : 1);

const ALL_CATEGORIES = [...CATEGORIES, ...MORE_CATEGORIES];
const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 30); };
const fresh = () => ({ passes: 0, booms: 0, words: 0, powers: 0, contested: 0 });
const stat = (s, name) => (s.stats[name] ||= fresh());

export const alive = s => s.players.filter(p => !p.out);
const find = (s, name) => s.players.find(p => p.name === name);

// Joueur suivant encore en vie dans le cercle (skip = nombre de joueurs sautés).
export function nextAlive(s, from, dir = s.direction, skip = 0) {
  const n = s.players.length;
  let i = s.players.findIndex(p => p.name === from);
  if (i < 0) i = 0;
  for (let jumps = 0; jumps < n * 3; jumps++) {
    i = (i + dir + n) % n;
    if (!s.players[i].out && s.players[i].name !== from) {
      if (skip <= 0) return s.players[i].name;
      skip -= 1;
    }
  }
  return alive(s)[0]?.name || from;
}

export function normalizeWord(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z]/g, "");
}

// ---------- Nouvelle partie / nouvelle bombe ----------

export function newGame(players, session = 0, mode = "categories") {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  const startLives = livesFor(real.length);
  return {
    v: 0, session, phase: "intro", mode: MODES[mode] ? mode : "categories", round: 0,
    players: real.map(p => ({ name: p.name, avatar: p.avatar || "💣", lives: startLives, out: 0 })),
    startLives, holder: null, direction: 1, handId: 0, fuse: 0, fuseTotal: 0,
    prompt: null, category: null, modifier: null, pool: [], usedWords: [],
    lastPass: null, contest: [], trap: null, powers: {}, ghosts: {},
    boom: null, result: null, stats: Object.fromEntries(real.map(p => [p.name, fresh()])),
    log: ["💣 La bombe est prête. Choisissez le mode et c'est parti."]
  };
}

function fuseFor(s, ctx) {
  const base = { soft: 22000, normal: 18000, hard: 14000, extreme: 11000, danger: 11000 }[ctx.drinkLevel] || 18000;
  const total = base + alive(s).length * 1500;
  return Math.round(total * (0.75 + ctx.rng() * 0.6)); // entre 75 % et 135 %, imprévisible
}

function newPrompt(s, ctx) {
  if (s.mode === "syllables") {
    const choices = (s.pool || []).filter(x => x !== s.prompt?.syllable);
    const syllable = choices.length ? pick(choices, ctx.rng) : "ON";
    s.prompt = { kind: "syllable", syllable, text: `Un mot avec « ${syllable} »` };
  } else if (s.mode === "questions") {
    const pool = QUESTIONS[ctx.partyMode] || QUESTIONS.Party;
    s.prompt = { kind: "question", text: pick(pool, ctx.rng) };
  } else {
    s.prompt = { kind: "category", text: s.category };
  }
}

function startBomb(s, starter, ctx, pool) {
  s.round += 1;
  s.phase = "live";
  s.holder = starter;
  s.direction = 1;
  s.handId += 1;
  s.fuseTotal = s.fuse = fuseFor(s, ctx);
  s.usedWords = [];
  s.lastPass = null;
  s.contest = [];
  s.trap = null;
  s.powers = {};
  s.ghosts = {};
  s.boom = null;
  if (pool?.length) s.pool = pool.slice(0, 80);
  s.category = s.mode === "categories" ? pick(ALL_CATEGORIES, ctx.rng) : null;
  // Modificateur de manche (catégories et questions uniquement).
  const mod = s.mode === "syllables" ? null : pick(MODIFIERS, ctx.rng);
  s.modifier = mod && mod.id !== "none" ? { ...mod, ...(mod.id === "letter" ? { letter: pick("ABCDEFGHILMNPRST".split(""), ctx.rng) } : {}) } : null;
  newPrompt(s, ctx);
  say(s, `💣 Bombe ${s.round} (${MODES[s.mode].name}) : elle part de ${starter}.`);
}

// Donne la bombe à `to` avec `remaining` ms de mèche.
function handTo(s, to, remaining, ctx) {
  let fuse = Math.max(500, Math.round(remaining));
  if (s.trap && s.trap.target === to) {
    fuse = Math.max(1500, Math.round(fuse / 2));
    say(s, `🪤 Piège ! ${to} récupère une mèche raccourcie.`);
    s.trap = null;
  }
  s.holder = to;
  s.fuse = fuse;
  s.handId += 1;
  s.contest = [];
  newPrompt(s, ctx);
}

function punishmentFor(ctx) {
  if (ctx.alcohol === false) return pick(["Fais un gros gage 😇", "Raconte une vérité", "Le groupe choisit un mini-gage", "Fais une imitation", "Danse 10 secondes"], ctx.rng);
  return pick(PUNISHMENTS[ctx.partyMode] || PUNISHMENTS.Party, ctx.rng);
}

function explode(s, ctx) {
  const p = find(s, s.holder);
  p.lives = Math.max(0, p.lives - 1);
  stat(s, p.name).booms += 1;
  const eliminated = p.lives === 0;
  if (eliminated) p.out = s.round;
  s.boom = { name: p.name, eliminated, lives: p.lives, punishment: punishmentFor(ctx) };
  say(s, eliminated ? `💥 BOUM ! ${p.name} n'a plus de vie : éliminé !` : `💥 BOUM sur ${p.name} (${p.lives} vie${p.lives > 1 ? "s" : ""} restante${p.lives > 1 ? "s" : ""}).`);
  const left = alive(s);
  if (left.length <= 1) {
    s.phase = "end";
    s.result = { winner: left[0]?.name || null };
    say(s, `👑 ${s.result.winner} survit à toutes les bombes !`);
  } else {
    s.phase = "boom";
  }
}

// ---------- Actions ----------

const HOST_ONLY = ["mode", "start", "restart"];

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  ctx = { rng: Math.random, partyMode: "Party", drinkLevel: "normal", alcohol: true, ...ctx };
  if (HOST_ONLY.includes(type) && !me.host) throw new Error("Seul l'hôte peut faire ça.");
  const mine = find(s, me.name);
  const sameHand = () => Number(payload.handId) === s.handId;

  switch (type) {
    case "mode": {
      if (s.phase !== "intro" && s.phase !== "boom") return;
      if (!MODES[payload.mode]) throw new Error("Mode inconnu.");
      s.mode = payload.mode;
      say(s, `${MODES[s.mode].icon} Mode ${MODES[s.mode].name}.`);
      return;
    }

    case "start": {
      if (s.phase !== "intro") return;
      if (s.players.length < MIN_PLAYERS) throw new Error(`Il faut au moins ${MIN_PLAYERS} joueurs.`);
      if (s.mode === "syllables" && !payload.pool?.length) throw new Error("Dictionnaire pas encore chargé, réessaie.");
      startBomb(s, pick(alive(s), ctx.rng).name, ctx, payload.pool);
      return;
    }

    // Nouvelle bombe après une explosion : l'hôte, ou celui qui vient d'exploser.
    case "next": {
      if (s.phase !== "boom") return;
      if (!me.host && me.name !== s.boom?.name) throw new Error("L'hôte (ou celui qui a explosé) relance la bombe.");
      if (s.mode === "syllables" && !payload.pool?.length && !s.pool.length) throw new Error("Dictionnaire pas encore chargé, réessaie.");
      const from = s.boom.name;
      const starter = find(s, from) && !find(s, from).out ? from : nextAlive(s, from);
      startBomb(s, starter, ctx, payload.pool);
      return;
    }

    case "pass": {
      if (s.phase !== "live" || !sameHand()) return;
      if (s.holder !== me.name) throw new Error("Ce n'est pas toi qui as la bombe.");
      const remaining = Number(payload.remaining);
      if (!(remaining > 0)) return; // trop tard : elle explose
      let answer = null;
      if (s.mode === "syllables") {
        const word = normalizeWord(payload.word);
        if (word.length < 3) throw new Error("Mot trop court.");
        if (!word.includes(normalizeWord(s.prompt.syllable))) throw new Error(`Le mot doit contenir « ${s.prompt.syllable} ».`);
        if (s.usedWords.includes(word)) throw new Error("Mot déjà utilisé pendant cette bombe.");
        s.usedWords.push(word);
        stat(s, me.name).words += 1;
        answer = word;
      }
      stat(s, me.name).passes += 1;
      const skip = s.modifier?.id === "double_pass" ? 1 : 0;
      const to = nextAlive(s, me.name, s.direction, skip);
      s.lastPass = { from: me.name, to, answer, handId: s.handId + 1, prompt: s.prompt.text };
      handTo(s, to, remaining, ctx);
      return;
    }

    // Pouvoir surprise : un par joueur et par bombe, seulement quand on tient la bombe.
    case "power": {
      if (s.phase !== "live" || !sameHand()) return;
      if (s.holder !== me.name) throw new Error("Il faut tenir la bombe pour utiliser ton pouvoir.");
      if (s.powers[me.name]) throw new Error("Tu as déjà utilisé ton pouvoir pour cette bombe.");
      const remaining = Number(payload.remaining);
      if (!(remaining > 0)) return;
      const key = payload.power && POWERS[payload.power] ? payload.power : pick(Object.keys(POWERS), ctx.rng);
      s.powers[me.name] = key;
      stat(s, me.name).powers += 1;
      say(s, `${POWERS[key].icon} ${me.name} utilise « ${POWERS[key].name} » !`);
      if (key === "bonus") { s.fuse = remaining + 5000; s.handId += 1; }
      if (key === "reverse") { s.direction *= -1; s.fuse = remaining; s.handId += 1; }
      if (key === "trap") { s.trap = { by: me.name, target: nextAlive(s, me.name) }; s.fuse = remaining; s.handId += 1; }
      if (key === "skip" || key === "hot") {
        const to = nextAlive(s, me.name, s.direction, key === "skip" ? 1 : 0);
        s.lastPass = null; // pas de réponse à contester
        handTo(s, to, remaining, ctx);
      }
      s.lastPowerHand = s.handId;
      return;
    }

    // Contester la dernière réponse (catégories / questions) : à la majorité, la bombe revient.
    case "contest": {
      if (s.phase !== "live" || !sameHand() || s.mode === "syllables") return;
      const lp = s.lastPass;
      if (!lp || lp.handId !== s.handId) throw new Error("Rien à contester.");
      if (!mine || mine.out || me.name === lp.from) throw new Error("Tu ne peux pas contester cette réponse.");
      if (!s.contest.includes(me.name)) s.contest.push(me.name);
      const eligible = alive(s).filter(p => p.name !== lp.from).length;
      const needed = Math.max(1, Math.ceil((eligible + 1) / 2));
      if (s.contest.length >= needed) {
        stat(s, lp.from).contested += 1;
        say(s, `🚫 Réponse de ${lp.from} refusée par le groupe : la bombe lui revient !`);
        const remaining = Number(payload.remaining) > 0 ? Number(payload.remaining) : s.fuse;
        s.lastPass = null;
        s.holder = lp.from;
        s.fuse = Math.max(1000, Math.round(remaining));
        s.handId += 1;
        s.contest = [];
      }
      return;
    }

    // Fantôme (joueur éliminé) : secoue la bombe une fois par bombe, -3 s.
    case "shake": {
      if (s.phase !== "live" || !sameHand()) return;
      if (!mine || !mine.out) throw new Error("Seuls les fantômes (éliminés) peuvent secouer la bombe.");
      if (s.ghosts[me.name]) throw new Error("Tu as déjà secoué cette bombe.");
      const remaining = Number(payload.remaining);
      if (!(remaining > 0)) return;
      s.ghosts[me.name] = true;
      s.fuse = Math.max(1000, Math.round(remaining - GHOST_SHAKE_MS));
      s.handId += 1;
      say(s, `👻 ${me.name} secoue la bombe : la mèche raccourcit !`);
      return;
    }

    case "explode": {
      if (s.phase !== "live" || !sameHand()) return;
      explode(s, ctx);
      return;
    }

    case "restart": {
      const next = newGame(payload.players || s.players, s.session, s.mode);
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}
