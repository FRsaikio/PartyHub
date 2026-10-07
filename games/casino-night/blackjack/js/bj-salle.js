// Salle de blackjack : plusieurs tables (5 places chacune), synchro Firestore + affichage.
//
// Les règles d'une table (places, mises, tours, sabot, règlement) sont dans
// ../../js/bj-table-logic.js, sans Firebase. Chaque table est rangée dans le doc de la room :
// casino.blackjack.t1 … t4 (les règles Firestore refusent les sous-collections).
// Toutes les actions passent par runTransaction, avec les jetons du casino (increment)
// dans la même écriture. La manche part toute seule quand tous les joueurs assis ont misé.

import { db, doc, onSnapshot, runTransaction, increment } from "../../../../firebase.js";
import { safeImageSrc } from "../../../../html-safe.js";
import { MAX_HANDS, value, total, parseCard } from "../../js/bj-rules.js";
import { MAX_SEATS, MIN_BET, emptyTable, cards, handTotal, isNatural, applyAction } from "../../js/bj-table-logic.js";
import { sound, formatChips, showResult, cinematic, goldRain } from "../../js/ui.js";

export const TABLE_IDS = ["t1", "t2", "t3", "t4"];
const BET_STEPS = [50, 100, 250, 500, 1000];

const tableName = id => `Table ${id.slice(1)}`;
const clone = v => JSON.parse(JSON.stringify(v));
// « Au tour d'Alex » / « Au tour de Sam »
const ofName = name => (/^[aeiouyhàâäéèêëîïôöûü]/i.test(name) ? `d'${name}` : `de ${name}`);

