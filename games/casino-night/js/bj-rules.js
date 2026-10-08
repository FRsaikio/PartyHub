// Règles du blackjack partagées par le mode solo (blackjack.js) et la table
// multijoueur (bj-table.js) : valeur des cartes, sabot, sanctions, règlement d'une main.
//
// Une carte = { rank: "A"…"K", suit: "♠♥♦♣" }. La table la stocke en texte
// compact (« 10♥ ») via cardCode / parseCard.

export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const DECKS = 4;
export const MAX_HANDS = 4;

export const value = rank => (rank === "A" ? 1 : ["J", "Q", "K"].includes(rank) ? 10 : Number(rank));

export function total(cards) {
  let sum = cards.reduce((acc, card) => acc + value(card.rank), 0);
  const aces = cards.filter(card => card.rank === "A").length;
  for (let i = 0; i < aces && sum + 10 <= 21; i++) sum += 10;
  return sum;
}

export const isBlackjack = cards => cards.length === 2 && total(cards) === 21;

export const cardCode = card => `${card.rank}${card.suit}`;
export const parseCard = code => ({ rank: code.slice(0, -1), suit: code.slice(-1) });

// Nouveau sabot mélangé (Fisher-Yates).
export function freshShoe() {
  const shoe = [];
  for (let d = 0; d < DECKS; d++) {
    for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit });
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

// ---------- Sanctions ----------

export function bustSanction(score) {
  if (score === 22) return "🔥 22 pile : un shot (ou 5 gorgées).";
  if (score === 23) return "🍺 23 : bois avec ton voisin.";
  if (score === 24) return "😈 24 : le dernier à rire boit avec toi.";
  if (score === 25) return "☠️ 25 : demi-verre cul sec.";
  if (score <= 27) return "🚨 26-27 : jusqu'à ta prochaine main, tu bois 1 gorgée à chaque prénom prononcé.";
  if (score <= 29) return "💣 28-29 : gage choisi par la table.";
  return "☠️ 30+ CASINO COLLAPSE : chaque joueur te donne 1 gorgée.";
}

export function losingHandSanction(score) {
  const map = {
    20: "👑 Main finale 20 : distribue 4 gorgées.",
    19: "🍺 Main finale 19 : choisis un duo, ils boivent ensemble.",
    18: "🔥 Main finale 18 : distribue 3 gorgées.",
    17: "🃏 Main finale 17 : le dernier à parler boit.",
    16: "💀 Main finale 16 : un shot.",
    15: "🍺 Main finale 15 : bois avec le voisin de ton choix.",
    14: "🚨 Main finale 14 : le plus sobre boit.",
    13: "😈 Main finale 13 : jusqu'à ta prochaine main, tu bois 1 gorgée à chaque rire.",
    12: "☠️ Main finale 12 : demi-verre cul sec.",
    11: "🔥 Main finale 11 : un shot.",
    10: "🍺 Main finale 10 : 5 gorgées."
  };
  return map[score] || "💀 Main faible : 4 gorgées.";
}

// Bonus de victoire selon le score (multiplicateur, texte).
export function winBonus(player, dealer, cardCount) {
  if (player === 21 && cardCount >= 5) return { mult: 4, text: "👑 21 en 5 cartes : immunité totale 3 tours." };
  if (player === 21 && cardCount === 4) return { mult: 3, text: "💀 21 en 4 cartes : choisis une victime pour un shot." };
  if (player === 21 && dealer === 20) return { mult: 5, text: "👑 21 contre 20 : CASINO JACKPOT, tout le monde boit sauf toi." };
  if (player === 20 && dealer === 19) return { mult: 4, text: "🔥 20 contre 19 : distribue 8 gorgées." };
  if (player === 21 && cardCount === 3) return { mult: 2, text: "🔥 21 en 3 cartes : distribue 8 gorgées." };
  if (player === 19 && dealer === 18) return { mult: 3, text: "🍺 19 contre 18 : choisis deux victimes." };
  return { mult: 2, text: "🔥 Victoire : distribue des gorgées." };
}

// Règle une main face à la banque.
// hand = { cards, surrendered } ; naturals = { playerBJ, dealerBJ } si la manche s'arrête d'entrée.
// Renvoie { outcome: "win"|"push"|"lose"|"surrender", mult, text, big }.
export function resolveHand(hand, dealer, naturals = null) {
  const p = total(hand.cards);
  const d = total(dealer);

  if (naturals) {
    if (naturals.playerBJ && naturals.dealerBJ) return { outcome: "push", text: "🃏 Double blackjack : égalité, chacun boit 2 gorgées." };
    if (naturals.playerBJ) return { outcome: "win", mult: 3, text: "🃏 VRAI BLACKJACK : distribue 10 gorgées.", big: true };
    return { outcome: "lose", text: "🏦 Blackjack de la banque : tout le monde boit." };
  }
  if (hand.surrendered) return { outcome: "surrender", text: "🏳️ Abandon : la moitié de ta mise est rendue, tu bois 2 gorgées." };
  if (p > 21) return { outcome: "lose", text: bustSanction(p) };
  if (d > 21) {
    return d > 25
      ? { outcome: "win", mult: 3, text: "☠️ La banque explose (plus de 25) : tout le monde boit 3 gorgées.", big: true }
      : { outcome: "win", mult: 2, text: "🔥 La banque saute : shot collectif." };
  }
  if (p > d) {
    const bonus = winBonus(p, d, hand.cards.length);
    return { outcome: "win", mult: bonus.mult, text: bonus.text, big: bonus.mult >= 4 };
  }
  if (p === d) {
    return { outcome: "push", text: p === 21 ? "💀 Égalité à 21 : duel de shots." : p === 20 ? "🍺 Égalité à 20 : distribuez 5 gorgées chacun." : "🃏 Égalité : tout le monde boit 2 gorgées." };
  }
  return { outcome: "lose", text: `${losingHandSanction(p)} + le croupier gagnant te donne un shot.` };
}

// Ce que rapporte une main réglée (mise comprise). L'abandon est rendu à part.
export function handReturn(hand, result, allIn = false) {
  if (result.outcome === "win") return hand.bet * result.mult * (allIn ? 2 : 1);
  if (result.outcome === "push") return hand.bet;
  return 0;
}
