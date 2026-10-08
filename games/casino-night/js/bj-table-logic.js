// Logique de la table de blackjack partagée — sans Firebase ni page web, pour pouvoir
// la tester seule. bj-table.js l'applique à l'intérieur d'une transaction Firestore.
//
// État de la table (rooms/{code}.casino.bjTable) :
//   { round, phase, shoe: ["10♥", …], dealer: [...], order: [clés], turn: { key, hand } | null,
//     seats: { <clé joueur>: { name, index, bet, allIn, hands: [{ cards, bet, doubled, done,
//              splitAces, surrendered }], insurance, insuranceDecided, result } } }
//
// Phases : "betting" (on s'assoit, on mise) → "insurance" (si la banque montre un As)
//          → "playing" (chacun joue à son tour, dans l'ordre des places) → "done" (résultats).
//          Une nouvelle mise pendant "done" ouvre la manche suivante.

import { MAX_HANDS, value, total, isBlackjack, freshShoe, cardCode, parseCard, resolveHand, handReturn } from "./bj-rules.js";

export const MAX_SEATS = 5;
export const MIN_BET = 50;

const fmt = n => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0");

export const cards = codes => (codes || []).map(parseCard);
export const handTotal = hand => total(cards(hand.cards));
export const isNatural = (seat, hand) => seat.hands.length === 1 && hand.cards.length === 2 && isBlackjack(cards(hand.cards));

export function emptyTable() {
  return { round: 0, phase: "betting", shoe: [], dealer: [], order: [], turn: null, seats: {}, updatedAt: Date.now() };
}

function newHand(bet) {
  return { cards: [], bet, doubled: false, done: false, splitAces: false, surrendered: false };
}

function drawCard(table) {
  if (table.shoe.length < 15) table.shoe = freshShoe().map(cardCode);
  return table.shoe.pop();
}

// Remet la table à zéro pour une nouvelle manche (mises effacées, places gardées).
function openNewRound(table) {
  table.phase = "betting";
  table.dealer = [];
  table.order = [];
  table.turn = null;
  Object.values(table.seats).forEach(seat => {
    Object.assign(seat, { bet: 0, allIn: false, hands: [], insurance: 0, insuranceDecided: false, result: null });
  });
}

// Prochaine main à jouer : toutes les mains dans l'ordre des places, on prend la première
// non terminée après la position actuelle (puis depuis le début, par sécurité).
function nextTurn(table) {
  const all = table.order.flatMap(key => (table.seats[key]?.hands || []).map((h, i) => ({ key, hand: i, done: h.done })));
  const current = table.turn ? all.findIndex(p => p.key === table.turn.key && p.hand === table.turn.hand) : -1;
  const next = all.slice(current + 1).find(p => !p.done) || all.find(p => !p.done);
  return next ? { key: next.key, hand: next.hand } : null;
}

// Passe au joueur suivant, ou fait jouer la banque puis règle la manche.
function advance(table, credit) {
  table.turn = nextTurn(table);
  if (!table.turn) {
    dealerPlays(table);
    settle(table, credit);
  }
}

function dealerPlays(table) {
  const dealerBJ = isBlackjack(cards(table.dealer));
  const alive = !dealerBJ && table.order.some(key => {
    const seat = table.seats[key];
    return seat?.hands.some(h => !h.surrendered && handTotal(h) <= 21 && !isNatural(seat, h));
  });
  while (alive && total(cards(table.dealer)) < 17) table.dealer.push(drawCard(table));
}

