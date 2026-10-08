// Résumé d'une partie terminée et récap de la soirée (logique pure, testable dans Node).
//
// summarize(gameId, state) lit l'état final d'un jeu (champ de la room) et renvoie :
//   { label, players, winners, highlights: [{ icon, title, name, value, bad }], drinks }
// buildRecap(soiree) agrège les parties notées dans room.soiree.games (journal de soirée).

export const GAME_LABELS = {
  blindtest: "Blind test", pyramid: "La Pyramide", mostLikely: "Qui est le plus susceptible ?", never: "Je n’ai jamais",
  truth: "Action ou Vérité", survivor: "Survivor", traitor: "Mission Traître", bomb: "La Bombe",
  roulette: "Roulette Chaos", kings: "Chaos Kings", monopoly: "Monopoly"
};

const namesOf = s => (s.players || s.tribe || []).map(p => p.name).filter(Boolean);

// Meilleur(s) d'une table { nom: nombre } (ex æquo gardés), seulement si le max est > 0.
function best(map, { min = false } = {}) {
  const entries = Object.entries(map || {}).filter(([, v]) => Number.isFinite(v));
  if (!entries.length) return { names: [], value: 0 };
  const target = min ? Math.min(...entries.map(([, v]) => v)) : Math.max(...entries.map(([, v]) => v));
  if (!min && target <= 0) return { names: [], value: 0 };
  return { names: entries.filter(([, v]) => v === target).map(([n]) => n), value: target };
}

const statMap = (stats, key) => Object.fromEntries(Object.entries(stats || {}).map(([n, st]) => [n, Number(st?.[key]) || 0]));

function hl(icon, title, top, unit = "", bad = false) {
  if (!top.names.length) return null;
  return { icon, title, name: top.names.join(" & "), value: `${top.value}${unit}`, bad };
}

const SUMMARIES = {
  blindtest: s => ({
    winners: best(s.scores).names,
    highlights: [hl("🏆", "Meilleur score", best(s.scores), " pts"), hl("⚡", "Doigt le plus rapide", best(s.fastest)), hl("🎯", "Oreille absolue", best(s.correct), " bonnes")],
    drinks: null
  }),
  pyramid: s => {
    const memory = Object.fromEntries((s.recallResult || []).map(r => [r.name, r.good]));
    return {
      winners: best(Object.fromEntries(namesOf(s).map(n => [n, s.drinks?.[n] || 0])), { min: true }).names,
      highlights: [hl("🍺", "A le plus bu", best(s.drinks), " gorgées", true), hl("🃏", "Meilleur bluffeur", best(s.bluffs)), hl("🕵️", "Détecteur de mensonges", best(s.sniffs)), hl("🐘", "Mémoire d’éléphant", best(memory), "/4")],
      drinks: { ...(s.drinks || {}) }
    };
  },
  mostLikely: s => ({
    winners: best(s.prophet).names,
    highlights: [hl("🔮", "Meilleur devin", best(s.prophet)), hl("👉", "Le plus désigné", best(s.scores), " fois", true)],
    drinks: null
  }),
  never: s => ({
    winners: best(s.points).names,
    highlights: [hl("🎯", "Meilleurs pronostics", best(s.points), " pts"), hl("😈", "L’a déjà fait le plus souvent", best(s.did), " fois", true)],
    drinks: null
  }),
  truth: s => ({
    winners: best(statMap(s.stats, "validated")).names,
    highlights: [hl("✅", "Le plus courageux", best(statMap(s.stats, "validated")), " validés"), hl("🙄", "Le plus bidon", best(statMap(s.stats, "bidon")), " fois", true), hl("🍺", "A le plus refusé", best(statMap(s.stats, "refused")), " refus", true)],
    drinks: null
  }),
  survivor: s => ({
    winners: s.result?.winner ? [s.result.winner] : [],
    highlights: [hl("💪", "Roi des épreuves", best(statMap(s.stats, "challengesWon"))), hl("🍻", "Le plus puni", best(statMap(s.stats, "punishments")), "", true), s.firstOut ? { icon: "🔥", title: "Premier éliminé", name: s.firstOut, value: "", bad: true } : null],
    drinks: null
  }),
  traitor: s => {
    const camp = s.result?.winner === "traitors" ? "traitor" : s.result?.winner === "innocents" ? "innocent" : null;
    const traitors = (s.players || []).filter(p => p.role === "traitor").map(p => p.name);
    return {
      winners: camp ? (s.players || []).filter(p => p.role === camp).map(p => p.name) : [],
      highlights: [traitors.length ? { icon: "😈", title: traitors.length > 1 ? "Les traîtres" : "Le traître", name: traitors.join(" & "), value: camp === "traitor" ? "victoire" : "démasqué", bad: camp !== "traitor" } : null],
      drinks: null
    };
  },
  bomb: s => ({
    winners: s.result?.winner ? [s.result.winner] : [],
    highlights: [hl("💥", "A le plus explosé", best(statMap(s.stats, "booms")), " boums", true), hl("🗣️", "Le plus bavard", best(statMap(s.stats, "words")), " réponses")],
    drinks: null
  }),
  roulette: s => ({
    winners: best(statMap(s.stats, "duelsWon")).names,
    highlights: [hl("🍻", "Le plus assoiffé", best(s.sips), " gorgées", true), hl("⚔️", "Roi du duel", best(statMap(s.stats, "duelsWon"))), hl("🎁", "Le plus généreux", best(statMap(s.stats, "distributed")), " gorgées")],
    drinks: { ...(s.sips || {}) }
  }),
  kings: s => ({
    winners: [],
    highlights: [hl("👑", "A tiré le plus de rois", best(statMap(s.stats, "kings"))), hl("🎯", "Le plus visé", best(statMap(s.stats, "targeted")), " fois", true), (s.cup || []).length >= 4 ? { icon: "🏆", title: "A bu la Chaos Cup", name: s.cup[s.cup.length - 1], value: "", bad: true } : null],
    drinks: null
  }),
  monopoly: s => {
    const ranking = s.result?.ranking || [];
    const sips = Object.fromEntries((s.players || []).map(p => [p.name, Number(p.sips) || 0]));
    return {
      winners: ranking[0] ? [ranking[0].name] : [],
      highlights: [ranking[0] ? { icon: "💰", title: "Magnat", name: ranking[0].name, value: `${ranking[0].wealth} de fortune`, bad: false } : null, hl("🍺", "A le plus bu", best(sips), " gorgées", true)],
      drinks: sips
    };
  }
};

