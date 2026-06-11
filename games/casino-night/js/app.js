
// V25 PartyHub sync: retour lobby global depuis ce jeu non-module.
async function partyhubV25ReturnEveryoneToLobby(roomCode) {
  if (!roomCode || roomCode === "----") return;
  try {
    const mod = await import("../../firebase.js");
    const roomRef = mod.doc(mod.db, "rooms", roomCode);
    await mod.updateDoc(roomRef, {
      gameStarted: false,
      roomStatus: "lobby",
      screen: "lobby",
      activeGame: null,
      gameState: {},
      forceNavigation: { target: "lobby", at: Date.now() },
      updatedAt: mod.serverTimestamp()
    });
  } catch (error) {
    console.warn("V25 retour lobby global non synchronisé :", error);
  }
}

function partyhubV25ListenLobbyNavigation(roomCode) {
  if (!roomCode || roomCode === "----") return;
  import("../../firebase.js").then((mod) => {
    const roomRef = mod.doc(mod.db, "rooms", roomCode);
    mod.onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.gameStarted === false || data.forceNavigation?.target === "lobby") {
        localStorage.setItem("partyhubReturnLobby", "true");
    partyhubV25ReturnEveryoneToLobby(roomCode);
        window.location.href = `../../index.html?room=${encodeURIComponent(roomCode)}`;
      }
    });
  }).catch(() => {});
}



// =======================
// SOUND SYSTEM
// =======================

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type="sine", volume=0.05){
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioCtx.currentTime + duration
  );

  osc.stop(audioCtx.currentTime + duration);
}

function spinSound(){
  let i = 0;
  const interval = setInterval(()=>{
    playTone(180 + Math.random()*120, 0.08, "square", 0.03);
    i++;
    if(i > 18){
      clearInterval(interval);
    }
  }, 70);
}

function jackpotSound(){
  playTone(523,0.2,"triangle",0.08);
  setTimeout(()=>playTone(659,0.2,"triangle",0.08),120);
  setTimeout(()=>playTone(784,0.35,"triangle",0.1),240);
}

function alarmSound(){
  let on = false;
  let count = 0;

  const interval = setInterval(()=>{
    playTone(on ? 220 : 420,0.18,"sawtooth",0.06);
    on = !on;
    count++;

    if(count > 7){
      clearInterval(interval);
    }
  },180);
}

function cardSound(){
  playTone(300,0.05,"triangle",0.03);
}

function loseSound(){
  playTone(160,0.4,"sawtooth",0.07);
}

function allInSound(){
  playTone(250,0.15,"square",0.05);
  setTimeout(()=>playTone(400,0.15,"square",0.05),150);
  setTimeout(()=>playTone(550,0.25,"square",0.08),300);
}


// =======================
// CASINO BANK
// =======================

let chips = 1000;
let shields = 0;
let allInMode = false;

const chipsEl = document.getElementById("chips");
const shieldsEl = document.getElementById("shields");
const statusEl = document.getElementById("status");
const betInput = document.getElementById("betInput");

function updateBank(){
  chipsEl.textContent = chips;
  shieldsEl.textContent = shields;
  statusEl.textContent = chips <= 0 ? "Ruine totale" : allInMode ? "ALL IN actif" : "En vie";
}

function getBet(){
  let bet = Number(betInput.value || 100);
  if(bet < 50) bet = 50;
  if(bet > chips) bet = chips;
  return bet;
}

function changeChips(amount){
  chips += amount;
  if(chips < 0) chips = 0;
  updateBank();
}

document.getElementById("allInBtn").addEventListener("click", ()=>{
  allInSound();
  allInMode = true;
  betInput.value = chips;
  updateBank();
});

document.getElementById("buyShieldBtn").addEventListener("click", ()=>{
  if(chips >= 300){
    chips -= 300;
    shields += 1;
    updateBank();
  }else{
    alert("Pas assez de jetons pour acheter une protection.");
  }
});

// =======================
// MACHINE A SOUS PREMIUM
// =======================

const symbols = ["💀","🔥","🍺","👑","💣","😈","🚨","🃏","7️⃣"];

