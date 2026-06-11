import {
  db,
  doc,
  updateDoc,
  onSnapshot
} from "../../firebase.js";

const backToLobbyBtn = document.getElementById("backToLobbyBtn");

const roomBadge = document.getElementById("roomBadge");
const categoryText = document.getElementById("categoryText");
const targetText = document.getElementById("targetText");
const punishmentText = document.getElementById("punishmentText");
const questionText = document.getElementById("questionText");
const instructionText = document.getElementById("instructionText");

const answerBtn = document.getElementById("answerBtn");
const drinkBtn = document.getElementById("drinkBtn");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");

const modeText = document.getElementById("modeText");
const drinkLevelText = document.getElementById("drinkLevelText");
const playersText = document.getElementById("playersText");
const questionCountText = document.getElementById("questionCountText");

const answerCounter = document.getElementById("answerCounter");
const drinkCounter = document.getElementById("drinkCounter");
const historyList = document.getElementById("historyList");

const questionCard = document.getElementById("questionCard");


function normalizePartyMode(value) {
  const key = String(value || "party").toLowerCase();
  if (key === "chill") return "Chill";
  if (key === "chaos") return "Chaos";
  if (key === "hardcore") return "Hardcore";
  return "Party";
}

const savedData = JSON.parse(localStorage.getItem("partyhubGameData"));

if (!savedData) {
  alert("Aucune partie trouvée.");
  window.location.href = "../../index.html";
}

let players = savedData.players || [];
const selectedPartyMode = normalizePartyMode(savedData.selectedPartyMode || "Party");
const drinkLevel = savedData.drinkLevel || "normal";
const roomCode = savedData.roomCode || "----";
const currentPlayer = savedData.currentPlayer || "";
const isHost = savedData.isHost === true;
const myProfileId = savedData.currentProfileId || localStorage.getItem("partyhubProfileId") || "";
const roomRef = doc(db, "rooms", roomCode);
let lastTruthActionId = null;

let currentQuestion = 1;
let answered = 0;
let drinks = 0;
let history = [];
let usedQuestions = [];
let currentTarget = null;
let currentPunishment = "";
let questionResolved = false;
let firstTruthStateChecked = false;

function getPlayerName(player) {
  return String(player?.name || player?.pseudo || player?.displayName || "").trim();
}

function getPlayerKey(player) {
  return String(player?.profileId || player?.id || player?.uid || getPlayerName(player)).trim().toLowerCase();
}

function getMyKey() {
  return String(myProfileId || currentPlayer || "").trim().toLowerCase();
}

function isSamePlayer(player) {
  const myKey = getMyKey();
  if (!player || !myKey) return false;
  const playerKey = getPlayerKey(player);
  const myName = String(currentPlayer || "").trim().toLowerCase();
  return playerKey === myKey || (!!myName && getPlayerName(player).toLowerCase() === myName);
}

function isTargetPlayer() {
  return !!currentTarget && isSamePlayer(currentTarget);
}

function updateTruthControls() {
  const targetCanAnswer = isTargetPlayer() && !questionResolved;
  const targetCanNext = isTargetPlayer() && questionResolved;
  const canNext = isHost || targetCanNext;

  answerBtn.disabled = !targetCanAnswer;
  drinkBtn.disabled = !targetCanAnswer;
  answerBtn.textContent = targetCanAnswer ? "🎤 Répondre" : (questionResolved ? "Réponse validée" : "Attente du joueur ciblé");
  drinkBtn.textContent = targetCanAnswer ? "🍺 Je bois" : (questionResolved ? "Action validée" : "Attente du joueur ciblé");
  nextQuestionBtn.disabled = !canNext;
  nextQuestionBtn.textContent = canNext ? "Question suivante 🔥" : "Attente du host";
}


