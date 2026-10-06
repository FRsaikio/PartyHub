// Blackjack Extreme.
//
// États : "idle" (pas de manche) → ["insurance" si la banque montre un As]
//         → "player" (le joueur joue ses mains une par une) → "dealer" → "idle".
// Les boutons ne sont actifs que dans le bon état : impossible de jouer sans avoir misé.
//
// Règles :
//   - Blackjack naturel ×3, banque tire jusqu'à 17.
//   - Doubler : sur 2 cartes (y compris après une séparation, sauf As séparés).
//   - Séparer : 2 cartes de même valeur, jusqu'à 4 mains ; As séparés = une seule carte chacun.
//   - Assurance : si la banque montre un As, moitié de la mise, paie 2 contre 1.
//   - Abandonner : sur les 2 premières cartes, récupère la moitié de la mise.
// Argent : chaque mise est prélevée quand elle est engagée ; un gain ×N renvoie N fois
// la mise de la main ; une égalité rend la mise.

import { sound, sleep, formatChips, showResult, cinematic, goldRain } from "./ui.js";
import { MAX_HANDS, value, total, isBlackjack, freshShoe, resolveHand as resolveAgainst } from "./bj-rules.js";


export function initBlackjack(ctx) {
  const dealBtn = document.getElementById("bjDealBtn");
  const hitBtn = document.getElementById("bjHitBtn");
  const standBtn = document.getElementById("bjStandBtn");
  const doubleBtn = document.getElementById("bjDoubleBtn");
  const splitBtn = document.getElementById("bjSplitBtn");
  const surrenderBtn = document.getElementById("bjSurrenderBtn");
  const handsEl = document.getElementById("bjPlayerHands");
  const dealerEl = document.getElementById("bjDealerCards");
  const dealerTotalEl = document.getElementById("bjDealerTotal");
  const shoeEl = document.getElementById("bjShoe");
  const resultBox = document.getElementById("bjResult");

  let shoe = [];
  let dealer = [];
  // Une main : { cards, bet, doubled, done, splitAces, surrendered }
  let hands = [];
  let active = 0;
  let state = "idle";
  let allIn = false;
  let insurance = 0;

  const hand = () => hands[active];
  const fromSplit = () => hands.length > 1;

  function newShoe() {
    shoe = freshShoe();
  }

  function draw() {
    if (shoe.length < 20) newShoe();
    return shoe.pop();
  }

  // ---------- Affichage ----------

  function cardEl(card, hidden = false, fresh = false) {
    const el = document.createElement("div");
    el.className = "playing-card";
    if (fresh) el.classList.add("dealt");
    if (hidden) {
      el.classList.add("card-back");
      return el;
    }
    if (card.suit === "♥" || card.suit === "♦") el.classList.add("red");
    const corner = `${card.rank}${card.suit}`;
    el.innerHTML = `<span class="pc-corner"></span><span class="pc-suit"></span><span class="pc-corner pc-corner-bottom"></span>`;
    el.querySelectorAll(".pc-corner").forEach(c => { c.textContent = corner; });
    el.querySelector(".pc-suit").textContent = card.suit;
    return el;
  }

  // `fresh` = { hand: index de la main dont la dernière carte vient d'arriver, dealer: bool }
  function render(fresh = {}) {
    const revealDealer = state === "dealer" || state === "idle";

    handsEl.replaceChildren(...(hands.length ? hands : [{ cards: [] }]).map((h, i) => {
      const box = document.createElement("div");
      box.className = "bj-hand";
      if (state === "player" && i === active && hands.length > 1) box.classList.add("active");
      if (h.done && state === "player") box.classList.add("done");

      const head = document.createElement("div");
      head.className = "bj-zone-head";
      const label = document.createElement("span");
      label.textContent = hands.length > 1 ? `Main ${i + 1}${h.bet ? ` · ${formatChips(h.bet)}` : ""}` : "Toi";
      const score = document.createElement("strong");
      score.textContent = h.cards.length ? total(h.cards) : "–";
      head.append(label, score);

      const row = document.createElement("div");
      row.className = "cards-row";
      row.append(...h.cards.map((c, j) => cardEl(c, false, fresh.hand === i && j === h.cards.length - 1)));

      box.append(head, row);
      return box;
    }));

    dealerEl.replaceChildren(...dealer.map((c, i) => cardEl(c, !revealDealer && i === 1, fresh.dealer && i === dealer.length - 1)));
    dealerTotalEl.textContent = !dealer.length ? "–" : revealDealer ? total(dealer) : value(dealer[0].rank) === 1 ? "1 / 11" : value(dealer[0].rank);
    shoeEl.textContent = `${shoe.length} cartes dans le sabot`;
  }

  function canSplit() {
    const h = hand();
    return state === "player" && h && !h.done && h.cards.length === 2 && !h.splitAces &&
      value(h.cards[0].rank) === value(h.cards[1].rank) && hands.length < MAX_HANDS && ctx.wallet.canAfford(h.bet);
  }

  function setButtons() {
    const h = hand();
    const playing = state === "player" && h && !h.done;
    dealBtn.disabled = state !== "idle";
    hitBtn.disabled = !playing || h.splitAces;
    standBtn.disabled = !playing;
    doubleBtn.disabled = !playing || h.cards.length !== 2 || h.splitAces || !ctx.wallet.canAfford(h.bet);
    splitBtn.disabled = !canSplit();
    surrenderBtn.disabled = !playing || fromSplit() || h.cards.length !== 2;
  }

  function prompt() {
    const h = hand();
    const lines = [];
    if (canSplit()) lines.push("Paire ! Tu peux séparer tes cartes en deux mains.");
    lines.push(fromSplit() ? `Main ${active + 1} sur ${hands.length} : carte, rester ou doubler.` : "Carte, rester, doubler… ou abandonner.");
    showResult(resultBox, { title: `${fromSplit() ? `Main ${active + 1} : ` : "Ta main : "}${total(h.cards)}`, lines, tone: "info" });
  }

  // ---------- Déroulement ----------

  async function deal() {
    if (state !== "idle") return;
    const bet = ctx.placeBet();
    if (!bet) return;

    allIn = bet.allIn;
    insurance = 0;
    dealer = [];
    hands = [{ cards: [], bet: bet.amount, doubled: false, done: false, splitAces: false, surrendered: false }];
    active = 0;
    state = "player";
    setButtons();
    showResult(resultBox, { title: "Distribution…", tone: "info" });
    disableAll();

    // Une carte à la fois : joueur, banque, joueur, banque (cachée)
    for (const who of ["player", "dealer", "player", "dealer"]) {
      if (who === "player") hands[0].cards.push(draw());
      else dealer.push(draw());
      sound.card();
      render(who === "player" ? { hand: 0 } : { dealer: true });
      await sleep(260);
    }

    const playerBJ = isBlackjack(hands[0].cards);

    // La banque montre un As : on propose l'assurance (sauf si on a déjà un blackjack).
    if (dealer[0].rank === "A" && !playerBJ && ctx.wallet.canAfford(Math.floor(hands[0].bet / 2))) {
      state = "insurance";
      setButtons();
      const cost = Math.floor(hands[0].bet / 2);
      showResult(resultBox, {
        title: "La banque montre un As",
        lines: [`Assurance : mise ${formatChips(cost)} jetons sur un blackjack de la banque (paie 2 contre 1).`],
        tone: "info",
        choices: [
          { label: `Prendre l'assurance (${formatChips(cost)})`, variant: "primary", onClick: () => afterInsurance(cost) },
          { label: "Pas d'assurance", variant: "secondary", onClick: () => afterInsurance(0) }
        ]
      });
      return;
    }

    await checkNaturals();
  }

  function disableAll() {
    [dealBtn, hitBtn, standBtn, doubleBtn, splitBtn, surrenderBtn].forEach(b => { b.disabled = true; });
  }

  async function afterInsurance(cost) {
    if (state !== "insurance") return;
    if (cost) {
      ctx.wallet.add(-cost);
      insurance = cost;
      sound.chip();
    }
    state = "player";
    await checkNaturals();
  }

  // La banque regarde sa carte cachée : blackjack(s) d'entrée ?
  async function checkNaturals() {
    const playerBJ = isBlackjack(hands[0].cards);
    const dealerBJ = isBlackjack(dealer);

    if (playerBJ || dealerBJ) {
      state = "dealer";
      render();
      hands[0].done = true;
      return settle({ naturals: { playerBJ, dealerBJ } });
    }

    if (insurance) ctx.toast(`Pas de blackjack pour la banque : assurance perdue (-${formatChips(insurance)}).`, "lose");
    render();
    setButtons();
    prompt();
  }

  async function hit() {
    const h = hand();
    if (state !== "player" || !h || h.done || h.splitAces) return;
    h.cards.push(draw());
    sound.card();
    render({ hand: active });

    const score = total(h.cards);
    if (score >= 21) {
      h.done = true;
      return nextHand();
    }
    setButtons();
    prompt();
  }

  function stand() {
    const h = hand();
    if (state !== "player" || !h || h.done) return;
    h.done = true;
    return nextHand();
  }

  async function doubleDown() {
    const h = hand();
    if (state !== "player" || !h || h.done || h.cards.length !== 2 || h.splitAces) return;
    if (!ctx.wallet.canAfford(h.bet)) return ctx.toast("Pas assez de jetons pour doubler.", "lose");
    ctx.wallet.add(-h.bet);
    h.bet *= 2;
    h.doubled = true;
    sound.chip();
    h.cards.push(draw());
    sound.card();
    h.done = true;
    render({ hand: active });
    await sleep(350);
    return nextHand();
  }

  async function split() {
    if (!canSplit()) return;
    const h = hand();
    ctx.wallet.add(-h.bet);
    sound.chip();

    const aces = h.cards[0].rank === "A";
    const second = { cards: [h.cards.pop()], bet: h.bet, doubled: false, done: false, splitAces: aces, surrendered: false };
    h.splitAces = aces;
    hands.splice(active + 1, 0, second);
    render();
    await sleep(250);

    // Chaque main reçoit sa deuxième carte.
    for (const [i, target] of [[active, h], [active + 1, second]]) {
      target.cards.push(draw());
      sound.card();
      render({ hand: i });
      await sleep(260);
    }

    // As séparés : une seule carte chacun, on passe directement.
    if (aces) {
      h.done = true;
      second.done = true;
      return nextHand();
    }
    if (total(h.cards) === 21) {
      h.done = true;
      return nextHand();
    }
    setButtons();
    prompt();
  }

  function surrender() {
    const h = hand();
    if (state !== "player" || !h || h.done || fromSplit() || h.cards.length !== 2) return;
    h.surrendered = true;
    h.done = true;
    ctx.wallet.add(Math.floor(h.bet / 2));
    state = "dealer";
    render();
    return settle({});
  }

  // Passe à la prochaine main à jouer, ou à la banque si tout est joué.
  function nextHand() {
    const next = hands.findIndex(h => !h.done);
    if (next >= 0) {
      active = next;
      render();
      setButtons();
      prompt();
      return;
    }
    return dealerTurn();
  }

  async function dealerTurn() {
    state = "dealer";
    setButtons();
    render(); // retourne la carte cachée
    await sleep(500);

    // La banque ne tire que s'il reste au moins une main en jeu.
    const alive = hands.some(h => !h.surrendered && total(h.cards) <= 21);
    while (alive && total(dealer) < 17) {
      dealer.push(draw());
      sound.card();
      render({ dealer: true });
      await sleep(600);
    }
    return settle({});
  }

  // ---------- Règlement ----------

  const resolveHand = (h, naturals) => resolveAgainst(h, dealer, naturals);

  function settle({ naturals = null }) {
    const lines = [];
    let staked = 0;
    let returned = 0;
    let handPayout = 0; // gains + mises rendues des mains, versés en une fois
    let anyLoss = false;
    let big = false;

    hands.forEach((h, i) => {
      const r = resolveHand(h, naturals);
      const prefix = hands.length > 1 ? `Main ${i + 1} (${total(h.cards)}) : ` : "";
      staked += h.bet;

      if (r.outcome === "win") {
        let payout = h.bet * r.mult;
        if (allIn) payout *= 2;
        returned += payout;
        handPayout += payout;
        big = big || r.big;
        lines.push(`${prefix}${r.text}${h.doubled ? " 💪 Double réussi." : ""}`);
      } else if (r.outcome === "push") {
        returned += h.bet;
        handPayout += h.bet;
        lines.push(`${prefix}${r.text}`);
      } else if (r.outcome === "surrender") {
        returned += Math.floor(h.bet / 2); // déjà recrédité au moment de l'abandon
        lines.push(`${prefix}${r.text}`);
      } else {
        anyLoss = true;
        lines.push(`${prefix}${r.text}${h.doubled ? " 💀 Double raté : double shot en plus." : ""}`);
      }
    });

    // Assurance : paie 2 contre 1 (on rend la mise + 2×) si la banque a un blackjack.
    if (insurance) {
      if (naturals?.dealerBJ) {
        ctx.wallet.add(insurance * 3);
        returned += insurance * 3;
        lines.push(`🛡️ Assurance gagnante : +${formatChips(insurance * 3)} jetons.`);
      } else if (naturals) {
        lines.push(`Assurance perdue (-${formatChips(insurance)}).`);
      }
      staked += insurance;
    }

    // L'abandon et l'assurance sont déjà réglés ; on verse le reste en une fois.
    if (handPayout) ctx.wallet.add(handPayout);

    if (allIn && returned > staked) lines.push("🔥 ALL IN réussi : gains doublés.");
    if (allIn && anyLoss && returned <= staked) lines.push("⚠️ ALL IN raté : sanction doublée.");

    const net = returned - staked;
    const title = net > 0 ? `Gagné ! +${formatChips(net)} jetons`
      : net < 0 ? `Perdu : ${formatChips(net)} jetons`
      : anyLoss ? "Bilan nul (0 jeton)" : "Égalité : mise rendue";
    const tone = net > 0 ? (big ? "gold" : "win") : net < 0 ? "lose" : "push";

    if (net > 0) {
      if (big) {
        sound.jackpot();
        cinematic("BLACKJACK", `+${formatChips(net)} jetons`, "gold");
        goldRain(25);
        ctx.wallet.announce(`a gagné ${formatChips(net)} jetons au blackjack !`, "gold");
      } else {
        sound.win();
      }
    } else if (net < 0) {
      sound.lose();
    }

    state = "idle";
    active = 0;
    insurance = 0;
    render();
    setButtons();
    showResult(resultBox, { title, lines, tone, choices: anyLoss ? ctx.sanctionChoices() : [] });
  }

  dealBtn.addEventListener("click", deal);
  hitBtn.addEventListener("click", hit);
  standBtn.addEventListener("click", stand);
  doubleBtn.addEventListener("click", doubleDown);
  splitBtn.addEventListener("click", split);
  surrenderBtn.addEventListener("click", surrender);

  newShoe();
  render();
  setButtons();
  showResult(resultBox, { title: "Le croupier t'attend", lines: ["Choisis ta mise puis clique sur « Distribuer »."], tone: "info" });

  // Le solde change (gain, vol…) : on réévalue doubler / séparer.
  return { refresh: setButtons };
}