const slotEls = [
  document.getElementById("slot1"),
  document.getElementById("slot2"),
  document.getElementById("slot3")
];

const slotMachine = document.getElementById("slotMachine");
const slotResult = document.getElementById("slotResult");

const slotPunishments = {
  "7️⃣7️⃣7️⃣":"☠️ 777 INFERNAL : tout le monde cul sec sauf toi. Gain x10.",
  "💀💀💀":"💀 CUL SEC + relance obligatoire. Perte x3.",
  "🔥🔥🔥":"🔥 Tout le monde shot. Gain x4.",
  "🍺🍺🍺":"🍺 Distribue 20 gorgées. Gain x3.",
  "👑👑👑":"👑 Couronne noire : immunité + vole 300 jetons.",
  "💣💣💣":"💣 Bombe totale : défi humiliation ou double shot.",
  "😈😈😈":"😈 Mode démon : tu bois à chaque rire pendant 7 minutes.",
  "🚨🚨🚨":"🚨 Contrôle casino : dernier à toucher son tel = cul sec.",
  "🃏🃏🃏":"🃏 Joker maudit : invente une règle, mais tu subis aussi la prochaine sanction.",
  "💣🔥💀":"☠️ TRIPLE CHAOS : shot + défi + relance forcée.",
  "👑💀👑":"👑 VIP empoisonné : choisis une victime, elle boit avec toi.",
  "🚨🔥💀":"🚨 Dernier à lever son téléphone : double shot.",
  "🃏🍺💀":"🍺 Choisis un duo : ils finissent un verre ensemble.",
  "💣👑💀":"💀 ALL IN TRAP : utilise une protection ou cul sec.",
  "🔥💀🔥":"🔥 Casino meltdown : tout le monde boit, toi tu relances.",
  "7️⃣💀7️⃣":"☠️ Faux jackpot : tu gagnes 500 jetons mais tu prends un shot.",
  "7️⃣👑7️⃣":"👑 Jackpot royal : vole 500 jetons et distribue 10 gorgées."
};

const failPunishments = [
  "💀 Mauvaise combinaison : shot immédiat.",
  "🔥 Double shot pour le lanceur.",
  "🍺 Bois avec le voisin de gauche.",
  "🍺 Bois avec le voisin de droite.",
  "😈 Tu bois à chaque prénom entendu pendant 2 minutes.",
  "💣 Défi humiliation obligatoire.",
  "🚨 Le plus sobre boit avec toi.",
  "🃏 Choisis quelqu’un : il partage ta sanction.",
  "☠️ Tu perds ta prochaine immunité et tu bois.",
  "👑 Le joueur avec le plus de jetons te donne une punition.",
  "🔥 Tout le monde vote : tu bois ou tu fais boire ? Si égalité, les deux.",
  "💀 Tu dois rejouer immédiatement. Si tu reperds : cul sec.",
  "😈 Tu finis chaque phrase par « casino » pendant 5 minutes. Oubli = gorgée.",
  "🚨 Dernier à crier JACKPOT boit avec toi.",
  "💣 Tu perds 200 jetons ou tu prends un double shot."
];

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function animateReel(el, finalSymbol, duration){
  const start = Date.now();
  while(Date.now() - start < duration){
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    await sleep(55);
  }
  el.textContent = finalSymbol;
}

