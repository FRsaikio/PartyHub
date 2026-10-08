// Fonctions partagées par les mini-jeux.

import { db, doc, onSnapshot, updateDoc, runTransaction, deleteField } from "./firebase.js";

// Champs de partie laissés dans le doc de la room par chaque jeu. On les efface au retour
// au lobby : sinon la room grossit à chaque jeu joué, et chaque mise à jour renvoie tout ce
// contenu à tous les téléphones. Le casino (portefeuilles, tables de blackjack et de poker
// où des jetons sont encore posés) est gardé.
export const GAME_FIELDS = [
  "survivor", "traitor", "bomb", "kings", "roulette", "mostLikely", "never", "truth", "monopoly",
  // anciennes versions des jeux
  "survivorState", "traitorState", "bombTimerState", "chaosKingsState", "chaosKingsTarget", "chaosKingsStats",
  "rouletteState", "rouletteRecentActions", "mostLikelyState", "neverHaveIEverState", "truthOrDrinkState",
  "monopolitState", "monopolyState",
  "casino.bjTable"
];

// Patch Firestore qui efface ces champs (à fusionner dans un updateDoc).
export function gameCleanupPatch() {
  return Object.fromEntries(GAME_FIELDS.map(field => [field, deleteField()]));
}

// Retour lobby de l'hôte : on prévient la room, mais on n'attend jamais plus
// de `maxWait` ms la réponse de Firestore avant de changer de page (sinon le
// bouton paraît mort si le réseau traîne). Pas de risque de perte : l'accueil
// (restoreLobbyFromGame dans app.js) réécrit gameStarted:false en arrivant.
export function lobbyWrite(promise, maxWait = 1200) {
  return Promise.race([promise, new Promise(resolve => setTimeout(resolve, maxWait))]);
}

// Détermine si ce téléphone pilote la partie (init de l'état, manche suivante,
// retour lobby global...). Un seul appareil doit répondre true :
// - le joueur marqué host dans la room ;
// - sinon (room créée depuis l'écran TV, aucun host téléphone) le premier joueur réel de la liste.
export function resolveIsHost(savedData) {
  savedData = savedData || {};
  if (savedData.isHost === true) return true;

  const players = Array.isArray(savedData.players) ? savedData.players : [];
  if (players.some(player => player?.host)) return false;

  const me = savedData.currentPlayer || savedData.playerName;
  const firstRealPlayer = players.find(player => player && !player.fake);
  return !!me && firstRealPlayer?.name === me;
}

// ---------- Hôte de secours ----------
//
// L'hôte pilote la partie (manche suivante, retour lobby…). S'il disparaît (téléphone éteint,
// onglet fermé, plus de réseau), plus rien n'avance. watchHost règle ça :
// - le téléphone de l'hôte signale qu'il est là toutes les 25 s (champ `hostSeen` de la room) ;
// - les autres regardent si ce signal change. Les horloges des téléphones ne sont jamais
//   comparées entre elles : chacun mesure avec SA montre depuis quand il n'a rien vu bouger ;
// - après 90 s de silence, le 1er joueur de la liste reprend la main (le 2e attend 10 s de
//   plus, etc., au cas où le 1er serait parti lui aussi). La transaction revérifie que
//   l'hôte n'a pas donné signe de vie entre-temps.
// onChange(isHost) est appelé quand CE téléphone devient (ou cesse d'être) l'hôte.

export const HOST_BEAT_MS = 25000;
export const HOST_TIMEOUT_MS = 90000;
const CLAIM_STEP_MS = 10000;

const realPlayers = players => (Array.isArray(players) ? players : []).filter(p => p && !p.fake && p.name);

// Le nom de l'hôte de la room : le joueur marqué host, sinon (room créée par la TV) le premier joueur réel.
export function hostNameOf(players) {
  const list = realPlayers(players);
  return (list.find(p => p.host) || list[0])?.name || "";
}

// Ce que l'on observe pour savoir si l'hôte est vivant : son signal et sa présence au lobby.
const lifeSign = (data, hostName) => JSON.stringify([
  data?.hostSeen?.name === hostName ? data.hostSeen.at : null,
  realPlayers(data?.players).find(p => p.name === hostName)?.lastSeen ?? null
]);