const truthQuestions = {
  "Chill": [
    "Quelle petite honte assumable tu caches encore ?",
    "Quel est ton dernier stalk innocent ?",
    "Quelle appli devrait te retirer ton temps d’écran ?",
    "Quelle photo de toi te fait le plus rire ?",
    "Quelle est ta pire excuse pour annuler un plan ?",
    "Quel message as-tu déjà écrit puis supprimé ?",
    "Quelle habitude bizarre fais-tu quand personne ne regarde ?",
    "Quel est ton crush fictif le plus gênant ?",
    "Quelle chanson connais-tu par cœur mais tu n’assumes pas ?",
    "Quelle est la chose la plus inutile que tu gardes ?",
    "Quelle personne ici te connaît le mieux ?",
    "Quel est ton plus gros fail de cuisine ?",
    "Quelle est ta peur la plus ridicule ?",
    "Quel est ton talent inutile ?",
    "Quelle vérité soft personne ne devinerait sur toi ?",
    "Quelle est la dernière recherche Google honteuse que tu assumes ?",
    "Quel surnom gênant as-tu déjà eu ?",
    "Quelle est ta manie la plus visible ?",
    "Quel est ton plus gros moment de malaise gentil ?",
    "Quelle est la chose la plus enfantine que tu fais encore ?",
    "Qui ici te ferait survivre sans téléphone ?",
    "Quelle est la chose que tu procrastines depuis trop longtemps ?",
    "Quel est ton pire achat impulsif ?",
    "Quelle est ta plus grosse obsession du moment ?",
    "Quelle story as-tu déjà supprimée par honte ?",
    "Quel est le truc le plus gênant dans tes notes ?",
    "Quelle est ta pire phrase de drague soft ?",
    "Quelle est ta comfort food honteuse ?",
    "Quel est ton plus gros mensonge innocent ?",
    "Quelle est ta plus grosse réaction dramatique pour rien ?",
    "Quelle petite honte assumable tu caches encore  en soirée ?",
    "Quel est ton dernier stalk innocent  en soirée ?",
    "Quelle appli devrait te retirer ton temps d’écran  en soirée ?",
    "Quelle photo de toi te fait le plus rire  en soirée ?",
    "Quelle est ta pire excuse pour annuler un plan  en soirée ?",
    "Quel message as-tu déjà écrit puis supprimé  en soirée ?",
    "Quelle habitude bizarre fais-tu quand personne ne regarde  en soirée ?",
    "Quel est ton crush fictif le plus gênant  en soirée ?",
    "Quelle chanson connais-tu par cœur mais tu n’assumes pas  en soirée ?",
    "Quelle est la chose la plus inutile que tu gardes  en soirée ?",
    "Quelle personne ici te connaît le mieux  en soirée ?",
    "Quel est ton plus gros fail de cuisine  en soirée ?",
    "Quelle est ta peur la plus ridicule  en soirée ?",
    "Quel est ton talent inutile  en soirée ?",
    "Quelle vérité soft personne ne devinerait sur toi  en soirée ?",
    "Quelle est la dernière recherche Google honteuse que tu assumes  en soirée ?",
    "Quel surnom gênant as-tu déjà eu  en soirée ?",
    "Quelle est ta manie la plus visible  en soirée ?",
    "Quel est ton plus gros moment de malaise gentil  en soirée ?",
    "Quelle est la chose la plus enfantine que tu fais encore  en soirée ?",
    "Qui ici te ferait survivre sans téléphone  en soirée ?",
    "Quelle est la chose que tu procrastines depuis trop longtemps  en soirée ?",
    "Quel est ton pire achat impulsif  en soirée ?",
    "Quelle est ta plus grosse obsession du moment  en soirée ?",
    "Quelle story as-tu déjà supprimée par honte  en soirée ?",
    "Quel est le truc le plus gênant dans tes notes  en soirée ?",
    "Quelle est ta pire phrase de drague soft  en soirée ?",
    "Quelle est ta comfort food honteuse  en soirée ?",
    "Quel est ton plus gros mensonge innocent  en soirée ?",
    "Quelle est ta plus grosse réaction dramatique pour rien  en soirée ?",
    "Quelle petite honte assumable tu caches encore  avec tes potes ?",
    "Quel est ton dernier stalk innocent  avec tes potes ?",
    "Quelle appli devrait te retirer ton temps d’écran  avec tes potes ?",
    "Quelle photo de toi te fait le plus rire  avec tes potes ?",
    "Quelle est ta pire excuse pour annuler un plan  avec tes potes ?",
    "Quel message as-tu déjà écrit puis supprimé  avec tes potes ?",
    "Quelle habitude bizarre fais-tu quand personne ne regarde  avec tes potes ?",
    "Quel est ton crush fictif le plus gênant  avec tes potes ?",
    "Quelle chanson connais-tu par cœur mais tu n’assumes pas  avec tes potes ?",
    "Quelle est la chose la plus inutile que tu gardes  avec tes potes ?",
    "Quelle personne ici te connaît le mieux  avec tes potes ?",
    "Quel est ton plus gros fail de cuisine  avec tes potes ?",
    "Quelle est ta peur la plus ridicule  avec tes potes ?",
    "Quel est ton talent inutile  avec tes potes ?",
    "Quelle vérité soft personne ne devinerait sur toi  avec tes potes ?",
    "Quelle est la dernière recherche Google honteuse que tu assumes  avec tes potes ?",
    "Quel surnom gênant as-tu déjà eu  avec tes potes ?",
    "Quelle est ta manie la plus visible  avec tes potes ?",
    "Quel est ton plus gros moment de malaise gentil  avec tes potes ?",
    "Quelle est la chose la plus enfantine que tu fais encore  avec tes potes ?",
    "Qui ici te ferait survivre sans téléphone  avec tes potes ?",
    "Quelle est la chose que tu procrastines depuis trop longtemps  avec tes potes ?",
    "Quel est ton pire achat impulsif  avec tes potes ?",
    "Quelle est ta plus grosse obsession du moment  avec tes potes ?",
    "Quelle story as-tu déjà supprimée par honte  avec tes potes ?",
    "Quel est le truc le plus gênant dans tes notes  avec tes potes ?",
    "Quelle est ta pire phrase de drague soft  avec tes potes ?",
    "Quelle est ta comfort food honteuse  avec tes potes ?",
    "Quel est ton plus gros mensonge innocent  avec tes potes ?",
    "Quelle est ta plus grosse réaction dramatique pour rien  avec tes potes ?",
    "Quelle petite honte assumable tu caches encore  sur ton téléphone ?",
    "Quel est ton dernier stalk innocent  sur ton téléphone ?",
    "Quelle appli devrait te retirer ton temps d’écran  sur ton téléphone ?",
    "Quelle photo de toi te fait le plus rire  sur ton téléphone ?",
    "Quelle est ta pire excuse pour annuler un plan  sur ton téléphone ?",
    "Quel message as-tu déjà écrit puis supprimé  sur ton téléphone ?",
    "Quelle habitude bizarre fais-tu quand personne ne regarde  sur ton téléphone ?",
    "Quel est ton crush fictif le plus gênant  sur ton téléphone ?",
    "Quelle chanson connais-tu par cœur mais tu n’assumes pas  sur ton téléphone ?",
    "Quelle est la chose la plus inutile que tu gardes  sur ton téléphone ?",
    "Quelle personne ici te connaît le mieux  sur ton téléphone ?",
    "Quel est ton plus gros fail de cuisine  sur ton téléphone ?",
    "Quelle est ta peur la plus ridicule  sur ton téléphone ?",
    "Quel est ton talent inutile  sur ton téléphone ?",
    "Quelle vérité soft personne ne devinerait sur toi  sur ton téléphone ?",
    "Quelle est la dernière recherche Google honteuse que tu assumes  sur ton téléphone ?",
    "Quel surnom gênant as-tu déjà eu  sur ton téléphone ?",
    "Quelle est ta manie la plus visible  sur ton téléphone ?",
    "Quel est ton plus gros moment de malaise gentil  sur ton téléphone ?",
    "Quelle est la chose la plus enfantine que tu fais encore  sur ton téléphone ?",
    "Qui ici te ferait survivre sans téléphone  sur ton téléphone ?",
    "Quelle est la chose que tu procrastines depuis trop longtemps  sur ton téléphone ?",
    "Quel est ton pire achat impulsif  sur ton téléphone ?",
    "Quelle est ta plus grosse obsession du moment  sur ton téléphone ?",
    "Quelle story as-tu déjà supprimée par honte  sur ton téléphone ?",
    "Quel est le truc le plus gênant dans tes notes  sur ton téléphone ?",
    "Quelle est ta pire phrase de drague soft  sur ton téléphone ?",
    "Quelle est ta comfort food honteuse  sur ton téléphone ?",
    "Quel est ton plus gros mensonge innocent  sur ton téléphone ?",
    "Quelle est ta plus grosse réaction dramatique pour rien  sur ton téléphone ?"
  ],
  "Party": [
    "Quel est ton dernier message envoyé après minuit que tu regrettes ?",
    "Qui ici pourrait te faire craquer en soirée ?",
    "Quelle est ta pire décision prise bourré ?",
    "Quel est le truc le plus gênant que tu as fait en soirée ?",
    "Quelle personne as-tu déjà voulu embrasser sans oser ?",
    "Quelle est ta technique de drague la plus nulle ?",
    "Quel est ton pire lendemain de soirée ?",
    "Quelle est la personne que tu as voulu recontacter bourré ?",
    "Quel est ton plus gros mensonge pour sortir ?",
    "Quelle est ta pire story postée en soirée ?",
    "Quel est ton meilleur souvenir flou ?",
    "Quelle chanson te transforme en menace sur la piste ?",
    "Qui ici serait ton meilleur wingman ?",
    "Quelle est ta pire excuse après un date ?",
    "Quel est le truc le plus cringe que tu as dit à quelqu’un qui te plaisait ?",
    "Quelle soirée ne peux-tu pas raconter à tes parents ?",
    "Qui ici pourrait te convaincre de faire un after ?",
    "Quel est ton plus gros flirt raté ?",
    "Quelle est ta pire danse de soirée ?",
    "Quel est ton plus gros moment de confiance injustifiée ?",
    "Quel est ton pire date ?",
    "Quelle est la phrase la plus bourrée que tu as déjà dite ?",
    "Quel est ton plus gros regret de soirée ?",
    "Qui ici serait le pire partenaire d’after ?",
    "Quelle est la pire personne à qui tu as envoyé un message bourré ?",
    "Quel est ton plus gros moment de jalousie en soirée ?",
    "Quel est ton record de mauvaises décisions en une nuit ?",
    "Quelle est la chose la plus cringe que tu as faite pour attirer l’attention ?",
    "Quelle est ta pire tentative de danse sexy ?",
    "Quel est le truc le plus gênant qu’on pourrait trouver dans tes DM ?",
    "Quel est ton dernier message envoyé après minuit que tu regrettes  en soirée ?",
    "Qui ici pourrait te faire craquer en soirée  en soirée ?",
    "Quelle est ta pire décision prise bourré  en soirée ?",
    "Quel est le truc le plus gênant que tu as fait en soirée  en soirée ?",
    "Quelle personne as-tu déjà voulu embrasser sans oser  en soirée ?",
    "Quelle est ta technique de drague la plus nulle  en soirée ?",
    "Quel est ton pire lendemain de soirée  en soirée ?",
    "Quelle est la personne que tu as voulu recontacter bourré  en soirée ?",
    "Quel est ton plus gros mensonge pour sortir  en soirée ?",
    "Quelle est ta pire story postée en soirée  en soirée ?",
    "Quel est ton meilleur souvenir flou  en soirée ?",
    "Quelle chanson te transforme en menace sur la piste  en soirée ?",
    "Qui ici serait ton meilleur wingman  en soirée ?",
    "Quelle est ta pire excuse après un date  en soirée ?",
    "Quel est le truc le plus cringe que tu as dit à quelqu’un qui te plaisait  en soirée ?",
    "Quelle soirée ne peux-tu pas raconter à tes parents  en soirée ?",
    "Qui ici pourrait te convaincre de faire un after  en soirée ?",
    "Quel est ton plus gros flirt raté  en soirée ?",
    "Quelle est ta pire danse de soirée  en soirée ?",
    "Quel est ton plus gros moment de confiance injustifiée  en soirée ?",
    "Quel est ton pire date  en soirée ?",
    "Quelle est la phrase la plus bourrée que tu as déjà dite  en soirée ?",
    "Quel est ton plus gros regret de soirée  en soirée ?",
    "Qui ici serait le pire partenaire d’after  en soirée ?",
    "Quelle est la pire personne à qui tu as envoyé un message bourré  en soirée ?",
    "Quel est ton plus gros moment de jalousie en soirée  en soirée ?",
    "Quel est ton record de mauvaises décisions en une nuit  en soirée ?",
    "Quelle est la chose la plus cringe que tu as faite pour attirer l’attention  en soirée ?",
    "Quelle est ta pire tentative de danse sexy  en soirée ?",
    "Quel est le truc le plus gênant qu’on pourrait trouver dans tes DM  en soirée ?",
    "Quel est ton dernier message envoyé après minuit que tu regrettes  après trois verres ?",
    "Qui ici pourrait te faire craquer en soirée  après trois verres ?",
    "Quelle est ta pire décision prise bourré  après trois verres ?",
    "Quel est le truc le plus gênant que tu as fait en soirée  après trois verres ?",
    "Quelle personne as-tu déjà voulu embrasser sans oser  après trois verres ?",
    "Quelle est ta technique de drague la plus nulle  après trois verres ?",
    "Quel est ton pire lendemain de soirée  après trois verres ?",
    "Quelle est la personne que tu as voulu recontacter bourré  après trois verres ?",
    "Quel est ton plus gros mensonge pour sortir  après trois verres ?",
    "Quelle est ta pire story postée en soirée  après trois verres ?",
    "Quel est ton meilleur souvenir flou  après trois verres ?",
    "Quelle chanson te transforme en menace sur la piste  après trois verres ?",
    "Qui ici serait ton meilleur wingman  après trois verres ?",
    "Quelle est ta pire excuse après un date  après trois verres ?",
    "Quel est le truc le plus cringe que tu as dit à quelqu’un qui te plaisait  après trois verres ?",
    "Quelle soirée ne peux-tu pas raconter à tes parents  après trois verres ?",
    "Qui ici pourrait te convaincre de faire un after  après trois verres ?",
    "Quel est ton plus gros flirt raté  après trois verres ?",
    "Quelle est ta pire danse de soirée  après trois verres ?",
    "Quel est ton plus gros moment de confiance injustifiée  après trois verres ?",
    "Quel est ton pire date  après trois verres ?",
    "Quelle est la phrase la plus bourrée que tu as déjà dite  après trois verres ?",
    "Quel est ton plus gros regret de soirée  après trois verres ?",
    "Qui ici serait le pire partenaire d’after  après trois verres ?",
    "Quelle est la pire personne à qui tu as envoyé un message bourré  après trois verres ?",
    "Quel est ton plus gros moment de jalousie en soirée  après trois verres ?",
    "Quel est ton record de mauvaises décisions en une nuit  après trois verres ?",
    "Quelle est la chose la plus cringe que tu as faite pour attirer l’attention  après trois verres ?",
    "Quelle est ta pire tentative de danse sexy  après trois verres ?",
    "Quel est le truc le plus gênant qu’on pourrait trouver dans tes DM  après trois verres ?",
    "Quel est ton dernier message envoyé après minuit que tu regrettes  en club ?",
    "Qui ici pourrait te faire craquer en soirée  en club ?",
    "Quelle est ta pire décision prise bourré  en club ?",
    "Quel est le truc le plus gênant que tu as fait en soirée  en club ?",
    "Quelle personne as-tu déjà voulu embrasser sans oser  en club ?",
    "Quelle est ta technique de drague la plus nulle  en club ?",
    "Quel est ton pire lendemain de soirée  en club ?",
    "Quelle est la personne que tu as voulu recontacter bourré  en club ?",
    "Quel est ton plus gros mensonge pour sortir  en club ?",
    "Quelle est ta pire story postée en soirée  en club ?",
    "Quel est ton meilleur souvenir flou  en club ?",
    "Quelle chanson te transforme en menace sur la piste  en club ?",
    "Qui ici serait ton meilleur wingman  en club ?",
    "Quelle est ta pire excuse après un date  en club ?",
    "Quel est le truc le plus cringe que tu as dit à quelqu’un qui te plaisait  en club ?",
    "Quelle soirée ne peux-tu pas raconter à tes parents  en club ?",
    "Qui ici pourrait te convaincre de faire un after  en club ?",
    "Quel est ton plus gros flirt raté  en club ?",
    "Quelle est ta pire danse de soirée  en club ?",
    "Quel est ton plus gros moment de confiance injustifiée  en club ?",
    "Quel est ton pire date  en club ?",
    "Quelle est la phrase la plus bourrée que tu as déjà dite  en club ?",
    "Quel est ton plus gros regret de soirée  en club ?",
    "Qui ici serait le pire partenaire d’after  en club ?",
    "Quelle est la pire personne à qui tu as envoyé un message bourré  en club ?",
    "Quel est ton plus gros moment de jalousie en soirée  en club ?",
    "Quel est ton record de mauvaises décisions en une nuit  en club ?",
    "Quelle est la chose la plus cringe que tu as faite pour attirer l’attention  en club ?",
    "Quelle est ta pire tentative de danse sexy  en club ?",
    "Quel est le truc le plus gênant qu’on pourrait trouver dans tes DM  en club ?"
  ],
  "Chaos": [
    "Qui ici t’agace parfois sans le savoir ?",
    "Quel est ton plus gros mensonge récent ?",
    "Quelle vérité pourrait créer un malaise dans le groupe ?",
    "Quel secret as-tu déjà failli révéler bourré ?",
    "Quelle personne as-tu déjà ghostée sans vraie raison ?",
    "Quel est le pire truc que tu as dit sous alcool ?",
    "Quelle relation as-tu déjà sabotée tout seul ?",
    "Quel est ton plus gros red flag social ?",
    "Quelle est la chose la plus toxique que tu as déjà faite ?",
    "Quel message de toi pourrait te faire honte demain ?",
    "Quelle est ta pire opinion que tu évites de dire ?",
    "Qui ici te connaît moins bien qu’il le croit ?",
    "Quelle est la chose que tu caches le plus à tes potes ?",
    "Quel est ton plus gros moment de mauvaise foi ?",
    "Quelle personne as-tu déjà fait semblant d’aimer ?",
    "Quel est ton plus gros drama non résolu ?",
    "Quelle est ta plus grosse manipulation soft ?",
    "Quel est le pire truc que tu as déjà fait par jalousie ?",
    "Quelle confession pourrait changer l’ambiance ?",
    "Qui ici pourrait découvrir un truc bizarre sur toi ?",
    "Quelle promesse n’as-tu jamais tenue ?",
    "Quel est ton plus gros mensonge par omission ?",
    "Quelle conversation supprimerais-tu en premier ?",
    "Quel est ton plus gros acte de lâcheté sociale ?",
    "Quelle personne as-tu déjà stalkée beaucoup trop longtemps ?",
    "Quelle est ta pire excuse pour disparaître ?",
    "Quel est ton plus gros moment de honte relationnelle ?",
    "Qui ici aurait le plus de dossiers sur toi ?",
    "Quelle est ta pire décision prise pour plaire ?",
    "Quel est le truc le plus problématique dans ton historique ?",
    "Qui ici t’agace parfois sans le savoir  après minuit ?",
    "Quel est ton plus gros mensonge récent  après minuit ?",
    "Quelle vérité pourrait créer un malaise dans le groupe  après minuit ?",
    "Quel secret as-tu déjà failli révéler bourré  après minuit ?",
    "Quelle personne as-tu déjà ghostée sans vraie raison  après minuit ?",
    "Quel est le pire truc que tu as dit sous alcool  après minuit ?",
    "Quelle relation as-tu déjà sabotée tout seul  après minuit ?",
    "Quel est ton plus gros red flag social  après minuit ?",
    "Quelle est la chose la plus toxique que tu as déjà faite  après minuit ?",
    "Quel message de toi pourrait te faire honte demain  après minuit ?",
    "Quelle est ta pire opinion que tu évites de dire  après minuit ?",
    "Qui ici te connaît moins bien qu’il le croit  après minuit ?",
    "Quelle est la chose que tu caches le plus à tes potes  après minuit ?",
    "Quel est ton plus gros moment de mauvaise foi  après minuit ?",
    "Quelle personne as-tu déjà fait semblant d’aimer  après minuit ?",
    "Quel est ton plus gros drama non résolu  après minuit ?",
    "Quelle est ta plus grosse manipulation soft  après minuit ?",
    "Quel est le pire truc que tu as déjà fait par jalousie  après minuit ?",
    "Quelle confession pourrait changer l’ambiance  après minuit ?",
    "Qui ici pourrait découvrir un truc bizarre sur toi  après minuit ?",
    "Quelle promesse n’as-tu jamais tenue  après minuit ?",
    "Quel est ton plus gros mensonge par omission  après minuit ?",
    "Quelle conversation supprimerais-tu en premier  après minuit ?",
    "Quel est ton plus gros acte de lâcheté sociale  après minuit ?",
    "Quelle personne as-tu déjà stalkée beaucoup trop longtemps  après minuit ?",
    "Quelle est ta pire excuse pour disparaître  après minuit ?",
    "Quel est ton plus gros moment de honte relationnelle  après minuit ?",
    "Qui ici aurait le plus de dossiers sur toi  après minuit ?",
    "Quelle est ta pire décision prise pour plaire  après minuit ?",
    "Quel est le truc le plus problématique dans ton historique  après minuit ?",
    "Qui ici t’agace parfois sans le savoir  quand tu es jaloux ?",
    "Quel est ton plus gros mensonge récent  quand tu es jaloux ?",
    "Quelle vérité pourrait créer un malaise dans le groupe  quand tu es jaloux ?",
    "Quel secret as-tu déjà failli révéler bourré  quand tu es jaloux ?",
    "Quelle personne as-tu déjà ghostée sans vraie raison  quand tu es jaloux ?",
    "Quel est le pire truc que tu as dit sous alcool  quand tu es jaloux ?",
    "Quelle relation as-tu déjà sabotée tout seul  quand tu es jaloux ?",
    "Quel est ton plus gros red flag social  quand tu es jaloux ?",
    "Quelle est la chose la plus toxique que tu as déjà faite  quand tu es jaloux ?",
    "Quel message de toi pourrait te faire honte demain  quand tu es jaloux ?",
    "Quelle est ta pire opinion que tu évites de dire  quand tu es jaloux ?",
    "Qui ici te connaît moins bien qu’il le croit  quand tu es jaloux ?",
    "Quelle est la chose que tu caches le plus à tes potes  quand tu es jaloux ?",
    "Quel est ton plus gros moment de mauvaise foi  quand tu es jaloux ?",
    "Quelle personne as-tu déjà fait semblant d’aimer  quand tu es jaloux ?",
    "Quel est ton plus gros drama non résolu  quand tu es jaloux ?",
    "Quelle est ta plus grosse manipulation soft  quand tu es jaloux ?",
    "Quel est le pire truc que tu as déjà fait par jalousie  quand tu es jaloux ?",
    "Quelle confession pourrait changer l’ambiance  quand tu es jaloux ?",
    "Qui ici pourrait découvrir un truc bizarre sur toi  quand tu es jaloux ?",
    "Quelle promesse n’as-tu jamais tenue  quand tu es jaloux ?",
    "Quel est ton plus gros mensonge par omission  quand tu es jaloux ?",
    "Quelle conversation supprimerais-tu en premier  quand tu es jaloux ?",
    "Quel est ton plus gros acte de lâcheté sociale  quand tu es jaloux ?",
    "Quelle personne as-tu déjà stalkée beaucoup trop longtemps  quand tu es jaloux ?",
    "Quelle est ta pire excuse pour disparaître  quand tu es jaloux ?",
    "Quel est ton plus gros moment de honte relationnelle  quand tu es jaloux ?",
    "Qui ici aurait le plus de dossiers sur toi  quand tu es jaloux ?",
    "Quelle est ta pire décision prise pour plaire  quand tu es jaloux ?",
    "Quel est le truc le plus problématique dans ton historique  quand tu es jaloux ?",
    "Qui ici t’agace parfois sans le savoir  devant le groupe ?",
    "Quel est ton plus gros mensonge récent  devant le groupe ?",
    "Quelle vérité pourrait créer un malaise dans le groupe  devant le groupe ?",
    "Quel secret as-tu déjà failli révéler bourré  devant le groupe ?",
    "Quelle personne as-tu déjà ghostée sans vraie raison  devant le groupe ?",
    "Quel est le pire truc que tu as dit sous alcool  devant le groupe ?",
    "Quelle relation as-tu déjà sabotée tout seul  devant le groupe ?",
    "Quel est ton plus gros red flag social  devant le groupe ?",
    "Quelle est la chose la plus toxique que tu as déjà faite  devant le groupe ?",
    "Quel message de toi pourrait te faire honte demain  devant le groupe ?",
    "Quelle est ta pire opinion que tu évites de dire  devant le groupe ?",
    "Qui ici te connaît moins bien qu’il le croit  devant le groupe ?",
    "Quelle est la chose que tu caches le plus à tes potes  devant le groupe ?",
    "Quel est ton plus gros moment de mauvaise foi  devant le groupe ?",
    "Quelle personne as-tu déjà fait semblant d’aimer  devant le groupe ?",
    "Quel est ton plus gros drama non résolu  devant le groupe ?",
    "Quelle est ta plus grosse manipulation soft  devant le groupe ?",
    "Quel est le pire truc que tu as déjà fait par jalousie  devant le groupe ?",
    "Quelle confession pourrait changer l’ambiance  devant le groupe ?",
    "Qui ici pourrait découvrir un truc bizarre sur toi  devant le groupe ?",
    "Quelle promesse n’as-tu jamais tenue  devant le groupe ?",
    "Quel est ton plus gros mensonge par omission  devant le groupe ?",
    "Quelle conversation supprimerais-tu en premier  devant le groupe ?",
    "Quel est ton plus gros acte de lâcheté sociale  devant le groupe ?",
    "Quelle personne as-tu déjà stalkée beaucoup trop longtemps  devant le groupe ?",
    "Quelle est ta pire excuse pour disparaître  devant le groupe ?",
    "Quel est ton plus gros moment de honte relationnelle  devant le groupe ?",
    "Qui ici aurait le plus de dossiers sur toi  devant le groupe ?",
    "Quelle est ta pire décision prise pour plaire  devant le groupe ?",
    "Quel est le truc le plus problématique dans ton historique  devant le groupe ?"
  ],
  "Hardcore": [
    "Quel secret ne veux-tu vraiment pas que le groupe découvre ?",
    "Quelle est ta pire trahison amicale ou amoureuse ?",
    "As-tu déjà trompé quelqu’un ou aidé quelqu’un à tromper ?",
    "Quel est ton plus gros regret intime ?",
    "Quel est ton kink le plus difficile à assumer ?",
    "Quelle relation de ton passé te ferait honte aujourd’hui ?",
    "Quel est le truc le plus immoral que tu as fait par désir ?",
    "Quelle personne ici te trouble plus que tu ne l’assumes ?",
    "Quelle vérité pourrait te faire perdre des points auprès du groupe ?",
    "Quel est ton plus gros mensonge dans une relation ?",
    "As-tu déjà caché une double vie sentimentale ou sexuelle ?",
    "Quelle est la pire chose que tu as faite pour être désiré ?",
    "Quel message supprimé te ferait le plus paniquer ?",
    "Quel est ton plus gros moment de honte après une soirée ?",
    "Quelle est ta limite que tu as déjà franchie ?",
    "Quel fantasme ne veux-tu pas expliquer à voix haute ?",
    "Quel est ton plus gros comportement toxique en amour ?",
    "Quelle personne as-tu déjà utilisée affectivement ?",
    "Quel est ton plus gros mensonge sur ton passé ?",
    "Quelle vérité sur ton téléphone te ferait transpirer ?",
    "As-tu déjà menti sur ton nombre de partenaires ?",
    "Quel est ton pire choix de partenaire ?",
    "Quelle est la chose que tu regrettes d’avoir envoyée ?",
    "Quel secret intime as-tu déjà gardé trop longtemps ?",
    "Quelle est ta pire excuse après avoir blessé quelqu’un ?",
    "Quel est ton plus gros moment de désir honteux ?",
    "Quelle décision sexuelle ou romantique referais-tu jamais ?",
    "Quel est le truc le plus sale émotionnellement que tu as déjà fait ?",
    "Quelle personne du passé pourrait te ruiner l’ambiance ?",
    "Quelle vérité te ferait choisir de boire direct ?",
    "Quel secret ne veux-tu vraiment pas que le groupe découvre  dans une relation ?",
    "Quelle est ta pire trahison amicale ou amoureuse  dans une relation ?",
    "As-tu déjà trompé quelqu’un ou aidé quelqu’un à tromper  dans une relation ?",
    "Quel est ton plus gros regret intime  dans une relation ?",
    "Quel est ton kink le plus difficile à assumer  dans une relation ?",
    "Quelle relation de ton passé te ferait honte aujourd’hui  dans une relation ?",
    "Quel est le truc le plus immoral que tu as fait par désir  dans une relation ?",
    "Quelle personne ici te trouble plus que tu ne l’assumes  dans une relation ?",
    "Quelle vérité pourrait te faire perdre des points auprès du groupe  dans une relation ?",
    "Quel est ton plus gros mensonge dans une relation  dans une relation ?",
    "As-tu déjà caché une double vie sentimentale ou sexuelle  dans une relation ?",
    "Quelle est la pire chose que tu as faite pour être désiré  dans une relation ?",
    "Quel message supprimé te ferait le plus paniquer  dans une relation ?",
    "Quel est ton plus gros moment de honte après une soirée  dans une relation ?",
    "Quelle est ta limite que tu as déjà franchie  dans une relation ?",
    "Quel fantasme ne veux-tu pas expliquer à voix haute  dans une relation ?",
    "Quel est ton plus gros comportement toxique en amour  dans une relation ?",
    "Quelle personne as-tu déjà utilisée affectivement  dans une relation ?",
    "Quel est ton plus gros mensonge sur ton passé  dans une relation ?",
    "Quelle vérité sur ton téléphone te ferait transpirer  dans une relation ?",
    "As-tu déjà menti sur ton nombre de partenaires  dans une relation ?",
    "Quel est ton pire choix de partenaire  dans une relation ?",
    "Quelle est la chose que tu regrettes d’avoir envoyée  dans une relation ?",
    "Quel secret intime as-tu déjà gardé trop longtemps  dans une relation ?",
    "Quelle est ta pire excuse après avoir blessé quelqu’un  dans une relation ?",
    "Quel est ton plus gros moment de désir honteux  dans une relation ?",
    "Quelle décision sexuelle ou romantique referais-tu jamais  dans une relation ?",
    "Quel est le truc le plus sale émotionnellement que tu as déjà fait  dans une relation ?",
    "Quelle personne du passé pourrait te ruiner l’ambiance  dans une relation ?",
    "Quelle vérité te ferait choisir de boire direct  dans une relation ?",
    "Quel secret ne veux-tu vraiment pas que le groupe découvre  après minuit ?",
    "Quelle est ta pire trahison amicale ou amoureuse  après minuit ?",
    "As-tu déjà trompé quelqu’un ou aidé quelqu’un à tromper  après minuit ?",
    "Quel est ton plus gros regret intime  après minuit ?",
    "Quel est ton kink le plus difficile à assumer  après minuit ?",
    "Quelle relation de ton passé te ferait honte aujourd’hui  après minuit ?",
    "Quel est le truc le plus immoral que tu as fait par désir  après minuit ?",
    "Quelle personne ici te trouble plus que tu ne l’assumes  après minuit ?",
    "Quelle vérité pourrait te faire perdre des points auprès du groupe  après minuit ?",
    "Quel est ton plus gros mensonge dans une relation  après minuit ?",
    "As-tu déjà caché une double vie sentimentale ou sexuelle  après minuit ?",
    "Quelle est la pire chose que tu as faite pour être désiré  après minuit ?",
    "Quel message supprimé te ferait le plus paniquer  après minuit ?",
    "Quel est ton plus gros moment de honte après une soirée  après minuit ?",
    "Quelle est ta limite que tu as déjà franchie  après minuit ?",
    "Quel fantasme ne veux-tu pas expliquer à voix haute  après minuit ?",
    "Quel est ton plus gros comportement toxique en amour  après minuit ?",
    "Quelle personne as-tu déjà utilisée affectivement  après minuit ?",
    "Quel est ton plus gros mensonge sur ton passé  après minuit ?",
    "Quelle vérité sur ton téléphone te ferait transpirer  après minuit ?",
    "As-tu déjà menti sur ton nombre de partenaires  après minuit ?",
    "Quel est ton pire choix de partenaire  après minuit ?",
    "Quelle est la chose que tu regrettes d’avoir envoyée  après minuit ?",
    "Quel secret intime as-tu déjà gardé trop longtemps  après minuit ?",
    "Quelle est ta pire excuse après avoir blessé quelqu’un  après minuit ?",
    "Quel est ton plus gros moment de désir honteux  après minuit ?",
    "Quelle décision sexuelle ou romantique referais-tu jamais  après minuit ?",
    "Quel est le truc le plus sale émotionnellement que tu as déjà fait  après minuit ?",
    "Quelle personne du passé pourrait te ruiner l’ambiance  après minuit ?",
    "Quelle vérité te ferait choisir de boire direct  après minuit ?",
    "Quelle est ta pire excuse après avoir blessé quelqu’un ?",
    "Quelle vérité te ferait choisir de boire direct  dans tes DM ?",
    "Quel est ton pire blackout en soirée ?",
  "Quelle est la chose la plus stupide que tu as faite bourré ?",
  "As-tu déjà vomi dans un endroit honteux ?",
  "Quel est ton plus gros regret après une soirée ?",
  "Quel message bourré regrettes-tu le plus ?",
  "As-tu déjà appelé quelqu’un totalement ivre ?",
  "Quel est ton pire mélange d’alcool ?",
  "As-tu déjà oublié une soirée entière ?",
  "Quel est le pire endroit où tu t’es réveillé après une soirée ?",
  "Quelle est ta pire honte devant des inconnus en étant bourré ?",
  "As-tu déjà cassé quelque chose en soirée ?",
  "Quel est ton plus gros mensonge pour rentrer de soirée ?",
  "As-tu déjà été refusé en boîte ?",
  "Quel est ton pire fail en essayant d’impressionner quelqu’un bourré ?",
  "Quelle est la pire odeur/sensation de lendemain de soirée ?",
  "As-tu déjà dormi dehors après une soirée ?",
  "Quel est ton record de shots approximatif ?",
  "Quel est le pire alcool que tu ne peux plus voir ?",
  "As-tu déjà confondu quelqu’un en étant bourré ?",
  "Quel est ton moment le plus gênant en boîte ?",
  "As-tu déjà envoyé un vocal catastrophique bourré ?",
  "Quel est ton pire Uber/taxi retour de soirée ?",
  "As-tu déjà perdu ton téléphone/portefeuille en soirée ?",
  "Quelle est la pire excuse que tu as donnée après une soirée ?",
  "As-tu déjà été sick après seulement quelques verres ?",
  "Quel est le truc le plus absurde que tu as acheté bourré ?",
  "As-tu déjà dansé de façon honteuse sans t’en rendre compte ?",
  "Quel est ton pire lendemain de soirée ?",
  "Quelle personne ici serait la pire à gérer bourrée ?",
  "As-tu déjà oublié où tu habitais en rentrant ?",
  "Quel est le moment où tu t’es dit : 'je suis allé trop loin' ?",
  "As-tu déjà été ami avec quelqu’un juste le temps d’une soirée ?",
  "Quel est ton plus gros fail de préchauffe ?",
  "Quelle est la pire boisson qu’on t’a forcé à goûter ?",
  "As-tu déjà parlé une autre langue en étant bourré ?",
  "Quel est ton plus gros exploit alcoolisé ?",
  "As-tu déjà dormi avec tes vêtements de soirée plusieurs jours ?",
    "Quel est ton pire combo alcool + nourriture ?",
  "As-tu déjà tenté un défi débile sous alcool ?",
  "Quelle est la pire phrase que tu as dite bourré ?"
  ]
};

