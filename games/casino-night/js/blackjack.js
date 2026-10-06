// Blackjack Extreme.
// États : "idle" (pas de manche) → "player" (le joueur joue) → "dealer" (la banque tire) → "idle".
// Les boutons ne sont actifs que dans le bon état : impossible de jouer sans avoir misé.
// Gains : la mise est prélevée à la distribution ; un gain ×N renvoie N fois la mise ;
// une égalité rend la mise.

import { sound, sleep, formatChips, showResult, cinematic, goldRain } from "./ui.js";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const DECKS = 4;

const value = rank => (rank === "A" ? 1 : ["J", "Q", "K"].includes(rank) ? 10 : Number(rank));

function total(cards) {
  let sum = cards.reduce((acc, card) => acc + value(card.rank), 0);
  const aces = cards.filter(card => card.rank === "A").length;
  for (let i = 0; i < aces && sum + 10 <= 21; i++) sum += 10;
  return sum;
}

const isBlackjack = cards => cards.length === 2 && total(cards) === 21;

// ---------- Sanctions (textes d'origine) ----------

function bustSanction(score) {
  if (score === 22) return "🔥 22 pile : double shot.";
  if (score === 23) return "🍺 23 : bois avec ton voisin.";
  if (score === 24) return "😈 24 : le dernier à rire boit avec toi.";
  if (score === 25) return "☠️ 25 : verre cul sec.";
  if (score <= 27) return "🚨 26-27 : tu bois à chaque prénom entendu pendant 5 minutes.";
  if (score <= 29) return "💣 28-29 : défi humiliation obligatoire.";
  return "☠️ 30+ CASINO COLLAPSE : chaque joueur te donne une sanction.";
}

function losingHandSanction(score) {
  const map = {
    20: "👑 Main finale 20 : distribue 20 gorgées.",
    19: "🍺 Main finale 19 : choisis un duo, ils boivent ensemble.",
    18: "🔥 Main finale 18 : distribue 10 gorgées.",
    17: "🃏 Main finale 17 : le dernier à parler boit.",
    16: "💀 Main finale 16 : double shot.",
    15: "🍺 Main finale 15 : bois avec le voisin de ton choix.",
    14: "🚨 Main finale 14 : le plus sobre boit.",
    13: "😈 Main finale 13 : tu bois à chaque rire pendant 3 minutes.",
    12: "☠️ Main finale 12 : verre cul sec.",
    11: "🔥 Main finale 11 : double shot.",
    10: "🍺 Main finale 10 : shot simple."
  };
  return map[score] || "💀 Main faible : shot.";
}

// Bonus de victoire selon le score (multiplicateur, texte).
function winBonus(player, dealer, cardCount) {
  if (player === 21 && cardCount >= 5) return { mult: 4, text: "👑 21 en 5 cartes : immunité totale 3 tours." };
  if (player === 21 && cardCount === 4) return { mult: 3, text: "💀 21 en 4 cartes : choisis une victime pour un double shot." };
  if (player === 21 && dealer === 20) return { mult: 5, text: "👑 21 contre 20 : CASINO JACKPOT, tout le monde boit sauf toi." };
  if (player === 20 && dealer === 19) return { mult: 4, text: "🔥 20 contre 19 : distribue 15 gorgées." };
  if (player === 21 && cardCount === 3) return { mult: 2, text: "🔥 21 en 3 cartes : distribue 15 gorgées." };
  if (player === 19 && dealer === 18) return { mult: 3, text: "🍺 19 contre 18 : choisis deux victimes." };
  return { mult: 2, text: "🔥 Victoire : distribue des gorgées." };
}

