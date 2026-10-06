// Logique d'une table de poker (Texas Hold'em no-limit, 6 places) — sans Firebase ni page
// web, pour pouvoir la tester seule. poker-table.js l'applique dans une transaction Firestore.
//
// Le « croupier » est cette logique : il distribue, prend les blinds, retourne flop / turn /
// river dès que les mises sont égalisées, règle les pots (y compris pots séparés) et
// enchaîne la main suivante. Aucun bouton Flop / Turn / River.
//
// État d'une table (rooms/{code}/casinoPoker/table-N) :
//   { id, v, handNo, phase: "waiting"|"preflop"|"flop"|"turn"|"river"|"done",
//     seats: [6 × null | { key, name, avatar, stack, bet, contrib, cards, folded, allIn,
//                         acted, inHand, sittingOut, last }],
//     button, sb, bb, community, deck, currentBet, minRaise, toAct, dead,
//     startAt, doneAt, results, log }
//
// Les jetons de la table (stack) viennent du portefeuille du casino : `w.charge` à
// l'arrivée (cave / recave), `w.credit` au départ (on repart avec son tapis).

import { freshDeck, evaluate, buildPots, punishmentFor } from "./poker-rules.js?v=3";

export const MAX_SEATS = 6;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
export const BUY_INS = [200, 500, 1000];
export const MIN_BUY_IN = 100;
export const START_DELAY = 3000;      // ms avant la 1re main quand 2 joueurs sont assis
export const NEXT_HAND_DELAY = 8000;  // ms d'affichage des résultats avant la main suivante

const fmt = n => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/ /g, " ");

export function emptyTable(id) {
  return {
    id, v: 0, handNo: 0, phase: "waiting",
    seats: Array(MAX_SEATS).fill(null),
    button: -1, sb: -1, bb: -1,
    community: [], deck: [], currentBet: 0, minRaise: BIG_BLIND, toAct: null, dead: 0,
    startAt: null, doneAt: null, results: null,
    log: ["Bienvenue à la table. Asseyez-vous !"]
  };
}

// ---------- Petits outils ----------

const say = (t, text) => { t.log = [...(t.log || []), text].slice(-6); };
const seatOf = (t, key) => t.seats.findIndex(s => s && s.key === key);
export const inPlay = s => Boolean(s && s.inHand && !s.folded);          // encore dans le coup
export const canAct = s => inPlay(s) && !s.allIn;                       // peut encore parler
export const potTotal = t => t.seats.reduce((sum, s) => sum + (s?.contrib || 0), 0) + (t.dead || 0);
const eligibleForHand = s => Boolean(s && !s.sittingOut && s.stack > 0);

// Prochaine place (dans le sens des aiguilles) qui vérifie `pred`, en partant de `from`.
function nextSeat(t, from, pred) {
  for (let step = 1; step <= MAX_SEATS; step++) {
    const i = (from + step + MAX_SEATS) % MAX_SEATS;
    if (pred(t.seats[i], i)) return i;
  }
  return -1;
}

function pay(seat, amount) {
  const real = Math.min(amount, seat.stack);
  seat.stack -= real;
  seat.bet += real;
  seat.contrib += real;
  if (seat.stack === 0) seat.allIn = true;
  return real;
}

// La 1re main démarre quelques secondes après l'arrivée du 2e joueur.
function scheduleStart(t, now) {
  const ready = t.seats.filter(eligibleForHand).length;
  if (t.phase === "waiting") t.startAt = ready >= 2 ? (t.startAt || now + START_DELAY) : null;
}

// ---------- Déroulement d'une main ----------

