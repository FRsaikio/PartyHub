// Table de blackjack partagée par la room (jusqu'à 5 joueurs, un seul sabot).
//
// Les règles de la table (places, mises, tours, sabot, règlement) sont dans
// bj-table-logic.js, sans Firebase. Ici : la synchro et l'affichage.
//
// Toutes les actions passent par runTransaction : lecture + écriture de la table d'un seul
// bloc, donc deux joueurs ne peuvent jamais tirer la même carte ni jouer en même temps.
// Les jetons bougent dans la même transaction (increment sur le portefeuille).
// Les cartes des joueurs sont visibles par tous (comme au casino) ; seule la carte cachée
// de la banque est masquée à l'écran jusqu'à la fin de la manche.

import { db, doc, onSnapshot, runTransaction, increment } from "../../../firebase.js";
import { MAX_HANDS, value, total, parseCard } from "./bj-rules.js";
import { MAX_SEATS, emptyTable, cards, handTotal, isNatural, applyAction } from "./bj-table-logic.js";
import { sound, formatChips, showResult, cinematic, goldRain } from "./ui.js";

export { MAX_SEATS };
const TABLE = "casino.bjTable";

// ---------- Interface ----------

export function initBjTable(ctx, { roomCode, me, isHost }) {
  const root = document.getElementById("bjTableMode");
  if (!roomCode) {
    root.querySelector(".bjt-offline").hidden = false;
    root.querySelector(".bjt-online").hidden = true;
    return { refresh() {} };
  }

  const roomRef = doc(db, "rooms", roomCode);
  const statusEl = document.getElementById("bjtStatus");
  const dealerEl = document.getElementById("bjtDealerCards");
  const dealerTotalEl = document.getElementById("bjtDealerTotal");
  const seatsEl = document.getElementById("bjtSeats");
  const controlsEl = document.getElementById("bjtControls");
  const resultBox = document.getElementById("bjtResult");
  const shoeEl = document.getElementById("bjtShoe");

  let table = emptyTable();
  let busy = false;
  let shownRound = null;
  let firstSnapshot = true;
  let newCards = false;
  const seenCards = new Map(); // nombre de cartes déjà affichées par main (pour animer les nouvelles)
  resultBox.hidden = true;

  // ---------- Transactions ----------

  async function mutate(label, fn) {
    if (busy) return;
    busy = true;
    renderControls();
    try {
      await runTransaction(db, async t => {
        const snap = await t.get(roomRef);
        if (!snap.exists()) throw new Error("La room n'existe plus.");
        const casino = snap.data().casino || {};
        const next = JSON.parse(JSON.stringify(casino.bjTable || emptyTable()));
        const wallets = casino.wallets || {};
        const deltas = {};

        const chipsOf = key => Math.max(0, Number(wallets[key]?.chips) || 0) + (deltas[key] || 0);
        const credit = (key, amount) => { deltas[key] = (deltas[key] || 0) + amount; };
        const charge = (key, amount) => {
          if (chipsOf(key) < amount) throw new Error(`Pas assez de jetons (il faut ${formatChips(amount)}).`);
          credit(key, -amount);
        };

        fn(next, { chipsOf, credit, charge });
        next.updatedAt = Date.now();

        const update = { [TABLE]: next };
        Object.entries(deltas).forEach(([key, amount]) => {
          if (amount) update[`casino.wallets.${key}.chips`] = increment(amount);
        });
        t.update(roomRef, update);
      });
    } catch (error) {
      ctx.toast(error.message || `Action impossible : ${label}`, "lose");
      if (!error.message) console.error(error);
    } finally {
      busy = false;
      renderControls();
    }
  }

  const act = (label, type, payload = {}) => mutate(label, (t, w) => applyAction(t, type, payload, me, w));

  const actions = {
    sit: () => act("s'asseoir", "sit"),
    leave: key => act("quitter la table", "leave", { key }),
    bet: (amount, allIn) => act("miser", "bet", { amount, allIn }),
    deal: () => act("distribuer", "deal"),
    insurance: take => act("assurance", "insurance", { take }),
    // force = l'hôte fait « rester » un joueur absent (garde-fou sans chrono)
    play: (move, force = false) => act("jouer", "play", { move, force })
  };

  // ---------- Affichage ----------

  function cardEl(code, hidden = false, fresh = false) {
    const el = document.createElement("div");
    el.className = "playing-card";
    if (fresh) el.classList.add("dealt");
    if (hidden) {
      el.classList.add("card-back");
      return el;
    }
    const card = parseCard(code);
    if (card.suit === "♥" || card.suit === "♦") el.classList.add("red");
    el.innerHTML = `<span class="pc-corner"></span><span class="pc-suit"></span><span class="pc-corner pc-corner-bottom"></span>`;
    el.querySelectorAll(".pc-corner").forEach(c => { c.textContent = code; });
    el.querySelector(".pc-suit").textContent = card.suit;
    return el;
  }

  // Cartes d'une main, en animant celles qui viennent d'arriver.
  function cardsRow(id, codes, hideIndex = -1) {
    const before = seenCards.get(id) ?? (firstSnapshot ? codes.length : 0);
    seenCards.set(id, codes.length);
    if (codes.length > before) newCards = true;
    const row = document.createElement("div");
    row.className = "cards-row";
    row.append(...codes.map((c, i) => cardEl(c, i === hideIndex, i >= before)));
    return row;
  }

  // « Au tour d'Alex » / « Au tour de Sam »
  const ofName = name => (/^[aeiouyhàâäéèêëîïôöûü]/i.test(name) ? `d'${name}` : `de ${name}`);

  function statusText() {
    const turnSeat = table.turn && table.seats[table.turn.key];
    if (table.phase === "betting") {
      const bettors = Object.values(table.seats).filter(s => s.bet > 0).length;
      return bettors ? `${bettors} mise${bettors > 1 ? "s" : ""} posée${bettors > 1 ? "s" : ""} · on distribue quand tout le monde est prêt` : "Asseyez-vous et posez vos mises";
    }
    if (table.phase === "insurance") return "La banque montre un As : assurance ?";
    if (table.phase === "playing" && turnSeat) return table.turn.key === me.key ? "À toi de jouer !" : `Au tour ${ofName(turnSeat.name)}`;
    if (table.phase === "done") return "Manche terminée · misez pour la suivante";
    return "";
  }

  function seatStatus(seat, hand) {
    if (hand.surrendered) return "Abandon";
    const score = handTotal(hand);
    if (isNatural(seat, hand)) return "Blackjack !";
    if (score > 21) return "Sauté";
    if (hand.doubled) return "Doublé";
    if (hand.done) return "Reste";
    return "";
  }

  function render() {
    newCards = false;
    const hideHole = table.phase === "insurance" || table.phase === "playing";
    statusEl.textContent = statusText();
    shoeEl.textContent = table.shoe.length ? `${table.shoe.length} cartes dans le sabot` : "Sabot neuf";

    // Banque
    dealerEl.replaceChildren(cardsRow("dealer", table.dealer, hideHole ? 1 : -1));
    const dealerCards = cards(table.dealer);
    dealerTotalEl.textContent = !dealerCards.length ? "–" : hideHole ? (value(dealerCards[0].rank) === 1 ? "1 / 11" : value(dealerCards[0].rank)) : total(dealerCards);

    // Places
    const byIndex = new Map(Object.entries(table.seats).map(([key, s]) => [s.index, { key, ...s }]));
    const seated = Boolean(table.seats[me.key]);
    seatsEl.replaceChildren(...Array.from({ length: MAX_SEATS }, (_, index) => {
      const seat = byIndex.get(index);
      const box = document.createElement("div");
      box.className = "bjt-seat";

      if (!seat) {
        box.classList.add("empty");
        const label = document.createElement("span");
        label.className = "bjt-seat-empty";
        label.textContent = `Place ${index + 1} libre`;
        box.appendChild(label);
        return box;
      }

      if (seat.key === me.key) box.classList.add("me");
      if (table.turn?.key === seat.key) box.classList.add("turn");

      const head = document.createElement("div");
      head.className = "bjt-seat-head";
      const name = document.createElement("strong");
      name.textContent = seat.key === me.key ? `${seat.name} (toi)` : seat.name;
      const bet = document.createElement("span");
      bet.className = "bjt-bet";
      bet.textContent = seat.bet ? `${seat.allIn ? "ALL IN · " : ""}${formatChips(seat.hands.reduce((s, h) => s + h.bet, 0) || seat.bet)}` : "pas de mise";
      head.append(name, bet);
      box.appendChild(head);

      seat.hands.forEach((hand, i) => {
        const handBox = document.createElement("div");
        handBox.className = "bjt-hand";
        if (table.turn?.key === seat.key && table.turn.hand === i) handBox.classList.add("active");
        const info = document.createElement("div");
        info.className = "bjt-hand-info";
        const score = document.createElement("strong");
        score.textContent = hand.cards.length ? handTotal(hand) : "–";
        const tag = document.createElement("span");
        tag.textContent = `${seat.hands.length > 1 ? `Main ${i + 1} ` : ""}${seatStatus(seat, hand)}`;
        info.append(score, tag);
        handBox.append(cardsRow(`${seat.key}:${i}`, hand.cards), info);
        box.appendChild(handBox);
      });

      if (table.phase === "done" && seat.result) {
        const res = document.createElement("div");
        res.className = `bjt-net ${seat.result.net > 0 ? "up" : seat.result.net < 0 ? "down" : ""}`;
        res.textContent = seat.result.net > 0 ? `+${formatChips(seat.result.net)}` : seat.result.net < 0 ? formatChips(seat.result.net) : "±0";
        box.appendChild(res);
      }

      if (isHost && seat.key !== me.key && table.phase !== "playing" && table.phase !== "insurance") {
        const kick = document.createElement("button");
        kick.type = "button";
        kick.className = "bjt-kick";
        kick.textContent = "Retirer";
        kick.addEventListener("click", () => actions.leave(seat.key));
        box.appendChild(kick);
      }
      return box;
    }));

    if (newCards) sound.card();
    renderControls(seated);
    showMyResult();
  }

  function button(label, onClick, variant = "secondary", disabled = false, extra = "") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn ${variant} ${extra}`.trim();
    btn.textContent = label;
    btn.disabled = disabled || busy;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderControls() {
    const seat = table.seats[me.key];
    const items = [];

    if (!seat) {
      const full = Object.keys(table.seats).length >= MAX_SEATS;
      items.push(button(full ? "Table complète" : "S'asseoir à la table", actions.sit, "primary big-btn", full));
    } else if (table.phase === "betting" || table.phase === "done") {
      const pending = ctx.peekBet();
      const label = seat.bet && table.phase === "betting"
        ? `Changer ma mise (${pending ? formatChips(pending.amount) : "–"})`
        : `Miser ${pending ? (pending.allIn ? `ALL IN (${formatChips(pending.amount)})` : formatChips(pending.amount)) : ""}`;
      items.push(button(label, () => {
        const b = ctx.peekBet();
        if (b) { actions.bet(b.amount, b.allIn); ctx.betUsed(); }
      }, seat.bet && table.phase === "betting" ? "secondary" : "primary", !pending));
      const anyBet = table.phase === "betting" && Object.values(table.seats).some(s => s.bet > 0);
      items.push(button("Distribuer", actions.deal, "primary big-btn", !anyBet));
      items.push(button("Quitter la table", () => actions.leave(me.key), "secondary"));
    } else if (table.phase === "insurance") {
      if (!seat.insuranceDecided && table.order.includes(me.key)) {
        const cost = Math.floor(seat.bet / 2);
        items.push(button(`Prendre l'assurance (${formatChips(cost)})`, () => actions.insurance(true), "primary"));
        items.push(button("Pas d'assurance", () => actions.insurance(false), "secondary"));
      } else {
        items.push(waitNote("En attente des autres joueurs…"));
      }
    } else if (table.phase === "playing") {
      const myTurn = table.turn?.key === me.key;
      const hand = myTurn ? seat.hands[table.turn.hand] : null;
      if (hand) {
        const two = hand.cards.length === 2;
        const [a, b] = cards(hand.cards);
        const canSplit = two && !hand.splitAces && value(a.rank) === value(b.rank) && seat.hands.length < MAX_HANDS && ctx.wallet.chips >= hand.bet;
        items.push(button("Carte", () => actions.play("hit"), "primary", hand.splitAces));
        items.push(button("Rester", () => actions.play("stand")));
        items.push(button("Doubler", () => actions.play("double"), "secondary", !two || hand.splitAces || ctx.wallet.chips < hand.bet));
        items.push(button("Séparer", () => actions.play("split"), "secondary", !canSplit));
        items.push(button("Abandonner", () => actions.play("surrender"), "secondary", !two || seat.hands.length > 1));
      } else {
        const turnSeat = table.turn && table.seats[table.turn.key];
        items.push(waitNote(turnSeat ? `${turnSeat.name} joue…` : "La banque joue…"));
        if (!table.order.includes(me.key)) items.push(waitNote("Tu joueras à la prochaine manche."));
      }
      // Garde-fou sans chrono : l'hôte peut faire rester un joueur absent.
      if (isHost && table.turn && table.turn.key !== me.key) {
        items.push(button(`Faire rester ${table.seats[table.turn.key]?.name || "le joueur"}`, () => actions.play("stand", true), "secondary", false, "bjt-force"));
      }
    }

    controlsEl.replaceChildren(...items);
  }

  function waitNote(text) {
    const p = document.createElement("p");
    p.className = "bjt-wait";
    p.textContent = text;
    return p;
  }

  // Mes résultats de fin de manche : affichés une fois, et gardés à l'écran jusqu'à la
  // distribution suivante (même si quelqu'un mise déjà pour la prochaine manche).
  function showMyResult() {
    const seat = table.seats[me.key];
    if (table.phase !== "done" || !seat?.result) {
      const keep = shownRound !== null && table.phase === "betting" && table.round === shownRound;
      if (!keep) resultBox.hidden = true;
      return;
    }
    resultBox.hidden = false;
    if (shownRound === table.round) return;
    const first = shownRound === null && firstSnapshot;
    shownRound = table.round;

    const { net, lines, anyLoss, big } = seat.result;
    const title = net > 0 ? `Gagné ! +${formatChips(net)} jetons` : net < 0 ? `Perdu : ${formatChips(net)} jetons` : anyLoss ? "Bilan nul (0 jeton)" : "Égalité : mise rendue";
    const tone = net > 0 ? (big ? "gold" : "win") : net < 0 ? "lose" : "push";
    showResult(resultBox, { title, lines, tone, choices: anyLoss ? ctx.sanctionChoices() : [] });

    if (first) return; // résultat d'une manche passée : pas d'effets en ouvrant la page
    if (net > 0 && big) {
      sound.jackpot();
      cinematic("BLACKJACK", `+${formatChips(net)} jetons`, "gold");
      goldRain(25);
      ctx.wallet.announce(`a gagné ${formatChips(net)} jetons à la table de blackjack !`, "gold");
    } else if (net > 0) {
      sound.win();
    } else if (net < 0) {
      sound.lose();
    }
  }

  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;
    table = snapshot.data().casino?.bjTable || emptyTable();
    render();
    firstSnapshot = false;
  }, error => console.error("Table de blackjack : synchro impossible", error));

  return { refresh: () => renderControls() };
}
