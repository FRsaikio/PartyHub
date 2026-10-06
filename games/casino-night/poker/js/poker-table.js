// Salle de poker : plusieurs tables (6 places chacune), synchro Firestore + affichage.
//
// Chaque table = un petit document rooms/{code}/casinoPoker/table-N (rapide à lire).
// Toutes les actions passent par runTransaction et appliquent poker-logic.js ; la cave et
// le départ modifient aussi le portefeuille du casino (increment dans la même transaction).
// Le « croupier » n'a besoin de personne : chaque téléphone surveille les délais
// (début de main, main suivante) et envoie un « tick » — le premier arrivé l'applique,
// les autres ne changent rien.

import { db, doc, onSnapshot, runTransaction, increment } from "../../../../firebase.js";
import { safeImageSrc } from "../../../../html-safe.js";
import { evaluate, suitOf, rankOf } from "./poker-rules.js";
import { MAX_SEATS, BUY_INS, MIN_BUY_IN, NEXT_HAND_DELAY, emptyTable, applyAction, potTotal, callInfo, canAct } from "./poker-logic.js";
import { sound, formatChips, showResult, cinematic, goldRain } from "../../js/ui.js";

export const TABLE_IDS = ["table-1", "table-2", "table-3", "table-4"];

// Places à l'écran (.slot-0 … .slot-5 dans poker.css) : 4 coins + 2 côtés, dans le sens
// des aiguilles d'une montre ; le haut-centre reste au croupier. Ta place est toujours .slot-0 (en bas).

const tableName = id => `Table ${id.split("-")[1]}`;
const clone = v => JSON.parse(JSON.stringify(v));

