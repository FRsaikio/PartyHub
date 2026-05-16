
import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "../../../firebase.js";


async function partyhubV25ReturnEveryoneToLobby() {
  if (!roomCode || roomCode === "----") return;
  try {
    const roomRef = doc(db, "rooms", roomCode);
    await updateDoc(roomRef, {
      gameStarted: false,
      roomStatus: "lobby",
      screen: "lobby",
      activeGame: null,
      gameState: {},
      forceNavigation: { target: "lobby", at: Date.now() },
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("V25 retour lobby poker non synchronisé :", error);
  }
}

const params = new URLSearchParams(window.location.search);

const savedPartyHubData = (() => {
  try { return JSON.parse(localStorage.getItem("partyhubGameData") || "{}"); }
  catch { return {}; }
})();

const roomCode =
  params.get("room") ||
  params.get("code") ||
  savedPartyHubData.roomCode ||
  localStorage.getItem("partyhubRoomCode") ||
  localStorage.getItem("partyhubRoomId") ||
  "LOCAL";

document.getElementById("roomCodeLabel").textContent = roomCode;
document.getElementById("backCasino").href = `../../../index.html?room=${encodeURIComponent(roomCode)}`;
document.getElementById("backCasino").addEventListener("click", () => {
  localStorage.setItem("partyhubReturnLobby", "true");
  partyhubV25ReturnEveryoneToLobby();
});

const partyhubRoomRef = doc(db, "rooms", roomCode);
onSnapshot(partyhubRoomRef, (snapshot) => {
  if (!snapshot.exists()) return;
  const data = snapshot.data();
  if (data.gameStarted === false || data.forceNavigation?.target === "lobby") {
    localStorage.setItem("partyhubReturnLobby", "true");
    window.location.href = `../../../index.html?room=${encodeURIComponent(roomCode)}`;
  }
});

const pokerRef = doc(db, "rooms", roomCode, "casinoPoker", "state");

const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const MAX_PLAYERS = 4;

const pokerPlayerKey = `casinoPokerPlayerId_${roomCode}`;
let activePokerPlayerId = localStorage.getItem(pokerPlayerKey) || "";
let lastPokerState = null;

const profileId =
  localStorage.getItem("partyhubProfileId") ||
  localStorage.getItem("profileId") ||
  `guest_${Math.random().toString(36).slice(2)}`;

const profileCache = (() => {
  try { return JSON.parse(localStorage.getItem("partyhubProfileCache") || "{}"); }
  catch { return {}; }
})();

const me = {
  id: profileId,
  name: profileCache.name || profileCache.pseudo || localStorage.getItem("partyhubPseudo") || "Joueur",
  avatar: profileCache.avatar || "🎲",
  chips: 1000,
  state: "ready",
  bet: 0,
  totalBet: 0,
  folded: false,
  allIn: false,
  hasActed: false,
  cards: [],
  blind: ""
};

const ranks = [
  {label:"A", value:14}, {label:"2", value:2}, {label:"3", value:3}, {label:"4", value:4},
  {label:"5", value:5}, {label:"6", value:6}, {label:"7", value:7}, {label:"8", value:8},
  {label:"9", value:9}, {label:"10", value:10}, {label:"J", value:11}, {label:"Q", value:12}, {label:"K", value:13}
];

const suits = ["♠","♥","♦","♣"];
const phases = ["preflop", "flop", "turn", "river"];

function createDeck(){
  const deck = [];
  for(const suit of suits){
    for(const rank of ranks){
      deck.push({...rank, suit, code:`${rank.label}${suit}`});
    }
  }
  return deck.sort(()=>Math.random()-0.5);
}

function draw(deck){ return deck.pop(); }

function cardHtml(card, hidden=false, slot=false){
  if(slot) return `<div class="playing-card card-slot"><div class="card-center">♠</div></div>`;
  if(hidden || !card) return `<div class="playing-card card-back"><div class="card-center">🎰</div></div>`;

  const red = card.suit === "♥" || card.suit === "♦" ? " red" : "";
  return `
    <div class="playing-card${red}">
      <div>${card.label}${card.suit}</div>
      <div class="card-center">${card.suit}</div>
      <div class="card-bottom">${card.label}${card.suit}</div>
    </div>
  `;
}

function renderCards(el, cards, hidden=false){
  el.innerHTML = cards.map(card => cardHtml(card, hidden)).join("");
}

function renderCommunity(cards){
  const filled = [...cards];
  while(filled.length < 5) filled.push(null);
  document.getElementById("communityCards").innerHTML = filled.map(card => {
    if(card) return cardHtml(card);
    return cardHtml(null, false, true);
  }).join("");
}

function evaluateHand(cards){
  const values = cards.map(c=>c.value).sort((a,b)=>b-a);
  const suitsCount = {};
  const valueCount = {};

  for(const c of cards){
    suitsCount[c.suit] = (suitsCount[c.suit] || 0) + 1;
    valueCount[c.value] = (valueCount[c.value] || 0) + 1;
  }

  const flushSuit = Object.keys(suitsCount).find(s => suitsCount[s] >= 5);
  const unique = [...new Set(values)].sort((a,b)=>b-a);
  if(unique.includes(14)) unique.push(1);

  let straightHigh = 0;
  for(let i=0;i<=unique.length-5;i++){
    const slice = unique.slice(i,i+5);
    if(slice[0]-slice[4] === 4) straightHigh = Math.max(straightHigh, slice[0]);
  }

  let straightFlushHigh = 0;
  if(flushSuit){
    const flushCards = cards.filter(c=>c.suit === flushSuit);
    const flushUnique = [...new Set(flushCards.map(c=>c.value).sort((a,b)=>b-a))];
    if(flushUnique.includes(14)) flushUnique.push(1);
    for(let i=0;i<=flushUnique.length-5;i++){
      const slice = flushUnique.slice(i,i+5);
      if(slice[0]-slice[4] === 4) straightFlushHigh = Math.max(straightFlushHigh, slice[0]);
    }
  }

  const counts = Object.entries(valueCount)
    .map(([v,c])=>({value:Number(v), count:c}))
    .sort((a,b)=>b.count-a.count || b.value-a.value);

  if(straightFlushHigh === 14) return {name:"Royal Flush", strength:10, punishment:"👑 BAD BEAT HELL : tout le monde boit avec toi."};
  if(straightFlushHigh) return {name:"Quinte Flush", strength:9, punishment:"☠️ Le gagnant choisit ta punition."};
  if(counts[0]?.count === 4) return {name:"Carré", strength:8, punishment:"🍺 Simple shot malgré la défaite."};
  if(counts[0]?.count === 3 && counts[1]?.count >= 2) return {name:"Full House", strength:7, punishment:"💣 Défi humiliation + shot."};
  if(flushSuit) return {name:"Couleur", strength:6, punishment:"🍺 Demi-verre cul sec."};
  if(straightHigh) return {name:"Suite", strength:5, punishment:"🔥 Distribue 10 gorgées."};
  if(counts[0]?.count === 3) return {name:"Brelan", strength:4, punishment:"🔥 Shot collectif avec les perdants."};
  if(counts[0]?.count === 2 && counts[1]?.count === 2) return {name:"Double Paire", strength:3, punishment:"🍺 Bois avec ton voisin."};
  if(counts[0]?.count === 2) return {name:"Paire", strength:2, punishment:"🍺 5 gorgées."};
  return {name:"Carte Haute", strength:1, punishment:"💀 DOUBLE SHOT."};
}

function handScore(hand, cards){
  const kickers = cards.map(c => c.value).sort((a,b)=>b-a).slice(0,5);
  return hand.strength * 100000000 + kickers.reduce((sum, v, i) => sum + v * Math.pow(15, 4-i), 0);
}

async function ensureState(){
  const snap = await getDoc(pokerRef);
  if(!snap.exists()){
    await setDoc(pokerRef, freshState("Table créée. Les joueurs peuvent rejoindre."));
  }
}

function freshState(message){
  return {
    players:{},
    deck:[],
    community:[],
    pot:0,
    phase:"waiting",
    currentBet:BIG_BLIND,
    dealerIndex:-1,
    activePlayerId:null,
    lastAggressorId:null,
    message,
    updatedAt:serverTimestamp()
  };
}

async function patchState(patch){
  await updateDoc(pokerRef, {...patch, updatedAt:serverTimestamp()});
}

function getPlayerIds(players){
  return Object.keys(players).slice(0, MAX_PLAYERS);
}

function activePlayers(players){
  return getPlayerIds(players).filter(id => {
    const p = players[id];
    return p && !p.folded && !p.allIn && p.cards?.length === 2;
  });
}

function remainingPlayers(players){
  return getPlayerIds(players).filter(id => {
    const p = players[id];
    return p && !p.folded && p.cards?.length === 2;
  });
}

function nextActivePlayerId(players, currentId){
  const ids = getPlayerIds(players);
  if(!ids.length) return null;
  const start = currentId ? ids.indexOf(currentId) : -1;

  for(let step=1; step<=ids.length; step++){
    const id = ids[(start + step + ids.length) % ids.length];
    const p = players[id];
    if(p && !p.folded && !p.allIn && p.cards?.length === 2) return id;
  }
  return null;
}

function isBettingRoundComplete(players, currentBet){
  const ids = remainingPlayers(players);
  if(ids.length <= 1) return true;

  return ids.every(id => {
    const p = players[id];
    return p.allIn || (p.hasActed && (p.bet || 0) === currentBet);
  });
}

function resetRoundBets(players){
  Object.keys(players).forEach(id => {
    players[id].bet = 0;
    players[id].hasActed = false;
    if(players[id].cards?.length && !players[id].folded && !players[id].allIn){
      players[id].state = "playing";
    }
  });
}

function phaseLabel(phase){
  return {
    waiting:"Attente",
    preflop:"Pré-flop",
    flop:"Flop",
    turn:"Turn",
    river:"River",
    reveal:"Reveal"
  }[phase] || phase;
}

function getRaiseAmount(){
  return Math.max(BIG_BLIND, Number(document.getElementById("betAmount").value || 40));
}

async function joinTable(){
  localStorage.setItem(pokerPlayerKey, me.id);
  activePokerPlayerId = me.id;
  await ensureState();

  const snap = await getDoc(pokerRef);
  const state = snap.data();
  const players = state.players || {};
  const ids = Object.keys(players);

  if(!players[me.id] && ids.length >= MAX_PLAYERS){
    document.getElementById("actionResult").textContent = "Table complète : 4 joueurs max.";
    return;
  }

  players[me.id] = {
    ...me,
    ...(players[me.id] || {}),
    name:me.name,
    avatar:me.avatar,
    state:"ready"
  };

  if(state.phase === "waiting"){
    players[me.id].cards = [];
    players[me.id].folded = false;
    players[me.id].allIn = false;
    players[me.id].bet = 0;
    players[me.id].totalBet = players[me.id].totalBet || 0;
    players[me.id].blind = "";
    players[me.id].hasActed = false;
  }

  await patchState({players, message:`${me.name} rejoint la table.`});
}

async function hardResetPokerTable(){
  const snap = await getDoc(pokerRef);
  const state = snap.exists() ? snap.data() : {};
  const players = state.players || {};

  Object.keys(players).forEach(id => {
    players[id].cards = [];
    players[id].bet = 0;
    players[id].blind = "";
    players[id].folded = false;
    players[id].allIn = false;
    players[id].hasActed = false;
    players[id].state = "ready";
  });

  await setDoc(pokerRef, {
    players,
    deck:[],
    community:[],
    pot:0,
    phase:"waiting",
    currentBet:BIG_BLIND,
    dealerIndex:-1,
    activePlayerId:null,
    lastAggressorId:null,
    message:"Table réinitialisée. Les joueurs doivent rejoindre avant de distribuer.",
    updatedAt:serverTimestamp()
  }, { merge:false });
}

async function deal(){
  const snap = await getDoc(pokerRef);
  const state = snap.data();
  const players = state.players || {};
  const ids = getPlayerIds(players);

  if(ids.length < 2){
    await patchState({message:"Il faut au moins 2 joueurs pour jouer au poker."});
    return;
  }

  let deck = createDeck();
  let pot = 0;

  const dealerIndex = ((state.dealerIndex ?? -1) + 1) % ids.length;
  const sbIndex = (dealerIndex + 1) % ids.length;
  const bbIndex = (dealerIndex + 2) % ids.length;

  for(const [index,id] of ids.entries()){
    const p = players[id];

    p.cards = [draw(deck), draw(deck)];
    p.folded = false;
    p.allIn = false;
    p.hasActed = false;
    p.bet = 0;
    p.totalBet = 0;
    p.blind = "";
    p.state = "playing";
    p.chips = p.chips ?? 1000;

    if(index === dealerIndex) p.blind = "D";

    if(index === sbIndex){
      const pay = Math.min(SMALL_BLIND, p.chips);
      p.chips -= pay;
      p.bet += pay;
      p.totalBet += pay;
      p.blind = p.blind ? `${p.blind} / SB` : "SB";
      pot += pay;
    }

    if(index === bbIndex){
      const pay = Math.min(BIG_BLIND, p.chips);
      p.chips -= pay;
      p.bet += pay;
      p.totalBet += pay;
      p.blind = p.blind ? `${p.blind} / BB` : "BB";
      pot += pay;
    }
  }

  const firstToAct = ids[(bbIndex + 1) % ids.length];

  await patchState({
    players,
    deck,
    community:[],
    pot,
    phase:"preflop",
    currentBet:BIG_BLIND,
    dealerIndex,
    activePlayerId:firstToAct,
    lastAggressorId:ids[bbIndex],
    message:`Pré-flop. SB ${SMALL_BLIND}, BB ${BIG_BLIND}. À ${players[firstToAct]?.name || "un joueur"} de parler.`
  });
}

async function maybeAdvanceRound(state, players){
  const remaining = remainingPlayers(players);
  if(remaining.length === 1){
    const winnerId = remaining[0];
    players[winnerId].chips = (players[winnerId].chips || 0) + (state.pot || 0);
    players[winnerId].state = "winner";

    await patchState({
      players,
      pot:0,
      phase:"waiting",
      currentBet:BIG_BLIND,
      activePlayerId:null,
      lastAggressorId:null,
      message:`👑 ${players[winnerId].name} gagne le pot car tous les autres se sont couchés. Aucun reveal : les joueurs couchés ne prennent pas de punition.`
    });
    return true;
  }

  if(!isBettingRoundComplete(players, state.currentBet || 0)){
    const nextId = nextActivePlayerId(players, state.activePlayerId);
    await patchState({
      players,
      activePlayerId:nextId,
      message:`À ${players[nextId]?.name || "un joueur"} de parler.`
    });
    return true;
  }

  // betting round finished: host/dealer reveals next street
  Object.keys(players).forEach(id => {
    players[id].hasActed = false;
    players[id].state = players[id].folded ? "fold" : players[id].allIn ? "all in" : "waiting next card";
  });

  await patchState({
    players,
    activePlayerId:null,
    currentBet:0,
    lastAggressorId:null,
    message:`Tour de mise terminé. Clique sur ${state.phase === "preflop" ? "Flop" : state.phase === "flop" ? "Turn" : state.phase === "turn" ? "River" : "Reveal"}.`
  });

  return true;
}

async function playerAction(type){
  const snap = await getDoc(pokerRef);
  const state = snap.data();
  const players = state.players || {};
  const p = players[me.id];

  if(!p) return;
  if(state.activePlayerId !== me.id){
    document.getElementById("actionResult").textContent = "Ce n’est pas ton tour.";
    return;
  }

  let message = "";
  const currentBet = state.currentBet || 0;
  const toCall = Math.max(0, currentBet - (p.bet || 0));

  if(type === "check"){
    if(toCall > 0){
      document.getElementById("actionResult").textContent = "Parole impossible : tu dois suivre, relancer, tapis ou te coucher.";
      return;
    }
    p.hasActed = true;
    p.state = "parole";
    message = `${p.name} fait parole.`;
  }

  if(type === "fold"){
    p.folded = true;
    p.hasActed = true;
    p.state = "couché";
    message = `${p.name} se couche. Il abandonne le pot et ne prendra pas de punition au reveal.`;
  }

  if(type === "call"){
    if(toCall <= 0){
      p.hasActed = true;
      p.state = "parole";
      message = `${p.name} fait parole.`;
    }else{
      const realAmount = Math.min(toCall, p.chips);
      p.chips -= realAmount;
      p.bet += realAmount;
      p.totalBet += realAmount;
      state.pot = (state.pot || 0) + realAmount;
      if(p.chips <= 0) p.allIn = true;
      p.hasActed = true;
      p.state = p.allIn ? "tapis" : "suivi";
      message = `${p.name} suit ${realAmount}.`;
    }
  }

  if(type === "raise"){
    const raiseTo = getRaiseAmount();
    if(raiseTo <= currentBet){
      document.getElementById("actionResult").textContent = `Relance impossible : tu dois relancer au-dessus de ${currentBet}.`;
      return;
    }

    const need = Math.max(0, raiseTo - (p.bet || 0));
    const realAmount = Math.min(need, p.chips);

    p.chips -= realAmount;
    p.bet += realAmount;
    p.totalBet += realAmount;
    state.pot = (state.pot || 0) + realAmount;
    state.currentBet = p.bet;
    state.lastAggressorId = p.id;
    p.hasActed = true;
    p.state = "relance";

    Object.keys(players).forEach(id => {
      if(id !== p.id && !players[id].folded && !players[id].allIn && players[id].cards?.length === 2){
        players[id].hasActed = false;
      }
    });

    message = `${p.name} relance à ${p.bet}.`;
  }

  if(type === "allin"){
    const amount = p.chips;
    p.bet += amount;
    p.totalBet += amount;
    state.pot = (state.pot || 0) + amount;
    p.chips = 0;
    p.allIn = true;
    p.hasActed = true;
    p.state = "tapis";

    if(p.bet > currentBet){
      state.currentBet = p.bet;
      state.lastAggressorId = p.id;

      Object.keys(players).forEach(id => {
        if(id !== p.id && !players[id].folded && !players[id].allIn && players[id].cards?.length === 2){
          players[id].hasActed = false;
        }
      });
    }

    message = `${p.name} fait TAPIS.`;
  }

  players[me.id] = p;

  await patchState({
    players,
    pot:state.pot,
    currentBet:state.currentBet,
    lastAggressorId:state.lastAggressorId,
    message
  });

  const updatedSnap = await getDoc(pokerRef);
  await maybeAdvanceRound(updatedSnap.data(), updatedSnap.data().players || {});
}

async function revealStage(stage){
  const snap = await getDoc(pokerRef);
  const state = snap.data();

  if(state.activePlayerId){
    await patchState({message:"Impossible : un tour de mise est encore en cours."});
    return;
  }

  let deck = state.deck || [];
  let community = state.community || [];

  if(stage === "flop"){
    if(state.phase !== "preflop"){
      await patchState({message:"Le Flop se révèle juste après le pré-flop."});
      return;
    }
    community = [draw(deck), draw(deck), draw(deck)];
  }

  if(stage === "turn"){
    if(state.phase !== "flop" || community.length !== 3){
      await patchState({message:"Il faut d’abord finir le tour de mise du Flop."});
      return;
    }
    community.push(draw(deck));
  }

  if(stage === "river"){
    if(state.phase !== "turn" || community.length !== 4){
      await patchState({message:"Il faut d’abord finir le tour de mise du Turn."});
      return;
    }
    community.push(draw(deck));
  }

  const players = state.players || {};
  resetRoundBets(players);

  const ids = getPlayerIds(players);
  const dealerIndex = state.dealerIndex ?? 0;
  const first = nextActivePlayerId(players, ids[dealerIndex]);

  await patchState({
    players,
    deck,
    community,
    phase:stage,
    currentBet:0,
    activePlayerId:first,
    lastAggressorId:null,
    message:`${stage.toUpperCase()} révélé (${community.length}/5). À ${players[first]?.name || "un joueur"} de parler.`
  });
}

async function revealFinal(){
  const snap = await getDoc(pokerRef);
  const state = snap.data();
  const players = state.players || {};
  const community = state.community || [];

  if(state.activePlayerId){
    await patchState({message:"Impossible : le dernier tour de mise n’est pas terminé."});
    return;
  }

  if(community.length < 5){
    await patchState({message:"Reveal impossible : il faut d’abord sortir les 5 cartes communes."});
    return;
  }

  const active = Object.values(players).filter(p => !p.folded && p.cards?.length === 2);

  const ranked = active.map(p => {
    const allCards = [...(p.cards || []), ...community];
    const hand = evaluateHand(allCards);
    return {...p, hand, score:handScore(hand, allCards)};
  }).sort((a,b)=>b.score-a.score);

  const winner = ranked[0];
  if(!winner) return;

  players[winner.id].chips = (players[winner.id].chips || 0) + (state.pot || 0);
  players[winner.id].state = "winner";

  const punishments = ranked.slice(1).map(p => `💀 ${p.name} perd avec ${p.hand.name} : ${p.hand.punishment}`);
  const foldedCount = Object.values(players).filter(p => p.folded).length;

  let finalMessage = `👑 ${winner.name} gagne avec ${winner.hand.name} et récupère le pot.`;
  finalMessage += punishments.length
    ? ` ${punishments.join(" | ")}`
    : " Aucun perdant actif à punir.";

  if(foldedCount > 0){
    finalMessage += ` Joueurs couchés : ${foldedCount}, aucune punition pour eux.`;
  }

  await patchState({
    players,
    phase:"reveal",
    pot:0,
    currentBet:BIG_BLIND,
    activePlayerId:null,
    lastAggressorId:null,
    message:finalMessage
  });
}

function renderPlayerPicker(players){
  const myCardsBox = document.getElementById("myCards");
  const existing = document.getElementById("playerPicker");
  if(existing) existing.remove();

  const candidates = Object.values(players || {}).filter(p => p.cards?.length);
  if(!candidates.length) return;

  const picker = document.createElement("div");
  picker.id = "playerPicker";
  picker.className = "mobile-player-picker";

  picker.innerHTML = candidates.map(p => `
    <button type="button" data-player-id="${p.id}">
      👤 Voir mes cartes : ${p.name || "Joueur"}
    </button>
  `).join("");

  picker.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      activePokerPlayerId = btn.dataset.playerId;
      localStorage.setItem(pokerPlayerKey, activePokerPlayerId);
      render(lastPokerState);
    });
  });

  myCardsBox.parentElement.appendChild(picker);
}