export function initBlackjack(ctx) {
  const dealBtn = document.getElementById("bjDealBtn");
  const hitBtn = document.getElementById("bjHitBtn");
  const standBtn = document.getElementById("bjStandBtn");
  const doubleBtn = document.getElementById("bjDoubleBtn");
  const playerEl = document.getElementById("bjPlayerCards");
  const dealerEl = document.getElementById("bjDealerCards");
  const playerTotalEl = document.getElementById("bjPlayerTotal");
  const dealerTotalEl = document.getElementById("bjDealerTotal");
  const shoeEl = document.getElementById("bjShoe");
  const resultBox = document.getElementById("bjResult");

  let shoe = [];
  let player = [];
  let dealer = [];
  let state = "idle";
  let bet = null; // { amount, allIn }
  let doubled = false;

  function newShoe() {
    shoe = [];
    for (let d = 0; d < DECKS; d++) {
      for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit });
    }
    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
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

  function render({ revealDealer = state !== "player", freshPlayer = 0, freshDealer = 0 } = {}) {
    playerEl.replaceChildren(...player.map((c, i) => cardEl(c, false, i >= player.length - freshPlayer)));
    dealerEl.replaceChildren(...dealer.map((c, i) => cardEl(c, !revealDealer && i === 1, i >= dealer.length - freshDealer)));
    playerTotalEl.textContent = player.length ? total(player) : "–";
    dealerTotalEl.textContent = !dealer.length ? "–" : revealDealer ? total(dealer) : value(dealer[0].rank) === 1 ? "1 / 11" : value(dealer[0].rank);
    shoeEl.textContent = `${shoe.length} cartes dans le sabot`;
  }

  function setButtons() {
    const playing = state === "player";
    dealBtn.disabled = state !== "idle";
    hitBtn.disabled = !playing;
    standBtn.disabled = !playing;
    doubleBtn.disabled = !playing || doubled || player.length !== 2 || !ctx.wallet.canAfford(bet?.amount || Infinity);
  }

  // ---------- Déroulement ----------

  async function deal() {
    if (state !== "idle") return;
    bet = ctx.placeBet();
    if (!bet) return;

    doubled = false;
    player = [];
    dealer = [];
    state = "player";
    setButtons();
    showResult(resultBox, { title: "Distribution…", tone: "info" });

    // Distribution une carte à la fois : joueur, banque, joueur, banque (cachée)
    for (const target of [player, dealer, player, dealer]) {
      target.push(draw());
      sound.card();
      render({ freshPlayer: target === player ? 1 : 0, freshDealer: target === dealer ? 1 : 0 });
      await sleep(260);
    }

    const playerBJ = isBlackjack(player);
    const dealerBJ = isBlackjack(dealer);
    if (playerBJ || dealerBJ) {
      state = "dealer";
      render();
      if (playerBJ && dealerBJ) return finish({ outcome: "push", text: "🃏 Double blackjack : égalité, chacun boit 2 gorgées." });
      if (playerBJ) return finish({ outcome: "win", mult: 3, text: "🃏 VRAI BLACKJACK : distribue 20 gorgées.", big: true });
      return finish({ outcome: "lose", text: "🏦 Blackjack de la banque : tout le monde boit." });
    }

    showResult(resultBox, { title: `Ta main : ${total(player)}`, lines: ["Tire une carte, reste, ou double ta mise."], tone: "info" });
    setButtons();
  }

  async function hit() {
    if (state !== "player") return;
    player.push(draw());
    sound.card();
    render({ freshPlayer: 1 });

    const score = total(player);
    if (score > 21) {
      state = "dealer";
      render();
      return finish({ outcome: "bust", text: bustSanction(score) });
    }
    if (score === 21) return stand();
    setButtons();
  }

  async function doubleDown() {
    if (state !== "player" || doubled || player.length !== 2) return;
    if (!ctx.wallet.canAfford(bet.amount)) return ctx.toast("Pas assez de jetons pour doubler.", "lose");
    ctx.wallet.add(-bet.amount);
    bet = { ...bet, amount: bet.amount * 2 };
    doubled = true;
    sound.chip();
    await hit();
    if (state === "player") await stand();
  }

  async function stand() {
    if (state !== "player") return;
    state = "dealer";
    setButtons();
    render(); // retourne la carte cachée
    await sleep(500);

    while (total(dealer) < 17) {
      dealer.push(draw());
      sound.card();
      render({ freshDealer: 1 });
      await sleep(600);
    }

    const p = total(player);
    const d = total(dealer);

    if (d > 21) {
      return finish(d > 25
        ? { outcome: "win", mult: 3, text: "☠️ La banque explose (plus de 25) : tout le monde cul sec.", big: true }
        : { outcome: "win", mult: 2, text: "🔥 La banque saute : shot collectif." });
    }
    if (p > d) {
      const bonus = winBonus(p, d, player.length);
      return finish({ outcome: "win", mult: bonus.mult, text: bonus.text, big: bonus.mult >= 4 });
    }
    if (p === d) {
      return finish({ outcome: "push", text: p === 21 ? "💀 Égalité à 21 : duel de shots." : p === 20 ? "🍺 Égalité à 20 : distribuez 5 gorgées chacun." : "🃏 Égalité : tout le monde boit 2 gorgées." });
    }
    return finish({ outcome: "lose", text: `${losingHandSanction(p)} + le croupier gagnant te donne un shot.` });
  }

  function finish({ outcome, mult = 0, text, big = false }) {
    const lines = [text];
    let tone = "info";
    let title = "";
    let choices = [];

    if (outcome === "win") {
      let payout = bet.amount * mult;
      if (bet.allIn) {
        payout *= 2;
        lines.push("🔥 ALL IN réussi : gain doublé.");
      }
      ctx.wallet.add(payout);
      title = `Gagné ! +${formatChips(payout)} jetons`;
      tone = big ? "gold" : "win";
      if (doubled) lines.push("💪 Double réussi.");
      if (big) {
        sound.jackpot();
        cinematic("BLACKJACK", `+${formatChips(payout)} jetons`, "gold");
        goldRain(25);
        ctx.wallet.announce(`a gagné ${formatChips(payout)} jetons au blackjack !`, "gold");
      } else {
        sound.win();
      }
    } else if (outcome === "push") {
      ctx.wallet.add(bet.amount);
      title = "Égalité : mise rendue";
      tone = "push";
    } else {
      title = outcome === "bust" ? `Sauté à ${total(player)} ! -${formatChips(bet.amount)} jetons` : `Perdu ! -${formatChips(bet.amount)} jetons`;
      tone = "lose";
      if (doubled) lines.push("💀 Double raté : double shot en plus.");
      if (bet.allIn) lines.push("⚠️ ALL IN raté : sanction doublée.");
      sound.lose();
      choices = ctx.sanctionChoices();
    }

    state = "idle";
    bet = null;
    setButtons();
    showResult(resultBox, { title, lines, tone, choices });
  }

  dealBtn.addEventListener("click", deal);
  hitBtn.addEventListener("click", hit);
  standBtn.addEventListener("click", stand);
  doubleBtn.addEventListener("click", doubleDown);

  newShoe();
  render();
  setButtons();
  showResult(resultBox, { title: "Le croupier t'attend", lines: ["Choisis ta mise puis clique sur « Distribuer »."], tone: "info" });

  // Le solde change (gain, vol…) : on réévalue la possibilité de doubler.
  return { refresh: setButtons };
}