const truthPunishments = {
  "Chill": [
    "1 gorgée",
    "2 gorgées",
    "Distribue 2 gorgées",
    "Mini-gage choisi par le groupe",
    "Réponds à une question bonus soft",
    "Parle avec un accent pendant 1 tour",
    "Fais un compliment gênant à quelqu’un",
    "Laisse quelqu’un te poser une question rapide",
    "Change de place avec quelqu’un",
    "Fais une imitation de 10 secondes",
    "Boire 1 shot",
    "Boire 2 gorgées de ton verre actuel",
    "Boire 3 gorgées",
    "Choisir quelqu’un qui boit un shot avec toi",
    "Boire un shot de bière",
    "Boire un mélange que le groupe te prépare (petit)",
    "Boire ton verre avec la main non dominante",
    "Boire en regardant quelqu’un dans les yeux",
    "Faire un shot inversé",
    "Boire une gorgée de chaque verre sur la table",
  ],
  "Party": [
    "3 gorgées",
    "4 gorgées",
    "Shot soft ou 5 gorgées",
    "Mini cul-sec",
    "Distribue 5 gorgées",
    "Waterfall 5 secondes",
    "Bois avec la personne à ta gauche",
    "Choisis quelqu’un qui boit avec toi",
    "Fais un toast ridicule puis bois 2 gorgées",
    "Danse 15 secondes ou bois 4 gorgées",
    "Boire un cul sec de bière",
    "Boire 2 shots d’affilée",
    "Boire un grand verre d’alcool mélangé",
    "Boire un shot préparé par la personne à ta gauche",
    "Boire un shot préparé par la personne à ta droite",
    "Boire un Verre de la Honte : tout le monde verse un peu dedans",
    "Boire 4 gorgées d’affilée",
    "Boire sans utiliser tes mains avec une paille ou directement",
    "Faire un shot dans le nombril de quelqu’un ou se le faire faire",
    "Boire un shot à chaque fois que quelqu’un dit un mot interdit pendant 2 tours",
    "Le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde",
    "Cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
    "Le Dernier Verre : tu finis entièrement ton verre actuel",
    "Alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi",
    "Verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours",
    "Shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante",
  ],
  "Chaos": [
    "Shot",
    "Cul-sec soft",
    "5 gorgées",
    "Double peine : bois et distribue 3 gorgées",
    "Waterfall 8 secondes",
    "Le groupe choisit ta punition",
    "Lis ton dernier message reçu ou bois un shot",
    "Réponds à une question bonus du groupe ou bois 5 gorgées",
    "Choisis quelqu’un qui boit avec toi",
    "Tu bois maintenant et tu seras ciblé au prochain tour",
    "Boire un cul sec de bière",
    "Boire 2 shots d’affilée",
    "Boire un grand verre d’alcool mélangé",
    "Boire un shot préparé par la personne à ta gauche",
    "Boire un shot préparé par la personne à ta droite",
    "Boire un Verre de la Honte : tout le monde verse un peu dedans",
    "Boire 4 gorgées d’affilée",
    "Boire sans utiliser tes mains avec une paille ou directement",
    "Faire un shot dans le nombril de quelqu’un ou se le faire faire",
    "Boire un shot à chaque fois que quelqu’un dit un mot interdit pendant 2 tours",
    "Boire 3 shots d’affilée",
    "Boire un cul sec de spiritueux",
    "Boire un grand verre entier en moins de 45 secondes",
    "Boire 2 verres d’affilée",
    "Boire un mélange créé par tout le groupe",
    "Tour du Monde : boire une gorgée de 5 verres différents",
    "Boire sans respirer entre chaque gorgée jusqu’à 5 gorgées",
    "Boire un shot toutes les 2 minutes pendant 10 minutes",
    "Boire un Shot de la Mort très fort ou très bizarre",
    "Être Roi/Reine du Shot pendant 3 tours : tu dois servir un shot à chaque personne qui perd",
    "Le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde",
    "Cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
    "Le Dernier Verre : tu finis entièrement ton verre actuel",
    "Alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi",
    "Verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours",
    "Shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante",
  ],
  "Hardcore": [
    "Double shot ou grosse vérité bonus",
    "Cul-sec complet ou vérité hardcore",
    "Shot + 4 gorgées",
    "Le groupe choisit une sanction hardcore",
    "Waterfall 10 secondes",
    "Montre ton dernier DM ou bois double",
    "Réponds à une question bonus sans esquiver ou bois double",
    "Shot mystère",
    "Distribue 10 gorgées puis bois 3 gorgées",
    "Punition collective : toi double, les autres 1 gorgée",
    "Boire 3 shots d’affilée",
    "Boire un cul sec de spiritueux",
    "Boire un grand verre entier en moins de 45 secondes",
    "Boire 2 verres d’affilée",
    "Boire un mélange créé par tout le groupe",
    "Tour du Monde : boire une gorgée de 5 verres différents",
    "Boire sans respirer entre chaque gorgée jusqu’à 5 gorgées",
    "Boire un shot toutes les 2 minutes pendant 10 minutes",
    "Boire un Shot de la Mort très fort ou très bizarre",
    "Être Roi/Reine du Shot pendant 3 tours : tu dois servir un shot à chaque personne qui perd",
    "Le Serpent : tu bois une gorgée à chaque question/réponse jusqu’à ce que quelqu’un d’autre perde",
    "Cascade : tout le monde boit en même temps que toi jusqu’à ce que tu arrêtes",
    "Punition Double : tu bois 2 shots et tu choisis qui boit avec toi",
    "Le Dernier Verre : tu finis entièrement ton verre actuel",
    "Alcool Roulette : tu tournes une bouteille, la personne visée boit avec toi",
    "Verre sans fond : tu dois toujours avoir ton verre plein pendant 3 tours",
    "Shot ou Vérité : tu choisis entre boire 2 shots ou répondre à une question très gênante",
    "Boire un cul sec de bière",
    "Boire 2 shots d’affilée",
    "Boire un grand verre d’alcool mélangé",
    "Boire un shot préparé par la personne à ta gauche",
    "Boire un shot préparé par la personne à ta droite",
    "Boire un Verre de la Honte : tout le monde verse un peu dedans",
    "Boire 4 gorgées d’affilée",
    "Boire sans utiliser tes mains avec une paille ou directement",
    "Faire un shot dans le nombril de quelqu’un ou se le faire faire",
    "Boire un shot à chaque fois que quelqu’un dit un mot interdit pendant 2 tours",
  ],
};