// `deck` : paquet imposé (tests uniquement) ; sinon paquet mélangé.
function startHand(t, now, deck = null) {
  const players = t.seats.map((s, i) => (eligibleForHand(s) ? i : -1)).filter(i => i >= 0);
  if (players.length < 2) {
    t.phase = "waiting";
    t.startAt = null;
    say(t, "Il faut au moins 2 joueurs avec des jetons pour lancer une main.");
    return;
  }

  t.handNo += 1;
  t.deck = deck ? [...deck] : freshDeck();
  t.community = [];
  t.results = null;
  t.dead = 0;
  t.startAt = null;
  t.doneAt = null;
  t.seats.forEach((s, i) => {
    if (!s) return;
    Object.assign(s, { bet: 0, contrib: 0, cards: [], folded: false, allIn: false, acted: false, inHand: players.includes(i), last: "" });
  });

  // Bouton, petite et grosse blinde (en tête-à-tête, le bouton est la petite blinde).
  t.button = nextSeat(t, t.button, s => eligibleForHand(s) && s.inHand);
  if (players.length === 2) {
    t.sb = t.button;
    t.bb = nextSeat(t, t.sb, s => s?.inHand);
  } else {
    t.sb = nextSeat(t, t.button, s => s?.inHand);
    t.bb = nextSeat(t, t.sb, s => s?.inHand);
  }
  pay(t.seats[t.sb], SMALL_BLIND);
  pay(t.seats[t.bb], BIG_BLIND);
  t.seats[t.sb].last = `Petite blinde ${SMALL_BLIND}`;
  t.seats[t.bb].last = `Grosse blinde ${BIG_BLIND}`;
  t.currentBet = Math.max(t.seats[t.sb].bet, t.seats[t.bb].bet);
  t.minRaise = BIG_BLIND;

  // Deux cartes à chacun, une à la fois, en commençant à gauche du bouton.
  for (let round = 0; round < 2; round++) {
    let i = t.button;
    for (let n = 0; n < players.length; n++) {
      i = nextSeat(t, i, s => s?.inHand);
      t.seats[i].cards.push(t.deck.pop());
    }
  }

  t.phase = "preflop";
  say(t, `Main n°${t.handNo} : blinds ${SMALL_BLIND} / ${BIG_BLIND}, cartes distribuées.`);
  t.toAct = nextSeat(t, t.bb, canAct);
  if (t.toAct < 0 || roundComplete(t)) nextStreet(t, now);
}

// Le tour de mise est fini quand tous ceux qui peuvent parler ont parlé et égalisé.
function roundComplete(t) {
  return t.seats.every(s => !canAct(s) || (s.acted && s.bet === t.currentBet));
}

// Après chaque action : main gagnée par abandon, rue suivante, ou joueur suivant.
function afterAction(t, from, now) {
  const alive = t.seats.map((s, i) => (inPlay(s) ? i : -1)).filter(i => i >= 0);
  if (alive.length === 1) return winUncontested(t, alive[0], now);
  if (roundComplete(t)) return nextStreet(t, now);
  t.toAct = nextSeat(t, from, s => canAct(s) && !(s.acted && s.bet === t.currentBet));
  if (t.toAct < 0) nextStreet(t, now);
}

const STREETS = { preflop: ["flop", 3, "Le flop"], flop: ["turn", 1, "Le turn"], turn: ["river", 1, "La river"] };

function nextStreet(t, now) {
  // Les mises du tour rejoignent le pot.
  t.seats.forEach(s => { if (s) { s.bet = 0; s.acted = false; if (canAct(s)) s.last = ""; } }); // nouveau tour : on efface « Parole », « Suit »…
  t.currentBet = 0;
  t.minRaise = BIG_BLIND;

  if (t.phase === "river") return showdown(t, now);

  const [phase, count, label] = STREETS[t.phase];
  for (let i = 0; i < count; i++) t.community.push(t.deck.pop());
  t.phase = phase;
  say(t, `${label} : ${t.community.slice(-count).join(" ")}.`);

  // Plus personne (ou un seul joueur) ne peut miser : le croupier déroule jusqu'à la river.
  if (t.seats.filter(canAct).length <= 1) return nextStreet(t, now);
  t.toAct = nextSeat(t, t.button, canAct);
}

function winUncontested(t, winnerIndex, now) {
  const winner = t.seats[winnerIndex];
  const amount = potTotal(t);
  winner.stack += amount;
  t.seats.forEach(s => { if (s) { s.bet = 0; } });
  t.results = {
    showdown: false,
    winners: [{ key: winner.key, name: winner.name, amount, hand: null }],
    lines: [`👑 ${winner.name} remporte ${fmt(amount)} jetons : tout le monde s'est couché.`, "Pas d'abattage : personne ne boit cette fois."],
    punished: []
  };
  say(t, `${winner.name} remporte ${fmt(amount)} jetons.`);
  finish(t, now);
}