export function createPokerRoom(ctx, { roomCode, me, isHost, spectator, avatarFor }) {
  const roomRef = doc(db, "rooms", roomCode);
  const refOf = id => doc(db, "rooms", roomCode, "casinoPoker", id);

  const el = id => document.getElementById(id);
  const tablesEl = el("pkTables");
  const feltEl = el("pkTable");
  const seatsEl = el("pkSeats");
  const boardEl = el("pkBoard");
  const potEl = el("pkPot");
  const phaseEl = el("pkPhase");
  const speechEl = el("pkSpeech");
  const myCardsEl = el("pkMyCards");
  const myHandEl = el("pkMyHand");
  const controlsEl = el("pkControls");
  const resultBox = el("pkResult");

  const tables = Object.fromEntries(TABLE_IDS.map(id => [id, emptyTable(id)]));
  let current = (() => {
    try { return sessionStorage.getItem(`pkTable_${roomCode}`) || null; } catch { return null; }
  })();
  let busy = false;
  let lastTick = 0;
  let raiseTo = 0;
  let buyIn = 500;
  let wasMyTurn = false;
  let shownResult = null;
  const seenCards = new Map();
  let firstRender = true;

  // ---------- Transactions ----------

  async function mutate(tableId, type, payload = {}) {
    if (busy && type !== "tick") return;
    if (type !== "tick") { busy = true; renderControls(); }
    const needsWallet = ["sit", "rebuy", "leave"].includes(type);
    let committed = null;
    try {
      await runTransaction(db, async t => {
        const roomSnap = needsWallet ? await t.get(roomRef) : null;
        const snap = await t.get(refOf(tableId));
        const before = snap.exists() ? snap.data() : emptyTable(tableId);
        const next = clone(before);
        const wallets = roomSnap?.data()?.casino?.wallets || {};
        const deltas = {};
        const w = {
          chipsOf: key => Math.max(0, Number(wallets[key]?.chips) || 0) + (deltas[key] || 0),
          credit: (key, n) => { deltas[key] = (deltas[key] || 0) + n; },
          charge: (key, n) => {
            if (w.chipsOf(key) < n) throw new Error(`Pas assez de jetons au casino (il faut ${formatChips(n)}).`);
            w.credit(key, -n);
          }
        };

        applyAction(next, type, payload, me, w, Date.now());
        // Rien n'a changé (ex. « tick » déjà appliqué par un autre téléphone) : pas d'écriture.
        if (JSON.stringify(next) === JSON.stringify(before)) { committed = null; return; }
        next.v = (before.v || 0) + 1;
        t.set(refOf(tableId), next);
        const patch = {};
        Object.entries(deltas).forEach(([key, n]) => { if (n) patch[`casino.wallets.${key}.chips`] = increment(n); });
        if (Object.keys(patch).length) t.update(roomRef, patch);
        committed = next;
      });
    } catch (error) {
      committed = null;
      if (type !== "tick") ctx.toast(error.message || "Action impossible.", "lose");
      if (!error.message) console.error(error);
    } finally {
      if (type !== "tick") busy = false;
      // Celui qui agit voit tout de suite le résultat, sans attendre le serveur.
      if (committed) applyTable(tableId, committed);
      else render();
    }
  }

  function applyTable(id, data) {
    if ((data?.v || 0) < (tables[id]?.v || 0)) return; // un vieux snapshot n'écrase jamais l'état local
    tables[id] = data || emptyTable(id);
    render();
  }

  // ---------- Quelle table afficher ----------

  const mySeatIn = t => t.seats.findIndex(s => s?.key === me.key);
  const occupancy = t => t.seats.filter(Boolean).length;

  function pickTable() {
    const seated = TABLE_IDS.find(id => mySeatIn(tables[id]) >= 0);
    if (seated) return seated;
    if (current && tables[current]) return current;
    // spectateur (TV) : la table la plus remplie
    return [...TABLE_IDS].sort((a, b) => occupancy(tables[b]) - occupancy(tables[a]))[0];
  }

  function showTable(id) {
    current = id;
    try { sessionStorage.setItem(`pkTable_${roomCode}`, id); } catch { /* ignoré */ }
    render();
  }

  // ---------- Délais du croupier ----------

  setInterval(() => {
    const id = pickTable();
    const t = tables[id];
    const now = Date.now();
    const due = (t.phase === "waiting" && t.startAt && now >= t.startAt) ||
      (t.phase === "done" && t.doneAt && now >= t.doneAt + NEXT_HAND_DELAY);
    // Seuls les joueurs assis font avancer le croupier (pas la TV), au plus toutes les 1,5 s.
    if (due && !spectator && mySeatIn(t) >= 0 && now - lastTick > 1500) {
      lastTick = now;
      mutate(id, "tick");
    }
    renderCountdown();
  }, 500);

  // ---------- Affichage ----------

  function cardEl(code, { hidden = false, fresh = false, small = false } = {}) {
    const c = document.createElement("div");
    c.className = `pk-card${small ? " small" : ""}${fresh ? " dealt" : ""}`;
    if (hidden || !code) {
      c.classList.add("back");
      return c;
    }
    if (suitOf(code) === "♥" || suitOf(code) === "♦") c.classList.add("red");
    const rank = document.createElement("span");
    rank.className = "pk-rank";
    rank.textContent = rankOf(code);
    const suit = document.createElement("span");
    suit.className = "pk-suit";
    suit.textContent = suitOf(code);
    c.append(rank, suit);
    return c;
  }

  // Cartes d'une zone, en animant celles qui viennent d'arriver.
  function cardsFor(zoneId, codes, opts = {}) {
    const before = seenCards.get(zoneId) ?? (firstRender ? codes.length : 0);
    seenCards.set(zoneId, codes.length);
    return codes.map((code, i) => cardEl(code, { ...opts, fresh: i >= before }));
  }

  function avatarEl(seat) {
    const box = document.createElement("div");
    box.className = "pk-avatar";
    const info = avatarFor(seat.name);
    const src = safeImageSrc(info?.avatarBase64 || info?.avatarUrl);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      box.appendChild(img);
    } else {
      box.textContent = info?.avatar || seat.avatar || "🎲";
    }
    return box;
  }

  const PHASES = { waiting: "En attente", preflop: "Pré-flop", flop: "Flop", turn: "Turn", river: "River", done: "Abattage" };

  function render() {
    current = pickTable();
    const t = tables[current];
    const mySeat = mySeatIn(t);
    const showdown = t.phase === "done" && t.results?.showdown;

    renderTablesBar();

    // Croupier : sa dernière annonce
    speechEl.textContent = t.log?.[t.log.length - 1] || "Faites vos jeux.";
    phaseEl.textContent = PHASES[t.phase] || "";
    const pot = potTotal(t);
    potEl.textContent = pot ? `Pot ${formatChips(pot)}` : "";
    potEl.hidden = !pot;

    // Cartes communes (5 emplacements)
    const board = cardsFor(`${current}:board:${t.handNo}`, t.community || []);
    while (board.length < 5) {
      const slot = document.createElement("div");
      slot.className = "pk-card slot";
      board.push(slot);
    }
    boardEl.replaceChildren(...board);

    // Places autour de la table, en tournant pour que ma place soit en bas.
    const hero = mySeat >= 0 ? mySeat : 0;
    let newCards = false;
    seatsEl.replaceChildren(...t.seats.map((seat, index) => {
      const slot = (index - hero + MAX_SEATS) % MAX_SEATS;
      const box = document.createElement("div");
      box.className = `pk-seat slot-${slot}`;

      if (!seat) {
        box.classList.add("empty");
        if (mySeat < 0 && !spectator) {
          const sit = document.createElement("button");
          sit.type = "button";
          sit.className = "pk-sit";
          sit.textContent = "S'asseoir";
          sit.addEventListener("click", () => mutate(current, "sit", { seat: index, buyIn }));
          box.appendChild(sit);
        } else {
          const free = document.createElement("span");
          free.className = "pk-free";
          free.textContent = "Libre";
          box.appendChild(free);
        }
        return box;
      }

      if (index === mySeat) box.classList.add("me");
      if (t.toAct === index && t.phase !== "done") box.classList.add("turn");
      if (seat.folded) box.classList.add("folded");
      if (seat.sittingOut) box.classList.add("out");
      if (t.phase === "done" && t.results?.winners?.some(wn => wn.key === seat.key)) box.classList.add("winner");

      const head = document.createElement("div");
      head.className = "pk-seat-head";
      const name = document.createElement("strong");
      name.className = "pk-name";
      name.textContent = seat.name;
      const stack = document.createElement("span");
      stack.className = "pk-stack";
      stack.textContent = formatChips(seat.stack);
      head.append(name, stack);

      const status = document.createElement("span");
      status.className = "pk-status";
      status.textContent = seat.sittingOut ? "À sec" : seat.last || "";

      // Cartes : les miennes face visible, celles des autres retournées à l'abattage.
      const cardsBox = document.createElement("div");
      cardsBox.className = "pk-seat-cards";
      if (seat.inHand && seat.cards?.length && t.phase !== "waiting") {
        const visible = index === mySeat || (showdown && !seat.folded);
        const before = cardsFor(`${current}:${index}:${t.handNo}`, seat.cards);
        if (before.some(c => c.classList.contains("dealt"))) newCards = true;
        cardsBox.replaceChildren(...seat.cards.map((code, i) => cardEl(code, { hidden: !visible, small: true, fresh: before[i].classList.contains("dealt") })));
      }

      const badges = document.createElement("div");
      badges.className = "pk-badges";
      if (t.button === index && t.phase !== "waiting") badges.appendChild(badge("D", "dealer"));
      if (t.sb === index && t.phase !== "waiting" && t.phase !== "done") badges.appendChild(badge("PB", "blind"));
      if (t.bb === index && t.phase !== "waiting" && t.phase !== "done") badges.appendChild(badge("GB", "blind"));

      box.append(avatarEl(seat), head, status, cardsBox, badges);

      // Mise posée devant le joueur
      if (seat.bet > 0) {
        const bet = document.createElement("span");
        bet.className = "pk-bet";
        bet.textContent = formatChips(seat.bet);
        box.appendChild(bet);
      }
      return box;
    }));
    if (newCards) sound.card();

    renderMine(t, mySeat);
    renderCountdown();
    renderControls();
    renderResults(t, mySeat);
    alertMyTurn(t, mySeat);
    firstRender = false;
  }

  function badge(text, kind) {
    const b = document.createElement("span");
    b.className = `pk-badge ${kind}`;
    b.textContent = text;
    return b;
  }

  function renderTablesBar() {
    tablesEl.replaceChildren(...TABLE_IDS.map(id => {
      const t = tables[id];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pk-table-btn";
      if (id === current) btn.classList.add("active");
      const seated = mySeatIn(t) >= 0;
      btn.textContent = `${tableName(id)} · ${occupancy(t)}/${MAX_SEATS}${seated ? " · toi" : ""}`;
      btn.addEventListener("click", () => { sound.click(); showTable(id); });
      return btn;
    }));
  }

  function renderMine(t, mySeat) {
    const seat = t.seats[mySeat];
    if (!seat || !seat.inHand || !seat.cards?.length || t.phase === "waiting") {
      myCardsEl.replaceChildren();
      myHandEl.textContent = seat ? (seat.sittingOut ? "Tu es à sec : recave-toi pour rejouer." : "Tes cartes arrivent à la prochaine main.") : "";
      return;
    }
    myCardsEl.replaceChildren(...seat.cards.map(code => cardEl(code)));
    if (seat.folded) {
      myHandEl.textContent = "Couché pour cette main.";
    } else if ((t.community || []).length >= 3) {
      myHandEl.textContent = `Ta main : ${evaluate([...seat.cards, ...t.community]).name}`;
    } else {
      const [a, b] = seat.cards;
      myHandEl.textContent = rankOf(a) === rankOf(b) ? `Paire servie : ${rankOf(a)} !` : "Tes deux cartes (toi seul les vois).";
    }
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

  function note(text) {
    const p = document.createElement("p");
    p.className = "pk-note";
    p.textContent = text;
    return p;
  }

  // Choix du montant de cave (limité par les jetons du casino).
  function buyInPicker(label, action) {
    const wrap = document.createElement("div");
    wrap.className = "pk-buyin";
    const title = document.createElement("span");
    title.textContent = label;
    wrap.appendChild(title);
    const chips = ctx.wallet.chips;
    const options = BUY_INS.filter(v => v <= chips);
    if (!options.includes(buyIn)) buyIn = options[options.length - 1] || MIN_BUY_IN;
    options.forEach(v => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `bet-chip${v === buyIn ? " selected" : ""}`;
      b.textContent = formatChips(v);
      b.addEventListener("click", () => { buyIn = v; sound.chip(); renderControls(); });
      wrap.appendChild(b);
    });
    if (!options.length) {
      wrap.appendChild(note(`Il te faut au moins ${MIN_BUY_IN} jetons au casino (emprunte dans le hall).`));
      return wrap;
    }
    if (action) wrap.appendChild(button(action.label, action.onClick, "primary"));
    return wrap;
  }

  function renderControls() {
    if (spectator) { controlsEl.replaceChildren(); return; }
    const t = tables[current];
    const mySeat = mySeatIn(t);
    const seat = t.seats[mySeat];
    const items = [];

    if (!seat) {
      const free = t.seats.findIndex(s => !s);
      items.push(buyInPicker("Ta cave pour t'asseoir :", free >= 0 ? {
        label: "S'asseoir à cette table",
        onClick: () => mutate(current, "sit", { buyIn })
      } : null));
      if (free < 0) items.push(note("Cette table est complète : choisis-en une autre au-dessus."));
      controlsEl.replaceChildren(...items);
      return;
    }

    const handRunning = ["preflop", "flop", "turn", "river"].includes(t.phase);

    if (handRunning && t.toAct === mySeat && canAct(seat)) {
      const { toCall, minRaiseTo, maxRaiseTo } = callInfo(t, mySeat);
      if (!raiseTo || raiseTo < minRaiseTo || raiseTo > maxRaiseTo) raiseTo = minRaiseTo;
      const pot = potTotal(t);

      const row = document.createElement("div");
      row.className = "pk-actions";
      row.append(
        button("Se coucher", () => mutate(current, "act", { move: "fold" }), "danger"),
        toCall === 0
          ? button("Parole", () => mutate(current, "act", { move: "check" }))
          : button(`Suivre ${formatChips(toCall)}`, () => mutate(current, "act", { move: "call" }), "secondary"),
        button("Tapis", () => mutate(current, "act", { move: "allin" }), "secondary", false, "pk-allin")
      );
      items.push(row);

      if (maxRaiseTo > t.currentBet && minRaiseTo < maxRaiseTo) {
        const raise = document.createElement("div");
        raise.className = "pk-raise";
        const presets = [
          ["Min", minRaiseTo],
          ["½ pot", t.currentBet + Math.floor(pot / 2)],
          ["Pot", t.currentBet + pot]
        ].map(([label, v]) => [label, Math.max(minRaiseTo, Math.min(maxRaiseTo, v))]);
        presets.forEach(([label, v]) => raise.appendChild(button(label, () => { raiseTo = v; renderControls(); }, `small${v === raiseTo ? " selected" : ""}`)));
        const range = document.createElement("input");
        range.type = "range";
        range.min = minRaiseTo;
        range.max = maxRaiseTo;
        range.step = 10;
        range.value = raiseTo;
        range.setAttribute("aria-label", "Montant de la relance");
        range.addEventListener("input", () => { raiseTo = Number(range.value); go.textContent = `Relancer à ${formatChips(raiseTo)}`; });
        const go = button(`Relancer à ${formatChips(raiseTo)}`, () => mutate(current, "act", { move: "raise", amount: raiseTo }), "primary");
        raise.append(range, go);
        items.push(raise);
      }
    } else if (handRunning) {
      const turnSeat = t.seats[t.toAct];
      items.push(note(seat.inHand && !seat.folded ? (turnSeat ? `${turnSeat.name} réfléchit…` : "Le croupier distribue…") : "Tu regardes cette main : tu joueras la suivante."));
      // Pas de chrono : l'hôte peut faire jouer un joueur absent (parole, sinon il se couche).
      if (isHost && turnSeat && t.toAct !== mySeat) {
        items.push(button(`Faire jouer ${turnSeat.name} (absent)`, () => mutate(current, "act", { force: true }), "secondary", false, "pk-force"));
      }
    }

    if (seat.sittingOut || seat.stack === 0) {
      items.push(buyInPicker("Tu es à sec. Recave :", { label: "Se recaver", onClick: () => mutate(current, "rebuy", { buyIn }) }));
    }

    if (!handRunning || seat.folded || !seat.inHand) {
      items.push(button(`Se lever (récupérer ${formatChips(seat.stack)} jetons)`, () => mutate(current, "leave"), "secondary", false, "pk-leave"));
    }

    controlsEl.replaceChildren(...items);
  }

  function renderCountdown() {
    const t = tables[current];
    const cd = el("pkCountdown");
    const now = Date.now();
    if (t.phase === "waiting") {
      cd.textContent = t.startAt ? `La main commence dans ${Math.max(0, Math.ceil((t.startAt - now) / 1000))} s` : (occupancy(t) < 2 ? "En attente d'un 2e joueur…" : "");
    } else if (t.phase === "done" && t.doneAt) {
      cd.textContent = `Main suivante dans ${Math.max(0, Math.ceil((t.doneAt + NEXT_HAND_DELAY - now) / 1000))} s`;
    } else {
      cd.textContent = "";
    }
  }

  function renderResults(t, mySeat) {
    if (t.phase !== "done" || !t.results) {
      resultBox.hidden = true;
      return;
    }
    resultBox.hidden = false;
    const myKey = t.seats[mySeat]?.key;
    const won = t.results.winners.find(wn => wn.key === myKey);
    const lost = t.results.punished.find(p => p.key === myKey);
    const title = won ? `Tu remportes ${formatChips(won.amount)} jetons !` : lost ? "Perdu à l'abattage" : `${t.results.winners.map(wn => wn.name).join(" et ")} remporte${t.results.winners.length > 1 ? "nt" : ""} la main`;
    const id = `${current}:${t.handNo}`;
    // Une seule fois par main : sinon les boutons de protection se réinitialisent à chaque snapshot.
    if (shownResult === id) return;
    showResult(resultBox, { title, lines: t.results.lines, tone: won ? "win" : lost ? "lose" : "info", choices: lost ? ctx.sanctionChoices() : [] });
    const first = shownResult === null && firstRender;
    shownResult = id;
    if (first) return;
    if (won) {
      sound.win();
      if (won.amount >= 500) {
        cinematic("POKER", `+${formatChips(won.amount)} jetons`, "gold");
        goldRain(25);
        ctx.wallet.announce(`a remporté ${formatChips(won.amount)} jetons au poker${won.hand ? ` avec ${won.hand}` : ""} !`, "gold");
      }
    } else if (lost) {
      sound.lose();
    }
  }

  // C'est à moi de parler : vibration, son, message, et on fait défiler jusqu'aux boutons.
  function alertMyTurn(t, mySeat) {
    const myTurn = mySeat >= 0 && t.toAct === mySeat && ["preflop", "flop", "turn", "river"].includes(t.phase);
    if (myTurn && !wasMyTurn && !firstRender && !spectator) {
      navigator.vibrate?.([80, 60, 80]);
      sound.chip();
      ctx.toast("♠️ À toi de parler !", "gold");
      controlsEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    wasMyTurn = myTurn;
  }

  // ---------- Démarrage ----------

  TABLE_IDS.forEach(id => {
    onSnapshot(refOf(id), snap => applyTable(id, snap.exists() ? snap.data() : emptyTable(id)),
      error => console.error(`Poker ${id} : synchro impossible`, error));
  });
  render();

  return { refresh: () => renderControls(), render };
}