function initGame() {
  roomBadge.textContent = `Room ${roomCode}`;
  modeText.textContent = selectedPartyMode;
  drinkLevelText.textContent = getDrinkLevelLabel();
  playersText.textContent = players.length;

  listenToTruthState();
  updateTruthControls();

  setTimeout(async () => {
    if (!firstTruthStateChecked) {
      loadQuestion(true);
    }
  }, 800);
}

async function publishTruthState(extra = {}) {
  try {
    const state = {
      actionId: Date.now(),
      currentQuestion,
      answered,
      drinks,
      history,
      usedQuestions,
      currentTarget,
      currentPunishment,
      questionResolved,
      question: questionText.textContent,
      instruction: instructionText.textContent,
      effect: "",
      updatedBy: currentPlayer,
      ...extra
    };

    await updateDoc(roomRef, {
      truthOrDrinkState: state,
      gameState: {
        round: currentQuestion,
        updatedBy: currentPlayer,
        updatedAt: Date.now()
      }
    });
  } catch (error) {
    console.error("Erreur synchro Truth or Drink :", error);
  }
}

function listenToTruthState() {
  onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (data.gameStarted === false || data.forceNavigation?.target === "lobby") {
      localStorage.setItem("partyhubReturnLobby", "true");
      window.location.href = "../../index.html";
      return;
    }

    if (Array.isArray(data.players)) {
      players = data.players;
      playersText.textContent = players.length;
    }

    const state = data.truthOrDrinkState;
    if (!state) return;
    firstTruthStateChecked = true;
    if (state.actionId === lastTruthActionId) return;

    lastTruthActionId = state.actionId;
    applyTruthState(state);
  });
}