function showdown(t, now) {
  const contenders = t.seats.map((s, i) => (inPlay(s) ? i : -1)).filter(i => i >= 0);
  const hands = {};
  contenders.forEach(i => { hands[i] = evaluate([...t.seats[i].cards, ...t.community]); });

  const contributors = t.seats.map((s, i) => (s?.inHand ? { key: String(i), contrib: s.contrib, folded: s.folded } : null)).filter(Boolean);
  if (t.dead) contributors.push({ key: "dead", contrib: t.dead, folded: true });
  const pots = buildPots(contributors);

  const won = {};
  const lines = [];
  pots.forEach((pot, n) => {
    const eligible = pot.eligible.map(Number).filter(i => hands[i]);
    if (!eligible.length) return;
    const best = Math.max(...eligible.map(i => hands[i].score));
    // Gagnants dans l'ordre à partir de la gauche du bouton (le jeton impair va au premier).
    const order = [];
    for (let step = 1; step <= MAX_SEATS; step++) order.push((t.button + step) % MAX_SEATS);
    const winners = order.filter(i => eligible.includes(i) && hands[i].score === best);
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    winners.forEach(i => {
      const gain = share + (odd-- > 0 ? 1 : 0);
      t.seats[i].stack += gain;
      won[i] = (won[i] || 0) + gain;
    });
    const label = pots.length > 1 ? (n === 0 ? "Pot principal" : `Pot séparé ${n}`) : "Le pot";
    lines.push(`${label} (${fmt(pot.amount)}) → ${winners.map(i => t.seats[i].name).join(" et ")}${winners.length > 1 ? " (partagé)" : ""} avec ${hands[winners[0]].name}.`);
  });

  const punished = contenders
    .filter(i => !won[i])
    .map(i => ({ key: t.seats[i].key, name: t.seats[i].name, hand: hands[i].name, text: punishmentFor(hands[i].name) }));
  punished.forEach(p => lines.push(`💀 ${p.name} perd avec ${p.hand} : ${p.text}`));
  const folded = t.seats.filter(s => s?.inHand && s.folded).length;
  if (folded) lines.push(`${folded} joueur${folded > 1 ? "s" : ""} couché${folded > 1 ? "s" : ""} : pas de punition.`);

  t.results = {
    showdown: true,
    winners: Object.entries(won).map(([i, amount]) => ({ key: t.seats[i].key, name: t.seats[i].name, amount, hand: hands[i].name })),
    hands: Object.fromEntries(contenders.map(i => [t.seats[i].key, { name: hands[i].name, cards: t.seats[i].cards }])),
    lines,
    punished
  };
  const top = t.results.winners.sort((a, b) => b.amount - a.amount)[0];
  say(t, `${top.name} remporte ${fmt(top.amount)} jetons avec ${top.hand}.`);
  finish(t, now);
}

function finish(t, now) {
  t.phase = "done";
  t.toAct = null;
  t.doneAt = now;
}

// ---------- Actions ----------
// Chaque action modifie `t` sur place. `w` = { chipsOf(key), credit(key, n), charge(key, n) }
// pour le portefeuille du casino ; `now` = horodatage (ms). Une erreur annule l'action.

