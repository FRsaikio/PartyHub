// Règles du Texas Hold'em : cartes, évaluation des mains (5 meilleures cartes sur 7,
// départage complet), pots partagés / pots séparés, punitions de PartyHub.
// Aucun accès au navigateur ni à Firebase : testable seul.
//
// Une carte = texte compact « 10♥ », « A♠ ». Valeurs : 2…10, J=11, Q=12, K=13, A=14.

export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export const rankOf = code => code.slice(0, -1);
export const suitOf = code => code.slice(-1);
export const valueOf = code => {
  const r = rankOf(code);
  return r === "A" ? 14 : r === "K" ? 13 : r === "Q" ? 12 : r === "J" ? 11 : Number(r);
};

export function freshDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push(`${rank}${suit}`);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ---------- Évaluation ----------

export const HAND_NAMES = ["Carte haute", "Paire", "Double paire", "Brelan", "Suite", "Couleur", "Full", "Carré", "Quinte flush", "Quinte flush royale"];

// Punitions de PartyHub pour les perdants qui vont jusqu'à l'abattage (textes d'origine).
const PUNISHMENTS = {
  "Quinte flush royale": "👑 BAD BEAT HELL : tout le monde boit avec toi.",
  "Quinte flush": "☠️ Le gagnant choisit ta punition.",
  "Carré": "🍺 Simple shot malgré la défaite.",
  "Full": "💣 Gage choisi par la table + 2 gorgées.",
  "Couleur": "🍺 Demi-verre cul sec.",
  "Suite": "🔥 Distribue 5 gorgées.",
  "Brelan": "🔥 Shot collectif avec les perdants.",
  "Double paire": "🍺 Bois avec ton voisin.",
  "Paire": "🍺 5 gorgées.",
  "Carte haute": "💀 Un shot."
};
export const punishmentFor = handName => PUNISHMENTS[handName] || "🍺 5 gorgées.";

// Plus haute suite dans une liste de valeurs (l'As compte aussi pour 1). 0 si aucune.
function straightHigh(values) {
  const set = new Set(values);
  if (set.has(14)) set.add(1);
  for (let high = 14; high >= 5; high--) {
    let ok = true;
    for (let v = high; v > high - 5; v--) if (!set.has(v)) { ok = false; break; }
    if (ok) return high;
  }
  return 0;
}

// Évalue la meilleure main de 5 cartes parmi 5 à 7 cartes.
// Renvoie { cat, name, score } ; `score` se compare directement (plus grand = meilleur).
export function evaluate(codes) {
  const values = codes.map(valueOf).sort((a, b) => b - a);
  const bySuit = {};
  codes.forEach(c => { (bySuit[suitOf(c)] ||= []).push(valueOf(c)); });
  const flushVals = Object.values(bySuit).find(v => v.length >= 5)?.sort((a, b) => b - a);

  const counts = {};
  values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  // groupes triés : d'abord par taille (4, 3, 2, 1), puis par valeur
  const groups = Object.entries(counts).map(([v, n]) => ({ v: Number(v), n })).sort((a, b) => b.n - a.n || b.v - a.v);
  const kickers = (exclude, k) => values.filter(v => !exclude.includes(v)).slice(0, k);

  let cat;
  let tiebreak;

  const sf = flushVals ? straightHigh(flushVals) : 0;
  const st = straightHigh(values);

  if (sf) {
    cat = sf === 14 ? 9 : 8;
    tiebreak = [sf];
  } else if (groups[0].n === 4) {
    cat = 7;
    tiebreak = [groups[0].v, ...kickers([groups[0].v], 1)];
  } else if (groups[0].n === 3 && groups.slice(1).some(g => g.n >= 2)) {
    cat = 6;
    tiebreak = [groups[0].v, groups.slice(1).find(g => g.n >= 2).v];
  } else if (flushVals) {
    cat = 5;
    tiebreak = flushVals.slice(0, 5);
  } else if (st) {
    cat = 4;
    tiebreak = [st];
  } else if (groups[0].n === 3) {
    cat = 3;
    tiebreak = [groups[0].v, ...kickers([groups[0].v], 2)];
  } else if (groups[0].n === 2 && groups[1]?.n === 2) {
    const [hi, lo] = [groups[0].v, groups[1].v];
    cat = 2;
    tiebreak = [hi, lo, ...kickers([hi, lo], 1)];
  } else if (groups[0].n === 2) {
    cat = 1;
    tiebreak = [groups[0].v, ...kickers([groups[0].v], 3)];
  } else {
    cat = 0;
    tiebreak = values.slice(0, 5);
  }

  // Score : catégorie puis départage, chaque valeur sur 2 chiffres en base 15.
  const score = [cat, ...tiebreak, 0, 0, 0, 0, 0].slice(0, 6).reduce((acc, v) => acc * 15 + v, 0);
  return { cat, name: HAND_NAMES[cat], score };
}

// ---------- Pots ----------

// players = [{ key, contrib, folded }] → [{ amount, eligible: [clés] }]
// Pot principal + pots séparés quand des joueurs sont à tapis avec moins que les autres.
export function buildPots(players) {
  const left = players.map(p => ({ ...p, left: p.contrib || 0 }));
  const pots = [];
  while (left.some(p => p.left > 0)) {
    const live = left.filter(p => p.left > 0 && !p.folded);
    if (!live.length) {
      // il ne reste que l'argent de joueurs couchés : il va au dernier pot
      const rest = left.reduce((s, p) => s + p.left, 0);
      left.forEach(p => { p.left = 0; });
      if (pots.length) pots[pots.length - 1].amount += rest;
      break;
    }
    const level = Math.min(...live.map(p => p.left));
    let amount = 0;
    left.forEach(p => {
      const take = Math.min(p.left, level);
      p.left -= take;
      amount += take;
    });
    const eligible = live.map(p => p.key);
    const prev = pots[pots.length - 1];
    if (prev && prev.eligible.join() === eligible.join()) prev.amount += amount;
    else pots.push({ amount, eligible });
  }
  return pots;
}