function applyTruthState(state) {
  currentQuestion = state.currentQuestion || 1;
  answered = state.answered || 0;
  drinks = state.drinks || 0;
  history = state.history || [];
  usedQuestions = state.usedQuestions || [];
  currentTarget = state.currentTarget || currentTarget;
  currentPunishment = state.currentPunishment || currentPunishment;
  questionResolved = state.questionResolved === true;

  answerCounter.textContent = answered;
  drinkCounter.textContent = drinks;
  questionCountText.textContent = currentQuestion;
  categoryText.textContent = getCategoryLabel();
  targetText.textContent = currentTarget ? `🎯 Joueur ciblé : ${getPlayerName(currentTarget)}` : "🎯 Joueur ciblé : ...";
  punishmentText.textContent = currentPunishment ? `🍺 Punition si refus : ${currentPunishment}` : "🍺 Punition si refus : ...";
  questionText.textContent = state.question || "Question en chargement...";
  instructionText.textContent = state.instruction || "Réponds honnêtement ou bois.";

  questionCard.classList.remove("drink-effect", "answer-effect");
  if (state.effect) {
    questionCard.classList.add(state.effect);
  }

  renderHistory();
  updateTruthControls();
}


function getDrinkLevelLabel() {
  if (drinkLevel === "soft") return "Soft";
  if (drinkLevel === "normal") return "Normal";
  if (drinkLevel === "hard") return "Hard";
  if (drinkLevel === "danger" || drinkLevel === "extreme") return "Extrême";
  return "Normal";
}