function renderSeats(players, phase, activePlayerId){
  const seats = ["seat1","seat2","seat3","seat4"];
  const list = Object.values(players || {}).slice(0,MAX_PLAYERS);

  seats.forEach((seatId, i)=>{
    const el = document.getElementById(seatId);
    const p = list[i];

    if(!p){
      el.innerHTML = `<div class="avatar">➕</div><div class="name">Place libre</div><div class="state">En attente</div>`;
      return;
    }

    const showCards = phase === "reveal";
    const cardsToDisplay = phase === "waiting" ? [] : (p.cards || []);
    const blind = p.blind ? `<div class="blind-badge">${p.blind}</div>` : "";
    const active = p.id === activePlayerId ? `<div class="blind-badge">À parler</div>` : "";

    el.innerHTML = `
      <div class="avatar">${p.avatar || "🎲"}</div>
      <div class="name">${p.name || "Joueur"}</div>
      <div class="chips">💰 ${p.chips ?? 0}</div>
      ${blind} ${active}
      <div class="state">${p.state || "waiting"} ${p.bet ? "• mise " + p.bet : ""}</div>
      <div class="cards-row">${cardsToDisplay.map(c => cardHtml(c, !showCards)).join("")}</div>
    `;
  });
}

function updatePhase(phase){
  const ids = ["phasePreflop","phaseFlop","phaseTurn","phaseRiver","phaseReveal"];
  ids.forEach(id => document.getElementById(id).classList.remove("active"));

  const map = {
    waiting:"phasePreflop",
    preflop:"phasePreflop",
    flop:"phaseFlop",
    turn:"phaseTurn",
    river:"phaseRiver",
    reveal:"phaseReveal"
  };

  document.getElementById(map[phase] || "phasePreflop").classList.add("active");
}