document.getElementById("spinBtn").addEventListener("click", async ()=>{
  spinSound();
  if(chips <= 0){
    slotResult.textContent = "💀 Tu n'as plus de jetons. Casino terminé.";
    return;
  }

  const bet = getBet();
  changeChips(-bet);

  slotMachine.classList.add("spinning");
  slotMachine.classList.remove("jackpot", "rare");
  slotResult.textContent = "🎰 Les rouleaux tournent...";

  const result = [
    symbols[Math.floor(Math.random()*symbols.length)],
    symbols[Math.floor(Math.random()*symbols.length)],
    symbols[Math.floor(Math.random()*symbols.length)]
  ];

  await Promise.all([
    animateReel(slotEls[0], result[0], 850),
    animateReel(slotEls[1], result[1], 1300),
    animateReel(slotEls[2], result[2], 1800)
  ]);

  slotMachine.classList.remove("spinning");

  const combo = result.join("");
  let text = slotPunishments[combo];
  let reward = 0;

  if(combo === "7️⃣7️⃣7️⃣"){
    reward = bet * 10;
    slotMachine.classList.add("jackpot");
    jackpotSound();
  }else if(result[0] === result[1] && result[1] === result[2]){
    reward = bet * 3;
    slotMachine.classList.add("rare");
    alarmSound();
  }else if(text){
    reward = Math.floor(bet * 1.5);
    slotMachine.classList.add("rare");
    alarmSound();
  }else{
    text = failPunishments[Math.floor(Math.random()*failPunishments.length)];
  }

  if(allInMode){
    text += " | ⚠️ ALL IN : sanction doublée si tu perds, récompense doublée si tu gagnes.";
    reward *= 2;
    allInMode = false;
  }

  if(reward > 0){
    changeChips(reward);
    text += ` | 💰 Gain : +${reward} jetons.`;
  }else{
    updateBank();
  }

  slotResult.textContent = text;
});

// =======================
// BLACKJACK PREMIUM
// =======================

let playerCards = [];
let dealerCards = [];
let gameOver = false;
let doubled = false;
let currentBet = 0;
let blackjackAllIn = false;
let finalPenalty = '';

const suits = ["♠", "♥", "♦", "♣"];
const ranks = [
  {label:"A", value:1},
  {label:"2", value:2},
  {label:"3", value:3},
  {label:"4", value:4},
  {label:"5", value:5},
  {label:"6", value:6},
  {label:"7", value:7},
  {label:"8", value:8},
  {label:"9", value:9},
  {label:"10", value:10},
  {label:"J", value:10},
  {label:"Q", value:10},
  {label:"K", value:10}
];

function drawCard(){
  const rank = ranks[Math.floor(Math.random()*ranks.length)];
  const suit = suits[Math.floor(Math.random()*suits.length)];
  return { ...rank, suit };
}

function total(cards){
  let sum = cards.reduce((acc, card)=>acc + card.value, 0);
  const aces = cards.filter(card => card.label === "A").length;
  let upgraded = 0;

  while(upgraded < aces && sum + 10 <= 21){
    sum += 10;
    upgraded++;
  }

  return sum;
}

function renderCard(card){
  const div = document.createElement("div");
  div.className = "playing-card";
  if(card.suit === "♥" || card.suit === "♦"){
    div.classList.add("red");
  }

  div.innerHTML = `
    <div class="card-top">${card.label}${card.suit}</div>
    <div class="card-center">${card.suit}</div>
    <div class="card-bottom">${card.label}${card.suit}</div>
  `;

  return div;
}

function renderCards(containerId, cards, hideSecond=false){
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  cards.forEach((card,index) => {

    if(hideSecond && index === 1 && !gameOver && cards.length === 2){

      const hidden = document.createElement("div");
      hidden.className = "playing-card card-back";
      hidden.innerHTML = "<div class='card-center'>🎰</div>";

      container.appendChild(hidden);

    }else{
      container.appendChild(renderCard(card));
    }
  });
}

function updateBlackjackUI(){
  renderCards("playerCards", playerCards, false);

  const shouldHideDealerCard = dealerCards.length === 2 && gameOver === false;

  renderCards(
    "dealerCards",
    dealerCards,
    shouldHideDealerCard
  );

  document.getElementById("playerTotal").textContent = total(playerCards);
  document.getElementById("dealerTotal").textContent = shouldHideDealerCard ? "?" : total(dealerCards);
}

function isBlackjack(cards){
  return cards.length === 2 && total(cards) === 21;
}

function isDoubleAce(cards){
  return cards.length === 2 && cards[0].label === "A" && cards[1].label === "A";
}