export function applyAction(t, type, payload, me, w, now = Date.now()) {
  const mine = seatOf(t, me.key);

  switch (type) {
    case "sit": {
      if (mine >= 0) return;
      const index = Number.isInteger(payload.seat) ? payload.seat : t.seats.findIndex(s => !s);
      if (index < 0 || index >= MAX_SEATS) throw new Error("La table est complète.");
      if (t.seats[index]) throw new Error("Cette place vient d'être prise.");
      const buyIn = Math.floor(payload.buyIn);
      if (!(buyIn >= MIN_BUY_IN)) throw new Error(`Cave minimum : ${MIN_BUY_IN} jetons.`);
      w.charge(me.key, buyIn);
      t.seats[index] = {
        key: me.key, name: me.name, avatar: me.avatar || "🎲", stack: buyIn,
        bet: 0, contrib: 0, cards: [], folded: false, allIn: false, acted: false, inHand: false, sittingOut: false, last: ""
      };
      say(t, `${me.name} s'assoit avec ${fmt(buyIn)} jetons.`);
      scheduleStart(t, now);
      return;
    }

    case "rebuy": {
      const seat = t.seats[mine];
      if (!seat) throw new Error("Assieds-toi d'abord.");
      if (seat.inHand && t.phase !== "done" && t.phase !== "waiting") throw new Error("Attends la fin de la main pour te recaver.");
      const buyIn = Math.floor(payload.buyIn);
      if (!(buyIn >= MIN_BUY_IN)) throw new Error(`Recave minimum : ${MIN_BUY_IN} jetons.`);
      w.charge(me.key, buyIn);
      seat.stack += buyIn;
      seat.sittingOut = false;
      say(t, `${me.name} se recave de ${fmt(buyIn)} jetons.`);
      scheduleStart(t, now);
      return;
    }

    case "leave": {
      const index = payload.key ? seatOf(t, payload.key) : mine;
      const seat = t.seats[index];
      if (!seat) return;
      const handRunning = t.phase !== "waiting" && t.phase !== "done";
      if (handRunning && inPlay(seat)) {
        if (payload.key && payload.key !== me.key) throw new Error("Ce joueur est encore dans le coup.");
        throw new Error("Couche-toi ou attends la fin de la main pour te lever.");
      }
      // Ses jetons déjà misés restent dans le pot (argent « mort »).
      if (handRunning) t.dead = (t.dead || 0) + seat.contrib;
      w.credit(seat.key, seat.stack);
      say(t, `${seat.name} quitte la table avec ${fmt(seat.stack)} jetons.`);
      t.seats[index] = null;
      if (handRunning && t.toAct === index) afterAction(t, index, now);
      scheduleStart(t, now);
      return;
    }

    // Appelé par n'importe quel téléphone quand le délai est écoulé : lance la 1re main
    // ou la suivante. Sans effet si un autre téléphone l'a déjà fait.
    case "tick": {
      if (t.phase === "waiting" && t.startAt && now >= t.startAt) startHand(t, now, payload.deck);
      else if (t.phase === "done" && t.doneAt && now >= t.doneAt + NEXT_HAND_DELAY) {
        t.seats.forEach(s => { if (s && s.stack === 0) s.sittingOut = true; }); // à sec : recave nécessaire
        if (t.seats.filter(eligibleForHand).length >= 2) startHand(t, now, payload.deck);
        else { t.phase = "waiting"; t.results = null; t.startAt = null; say(t, "En attente d'un 2e joueur."); }
      }
      return;
    }

    // payload = { move: "fold"|"check"|"call"|"raise"|"allin", amount, force }
    // force = l'hôte fait jouer un joueur absent (parole si possible, sinon il se couche).
    case "act": {
      if (!["preflop", "flop", "turn", "river"].includes(t.phase) || t.toAct == null || t.toAct < 0) return;
      if (!payload.force && t.toAct !== mine) throw new Error("Ce n'est pas ton tour.");
      const i = t.toAct;
      const s = t.seats[i];
      if (!canAct(s)) return;
      const toCall = Math.max(0, t.currentBet - s.bet);
      let move = payload.move;
      if (payload.force) move = toCall === 0 ? "check" : "fold";

      if (move === "fold") {
        s.folded = true;
        s.last = "Couché";
        say(t, `${s.name} se couche.`);
      } else if (move === "check") {
        if (toCall > 0) throw new Error(`Tu dois suivre ${fmt(toCall)}, relancer ou te coucher.`);
        s.last = "Parole";
      } else if (move === "call") {
        if (toCall === 0) { s.last = "Parole"; } else {
          const paid = pay(s, toCall);
          s.last = s.allIn ? `Tapis (${fmt(paid)})` : `Suit ${fmt(paid)}`;
        }
      } else if (move === "raise" || move === "allin") {
        const target = move === "allin" ? s.bet + s.stack : Math.floor(payload.amount);
        if (!(target > t.currentBet)) throw new Error(`Relance au-dessus de ${fmt(t.currentBet)}.`);
        const allInNow = target >= s.bet + s.stack;
        if (!allInNow && target - t.currentBet < t.minRaise) throw new Error(`Relance minimum : ${fmt(t.currentBet + t.minRaise)}.`);
        const raiseBy = target - t.currentBet;
        pay(s, target - s.bet);
        if (raiseBy >= t.minRaise) t.minRaise = raiseBy;
        t.currentBet = Math.max(t.currentBet, s.bet);
        // Une relance rouvre la parole pour tous les autres.
        t.seats.forEach((o, j) => { if (j !== i && canAct(o)) o.acted = false; });
        s.last = s.allIn ? `Tapis ${fmt(s.bet)}` : `Relance ${fmt(s.bet)}`;
        say(t, `${s.name} ${s.allIn ? "fait tapis" : "relance"} à ${fmt(s.bet)}.`);
      } else {
        throw new Error(`Action inconnue : ${move}`);
      }

      s.acted = true;
      afterAction(t, i, now);
      return;
    }

    default:
      throw new Error(`Action inconnue : ${type}`);
  }
}

// Ce que le joueur `index` doit payer pour suivre, et la relance minimum autorisée.
export function callInfo(t, index) {
  const s = t.seats[index];
  if (!s) return { toCall: 0, minRaiseTo: 0, maxRaiseTo: 0 };
  const toCall = Math.max(0, t.currentBet - s.bet);
  return {
    toCall: Math.min(toCall, s.stack),
    minRaiseTo: Math.min(t.currentBet + t.minRaise, s.bet + s.stack),
    maxRaiseTo: s.bet + s.stack
  };
}