function getQuestions() {
  return truthQuestions[selectedPartyMode] || truthQuestions.Party;
}

function getPunishments() {
  return truthPunishments[selectedPartyMode] || truthPunishments.Party;
}

function getCategoryLabel() {
  if (selectedPartyMode === "Chill") return "😇 Chill";
  if (selectedPartyMode === "Party") return "🍻 Party";
  if (selectedPartyMode === "Chaos") return "💀 Chaos";
  if (selectedPartyMode === "Hardcore") return "☠️ Hardcore";
  return "🍺 Vérité";
}

function getRandomQuestion() {
  const pool = getQuestions();

  if (usedQuestions.length >= pool.length) {
    usedQuestions = [];
  }

  let question;

  do {
    question = pool[Math.floor(Math.random() * pool.length)];
  } while (usedQuestions.includes(question));

  usedQuestions.push(question);
  return question;
}

function getRandomPunishment() {
  const pool = getPunishments();
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomPlayer() {
  if (!players.length) {
    return { name: "Joueur inconnu" };
  }

  return players[Math.floor(Math.random() * players.length)];
}

function loadQuestion(shouldPublish = false) {
  currentTarget = getRandomPlayer();
  currentPunishment = getRandomPunishment();

  categoryText.textContent = getCategoryLabel();
  targetText.textContent = `🎯 Joueur ciblé : ${getPlayerName(currentTarget)}`;
  punishmentText.textContent = `🍺 Punition si refus : ${currentPunishment}`;
  questionText.textContent = getRandomQuestion();
  instructionText.textContent = `${getPlayerName(currentTarget)}, réponds honnêtement ou prends la punition.`;

  questionCountText.textContent = currentQuestion;
  questionResolved = false;
  questionCard.classList.remove("drink-effect", "answer-effect");

  if (shouldPublish) {
    publishTruthState({ effect: "" });
  }

  updateTruthControls();
}

function addHistory(message) {
  history.unshift(message);

  if (history.length > 8) {
    history.pop();
  }

  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";

  history.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    historyList.appendChild(li);
  });
}