export function createBlackjackRoom(ctx, { roomCode, me, isHost, spectator, avatarFor }) {
  const roomRef = doc(db, "rooms", roomCode);
  const el = id => document.getElementById(id);
  const tablesEl = el("bkTables");
  const seatsEl = el("bkSeats");
  const dealerCardsEl = el("bkDealerCards");
  const dealerTotalEl = el("bkDealerTotal");
  const speechEl = el("bkSpeech");
  const shoeEl = el("bkShoe");
  const controlsEl = el("bkControls");
  const resultBox = el("bkResult");

  const tables = Object.fromEntries(TABLE_IDS.map(id => [id, emptyTable()]));
  let current = (() => {
    try { return sessionStorage.getItem(`bkTable_${roomCode}`) || null; } catch { return null; }
  })();
  let busy = false;
  let bet = (() => {
    const saved = Number(localStorage.getItem("partyhubCasinoBet"));
    return BET_STEPS.includes(saved) ? saved : 100;
  })();
  let allIn = false;
  let wasMyTurn = false;
  let shownRound = null;
  let firstRender = true;
  const seenCards = new Map();

  // ---------- Transactions ----------

  async function mutate(tableId, type, payload = {}) {
    if (busy || spectator) return;
    busy = true;
    renderControls();
    let committed = null;
    try {
      await runTransaction(db, async t => {
        const snap = await t.get(roomRef);
        if (!snap.exists()) throw new Error("La room n'existe plus.");
        const casino = snap.data().casino || {};
        const before = casino.blackjack?.[tableId] || emptyTable();
        const next = clone(before);
        const wallets = casino.wallets || {};
        const deltas = {};
        const w = {
          chipsOf: key => Math.max(0, Number(wallets[key]?.chips) || 0) + (deltas[key] || 0),
          credit: (key, n) => { deltas[key] = (deltas[key] || 0) + n; },
          charge: (key, n) => {
            if (w.chipsOf(key) < n) throw new Error(`Pas assez de jetons (il faut ${formatChips(n)}).`);
            w.credit(key, -n);
          }
        };
        applyAction(next, type, payload, me, w);
        next.updatedAt = Date.now();
        next.v = (before.v || 0) + 1;
        const patch = { [`casino.blackjack.${tableId}`]: next };
        Object.entries(deltas).forEach(([key, n]) => { if (n) patch[`casino.wallets.${key}.chips`] = increment(n); });
        t.update(roomRef, patch);
        committed = next;
      });
    } catch (error) {
      committed = null;
      ctx.toast(error.message || "Action impossible.", "lose");
      if (!error.message) console.error(error);
    } finally {
      busy = false;
      // Celui qui joue voit tout de suite le résultat, sans attendre le serveur.
      if (committed) applyTable(tableId, committed);
      else render();
    }
  }

  function applyTable(id, data, redraw = true) {
    if ((data?.v || 0) < (tables[id]?.v || 0)) return false; // un vieux snapshot n'écrase jamais l'état local
    tables[id] = data || emptyTable();
    if (redraw) render();
    return true;
  }

  // ---------- Quelle table afficher ----------

  const occupancy = t => Object.keys(t.seats || {}).length;
  const seatedAt = t => Boolean(t.seats?.[me.key]);

  function pickTable() {
    const seated = TABLE_IDS.find(id => seatedAt(tables[id]));
    if (seated) return seated;
    if (current && tables[current]) return current;
    return [...TABLE_IDS].sort((a, b) => occupancy(tables[b]) - occupancy(tables[a]))[0];
  }

  function showTable(id) {
    current = id;
    try { sessionStorage.setItem(`bkTable_${roomCode}`, id); } catch { /* ignoré */ }
    render();
  }

  // ---------- Affichage ----------

  function cardEl(code, { hidden = false, fresh = false } = {}) {
    const c = document.createElement("div");
    c.className = `bk-card${fresh ? " dealt" : ""}`;
    if (hidden || !code) { c.classList.add("back"); return c; }
    const card = parseCard(code);
    if (card.suit === "♥" || card.suit === "♦") c.classList.add("red");
    const rank = document.createElement("span");
    rank.className = "bk-rank";
    rank.textContent = code.slice(0, -1);
    const suit = document.createElement("span");
    suit.className = "bk-suit";
    suit.textContent = card.suit;
    c.append(rank, suit);
    return c;
  }

  // Cartes d'une main, en animant celles qui viennent d'arriver.
  let newCards = false;
  function cardsRow(id, codes, hideIndex = -1) {
    const before = seenCards.get(id) ?? (firstRender ? codes.length : 0);
    seenCards.set(id, codes.length);
    if (codes.length > before) newCards = true;
    const row = document.createElement("div");
    row.className = "bk-cards";
    row.append(...codes.map((code, i) => cardEl(code, { hidden: i === hideIndex, fresh: i >= before })));
    return row;
  }

  function avatarEl(name) {
    const box = document.createElement("div");
    box.className = "bk-avatar";
    const info = avatarFor(name);
    const src = safeImageSrc(info?.avatarBase64 || info?.avatarUrl);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      box.appendChild(img);
    } else {
      box.textContent = info?.avatar || "🎲";
    }
    return box;
  }

  const span = (cls, text) => { const s = document.createElement("span"); s.className = cls; s.textContent = text; return s; };

  function handTag(seat, hand) {
    if (hand.surrendered) return "Abandon";
    if (isNatural(seat, hand)) return "Blackjack !";
    if (handTotal(hand) > 21) return "Sauté";
    if (hand.doubled) return "Doublé";
    if (hand.done) return "Reste";
    return "";
  }

  // Ce que dit le croupier, d'après l'état de la table.
  function speech(t) {
    const seats = Object.values(t.seats || {});
    const turnSeat = t.turn && t.seats[t.turn.key];
    if (!seats.length) return "Bonsoir ! Asseyez-vous, la table est ouverte.";
    if (t.phase === "betting") {
      const bettors = seats.filter(s => s.bet > 0).length;
      return bettors ? `Faites vos jeux… ${bettors}/${seats.length} mise${bettors > 1 ? "s" : ""} posée${bettors > 1 ? "s" : ""}.` : "Faites vos jeux, mesdames et messieurs !";
    }
    if (t.phase === "insurance") return "J'ai un As… Qui veut s'assurer ?";
    if (t.phase === "playing" && turnSeat) {
      const hand = turnSeat.hands[t.turn.hand];
      return `Au tour ${ofName(turnSeat.name)}${turnSeat.hands.length > 1 ? ` (main ${t.turn.hand + 1})` : ""} : ${handTotal(hand)}.`;
    }
    if (t.phase === "done") {
      const d = total(cards(t.dealer));
      const winners = seats.filter(s => s.result?.net > 0).map(s => s.name);
      const head = d > 21 ? `La banque saute avec ${d} !` : `La banque fait ${d}.`;
      return `${head} ${winners.length ? `Bravo ${winners.join(", ")} !` : "La maison gagne."} Misez pour la suivante.`;
    }
    return "";
  }

  function render() {
    current = pickTable();
    const t = tables[current];
    newCards = false;
    renderTablesBar();

    const hideHole = t.phase === "insurance" || t.phase === "playing";
    speechEl.textContent = speech(t);
    shoeEl.textContent = t.shoe?.length ? `${t.shoe.length} cartes` : "Sabot neuf";

    // Banque
    dealerCardsEl.replaceChildren(cardsRow(`${current}:dealer:${t.round}`, t.dealer || [], hideHole ? 1 : -1));
    const dc = cards(t.dealer);
    dealerTotalEl.textContent = !dc.length ? "" : hideHole ? (value(dc[0].rank) === 1 ? "1 / 11" : String(value(dc[0].rank))) : String(total(dc));
    dealerTotalEl.hidden = !dc.length;
    dealerTotalEl.classList.toggle("bust", !hideHole && total(dc) > 21);

    // Places (de droite à gauche vues du joueur, comme au casino : place 1 = à gauche du croupier)
    const byIndex = new Map(Object.entries(t.seats || {}).map(([key, s]) => [s.index, { key, ...s }]));
    const mineSeated = seatedAt(t);
    seatsEl.replaceChildren(...Array.from({ length: MAX_SEATS }, (_, index) => {
      const seat = byIndex.get(index);
      const box = document.createElement("div");
      box.className = `bk-seat slot-${index}`;

      if (!seat) {
        box.classList.add("empty");
        if (!mineSeated && !spectator) {
          const sit = document.createElement("button");
          sit.type = "button";
          sit.className = "bk-sit";
          sit.textContent = "S'asseoir";
          sit.addEventListener("click", () => mutate(current, "sit", { index }));
          box.append(sit);
        } else {
          box.append(span("bk-free", "Libre"));
        }
        return box;
      }

      if (seat.key === me.key) box.classList.add("me");
      if (t.turn?.key === seat.key) box.classList.add("turn");
      if (t.phase === "done" && seat.result) box.classList.add(seat.result.net > 0 ? "won" : seat.result.net < 0 ? "lost" : "push");

      // Mains (plusieurs après une séparation)
      const hands = document.createElement("div");
      hands.className = "bk-hands";
      seat.hands.forEach((hand, i) => {
        const hb = document.createElement("div");
        hb.className = "bk-hand";
        if (t.turn?.key === seat.key && t.turn.hand === i) hb.classList.add("active");
        hb.append(cardsRow(`${current}:${seat.key}:${t.round}:${i}`, hand.cards));
        if (hand.cards.length) {
          const score = handTotal(hand);
          const badge = span(`bk-total${score > 21 ? " bust" : isNatural(seat, hand) ? " bj" : ""}`, String(score));
          hb.append(badge);
        }
        const tag = handTag(seat, hand);
        if (tag) hb.append(span("bk-tag", tag));
        hands.append(hb);
      });

      const plate = document.createElement("div");
      plate.className = "bk-plate";
      const name = document.createElement("strong");
      name.textContent = seat.name;
      plate.append(name);
      const staked = seat.hands.reduce((s, h) => s + h.bet, 0) || seat.bet;
      if (t.phase === "done" && seat.result) {
        plate.append(span(`bk-net ${seat.result.net > 0 ? "up" : seat.result.net < 0 ? "down" : ""}`, seat.result.net > 0 ? `+${formatChips(seat.result.net)}` : seat.result.net < 0 ? formatChips(seat.result.net) : "±0"));
      } else {
        plate.append(span("bk-wait", staked ? "" : t.phase === "betting" ? "mise ?" : "regarde"));
      }

      box.append(hands, avatarEl(seat.name), plate);
      if (staked && t.phase !== "done") box.append(span(`bk-chip${seat.allIn ? " allin" : ""}`, `${seat.allIn ? "ALL IN " : ""}${formatChips(staked)}`));

      // L'hôte peut libérer la place d'un absent entre deux manches.
      if (isHost() && seat.key !== me.key && t.phase !== "playing" && t.phase !== "insurance" && !spectator) {
        const kick = document.createElement("button");
        kick.type = "button";
        kick.className = "bk-kick";
        kick.title = "Libérer la place";
        kick.textContent = "✕";
        kick.addEventListener("click", () => mutate(current, "leave", { key: seat.key }));
        box.append(kick);
      }
      return box;
    }));

    if (newCards) sound.card();
    alertMyTurn(t);
    renderControls();
    showMyResult(t);
    firstRender = false;
  }

  function renderTablesBar() {
    tablesEl.replaceChildren(...TABLE_IDS.map(id => {
      const t = tables[id];
      const b = document.createElement("button");
      b.type = "button";
      b.className = `bk-table-btn${id === current ? " active" : ""}`;
      b.textContent = `${tableName(id)} · ${occupancy(t)}/${MAX_SEATS}${seatedAt(t) ? " · toi" : ""}`;
      b.addEventListener("click", () => { sound.click(); showTable(id); });
      return b;
    }));
  }

  function button(label, onClick, variant = "secondary", disabled = false, extra = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn ${variant} ${extra}`.trim();
    b.textContent = label;
    b.disabled = disabled || busy;
    b.addEventListener("click", onClick);
    return b;
  }

  const note = text => { const p = document.createElement("p"); p.className = "bk-note"; p.textContent = text; return p; };

  // Choix de la mise (pris sur les jetons du casino au moment de miser).
  function betPicker() {
    const wrap = document.createElement("div");
    wrap.className = "bk-betpick";
    const chips = ctx.wallet.chips;
    BET_STEPS.forEach(step => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `bet-chip${!allIn && step === bet ? " selected" : ""}`;
      b.textContent = formatChips(step);
      b.disabled = step > chips;
      b.addEventListener("click", () => {
        bet = step;
        allIn = false;
        try { localStorage.setItem("partyhubCasinoBet", String(step)); } catch { /* ignoré */ }
        sound.chip();
        renderControls();
      });
      wrap.append(b);
    });
    const all = button("ALL IN", () => { allIn = !allIn; sound.click(); renderControls(); }, `small ${allIn ? "primary" : "secondary"}`, chips < MIN_BET);
    wrap.append(all);
    return wrap;
  }

  function renderControls() {
    if (spectator) { controlsEl.replaceChildren(); return; }
    const t = tables[current];
    const seat = t.seats?.[me.key];
    const items = [];

    if (!seat) {
      const full = occupancy(t) >= MAX_SEATS;
      items.push(button(full ? "Table complète : choisis-en une autre" : "S'asseoir à cette table", () => mutate(current, "sit"), "primary big-btn", full));
    } else if (t.phase === "betting" || t.phase === "done") {
      const chips = ctx.wallet.chips;
      const amount = allIn ? chips : bet;
      items.push(betPicker());
      const label = seat.bet && t.phase === "betting"
        ? `Changer ma mise → ${allIn ? `ALL IN (${formatChips(amount)})` : formatChips(amount)}`
        : `Miser ${allIn ? `ALL IN (${formatChips(amount)})` : formatChips(amount)}`;
      items.push(button(label, () => { mutate(current, "bet", { amount, allIn }); allIn = false; }, seat.bet && t.phase === "betting" ? "secondary" : "primary big-btn", amount < MIN_BET || amount > chips));
      if (chips < MIN_BET) items.push(note("💀 Tu es à sec : emprunte 500 jetons dans le hall du casino."));
      // La manche démarre seule quand tout le monde a misé ; ce bouton sert si quelqu'un traîne.
      const seats = Object.values(t.seats);
      const bettors = t.phase === "betting" ? seats.filter(s => s.bet > 0).length : 0;
      if (bettors && bettors < seats.length) items.push(button(`Lancer sans attendre (${bettors}/${seats.length})`, () => mutate(current, "deal")));
      items.push(button("Se lever", () => mutate(current, "leave", { key: me.key }), "secondary", false, "bk-leave"));
    } else if (t.phase === "insurance") {
      if (!seat.insuranceDecided && t.order.includes(me.key)) {
        const cost = Math.floor(seat.bet / 2);
        const row = document.createElement("div");
        row.className = "bk-actions two";
        row.append(
          button(`🛡️ Assurance (${formatChips(cost)})`, () => mutate(current, "insurance", { take: true }), "primary"),
          button("Pas d'assurance", () => mutate(current, "insurance", { take: false })));
        items.push(row);
      } else {
        items.push(note("En attente des autres joueurs…"));
      }
    } else if (t.phase === "playing") {
      const hand = t.turn?.key === me.key ? seat.hands[t.turn.hand] : null;
      if (hand) {
        const two = hand.cards.length === 2;
        const [a, b] = cards(hand.cards);
        const canSplit = two && !hand.splitAces && value(a.rank) === value(b.rank) && seat.hands.length < MAX_HANDS && ctx.wallet.chips >= hand.bet;
        const row = document.createElement("div");
        row.className = "bk-actions";
        row.append(
          button("Carte", () => mutate(current, "play", { move: "hit" }), "primary", hand.splitAces, "bk-hit"),
          button("Rester", () => mutate(current, "play", { move: "stand" }), "secondary", false, "bk-stand"),
          button("Doubler", () => mutate(current, "play", { move: "double" }), "secondary", !two || hand.splitAces || ctx.wallet.chips < hand.bet),
          button("Séparer", () => mutate(current, "play", { move: "split" }), "secondary", !canSplit),
          button("Abandonner", () => mutate(current, "play", { move: "surrender" }), "secondary", !two || seat.hands.length > 1));
        items.push(note(`Ta main : ${handTotal(hand)}${seat.hands.length > 1 ? ` (main ${t.turn.hand + 1}/${seat.hands.length})` : ""}`), row);
      } else {
        const turnSeat = t.turn && t.seats[t.turn.key];
        items.push(note(t.order.includes(me.key) ? (turnSeat ? `${turnSeat.name} joue…` : "La banque joue…") : "Tu joueras à la prochaine manche."));
      }
      // Pas de chrono : l'hôte peut faire « rester » un joueur absent.
      if (isHost() && t.turn && t.turn.key !== me.key) {
        items.push(button(`Faire rester ${t.seats[t.turn.key]?.name || "le joueur"} (absent)`, () => mutate(current, "play", { move: "stand", force: true }), "secondary", false, "bk-force"));
      }
    }
    controlsEl.replaceChildren(...items);
  }

  // C'est à moi (tour de jeu ou assurance) : vibration, son, message, défilement vers les boutons.
  function alertMyTurn(t) {
    const seat = t.seats?.[me.key];
    const myTurn = !spectator && ((t.phase === "playing" && t.turn?.key === me.key) ||
      (t.phase === "insurance" && t.order.includes(me.key) && seat && !seat.insuranceDecided));
    if (myTurn && !wasMyTurn && !firstRender) {
      navigator.vibrate?.([80, 60, 80]);
      sound.chip();
      ctx.toast(t.phase === "insurance" ? "🛡️ La banque montre un As : assurance ?" : "🃏 À toi de jouer !", "gold");
      controlsEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    wasMyTurn = myTurn;
  }

  // Mes résultats : affichés une fois par manche et gardés jusqu'à la distribution suivante.
  function showMyResult(t) {
    const seat = t.seats?.[me.key];
    if (t.phase !== "done" || !seat?.result) {
      const keep = shownRound === `${current}:${t.round}` && t.phase === "betting";
      if (!keep) resultBox.hidden = true;
      return;
    }
    resultBox.hidden = false;
    const id = `${current}:${t.round}`;
    if (shownRound === id) return;
    const first = shownRound === null && firstRender;
    shownRound = id;

    const { net, lines, anyLoss, big } = seat.result;
    const title = net > 0 ? `Gagné ! +${formatChips(net)} jetons` : net < 0 ? `Perdu : ${formatChips(net)} jetons` : anyLoss ? "Bilan nul (0 jeton)" : "Égalité : mise rendue";
    const tone = net > 0 ? (big ? "gold" : "win") : net < 0 ? "lose" : "push";
    showResult(resultBox, { title, lines, tone, choices: anyLoss ? ctx.sanctionChoices() : [] });

    if (first) return; // manche passée : pas d'effets à l'ouverture de la page
    if (net > 0 && big) {
      sound.jackpot();
      cinematic("BLACKJACK", `+${formatChips(net)} jetons`, "gold");
      goldRain(25);
      ctx.wallet.announce(`a gagné ${formatChips(net)} jetons au blackjack !`, "gold");
    } else if (net > 0) sound.win();
    else if (net < 0) sound.lose();
  }

  // ---------- Démarrage ----------

  onSnapshot(roomRef, snap => {
    const all = snap.exists() ? snap.data().casino?.blackjack || {} : {};
    let changed = false;
    TABLE_IDS.forEach(id => {
      const data = all[id] || emptyTable();
      if (JSON.stringify(data) !== JSON.stringify(tables[id]) && applyTable(id, data, false)) changed = true;
    });
    if (changed || firstRender) render();
  }, error => console.error("Blackjack : synchro impossible", error));

  return { refresh: () => renderControls(), render };
}