export function summarize(gameId, state) {
  const fn = SUMMARIES[gameId];
  if (!fn || !state) return null;
  const out = fn(state);
  return {
    label: GAME_LABELS[gameId] || gameId,
    players: namesOf(state),
    winners: out.winners || [],
    highlights: (out.highlights || []).filter(Boolean),
    drinks: out.drinks || null
  };
}

// Clé unique d'une partie. « Rejouer » garde la même session : on ajoute une empreinte de
// l'état final (cartes, manches, scores…) pour distinguer deux parties d'affilée du même jeu.
// L'état ne bouge plus une fois la partie finie : la clé reste la même à chaque mise à jour.
export function gameKey(gameId, state, summary) {
  const { v, ...rest } = state || {};
  const text = JSON.stringify([rest, summary?.winners]);
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return `${gameId}:${state?.session || 0}:${(hash >>> 0).toString(36)}`;
}

// ---------- Récap de la soirée ----------

export function buildRecap(soiree) {
  const games = (soiree?.games || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0));
  const players = new Map();
  const get = name => {
    if (!players.has(name)) players.set(name, { name, played: 0, wins: 0, drinks: 0, bad: 0, good: 0 });
    return players.get(name);
  };
  const playedCount = {};
  games.forEach(g => {
    playedCount[g.label] = (playedCount[g.label] || 0) + 1;
    (g.players || []).forEach(n => { get(n).played += 1; });
    (g.winners || []).forEach(n => { get(n).wins += 1; });
    Object.entries(g.drinks || {}).forEach(([n, v]) => { get(n).drinks += Number(v) || 0; });
    (g.highlights || []).forEach(h => String(h.name || "").split(" & ").forEach(n => { if (n) get(n)[h.bad ? "bad" : "good"] += 1; }));
  });
  const list = [...players.values()];
  const top = key => {
    const max = Math.max(0, ...list.map(p => p[key]));
    return max > 0 ? { names: list.filter(p => p[key] === max).map(p => p.name), value: max } : null;
  };
  const favorite = Object.entries(playedCount).sort((a, b) => b[1] - a[1])[0];
  const awards = [
    ["🏆", "Champion de la soirée", top("wins"), v => `${v} victoire${v > 1 ? "s" : ""}`],
    ["🍺", "Plus gros buveur", top("drinks"), v => `${v} gorgée${v > 1 ? "s" : ""} comptée${v > 1 ? "s" : ""}`],
    ["⭐", "Star des moments forts", top("good"), v => `${v} titre${v > 1 ? "s" : ""}`],
    ["🐈‍⬛", "Chat noir de la soirée", top("bad"), v => `${v} malchance${v > 1 ? "s" : ""}`],
    ["🎮", "Le plus assidu", top("played"), v => `${v} partie${v > 1 ? "s" : ""}`]
  ].filter(([, , t]) => t).map(([icon, title, t, fmt]) => ({ icon, title, name: t.names.join(" & "), value: fmt(t.value) }));
  const start = games[0]?.at || null;
  const end = games[games.length - 1]?.at || null;
  return {
    count: games.length,
    minutes: start && end ? Math.max(0, Math.round((end - start) / 60000)) : 0,
    favorite: favorite ? { label: favorite[0], count: favorite[1] } : null,
    ranking: list.sort((a, b) => b.wins - a.wins || b.good - a.good || a.bad - b.bad),
    awards,
    timeline: games.map(g => ({ label: g.label, at: g.at, winners: g.winners || [], highlight: (g.highlights || [])[0] || null }))
  };
}
