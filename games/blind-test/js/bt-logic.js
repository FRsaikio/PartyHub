// Règles du Blind test, sans navigateur ni Firebase : testable seul dans Node.
//
// L'hôte choisit un ou plusieurs thèmes et le nombre d'extraits ; les manches (morceau + 4 propositions) sont préparées à partir
// d'une playlist Deezer (bt-deezer.js) au lancement. À chaque manche, l'extrait joue sur la TV
// (ou le téléphone de l'hôte) ; chacun choisit une proposition sur son téléphone. Le temps de
// réponse est mesuré par chaque téléphone à partir du moment où il a reçu la manche (aucune
// horloge comparée). Bonne réponse = 500 à 1000 points selon la rapidité.
//
// applyAction(state, type, payload, me, ctx) modifie `state` ou lève une Error.

export const roundsFor = duration => ({ short: 20, medium: 30, long: 40, infinite: 50 }[duration] || 30);
export const ROUND_CHOICES = [10, 20, 30, 40, 50];
export const ANSWER_WINDOW = 20000; // au-delà de 20 s, une bonne réponse vaut 500 points

export function pointsFor(ms) {
  const t = Math.max(0, Math.min(ANSWER_WINDOW, Number(ms) || 0));
  return Math.round(1000 - (t / ANSWER_WINDOW) * 500);
}

const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 30); };
const find = (s, name) => s.players.find(p => p.name === name);

export function newGame(players, session = 0, duration = "medium") {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  return {
    v: 0, session, phase: "intro", themes: ["mix"], maxRounds: roundsFor(duration),
    players: real.map(p => ({ name: p.name, avatar: p.avatar || "🎧" })),
    rounds: [], spares: [], index: -1, answers: {}, reveal: null, playing: null, failed: null,
    scores: Object.fromEntries(real.map(p => [p.name, 0])),
    correct: Object.fromEntries(real.map(p => [p.name, 0])),
    fastest: {}, log: ["🎧 Blind test : écoutez, trouvez, le plus rapide gagne."]
  };
}

export const current = s => s.rounds[s.index] || null;
export const SPARES = 3; // manches de réserve, utilisées si un extrait ne se charge pas
// Identifiant de la manche en cours (change aussi quand une manche est remplacée par une réserve).
export const roundKey = s => (current(s) ? `${s.session}:${s.index}:${current(s).trackId}` : "");
export const pending = s => (s.phase === "listen" ? s.players.filter(p => s.answers[p.name] === undefined).map(p => p.name) : []);

function reveal(s) {
  const round = current(s);
  const results = Object.entries(s.answers).map(([name, a]) => {
    const ok = a.choice === round.answer;
    const pts = ok ? pointsFor(a.ms) : 0;
    s.scores[name] = (s.scores[name] || 0) + pts;
    if (ok) s.correct[name] = (s.correct[name] || 0) + 1;
    return { name, choice: a.choice, ok, ms: a.ms, pts };
  }).sort((a, b) => b.pts - a.pts);
  const best = results.find(r => r.ok);
  if (best) s.fastest[best.name] = (s.fastest[best.name] || 0) + 1;
  s.reveal = { results, fastest: best?.name || null };
  s.phase = "reveal";
  say(s, `🎵 ${round.title} — ${round.artist}${best ? ` · ⚡ ${best.name} le plus rapide` : " · personne n'a trouvé"}`);
}

export function applyAction(s, type, payload = {}, me = {}) {
  const hostOnly = ["theme", "count", "start", "close", "next", "end", "restart", "skip"];
  if (hostOnly.includes(type) && !me.host) throw new Error("Seul l'hôte peut faire ça.");

  switch (type) {
    // Coche / décoche un thème. « mix » = tous les thèmes ; rien de coché = « mix ».
    case "theme": {
      if (s.phase !== "intro") return;
      const key = String(payload.theme || "mix");
      let themes = (s.themes || []).filter(t => t !== "mix");
      if (key === "mix") themes = [];
      else themes = themes.includes(key) ? themes.filter(t => t !== key) : [...themes, key];
      s.themes = themes.length ? themes : ["mix"];
      return;
    }

    case "count": {
      if (s.phase !== "intro") return;
      s.maxRounds = Math.max(5, Math.min(60, Math.round(Number(payload.count) || 30)));
      return;
    }

    // Les manches sont préparées par le téléphone de l'hôte (playlist Deezer) puis envoyées ici.
    case "start": {
      if (s.phase !== "intro") return;
      if (s.players.length < 1) throw new Error("Il faut au moins 1 joueur.");
      const rounds = (payload.rounds || []).filter(r => r && r.trackId && Array.isArray(r.choices) && r.choices.length >= 2);
      if (rounds.length < 3) throw new Error("Pas assez de morceaux trouvés pour ces thèmes, essaie-en d'autres.");
      s.rounds = rounds.slice(0, s.maxRounds);
      s.spares = rounds.slice(s.maxRounds, s.maxRounds + SPARES);
      s.index = 0;
      s.answers = {};
      s.reveal = null;
      s.phase = "listen";
      say(s, `🎧 C'est parti : ${s.rounds.length} extraits.`);
      return;
    }

    // L'extrait de la manche ne se charge pas : on la remplace par une manche de réserve (ou on
    // la retire s'il n'y en a plus). Personne ne marque de points sur une manche sans musique.
    case "skip": {
      if (s.phase !== "listen" || (payload.key && payload.key !== roundKey(s))) return;
      const broken = current(s);
      if (s.spares?.length) s.rounds[s.index] = s.spares.shift();
      else s.rounds.splice(s.index, 1);
      s.answers = {};
      s.playing = null;
      s.failed = null;
      say(s, `⚠️ Extrait indisponible (${broken.title}) : manche remplacée.`);
      if (s.index >= s.rounds.length) { s.phase = "end"; say(s, "🏁 Fin du blind test !"); }
      return;
    }

    case "answer": {
      if (s.phase !== "listen") return;
      if (!find(s, me.name)) throw new Error("Tu ne joues pas cette partie.");
      if (s.answers[me.name] !== undefined) throw new Error("Tu as déjà répondu.");
      const choice = Number(payload.choice);
      if (!(choice >= 0 && choice < current(s).choices.length)) throw new Error("Réponse invalide.");
      s.answers[me.name] = { choice, ms: Math.max(0, Math.round(Number(payload.ms) || 0)) };
      if (!pending(s).length) reveal(s);
      return;
    }

    case "close": {
      if (s.phase !== "listen") return;
      reveal(s);
      return;
    }

    case "next": {
      if (s.phase !== "reveal") return;
      if (s.index + 1 >= s.rounds.length) { s.phase = "end"; say(s, "🏁 Fin du blind test !"); return; }
      s.index += 1;
      s.answers = {};
      s.reveal = null;
      s.playing = null;
      s.failed = null;
      s.phase = "listen";
      return;
    }

    case "end": {
      if (s.phase === "intro" || s.phase === "end") return;
      s.phase = "end";
      say(s, "🏁 Fin du blind test !");
      return;
    }

    case "restart": {
      const next = newGame(payload.players || s.players, s.session);
      next.maxRounds = s.maxRounds;
      next.themes = s.themes;
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}
