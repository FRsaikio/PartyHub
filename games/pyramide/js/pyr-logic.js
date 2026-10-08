// Règles de la Pyramide, sans navigateur ni Firebase : testable seul dans Node.
//
// Chacun reçoit 4 cartes secrètes, les mémorise, puis elles se cachent. La TV retourne une
// pyramide de cartes, de la base (1 gorgée) au sommet. Quand une carte est retournée, chacun
// peut DONNER les gorgées de l'étage à quelqu'un en prétendant avoir la même valeur. La cible
// boit… ou crie « Menteur ! » : le donneur doit alors toucher la bonne carte parmi ses cartes
// cachées. S'il l'avait, la cible boit double ; sinon (bluff ou trou de mémoire), le donneur
// boit double. La carte montrée est remplacée par une nouvelle. À la fin, chacun doit réciter
// ses 4 cartes : chaque erreur coûte des gorgées.
//
// applyAction(state, type, payload, me, ctx) modifie `state` ou lève une Error.

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["S", "H", "D", "C"];
export const HAND = 4;
export const RECALL_PENALTY = 2;

export const rowsFor = duration => ({ short: 4, medium: 5, long: 6, infinite: 7 }[duration] || 5);
export const rankOf = card => String(card).slice(0, -1);

// Gorgées d'un étage (0 = base) selon le niveau d'alcool du lobby.
export function sipsFor(row, level = "normal") {
  const base = row + 1;
  if (level === "soft") return Math.min(base, 2);
  if (level === "hard") return base + 1;
  if (level === "extreme") return base * 2;
  return base;
}

// Ordre de retournement : base de gauche à droite, puis l'étage au-dessus… jusqu'au sommet.
export function pyramidSlots(rows) {
  const slots = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < rows - row; col++) slots.push({ row, col });
  }
  return slots;
}

function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function freshDeck(decks, rng) {
  const cards = [];
  for (let d = 0; d < decks; d++) RANKS.forEach(r => SUITS.forEach(s => cards.push(r + s)));
  return shuffled(cards, rng);
}

const say = (s, text) => { s.log = [text, ...(s.log || [])].slice(0, 40); };
const isPlayer = (s, name) => s.players.some(p => p.name === name);
const add = (map, name, n) => { map[name] = (map[name] || 0) + n; };

export function newGame(players, session = 0, duration = "medium", level = "normal") {
  const real = (players || []).filter(p => p && p.name && !p.fake);
  return {
    v: 0, session, phase: "intro", rows: rowsFor(duration), level,
    players: real.map(p => ({ name: p.name, avatar: p.avatar || "🃏" })),
    hands: {}, deck: [], pyramid: [], flipped: -1,
    ready: {}, attacks: [], nextId: 1, fresh: {}, recall: {}, recallResult: null,
    drinks: {}, given: {}, bluffs: {}, caught: {}, sniffs: {},
    log: ["🔺 La Pyramide : mémorise tes cartes, donne des gorgées… et bluffe."]
  };
}

export const currentCard = s => (s.flipped >= 0 ? s.pyramid[s.flipped] : null);
export const currentSips = s => (s.flipped >= 0 ? sipsFor(s.pyramid[s.flipped].row, s.level) : 0);
export const openAttacks = s => s.attacks.filter(a => a.status === "pending" || a.status === "challenged");

// Le donneur n'a pas répondu / la cible n'a pas réagi : on clôt avant de retourner la carte suivante.
function settleOpen(s) {
  openAttacks(s).forEach(a => {
    if (a.status === "pending") {
      a.status = "drunk";
      add(s.drinks, a.to, a.sips);
      add(s.given, a.from, a.sips);
      if (!s.hands[a.from]?.some(c => rankOf(c) === a.rank)) add(s.bluffs, a.from, 1);
    } else {
      a.status = "lie";
      a.loser = a.from;
      add(s.drinks, a.from, a.sips * 2);
      add(s.caught, a.from, 1);
      add(s.sniffs, a.to, 1);
    }
  });
}

function draw(s, ctx) {
  if (!s.deck.length) s.deck = freshDeck(1, ctx.rng);
  return s.deck.pop();
}