function hostNotice(text) {
  if (typeof document === "undefined") return;
  const box = document.createElement("div");
  box.setAttribute("role", "status");
  box.textContent = text;
  box.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99999;max-width:min(92vw,420px);" +
    "padding:12px 18px;border-radius:14px;background:rgba(8,6,26,.95);color:#fff;font:700 14px/1.35 Manrope,system-ui,sans-serif;" +
    "text-align:center;border:1.5px solid #e01fa0;box-shadow:0 0 28px rgba(224,31,160,.45);transition:opacity .4s";
  document.body.appendChild(box);
  setTimeout(() => { box.style.opacity = "0"; }, 4500);
  setTimeout(() => box.remove(), 5000);
}

export function watchHost(roomCode, savedData, onChange = () => {}) {
  const me = savedData?.currentPlayer || savedData?.playerName || "";
  if (!roomCode || roomCode === "----" || !me) return () => {};

  const roomRef = doc(db, "rooms", roomCode);
  let isHost = resolveIsHost(savedData);
  let latest = null;
  let hostName = "";
  let sign = "";
  let lastLifeAt = Date.now(); // heure LOCALE où l'on a vu l'hôte bouger pour la dernière fois
  let claiming = false;
  let stopped = false;

  function setHost(next, data) {
    if (next === isHost) return;
    isHost = next;
    try {
      for (const store of [localStorage, sessionStorage]) {
        const saved = JSON.parse(store.getItem("partyhubGameData") || "null");
        if (saved) store.setItem("partyhubGameData", JSON.stringify({ ...saved, isHost: next, players: data?.players || saved.players }));
      }
    } catch { /* stockage indisponible */ }
    onChange(next);
    if (next) beat();
  }

  function beat() {
    if (stopped || !isHost) return;
    updateDoc(roomRef, { hostSeen: { name: me, at: Date.now() } }).catch(error => console.warn("Hôte : signal non envoyé", error));
  }

  async function claim() {
    claiming = true;
    const seenSign = sign;
    const oldHost = hostName;
    try {
      const done = await runTransaction(db, async t => {
        const snap = await t.get(roomRef);
        if (!snap.exists()) return false;
        const data = snap.data();
        // L'hôte a changé ou a donné signe de vie entre-temps : on ne touche à rien.
        if (hostNameOf(data.players) !== oldHost || lifeSign(data, oldHost) !== seenSign) return false;
        const players = (data.players || []).map(p => (p ? { ...p, host: p.name === me } : p));
        t.update(roomRef, {
          players,
          hostName: me,
          hostSeen: { name: me, at: Date.now() },
          activity: [`👑 ${me} reprend la main : ${oldHost} ne répond plus`, ...(data.activity || [])].slice(0, 30)
        });
        return true;
      });
      if (done) hostNotice(`👑 ${oldHost} ne répond plus : c'est toi l'hôte maintenant.`);
    } catch (error) {
      console.warn("Hôte : reprise impossible", error);
    } finally {
      claiming = false;
      lastLifeAt = Date.now(); // on laisse le temps au nouvel état d'arriver avant de réessayer
    }
  }

  const unsubscribe = onSnapshot(roomRef, snap => {
    if (!snap.exists()) return;
    latest = snap.data();
    const name = hostNameOf(latest.players);
    const nextSign = lifeSign(latest, name);
    if (name !== hostName || nextSign !== sign) lastLifeAt = Date.now();
    if (hostName && name !== hostName && name !== me && isHost) hostNotice(`👑 ${name} est maintenant l'hôte.`);
    hostName = name;
    sign = nextSign;
    setHost(name === me, latest);
  }, error => console.warn("Hôte : synchro impossible", error));

  const timer = setInterval(() => {
    if (stopped || !latest || claiming) return;
    if (isHost) return;
    const waiting = realPlayers(latest.players).filter(p => p.name !== hostName);
    const rank = waiting.findIndex(p => p.name === me);
    if (rank < 0 || !hostName) return;
    if (Date.now() - lastLifeAt > HOST_TIMEOUT_MS + rank * CLAIM_STEP_MS) claim();
  }, 5000);

  const beatTimer = setInterval(beat, HOST_BEAT_MS);
  // Téléphone qui se réveille : on n'a peut-être rien reçu pendant la veille, on laisse un délai de grâce.
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    lastLifeAt = Date.now();
    beat();
  };
  document.addEventListener("visibilitychange", onVisible);
  beat();

  return () => {
    stopped = true;
    unsubscribe();
    clearInterval(timer);
    clearInterval(beatTimer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