function openingPunishment(score){
  const map = {
    20:"👑 Départ à 20 : tu peux annuler une sanction.",
    19:"🍺 Départ à 19 : choisis un duo, ils boivent ensemble.",
    18:"🔥 Départ à 18 : distribue 10 gorgées.",
    17:"🃏 Départ à 17 : force quelqu’un à reprendre une carte dans son prochain tour.",
    16:"💀 Départ à 16 : reprends une carte OU shot.",
    15:"🍺 Départ à 15 : bois avec le voisin de ton choix.",
    14:"🚨 Départ à 14 : le plus sobre boit.",
    13:"😈 Départ à 13 : tu bois à chaque rire pendant 3 minutes.",
    12:"☠️ Départ à 12 : verre cul sec.",
    11:"🔥 Départ à 11 : double shot.",
    10:"🍺 Départ à 10 : shot simple.",
    9:"🃏 Départ à 9 : mini défi humiliation."
  };

  if(score <= 8){
    return "💀 Départ à 8 ou moins : le casino te méprise, hit obligatoire.";
  }

  return map[score] || "🃏 Main neutre : joue ta vie.";
}

function finalHandPunishment(score, cardCount){
  if(score > 21){
    if(score === 22) return "🔥 Main finale 22 : double shot.";
    if(score === 23) return "🍺 Main finale 23 : bois avec ton voisin.";
    if(score === 24) return "😈 Main finale 24 : le dernier à rire boit avec toi.";
    if(score === 25) return "☠️ Main finale 25 : verre cul sec.";
    if(score <= 27) return "🚨 Main finale 26-27 : tu bois à chaque prénom entendu pendant 5 minutes.";
    if(score <= 29) return "💣 Main finale 28-29 : défi humiliation obligatoire.";
    return "☠️ Main finale 30+ : chaque joueur te donne une sanction.";
  }

  if(score === 21){
    if(cardCount === 3) return "🔥 21 en 3 cartes : distribue 15 gorgées.";
    if(cardCount === 4) return "💀 21 en 4 cartes : choisis une victime pour double shot.";
    return "👑 21 en 5 cartes : distribue 25 gorgées.";
  }

  const map = {
    20:"👑 Main finale 20 : distribue 20 gorgées.",
    19:"🍺 Main finale 19 : choisis un duo, ils boivent ensemble.",
    18:"🔥 Main finale 18 : distribue 10 gorgées.",
    17:"🃏 Main finale 17 : le dernier à parler boit.",
    16:"💀 Main finale 16 : double shot.",
    15:"🍺 Main finale 15 : bois avec le voisin de ton choix.",
    14:"🚨 Main finale 14 : le plus sobre boit.",
    13:"😈 Main finale 13 : tu bois à chaque rire pendant 3 minutes.",
    12:"☠️ Main finale 12 : verre cul sec.",
    11:"🔥 Main finale 11 : double shot.",
    10:"🍺 Main finale 10 : shot simple.",
    9:"🃏 Main finale 9 : mini défi humiliation.",
    8:"💀 Main finale 8 : shot + prochain tour sans protection.",
    7:"🍺 Main finale 7 : bois 7 gorgées.",
    6:"🚨 Main finale 6 : le dernier à lever la main boit avec toi.",
    5:"😈 Main finale 5 : parle avec un accent 5 minutes.",
    4:"💣 Main finale 4 : choisis quelqu’un, vous buvez ensemble.",
    3:"☠️ Main finale 3 : humiliation obligatoire.",
    2:"🔥 Main finale 2 : double shot ridicule."
  };

  return map[score] || "💀 Main finale faible : shot.";
}

function applyBlackjackBet(multiplier, text){
  const bet = currentBet || getBet();

  if(multiplier > 0){
    let payout = bet * multiplier;

    // ALL IN blackjack = payout doublé en cas de victoire.
    // Exemple : mise 700, victoire x2 => 2800 récupérés au lieu de 1400.
    if(blackjackAllIn){
      payout *= 2;
      text += " | 🔥 ALL IN RÉUSSI : payout doublé.";
    }

    changeChips(payout);
    blackjackAllIn = false;
    return `${text} | 💰 +${payout} jetons.`;
  }

  if(multiplier < 0){
    blackjackAllIn = false;
    return `${text} | 💸 Mise perdue : -${bet} jetons.`;
  }

  blackjackAllIn = false;
  return text;
}