function updateActionButtons(state, currentMe){
  const toCall = currentMe ? Math.max(0, (state.currentBet || 0) - (currentMe.bet || 0)) : 0;
  const isMyTurn = currentMe && state.activePlayerId === currentMe.id;

  document.getElementById("checkBtn").disabled = !isMyTurn || toCall > 0;
  document.getElementById("callBtn").disabled = !isMyTurn || toCall <= 0;
  document.getElementById("raiseBtn").disabled = !isMyTurn;
  document.getElementById("foldBtn").disabled = !isMyTurn;
  document.getElementById("allInBtn").disabled = !isMyTurn;
}

function render(state){
  lastPokerState = state;
  const players = state.players || {};

  const savedPlayerId = localStorage.getItem(pokerPlayerKey) || activePokerPlayerId || "";
  let currentMe = savedPlayerId ? players[savedPlayerId] : players[me.id];

  if(savedPlayerId && !players[savedPlayerId]){
    localStorage.removeItem(pokerPlayerKey);
    activePokerPlayerId = "";
    currentMe = players[me.id];
  }

  document.getElementById("potValue").textContent = state.pot || 0;
  document.getElementById("tableStatus").textContent = state.message || "Table active.";
  document.getElementById("currentBetDisplay").value = state.currentBet || 0;
  document.getElementById("turnLabel").textContent = state.activePlayerId && players[state.activePlayerId]
    ? `À parler : ${players[state.activePlayerId].name}`
    : `Phase : ${phaseLabel(state.phase)}`;

  renderCommunity(state.phase === "waiting" ? [] : (state.community || []));
  renderSeats(players, state.phase, state.activePlayerId);
  updatePhase(state.phase);
  updateActionButtons(state, currentMe);

  if(state.phase !== "waiting" && currentMe?.cards?.length){
    const picker = document.getElementById("playerPicker");
    if(picker) picker.remove();

    renderCards(document.getElementById("myCards"), currentMe.cards, false);

    const availableCards = [...(currentMe.cards || []), ...(state.community || [])];

    if(availableCards.length >= 5){
      const hand = evaluateHand(availableCards);
      document.getElementById("myHandLabel").textContent = `${hand.name} — ${hand.punishment}`;
    }else{
      document.getElementById("myHandLabel").textContent = "Tes cartes privées : toi seul les vois sur cet appareil.";
    }
  }else{
    document.getElementById("myCards").innerHTML = "";
    document.getElementById("myHandLabel").textContent = "Rejoins la table puis attends la distribution.";
    renderPlayerPicker(players);
  }

  document.getElementById("actionResult").textContent = state.message || "En attente.";
}

document.getElementById("joinBtn").addEventListener("click", joinTable);
document.getElementById("dealBtn").addEventListener("click", deal);
document.getElementById("resetTableBtn").addEventListener("click", hardResetPokerTable);
document.getElementById("checkBtn").addEventListener("click", ()=>playerAction("check"));
document.getElementById("callBtn").addEventListener("click", ()=>playerAction("call"));
document.getElementById("raiseBtn").addEventListener("click", ()=>playerAction("raise"));
document.getElementById("foldBtn").addEventListener("click", ()=>playerAction("fold"));
document.getElementById("allInBtn").addEventListener("click", ()=>playerAction("allin"));
document.getElementById("flopBtn").addEventListener("click", ()=>revealStage("flop"));
document.getElementById("turnBtn").addEventListener("click", ()=>revealStage("turn"));
document.getElementById("riverBtn").addEventListener("click", ()=>revealStage("river"));
document.getElementById("revealBtn").addEventListener("click", revealFinal);

await ensureState();

onSnapshot(pokerRef, snap => {
  if(snap.exists()) render(snap.data());
});