function settle(table, credit) {
  const dealer = cards(table.dealer);
  const dealerBJ = isBlackjack(dealer);

  table.order.forEach(key => {
    const seat = table.seats[key];
    if (!seat) return;
    const lines = [];
    let staked = 0;
    let returned = 0;
    let anyLoss = false;
    let big = false;

    seat.hands.forEach((hand, i) => {
      const natural = isNatural(seat, hand);
      const naturals = dealerBJ || natural ? { playerBJ: natural, dealerBJ } : null;
      const r = resolveHand({ cards: cards(hand.cards), surrendered: hand.surrendered }, dealer, naturals);
      const prefix = seat.hands.length > 1 ? `Main ${i + 1} (${handTotal(hand)}) : ` : "";
      const back = handReturn(hand, r, seat.allIn);

      staked += hand.bet;
      returned += back + (hand.surrendered ? Math.floor(hand.bet / 2) : 0); // l'abandon est rendu au moment de l'action
      if (r.outcome === "lose") anyLoss = true;
      if (r.outcome === "win" && r.big) big = true;
      const doubleNote = !hand.doubled ? "" : r.outcome === "win" ? " 💪 Double réussi." : r.outcome === "lose" ? " 💀 Double raté : 2 gorgées en plus." : "";
      lines.push(`${prefix}${r.text}${doubleNote}`);
      if (back) credit(key, back);
    });

    if (seat.insurance) {
      staked += seat.insurance;
      if (dealerBJ) {
        returned += seat.insurance * 3;
        credit(key, seat.insurance * 3);
        lines.push(`🛡️ Assurance gagnante : +${fmt(seat.insurance * 3)} jetons.`);
      } else {
        lines.push(`Assurance perdue (-${fmt(seat.insurance)}).`);
      }
    }
    if (seat.allIn && returned > staked) lines.push("🔥 ALL IN réussi : gains doublés.");
    if (seat.allIn && anyLoss && returned <= staked) lines.push("⚠️ ALL IN raté : sanction doublée.");

    seat.result = { net: returned - staked, lines, anyLoss, big };
  });

  table.turn = null;
  table.phase = "done";
}

// Après la distribution (et l'assurance) : blackjacks d'entrée, puis premier joueur.
function startPlay(table, credit) {
  const dealerBJ = isBlackjack(cards(table.dealer));
  table.order.forEach(key => {
    const seat = table.seats[key];
    seat.hands.forEach(h => { if (dealerBJ || isNatural(seat, h)) h.done = true; });
  });
  if (dealerBJ) {
    settle(table, credit);
    return;
  }
  table.phase = "playing";
  table.turn = null;
  advance(table, credit);
}

// Distribue une nouvelle manche à tous ceux qui ont misé.
function dealRound(table, w) {
  const order = Object.entries(table.seats).filter(([, s]) => s.bet > 0).sort((a, b) => a[1].index - b[1].index).map(([k]) => k);
  if (!order.length) throw new Error("Personne n'a misé.");
  table.round += 1;
  table.order = order;
  table.dealer = [];
  table.turn = null;
  order.forEach(key => {
    const seat = table.seats[key];
    Object.assign(seat, { hands: [newHand(seat.bet)], insurance: 0, insuranceDecided: false, result: null });
  });
  if (table.shoe.length < 15 + order.length * 6) table.shoe = freshShoe().map(cardCode);
  // Distribution comme au casino : une carte à chacun, une à la banque, deux fois.
  for (let r = 0; r < 2; r++) {
    order.forEach(key => table.seats[key].hands[0].cards.push(drawCard(table)));
    table.dealer.push(drawCard(table));
  }
  if (parseCard(table.dealer[0]).rank === "A") {
    table.phase = "insurance";
    order.forEach(key => {
      const seat = table.seats[key];
      seat.insuranceDecided = isNatural(seat, seat.hands[0]); // un blackjack ne s'assure pas
    });
    if (order.every(key => table.seats[key].insuranceDecided)) startPlay(table, w.credit);
  } else {
    startPlay(table, w.credit);
  }
}

// Tous les joueurs assis ont misé : la manche peut partir toute seule.
const everyoneHasBet = table => {
  const seats = Object.values(table.seats);
  return seats.length > 0 && seats.every(seat => seat.bet > 0);
};

// ---------- Actions ----------
// Chaque action modifie `table` sur place. `w` = { chipsOf(key), credit(key, n), charge(key, n) }.
// Une erreur lancée annule l'action (et la transaction).