document.getElementById("startBtn").addEventListener("click", ()=>{
  if(chips <= 0){
    document.getElementById("blackjackResult").textContent = "💀 Tu es ruiné. Le casino a gagné.";
    return;
  }

  currentBet = getBet();
  blackjackAllIn = currentBet === chips || blackjackAllIn;
  changeChips(-currentBet);

  playerCards = [drawCard(), drawCard()];
  dealerCards = [drawCard(), drawCard()];
  gameOver = false;
  doubled = false;
  finalPenalty = '';
  allInMode = false;

  updateBlackjackUI();

  const p = total(playerCards);
  let msg = "";

  if(isBlackjack(playerCards)){
    let payout = currentBet * 3;
    if(blackjackAllIn){
      payout *= 2;
      msg = `🃏 VRAI BLACKJACK : distribue 20 gorgées. | 🔥 ALL IN RÉUSSI : payout doublé. | 💰 +${payout} jetons.`;
    }else{
      msg = `🃏 VRAI BLACKJACK : distribue 20 gorgées. | 💰 +${payout} jetons.`;
    }
    changeChips(payout);
    blackjackAllIn = false;
    gameOver = true;
  }else{
    msg = `🃏 Main de départ : ${p}. Joue ta manche, la punition sera décidée à la fin si tu perds.`;
  }

  document.getElementById("blackjackResult").textContent = msg;
});

document.getElementById("hitBtn").addEventListener("click", ()=>{
  if(gameOver) return;

  playerCards.push(drawCard());
  cardSound();
  updateBlackjackUI();

  const p = total(playerCards);
  let msg = "";

  if(p === 21){
    gameOver = true;
    if(playerCards.length === 3){
      msg = applyBlackjackBet(2, "🔥 21 EN 3 CARTES : distribue 15 gorgées.");
    }else if(playerCards.length === 4){
      msg = applyBlackjackBet(3, "💀 21 EN 4 CARTES : choisis une victime pour double shot.");
    }else{
      msg = applyBlackjackBet(4, "👑 21 EN 5 CARTES : immunité totale 3 tours.");
    }
  }else if(p > 21){
    gameOver = true;

    if(shields > 0){
      shields--;
      updateBank();
      msg = "🛡️ Protection utilisée : sanction annulée, mais ta manche est perdue.";
    }else if(p === 22){
      msg = applyBlackjackBet(-1, "🔥 22 EXACT : double shot.");
    }else if(p === 23){
      msg = applyBlackjackBet(-1, "🍺 23 : bois avec ton voisin.");
    }else if(p === 24){
      msg = applyBlackjackBet(-1, "😈 24 : le dernier à rire boit avec toi.");
    }else if(p === 25){
      msg = applyBlackjackBet(-2, "☠️ 25 : verre cul sec.");
    }else if(p <= 27){
      msg = applyBlackjackBet(-2, "🚨 26-27 : tu bois à chaque prénom entendu pendant 5 minutes.");
    }else if(p <= 29){
      msg = applyBlackjackBet(-2, "💣 28-29 : défi humiliation obligatoire.");
    }else{
      msg = applyBlackjackBet(-3, "☠️ 30+ CASINO COLLAPSE : chaque joueur te donne une sanction.");
    }
  }else{
    msg = "🃏 Carte tirée. Le casino observe...";
  }

  document.getElementById("blackjackResult").textContent = msg;
});

document.getElementById("doubleBtn").addEventListener("click", ()=>{
  if(gameOver || doubled) return;

  const bet = currentBet || getBet();
  if(chips < bet){
    document.getElementById("blackjackResult").textContent = "💸 Pas assez de jetons pour doubler.";
    return;
  }

  doubled = true;
  changeChips(-bet);
  currentBet += bet;
  playerCards.push(drawCard());
  cardSound();
  updateBlackjackUI();

  const p = total(playerCards);
  let msg = "";

  if(p > 21){
    gameOver = true;
    loseSound();
    blackjackAllIn = false;
    msg = "💀 DOUBLE RATÉ : double shot + mise perdue.";
  }else{
    msg = "🔥 Double engagé : maintenant tu dois Stand.";
  }

  document.getElementById("blackjackResult").textContent = msg;
});