export function applyAction(s, type, payload = {}, me = {}, ctx = {}) {
  const rng = ctx.rng || Math.random;
  const hostOnly = ["rows", "start", "go", "flip", "closeRecall", "end", "restart"];
  if (hostOnly.includes(type) && !me.host) throw new Error("Seul l'hôte peut faire ça.");

  switch (type) {
    case "rows": {
      if (s.phase !== "intro") return;
      s.rows = Math.max(3, Math.min(7, Math.round(Number(payload.rows) || 5)));
      return;
    }

    case "start": {
      if (s.phase !== "intro") return;
      if (s.players.length < 2) throw new Error("Il faut au moins 2 joueurs.");
      const slots = pyramidSlots(s.rows);
      const decks = Math.max(1, Math.ceil((s.players.length * HAND + slots.length + 12) / 52));
      s.deck = freshDeck(decks, rng);
      s.hands = {};
      s.players.forEach(p => { s.hands[p.name] = Array.from({ length: HAND }, () => s.deck.pop()); });
      s.pyramid = slots.map(slot => ({ ...slot, card: s.deck.pop() }));
      s.flipped = -1;
      s.ready = {};
      s.phase = "memo";
      say(s, `🃏 Cartes distribuées (${s.rows} étages, ${slots.length} cartes). Mémorisez !`);
      return;
    }

    case "ready": {
      if (s.phase !== "memo" || !isPlayer(s, me.name)) return;
      s.ready[me.name] = true;
      return;
    }

    case "go": {
      if (s.phase !== "memo") return;
      s.phase = "play";
      say(s, "🔺 La pyramide commence !");
      return;
    }

    case "flip": {
      if (s.phase !== "play") return;
      settleOpen(s);
      if (s.flipped + 1 >= s.pyramid.length) {
        s.phase = "recall";
        s.recall = {};
        say(s, "🧠 Pyramide terminée : récitez vos cartes !");
        return;
      }
      s.flipped += 1;
      const top = s.flipped === s.pyramid.length - 1;
      say(s, `${top ? "👑 Sommet" : `Étage ${s.pyramid[s.flipped].row + 1}`} : ${s.pyramid[s.flipped].card} (${currentSips(s)} gorgée${currentSips(s) > 1 ? "s" : ""})`);
      return;
    }

    case "give": {
      if (s.phase !== "play" || s.flipped < 0) throw new Error("Attends qu'une carte soit retournée.");
      if (!isPlayer(s, me.name)) throw new Error("Tu ne joues pas cette partie.");
      const to = String(payload.to || "");
      if (!isPlayer(s, to) || to === me.name) throw new Error("Choisis quelqu'un d'autre.");
      if (s.attacks.some(a => a.flip === s.flipped && a.from === me.name)) throw new Error("Tu as déjà donné sur cette carte.");
      const card = currentCard(s).card;
      const attack = { id: s.nextId++, flip: s.flipped, from: me.name, to, rank: rankOf(card), sips: currentSips(s), status: "pending" };
      s.attacks.push(attack);
      say(s, `🫵 ${me.name} donne ${attack.sips} à ${to}`);
      return;
    }

    case "accept":
    case "challenge": {
      const a = s.attacks.find(x => x.id === Number(payload.id));
      if (!a || a.status !== "pending") return;
      if (a.to !== me.name) throw new Error("Ce n'est pas à toi de répondre.");
      if (type === "accept") {
        a.status = "drunk";
        add(s.drinks, a.to, a.sips);
        add(s.given, a.from, a.sips);
        if (!s.hands[a.from]?.some(c => rankOf(c) === a.rank)) add(s.bluffs, a.from, 1);
        say(s, `🍺 ${a.to} boit ${a.sips}`);
      } else {
        a.status = "challenged";
        say(s, `🤨 ${a.to} crie MENTEUR à ${a.from} !`);
      }
      return;
    }

    // Le donneur accusé touche une de ses cartes cachées.
    case "reveal": {
      const a = s.attacks.find(x => x.id === Number(payload.id));
      if (!a || a.status !== "challenged") return;
      if (a.from !== me.name) throw new Error("Ce n'est pas à toi de montrer ta carte.");
      const pos = Number(payload.pos);
      const hand = s.hands[a.from] || [];
      if (!(pos >= 0 && pos < hand.length)) throw new Error("Carte invalide.");
      const shown = hand[pos];
      const truth = rankOf(shown) === a.rank;
      a.shown = shown;
      a.status = truth ? "truth" : "lie";
      a.loser = truth ? a.to : a.from;
      add(s.drinks, a.loser, a.sips * 2);
      if (truth) { add(s.given, a.from, a.sips * 2); } else { add(s.caught, a.from, 1); add(s.sniffs, a.to, 1); }
      hand[pos] = draw(s, { rng });
      s.fresh[a.from] = { pos, n: (s.fresh[a.from]?.n || 0) + 1 };
      say(s, truth ? `✅ ${a.from} avait bien un ${a.rank} : ${a.to} boit ${a.sips * 2}` : `❌ ${a.from} a montré ${shown} : il boit ${a.sips * 2}`);
      return;
    }

    case "recall": {
      if (s.phase !== "recall" || !isPlayer(s, me.name)) return;
      const guesses = (payload.guesses || []).slice(0, HAND).map(String);
      if (guesses.length !== HAND || guesses.some(g => !RANKS.includes(g))) throw new Error("Donne une valeur pour chaque carte.");
      s.recall[me.name] = guesses;
      if (s.players.every(p => s.recall[p.name])) finishRecall(s);
      return;
    }

    case "closeRecall": {
      if (s.phase !== "recall") return;
      finishRecall(s);
      return;
    }

    case "end": {
      if (s.phase === "intro" || s.phase === "end") return;
      settleOpen(s);
      if (s.phase === "recall") { finishRecall(s); return; }
      s.phase = "end";
      say(s, "🏁 Fin de la pyramide !");
      return;
    }

    case "restart": {
      const next = newGame(payload.players || s.players, s.session);
      next.rows = s.rows;
      next.level = s.level;
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}

// Récitation : chaque valeur fausse coûte RECALL_PENALTY gorgées. Ceux qui n'ont pas répondu
// ne sont pas comptés.
function finishRecall(s) {
  const results = s.players.filter(p => s.recall[p.name]).map(p => {
    const hand = s.hands[p.name] || [];
    const good = hand.filter((c, i) => rankOf(c) === s.recall[p.name][i]).length;
    const errors = HAND - good;
    add(s.drinks, p.name, errors * RECALL_PENALTY);
    return { name: p.name, good, errors, sips: errors * RECALL_PENALTY };
  });
  s.recallResult = results;
  s.phase = "end";
  say(s, "🏁 Fin de la pyramide !");
}