export function applyAction(table, type, payload, me, w) {
  const mySeat = table.seats[me.key];

  switch (type) {
    case "sit": {
      if (mySeat) return;
      const taken = new Set(Object.values(table.seats).map(s => s.index));
      if (taken.size >= MAX_SEATS) throw new Error("La table est complète.");
      // payload.index : la place touchée à l'écran, si elle est libre ; sinon la première libre.
      let index = Number.isInteger(payload.index) && payload.index >= 0 && payload.index < MAX_SEATS && !taken.has(payload.index) ? payload.index : 0;
      while (taken.has(index)) index++;
      table.seats[me.key] = { name: me.name, index, bet: 0, allIn: false, hands: [], insurance: 0, insuranceDecided: false, result: null };
      return;
    }

    case "leave": {
      const key = payload.key;
      const seat = table.seats[key];
      if (!seat) return;
      const inRound = table.order.includes(key) && (table.phase === "insurance" || table.phase === "playing");
      if (inRound) throw new Error(key === me.key ? "Termine la manche avant de quitter la table." : "Ce joueur est en pleine manche.");
      if (table.phase === "betting" && seat.bet) w.credit(key, seat.bet); // mise rendue
      delete table.seats[key];
      if (table.phase === "betting" && everyoneHasBet(table)) dealRound(table, w);
      return;
    }

    case "bet": {
      if (!mySeat) throw new Error("Assieds-toi d'abord à la table.");
      if (table.phase === "done") openNewRound(table);
      if (table.phase !== "betting") throw new Error("Une manche est en cours : attends la suivante.");
      if (mySeat.bet) w.credit(me.key, mySeat.bet); // on remplace la mise précédente
      const stake = payload.allIn ? w.chipsOf(me.key) : payload.amount;
      if (stake < MIN_BET) throw new Error("Tu es à sec : emprunte au casino pour miser.");
      w.charge(me.key, stake);
      mySeat.bet = stake;
      mySeat.allIn = Boolean(payload.allIn);
      if (everyoneHasBet(table)) dealRound(table, w);
      return;
    }

    case "deal": {
      // « Lancer sans attendre » : démarre avec ceux qui ont déjà misé.
      if (table.phase !== "betting") return;
      dealRound(table, w);
      return;
    }

    case "insurance": {
      if (table.phase !== "insurance" || !mySeat || mySeat.insuranceDecided || !table.order.includes(me.key)) return;
      if (payload.take) {
        const cost = Math.floor(mySeat.bet / 2);
        w.charge(me.key, cost);
        mySeat.insurance = cost;
      }
      mySeat.insuranceDecided = true;
      if (table.order.every(key => table.seats[key].insuranceDecided)) startPlay(table, w.credit);
      return;
    }

    case "play": {
      // payload = { move: "hit"|"stand"|"double"|"split"|"surrender", force }
      // force = l'hôte fait « rester » un joueur absent.
      if (table.phase !== "playing" || !table.turn) return;
      if (!payload.force && table.turn.key !== me.key) throw new Error("Ce n'est pas ton tour.");
      if (payload.force && payload.move !== "stand") return;
      const key = table.turn.key;
      const seat = table.seats[key];
      const hand = seat?.hands[table.turn.hand];
      if (!hand || hand.done) return;
      const two = hand.cards.length === 2;

      if (payload.move === "hit") {
        if (hand.splitAces) return;
        hand.cards.push(drawCard(table));
        if (handTotal(hand) >= 21) hand.done = true;
      } else if (payload.move === "stand") {
        hand.done = true;
      } else if (payload.move === "double") {
        if (!two || hand.splitAces) return;
        w.charge(key, hand.bet);
        hand.bet *= 2;
        hand.doubled = true;
        hand.cards.push(drawCard(table));
        hand.done = true;
      } else if (payload.move === "split") {
        const [a, b] = cards(hand.cards);
        if (!two || hand.splitAces || value(a.rank) !== value(b.rank) || seat.hands.length >= MAX_HANDS) return;
        w.charge(key, hand.bet);
        const aces = a.rank === "A";
        const second = { ...newHand(hand.bet), cards: [hand.cards.pop()], splitAces: aces };
        hand.splitAces = aces;
        seat.hands.splice(table.turn.hand + 1, 0, second);
        hand.cards.push(drawCard(table));
        second.cards.push(drawCard(table));
        if (aces) { hand.done = true; second.done = true; }
        if (handTotal(hand) === 21) hand.done = true;
      } else if (payload.move === "surrender") {
        if (!two || seat.hands.length > 1) return;
        hand.surrendered = true;
        hand.done = true;
        w.credit(key, Math.floor(hand.bet / 2));
      }

      // La main est finie : main suivante, joueur suivant, ou la banque.
      if (hand.done) advance(table, w.credit);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}