document.getElementById("standBtn").addEventListener("click", ()=>{

  if(gameOver) return;

  while(total(dealerCards) < 17){
    dealerCards.push(drawCard());
    cardSound();
  }

  // Important : on termine la manche AVANT d'afficher la banque,
  // comme ça la carte cachée disparaît et toutes les vraies cartes s'affichent.
  gameOver = true;
  updateBlackjackUI();

  const p = total(playerCards);
  const d = total(dealerCards);
  let msg = "";

  if(isBlackjack(dealerCards)){
    msg = applyBlackjackBet(-2, "🏦 BANQUE BLACKJACK : tout le monde boit.");
  }else if(d > 21){
    if(d > 25){
      msg = applyBlackjackBet(3, "☠️ Banque bust >25 : le casino explose, tout le monde cul sec.");
    }else{
      msg = applyBlackjackBet(2, "🔥 Banque bust : shot collectif.");
    }
  }else if(p > d){
    if(p === 21 && d === 20){
      msg = applyBlackjackBet(5, "👑 21 vs 20 : CASINO JACKPOT, tout le monde boit sauf toi.");
    }else if(p === 20 && d === 19){
      msg = applyBlackjackBet(4, "🔥 20 vs 19 : distribue 15 gorgées.");
    }else if(p === 19 && d === 18){
      msg = applyBlackjackBet(3, "🍺 19 vs 18 : choisis deux victimes.");
    }else if(p === 18 && d === 17){
      msg = applyBlackjackBet(2, "🚨 18 vs 17 : le plus riche boit.");
    }else if(p === 17 && d === 16){
      msg = applyBlackjackBet(2, "🃏 17 vs 16 : tu peux relancer la banque pour doubler les sanctions.");
    }else{
      msg = applyBlackjackBet(2, "🔥 Victoire simple : distribue des gorgées.");
    }

    if(doubled){
      msg += " | 🔥 Double réussi : ta mise a été doublée.";
    }
  }else if(p === d){
    if(p === 21){
      msg = "💀 Egalité à 21 : duel shot.";
    }else if(p === 20){
      msg = "🍺 Egalité à 20 : distribuez 5 gorgées chacun.";
    }else{
      msg = "🃏 Petite égalité : tout le monde boit 2 gorgées.";
    }
  }else{
    if(shields > 0){
      shields--;
      updateBank();
      msg = "🛡️ Protection utilisée : défaite annulée.";
    }else{
      loseSound();
      const playerFinalPenalty = finalHandPunishment(p, playerCards.length);
      msg = applyBlackjackBet(-1, "💀 Défaite contre la banque :");
      msg += ` | ☠️ Double punition obligatoire : [Ta main finale] ${playerFinalPenalty} + [Croupier gagnant] shot.`;
      if(doubled){
        msg += " | 💀 Double raté : double shot.";
      }
    }
  }

  document.getElementById("blackjackResult").textContent = msg;
});

updateBank();


// =======================
// CINEMATIC EFFECTS
// =======================

const overlay = document.createElement("div");
overlay.className = "fx-overlay";
overlay.innerHTML = `
  <div class="fx-title" id="fxTitle">JACKPOT</div>
  <div class="fx-sub" id="fxSub">Le casino devient fou...</div>
`;

document.body.appendChild(overlay);

const rain = document.createElement("div");
rain.className = "gold-rain";
document.body.appendChild(rain);

function createGoldRain(){

  rain.innerHTML = "";

  for(let i=0;i<55;i++){

    const coin = document.createElement("div");
    coin.className = "coin";
    coin.textContent = "💰";

    coin.style.left = Math.random()*100 + "vw";
    coin.style.animationDuration = (2 + Math.random()*2) + "s";
    coin.style.opacity = 0.6 + Math.random()*0.4;

    rain.appendChild(coin);
  }

  setTimeout(()=>{
    rain.innerHTML = "";
  },5000);
}

