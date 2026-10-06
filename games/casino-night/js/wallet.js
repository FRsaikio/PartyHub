// Portefeuilles du casino, partagés dans la room.
//
// Stockage Firestore (document rooms/{code}) :
//   casino.wallets.<clé joueur> = { name, chips, shields, joinedAt, updatedAt }
//   casino.lastEvent            = { id, name, text, tone, at }   (gros gains, vols…)
//
// Règles pour éviter les écrasements entre joueurs :
//   - chaque joueur n'écrit que SA ligne (sauf un vol, qui retire des jetons à la victime) ;
//   - les jetons bougent uniquement via increment() (atomique côté serveur).
// Sans room (page ouverte seule), on retombe sur un portefeuille local (localStorage).

import { db, doc, updateDoc, onSnapshot, increment } from "../../../firebase.js";

export const START_CHIPS = 1000;
export const SHIELD_PRICE = 300;
const LOCAL_KEY = "partyhubCasinoWallet";

function hashName(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `n_${h.toString(36)}`;
}

// Clé Firestore sûre (pas de « . », de « / » ni d'espace).
// Profil + pseudo : deux onglets du même navigateur partagent le même profil, mais ont
// chacun leur pseudo dans la room, donc chacun son portefeuille.
export function walletKeyFor(profileId, name) {
  const id = String(profileId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return id ? `p_${id}_${hashName(name || "Joueur")}` : hashName(name || "Joueur");
}

// Ancienne clé (profil seul) : on y reprend les jetons déjà gagnés ce soir.
export function legacyWalletKeyFor(profileId) {
  const id = String(profileId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return id ? `p_${id}` : null;
}

export function createWallet({ roomCode, me, spectator = false, onChange = () => {}, onEvent = () => {} }) {
  const online = Boolean(roomCode) && roomCode !== "----";
  const roomRef = online ? doc(db, "rooms", roomCode) : null;

  let wallets = {};
  let lastEventId = null;
  let firstSnapshot = true;
  let unsubscribe = null;

  // Copie locale de MON portefeuille pour réagir instantanément (le snapshot la recale).
  let mine = { name: me.name, chips: START_CHIPS, shields: 0 };

  const path = field => `casino.wallets.${me.key}${field ? `.${field}` : ""}`;

  function emit() {
    onChange({ mine: { ...mine }, leaderboard: leaderboard() });
  }

  function leaderboard() {
    const rows = Object.entries(wallets).filter(([, w]) => w).map(([key, w]) => ({
      key,
      name: w?.name || "Joueur",
      chips: Math.max(0, Number(w?.chips) || 0),
      shields: Number(w?.shields) || 0,
      isMe: key === me.key
    }));
    if (!online && !rows.length) rows.push({ key: me.key, name: me.name, chips: mine.chips, shields: mine.shields, isMe: true });
    return rows.sort((a, b) => b.chips - a.chips);
  }

  // ---------- Mode local (sans room) ----------

  function loadLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
      if (saved && Number.isFinite(saved.chips)) mine = { name: me.name, chips: saved.chips, shields: saved.shields || 0 };
    } catch { /* stockage indisponible : on garde le départ */ }
  }

  function saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(mine)); } catch { /* ignoré */ }
  }

  // ---------- Démarrage ----------

  function start() {
    if (!online) {
      loadLocal();
      emit();
      return;
    }

    unsubscribe = onSnapshot(roomRef, snapshot => {
      if (!snapshot.exists()) return;
      const casino = snapshot.data().casino || {};
      wallets = casino.wallets || {};

      const serverMine = wallets[me.key];
      if (serverMine) {
        mine = { name: serverMine.name || me.name, chips: Math.max(0, Number(serverMine.chips) || 0), shields: Number(serverMine.shields) || 0 };
      } else if (!spectator) {
        // Première visite au casino ce soir : on ouvre le compte, en reprenant si besoin
        // les jetons enregistrés sous l'ancienne clé (profil seul) au même pseudo.
        const legacy = me.legacyKey && wallets[me.legacyKey];
        const inherit = legacy && legacy.name === me.name;
        const patch = {
          [path()]: {
            name: me.name,
            chips: inherit ? Math.max(0, Number(legacy.chips) || 0) : START_CHIPS,
            shields: inherit ? Number(legacy.shields) || 0 : 0,
            joinedAt: Date.now(),
            updatedAt: Date.now()
          }
        };
        if (inherit) patch[`casino.wallets.${me.legacyKey}`] = null;
        updateDoc(roomRef, patch).catch(error => console.error("Casino : ouverture du compte impossible", error));
      }

      const event = casino.lastEvent;
      if (event?.id && event.id !== lastEventId) {
        // On ne rejoue pas l'ancien événement à l'ouverture de la page.
        if (!firstSnapshot) onEvent(event);
        lastEventId = event.id;
      }
      firstSnapshot = false;
      emit();
    }, error => console.error("Casino : synchro de la room impossible", error));
  }

  // ---------- Actions ----------

  function write(patch) {
    if (!online) { saveLocal(); return Promise.resolve(); }
    return updateDoc(roomRef, { ...patch, [path("updatedAt")]: Date.now() })
      .catch(error => console.error("Casino : écriture impossible", error));
  }

  // Ajoute (ou retire si négatif) des jetons à MON solde.
  function add(delta) {
    const amount = Math.round(Number(delta) || 0);
    if (!amount) return Promise.resolve();
    mine.chips = Math.max(0, mine.chips + amount);
    emit();
    return write({ [path("chips")]: increment(amount) });
  }

  function canAfford(amount) {
    return mine.chips >= amount;
  }

  function buyShield() {
    if (!canAfford(SHIELD_PRICE)) return false;
    mine.chips -= SHIELD_PRICE;
    mine.shields += 1;
    emit();
    write({ [path("chips")]: increment(-SHIELD_PRICE), [path("shields")]: increment(1) });
    return true;
  }

  function useShield() {
    if (mine.shields <= 0) return false;
    mine.shields -= 1;
    emit();
    write({ [path("shields")]: increment(-1) });
    return true;
  }

  // Vole jusqu'à `amount` jetons au joueur le plus riche (hors moi).
  // Renvoie { victim, amount } ou null s'il n'y a personne à voler.
  function stealFromRichest(amount) {
    const victim = leaderboard().find(row => !row.isMe && row.chips > 0);
    if (!victim) return null;
    const taken = Math.min(amount, victim.chips);
    mine.chips += taken;
    emit();
    if (online) {
      updateDoc(roomRef, {
        [`casino.wallets.${victim.key}.chips`]: increment(-taken),
        [path("chips")]: increment(taken),
        [path("updatedAt")]: Date.now()
      }).catch(error => console.error("Casino : vol impossible", error));
    }
    return { victim: victim.name, amount: taken };
  }

  // Annonce un moment fort à toute la room (toast sur les téléphones + écran TV).
  function announce(text, tone = "gold") {
    if (!online) return;
    const id = `${me.key}_${Date.now()}`;
    lastEventId = id; // pas de toast pour soi-même : on a déjà le résultat à l'écran
    updateDoc(roomRef, { "casino.lastEvent": { id, name: me.name, text, tone, at: Date.now() } })
      .catch(error => console.error("Casino : annonce impossible", error));
  }

  function stop() {
    if (unsubscribe) unsubscribe();
  }

  return {
    online,
    start,
    stop,
    add,
    canAfford,
    buyShield,
    useShield,
    stealFromRichest,
    announce,
    get chips() { return mine.chips; },
    get shields() { return mine.shields; },
    leaderboard
  };
}
