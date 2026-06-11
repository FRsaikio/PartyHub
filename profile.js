import { db, doc, getDoc, setDoc, serverTimestamp } from "./firebase.js";

const PROFILE_STORAGE_KEY = "partyhubProfileId";
const PROFILE_CACHE_KEY = "partyhubProfileCache";

const AVATARS = ["🦊", "🐼", "🐸", "🐵", "🐯", "🦄", "👻", "🤖", "😈", "🍻", "🔥", "👑"];

function createProfileId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `ph_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getProfileId() {
  let profileId = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!profileId) {
    profileId = createProfileId();
    localStorage.setItem(PROFILE_STORAGE_KEY, profileId);
  }
  return profileId;
}

export function createDefaultProfile(name = "Player") {
  return {
    id: getProfileId(),
    pseudo: name,
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    avatarUrl: "",
    avatarBase64: "",
    avatarType: "emoji",
    xp: 0,
    level: 1,
    badges: ["Nouveau joueur"],
    stats: {
      roomsCreated: 0,
      roomsJoined: 0,
      gamesStarted: 0,
      partiesPlayed: 0,
      tvSessions: 0,
      endScreensViewed: 0,
      casinoGames: 0,
      monopolyGames: 0
    },
    history: [],
    updatedAtLocal: Date.now()
  };
}

export function getCachedProfile() {
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY));
    return cached || createDefaultProfile();
  } catch {
    return createDefaultProfile();
  }
}

function cacheProfile(profile) {
  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
}

export async function loadProfile() {
  const profileId = getProfileId();
  const cached = getCachedProfile();

  try {
    const profileRef = doc(db, "profiles", profileId);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      const profile = { ...cached, ...profileSnap.data(), id: profileId };
      cacheProfile(profile);
      return profile;
    }

    const freshProfile = { ...cached, id: profileId };
    await saveProfile(freshProfile);
    return freshProfile;
  } catch (error) {
    console.warn("Profil Firebase indisponible, utilisation du cache local.", error);
    return cached;
  }
}

export async function processAvatarFile(file) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Sélectionne une vraie image.");
  }

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("Image trop lourde. Essaie avec une photo de moins de 5 Mo.");
  }

  const imageUrl = URL.createObjectURL(file);
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = imageUrl;
  });

  // Petit format volontaire pour rester compatible avec Firestore gratuit.
  // Pas besoin de Firebase Storage : on stocke une Data URL compressée.
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  URL.revokeObjectURL(imageUrl);

  return canvas.toDataURL("image/jpeg", 0.62);
}

export async function saveCustomAvatar(file) {
  const avatarBase64 = await processAvatarFile(file);
  const profile = getCachedProfile();

  return saveProfile({
    ...profile,
    avatar: "📸",
    // avatarUrl gardé pour compatibilité avec le code existant.
    // Ici ce n’est pas une URL Firebase Storage, c’est une image Base64.
    avatarUrl: avatarBase64,
    avatarBase64,
    avatarType: "custom"
  });
}

export async function saveProfile(profile) {
  const nextProfile = {
    ...profile,
    id: getProfileId(),
    updatedAtLocal: Date.now()
  };

  cacheProfile(nextProfile);

  try {
    await setDoc(doc(db, "profiles", nextProfile.id), {
      ...nextProfile,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Profil sauvegardé localement, mais pas encore synchronisé Firebase.", error);
  }

  return nextProfile;
}

export async function addProfileXP(amount, reason = "Action PartyHub") {
  const profile = getCachedProfile();
  const nextXp = (profile.xp || 0) + amount;
  const nextLevel = Math.floor(nextXp / 100) + 1;
  const stats = profile.stats || {};
  const gamesPlayed = stats.partiesPlayed || 0;

  const badges = new Set(profile.badges || []);

  badges.add("Nouveau joueur");

  if (nextXp >= 50) badges.add("Ambianceur rookie");
  if (nextXp >= 150) badges.add("Alcoolique certifié");
  if (nextXp >= 300) badges.add("Menteur pro");
  if (nextXp >= 600) badges.add("Fêtard confirmé");
  if (nextXp >= 1000) badges.add("Machine à shots");
  if (nextXp >= 1500) badges.add("Survivant des soirées");
  if (nextXp >= 2500) badges.add("Roi du before");
  if (nextXp >= 4000) badges.add("Démon du lobby");
  if (nextXp >= 6000) badges.add("Chaos ambulant");

  if (nextLevel >= 5) badges.add("Légende du lobby");
  if (nextLevel >= 8) badges.add("Seigneur des gorgées");
  if (nextLevel >= 10) badges.add("Boss des soirées");
  if (nextLevel >= 12) badges.add("Vétéran PartyHub");
  if (nextLevel >= 15) badges.add("Maître du chaos");
  if (nextLevel >= 18) badges.add("Survivant Hardcore");
  if (nextLevel >= 20) badges.add("Icône nocturne");
  if (nextLevel >= 22) badges.add("Danger public");
  if (nextLevel >= 25) badges.add("Empereur des shots");
  if (nextLevel >= 27) badges.add("Monstre des afters");
  if (nextLevel >= 30) badges.add("DIEU DU LOBBY");

  if (gamesPlayed >= 10) badges.add("Joueur régulier");
  if (gamesPlayed >= 25) badges.add("Pilier de soirée");
  if (gamesPlayed >= 50) badges.add("Addict PartyHub");
  if (gamesPlayed >= 100) badges.add("Légende vivante");

  if ((stats.tvSessions || 0) >= 1) badges.add("Maître écran TV");
  if ((stats.endScreensViewed || 0) >= 1) badges.add("Archiviste de soirée");
  if ((stats.casinoGames || 0) >= 3) badges.add("Shark du casino");
  if ((stats.monopolyGames || 0) >= 3) badges.add("Rentier du Monopoly");

  return saveProfile({
    ...profile,
    xp: nextXp,
    level: nextLevel,
    badges: [...badges],
    history: [
      { label: reason, date: new Date().toISOString(), xp: amount },
      ...(profile.history || [])
    ].slice(0, 12)
  });
}

export async function updateProfileStats(patch = {}, historyLabel = null) {
  const profile = getCachedProfile();
  const stats = { ...(profile.stats || {}) };

  Object.entries(patch).forEach(([key, value]) => {
    stats[key] = (stats[key] || 0) + value;
  });

  return saveProfile({
    ...profile,
    stats,
    history: historyLabel
      ? [{ label: historyLabel, date: new Date().toISOString(), xp: 0 }, ...(profile.history || [])].slice(0, 12)
      : profile.history || []
  });
}

export { AVATARS };