function cinematic(title, sub, type="normal"){

  const fxTitle = document.getElementById("fxTitle");
  const fxSub = document.getElementById("fxSub");

  fxTitle.textContent = title;
  fxSub.textContent = sub;

  overlay.className = "fx-overlay active";

  document.body.classList.add("shake-screen");

  if(type === "red"){
    overlay.classList.add("red");
  }

  if(type === "glitch"){
    fxTitle.classList.add("glitch");
  }

  if(navigator.vibrate){
    navigator.vibrate([120,80,120,80,180]);
  }

  setTimeout(()=>{
    overlay.classList.remove("active","red");
    fxTitle.classList.remove("glitch");
    document.body.classList.remove("shake-screen");
  },3500);
}


// PREMIUM PARTICLES / SMOKE

const particles = document.createElement("div");
particles.className = "particles";
document.body.appendChild(particles);

for(let i=0;i<45;i++){
  const p = document.createElement("div");
  p.className = "particle";
  p.style.left = Math.random()*100 + "vw";
  p.style.animationDuration = (6 + Math.random()*8) + "s";
  p.style.animationDelay = Math.random()*5 + "s";
  particles.appendChild(p);
}

for(let i=0;i<6;i++){
  const smoke = document.createElement("div");
  smoke.className = "smoke";
  smoke.style.left = Math.random()*100 + "vw";
  smoke.style.animationDelay = Math.random()*10 + "s";
  document.body.appendChild(smoke);
}

function fallingCards(){

  for(let i=0;i<18;i++){

    const c = document.createElement("div");
    c.className = "falling-card";

    const icons = ["🂡","🂮","🂱","🃁","🂫","🃑"];
    c.textContent = icons[Math.floor(Math.random()*icons.length)];

    c.style.left = Math.random()*100 + "vw";
    c.style.animationDuration = (3 + Math.random()*3) + "s";
    c.style.animationDelay = Math.random()*1.5 + "s";

    document.body.appendChild(c);

    setTimeout(()=>{
      c.remove();
    },7000);
  }
}


// =======================
// PARTYHUB ROOM LINK
// =======================

(function keepPartyHubRoomInCasinoLinks(){
  const params = new URLSearchParams(window.location.search);
  const roomCode =
    params.get("room") ||
    params.get("code") ||
    localStorage.getItem("partyhubRoomCode") ||
    localStorage.getItem("partyhubRoomId") ||
    localStorage.getItem("currentRoomCode");

  const pokerBtn = document.getElementById("pokerNightBtn");

  if(pokerBtn && roomCode){
    pokerBtn.href = `poker/index.html?room=${encodeURIComponent(roomCode)}`;
  }
})();

// =======================
// DICE OF THE DEVIL
// =======================

function diceText(n){
  return ["","⚀","⚁","⚂","⚃","⚄","⚅"][n];
}

