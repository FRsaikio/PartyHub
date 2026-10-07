// Règles d'« Action ou Vérité… ou Bois », sans navigateur ni Firebase : testable seul dans Node.
//
// Chacun son tour (ordre fixe) : la cible choisit Action ou Vérité sur son téléphone.
// Elle répond / fait le défi, ou refuse et boit. Si elle a répondu, les autres jugent
// en secret : « ✅ Validé » ou « 🙄 Bidon ». Bidon à la majorité = punition quand même.
//
// applyAction(state, type, payload, me, ctx) modifie `state` ou lève une Error.
// ctx = { rng, partyMode, alcohol }.

import { TRUTHS, PUNISHMENTS } from "./truth-content.js";
import { DARES } from "./dare-content.js";

export const lapsFor = duration => ({ short: 2, medium: 3, long: 5, infinite: 999 }[duration] || 3);

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 30); };
const find = (s, name) => s.players.find(p => p.name === name);
const fresh = () => ({ truths: 0, dares: 0, refused: 0, bidon: 0, validated: 0 });

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newGame(players, session = 0, duration = "medium", rng = Math.random) {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  return {
    v: 0, session, phase: "intro", turn: 0, laps: lapsFor(duration),
    players: shuffle(real.map(p => ({ name: p.name, avatar: p.avatar || "🎯" })), rng),
    current: null, kind: null, prompt: null, punishment: null,
    judges: {}, result: null, used: { truth: [], dare: [] },
    stats: Object.fromEntries(real.map(p => [p.name, fresh()])),
    log: ["🎯 Action ou Vérité… ou tu bois. Le groupe juge !"]
  };
}

const maxTurns = s => s.laps * s.players.length;

function startTurn(s) {
  s.turn += 1;
  s.current = s.players[(s.turn - 1) % s.players.length].name;
  s.phase = "choose";
  s.kind = null;
  s.prompt = null;
  s.punishment = null;
  s.judges = {};
  s.result = null;
}

function drawPrompt(s, kind, ctx) {
  const pool = kind === "truth" ? (TRUTHS[ctx.partyMode] || TRUTHS.Party) : (DARES[ctx.partyMode] || DARES.Party);
  const used = s.used[kind];
  let free = pool.filter(q => !used.includes(q));
  if (!free.length) { s.used[kind] = []; free = pool; }
  const prompt = pick(free, ctx.rng);
  s.used[kind].push(prompt);
  return prompt;
}

function punishmentFor(ctx) {
  if (ctx.alcohol === false) return pick(["Mini-gage choisi par le groupe 😇", "Imitation de 10 secondes", "Compliment gênant à quelqu'un", "Danse de 10 secondes"], ctx.rng);
  return pick(PUNISHMENTS[ctx.partyMode] || PUNISHMENTS.Party, ctx.rng);
}

// Les juges : tous les joueurs sauf la cible.
export const judgesOf = s => s.players.filter(p => p.name !== s.current).map(p => p.name);
export const pending = s => (s.phase === "judge" ? judgesOf(s).filter(n => s.judges[n] === undefined) : []);

function closeJudging(s, ctx) {
  const votes = Object.values(s.judges);
  const bidon = votes.filter(v => v === false).length;
  const ok = votes.filter(v => v === true).length;
  const rejected = bidon > ok;
  const st = s.stats[s.current];
  if (rejected) {
    st.bidon += 1;
    s.result = { outcome: "bidon", bidon, ok, punishment: s.punishment };
    say(s, `🙄 ${s.current} : ${s.kind === "truth" ? "réponse" : "défi"} jugé bidon (${bidon} contre ${ok}) → ${s.punishment}`);
  } else {
    st.validated += 1;
    s.result = { outcome: "validated", bidon, ok, punishment: null };
    say(s, `✅ ${s.current} : ${s.kind === "truth" ? "réponse" : "défi"} validé (${ok} contre ${bidon}).`);
  }
  s.phase = "result";
}

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  ctx = { rng: Math.random, partyMode: "Party", alcohol: true, ...ctx };
  const isTarget = me.name === s.current || me.host; // l'hôte peut jouer pour un absent
  if (["start", "close", "end", "restart"].includes(type) && !me.host) throw new Error("Seul l'hôte peut faire ça.");

  switch (type) {
    case "start": {
      if (s.phase !== "intro") return;
      if (s.players.length < 2) throw new Error("Il faut au moins 2 joueurs.");
      startTurn(s);
      return;
    }

    // La cible choisit Action ou Vérité.
    case "choose": {
      if (s.phase !== "choose") return;
      if (!isTarget) throw new Error(`C'est à ${s.current} de choisir.`);
      if (payload.kind !== "truth" && payload.kind !== "dare") throw new Error("Choisis Action ou Vérité.");
      s.kind = payload.kind;
      s.prompt = drawPrompt(s, payload.kind, ctx);
      s.punishment = punishmentFor(ctx);
      s.stats[s.current][payload.kind === "truth" ? "truths" : "dares"] += 1;
      s.phase = "answer";
      say(s, `${payload.kind === "truth" ? "💬 Vérité" : "🔥 Action"} pour ${s.current}.`);
      return;
    }

    // Fait / répondu → le groupe juge.
    case "done": {
      if (s.phase !== "answer") return;
      if (!isTarget) throw new Error("C'est à la cible de dire qu'elle a répondu.");
      s.phase = "judge";
      s.judges = {};
      return;
    }

    // Refus → punition directe.
    case "refuse": {
      if (s.phase !== "answer") return;
      if (!isTarget) throw new Error("C'est à la cible de refuser.");
      s.stats[s.current].refused += 1;
      s.result = { outcome: "refused", punishment: s.punishment };
      s.phase = "result";
      say(s, `🍺 ${s.current} refuse et prend : ${s.punishment}`);
      return;
    }

    case "judge": {
      if (s.phase !== "judge") return;
      if (!judgesOf(s).includes(me.name)) throw new Error(me.name === s.current ? "Tu ne te juges pas toi-même !" : "Tu ne joues pas cette partie.");
      if (s.judges[me.name] !== undefined) throw new Error("Tu as déjà jugé.");
      s.judges[me.name] = Boolean(payload.ok);
      if (!pending(s).length) closeJudging(s, ctx);
      return;
    }

    case "close": {
      if (s.phase !== "judge") return;
      closeJudging(s, ctx);
      return;
    }

    case "next": {
      if (s.phase !== "result") return;
      if (!isTarget) throw new Error("La cible (ou l'hôte) passe au suivant.");
      if (s.turn >= maxTurns(s)) { s.phase = "end"; say(s, "🏁 Fin de la partie !"); return; }
      startTurn(s);
      return;
    }

    case "end": {
      if (s.phase === "intro" || s.phase === "end") return;
      s.phase = "end";
      say(s, "🏁 Fin de la partie !");
      return;
    }

    case "restart": {
      const next = newGame(payload.players || s.players, s.session, "medium", ctx.rng);
      next.laps = s.laps;
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}

export { maxTurns };