answerBtn.addEventListener("click", async () => {
  if (!isTargetPlayer() || questionResolved) return;
  answered++;
  answerCounter.textContent = answered;
  questionCard.classList.remove("drink-effect");
  questionCard.classList.add("answer-effect");
  instructionText.textContent = `🎤 ${getPlayerName(currentTarget)} a répondu.`;
  questionResolved = true;
  addHistory(`🎤 ${getPlayerName(currentTarget)} a répondu à la question.`);
  await publishTruthState({ effect: "answer-effect", questionResolved: true });
});

drinkBtn.addEventListener("click", async () => {
  if (!isTargetPlayer() || questionResolved) return;
  drinks++;
  drinkCounter.textContent = drinks;
  questionCard.classList.remove("answer-effect");
  questionCard.classList.add("drink-effect");
  instructionText.textContent = `🍺 ${getPlayerName(currentTarget)} prend : ${currentPunishment}`;
  questionResolved = true;
  addHistory(`🍺 ${getPlayerName(currentTarget)} a bu / pris : ${currentPunishment}`);
  await publishTruthState({ effect: "drink-effect", questionResolved: true });
});

nextQuestionBtn.addEventListener("click", () => {
  if (!(isHost || (isTargetPlayer() && questionResolved))) return;
  currentQuestion++;
  loadQuestion(true);
});

backToLobbyBtn.addEventListener("click", async () => {
  localStorage.setItem("partyhubReturnLobby", "true");

  try {
    await updateDoc(roomRef, {
      gameStarted: false,
      roomStatus: "lobby",
      screen: "lobby",
      activeGame: null,
      gameState: {},
      forceNavigation: { target: "lobby", at: Date.now() }
    });
  } catch (error) {
    console.error("Retour lobby non synchronisé :", error);
  }

  window.location.href = "../../index.html";
});

initGame();