const exactDicePunishments = {
  "1-1":"☠️ Snake Eyes : cul sec + relance obligatoire.",
  "2-2":"🍺 Double 2 : bois avec tes deux voisins.",
  "3-3":"😈 Double 3 : tu bois à chaque rire pendant 3 minutes.",
  "4-4":"💣 Double 4 : défi humiliation obligatoire.",
  "5-5":"🔥 Double 5 : tout le monde shot.",
  "6-6":"👑 Devil Jackpot : distribue 25 gorgées.",
  "1-6":"😈 Le démon : tu bois à chaque prénom entendu pendant 5 minutes.",
  "6-1":"😈 Le démon : tu bois à chaque prénom entendu pendant 5 minutes.",
  "2-5":"🍺 Shot partagé avec la personne de ton choix.",
  "5-2":"🍺 Shot partagé avec la personne de ton choix.",
  "3-4":"💣 Défi humiliation.",
  "4-3":"💣 Défi humiliation.",
  "1-2":"💀 Mini enfer : double shot.",
  "2-1":"💀 Mini enfer : double shot.",
  "1-3":"🚨 Le dernier à lever la main boit.",
  "3-1":"🚨 Le dernier à lever la main boit.",
  "1-4":"🍺 Bois 8 gorgées.",
  "4-1":"🍺 Bois 8 gorgées.",
  "1-5":"🔥 Shot + choisis quelqu’un qui boit avec toi.",
  "5-1":"🔥 Shot + choisis quelqu’un qui boit avec toi.",
  "2-3":"😈 Parle avec un accent pendant 5 minutes.",
  "3-2":"😈 Parle avec un accent pendant 5 minutes.",
  "2-4":"💀 Verre cul sec ou double shot.",
  "4-2":"💀 Verre cul sec ou double shot.",
  "2-6":"👑 Distribue 12 gorgées.",
  "6-2":"👑 Distribue 12 gorgées.",
  "3-5":"🚨 Tout le monde vote : tu bois ou tu désignes une victime.",
  "5-3":"🚨 Tout le monde vote : tu bois ou tu désignes une victime.",
  "3-6":"🔥 Shot collectif avec les perdants du dernier jeu.",
  "6-3":"🔥 Shot collectif avec les perdants du dernier jeu.",
  "4-5":"☠️ Casino taxe : perds 300 jetons ou prends un shot.",
  "5-4":"☠️ Casino taxe : perds 300 jetons ou prends un shot.",
  "4-6":"💣 Mission impossible : fais rire quelqu’un, sinon shot.",
  "6-4":"💣 Mission impossible : fais rire quelqu’un, sinon shot.",
  "5-6":"👑 Tu gagnes 500 jetons mais tu bois.",
  "6-5":"👑 Tu gagnes 500 jetons mais tu bois."
};

const rollDiceBtn = document.getElementById("rollDiceBtn");

if(rollDiceBtn){
  rollDiceBtn.addEventListener("click", async ()=>{

    const dice1 = document.getElementById("dice1");
    const dice2 = document.getElementById("dice2");

    dice1.classList.add("dice-critical");
    dice2.classList.add("dice-critical");

    for(let i=0;i<14;i++){
      dice1.textContent = diceText(Math.floor(Math.random()*6)+1);
      dice2.textContent = diceText(Math.floor(Math.random()*6)+1);
      await sleep(70);
    }

    const d1 = Math.floor(Math.random()*6)+1;
    const d2 = Math.floor(Math.random()*6)+1;

    dice1.textContent = diceText(d1);
    dice2.textContent = diceText(d2);

    setTimeout(()=>{
      dice1.classList.remove("dice-critical");
      dice2.classList.remove("dice-critical");
    },900);

    const combo = `${d1}-${d2}`;
    const totalDice = d1+d2;
    let result = exactDicePunishments[combo] || "🍺 Bois 5 gorgées.";

    if(totalDice === 7){
      result += " | 🎰 Total 7 : tu rejoues ou tu bois double.";
    }

    if(d1 === d2){
      cinematic("DOUBLE DÉS", "LE CASINO REGARDE", "red");
      alarmSound();
    }

    if(combo === "6-6"){
      jackpotSound();
      createGoldRain();
    }

    document.getElementById("diceResult").textContent = result;
  });
}


// =======================
// RETURN TO PARTYHUB ROOM
// =======================

(function setupReturnToPartyHubRoom(){
  const btn = document.getElementById("backPartyHub");
  if(!btn) return;

  const params = new URLSearchParams(window.location.search);

  const savedGameData = (() => {
    try { return JSON.parse(localStorage.getItem("partyhubGameData") || "{}"); }
    catch { return {}; }
  })();

  const roomCode =
    params.get("room") ||
    params.get("code") ||
    savedGameData.roomCode ||
    localStorage.getItem("partyhubRoomCode") ||
    localStorage.getItem("partyhubRoomId") ||
    "";

  if(roomCode){
    btn.href = `../../index.html?room=${encodeURIComponent(roomCode)}`;
  }else{
    btn.href = "../../index.html";
  }

  btn.addEventListener("click", () => {
    localStorage.setItem("partyhubReturnLobby", "true");
    partyhubV25ReturnEveryoneToLobby(roomCode);

    if(roomCode && savedGameData){
      partyhubV25ListenLobbyNavigation(roomCode);
      savedGameData.roomCode = roomCode;
      localStorage.setItem("partyhubGameData", JSON.stringify(savedGameData));
    }
  });
})();
