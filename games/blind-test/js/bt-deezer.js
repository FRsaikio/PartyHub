// Morceaux du Blind test, tirés de playlists Deezer publiques (extraits de 30 s, sans compte).
// L'API Deezer ne permet pas les appels directs depuis un site (pas de CORS) : on passe par
// JSONP (balise <script> + callback). Les liens d'extraits expirent au bout de ~15 min, donc
// on ne garde que l'identifiant du morceau et on redemande un lien frais au moment de jouer.

import { frName } from "./bt-fr.js";

export const THEMES = {
  // kind : « work » = deviner le film / la série (nom tiré du titre), « album » = deviner le jeu
  // (nom tiré du titre ou de l'album), « music » = deviner l'artiste et le titre.
  // Les noms d'œuvres passent par la table française de bt-fr.js ; strict = seules les réponses
  // de la table sont gardées (Disney : on fait deviner le film, pas la chanson).
  films: { icon: "🎬", name: "Musiques de films", kind: "work", playlists: [1602126835, 8531512122] },
  series: { icon: "📺", name: "Séries & génériques TV", kind: "work", playlists: [3721524742, 13511043423] },
  cartoons: { icon: "🧸", name: "Dessins animés", kind: "work", playlists: [9976576142, 8390630182] },
  disney: { icon: "🏰", name: "Disney", kind: "work", strict: true, playlists: [613860315, 14511914743, 15784223101, 11837822681, 5232222102] },
  games: { icon: "🎮", name: "Jeux vidéo", kind: "album", playlists: [7747193762, 15408880043, 15528893401, 15808711181, 15534525903, 11930555961] },
  hits: { icon: "🔥", name: "Hits du moment", kind: "music", playlists: [53362031, 13520387843, 15449273061, 11915740641] },
  y2010: { icon: "📱", name: "Années 2010", kind: "music", playlists: [6294884764, 8179583022, 4428520242] },
  retro: { icon: "🕺", name: "Années 80-90-2000", kind: "music", playlists: [7089916404, 10109031722] },
  variete: { icon: "🥖", name: "Variété française", kind: "music", playlists: [7752025662, 7559081442, 6985188764, 6647148884, 6985222544] },
  rap: { icon: "🎤", name: "Rap français", kind: "music", playlists: [7708037842, 13154564983] },
  party: { icon: "🪩", name: "Ambiance soirée", kind: "music", playlists: [10912118462, 6497180824] },
  pub: { icon: "📢", name: "Musiques de pub", kind: "music", playlists: [1267962552, 1626915875, 9046419802, 8723696102, 8353886802] },
  mix: { icon: "🎲", name: "Grand mix", kind: "mix", playlists: [] }
};

let jsonpCount = 0;
function jsonp(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const cb = `__dz${Date.now()}${jsonpCount++}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("Deezer ne répond pas.")); }, timeout);
    function cleanup() { clearTimeout(timer); delete window[cb]; script.remove(); }
    window[cb] = data => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("Deezer inaccessible.")); };
    script.src = `${url}${url.includes("?") ? "&" : "?"}output=jsonp&callback=${cb}`;
    document.head.append(script);
  });
}

// Nom de l'œuvre caché dans le titre : (De "La Reine des Neiges"…), (From "God of War"), (B. O. "Le Roi Lion")…
export function workName(title) {
  const t = String(title);
  const inParen = t.match(/\((?:[^()"“«]*?)(?:from|de|du|issu de|extrait de|b\.\s?o\.?|bande originale)[^"“«]*["“«]\s*([^"”»]+?)\s*["”»]/i);
  if (inParen) return inParen[1].trim();
  const themeFrom = t.match(/^(?:main\s+)?(?:theme|thème|title)\s+(?:from|de)\s+["“«]?([^"”»]+?)["”»]?$/i);
  if (themeFrom) return themeFrom[1].replace(/:.*$/, "").trim();
  return null;
}

// Parenthèses et mentions qui n'aident pas à deviner (générique, B.O., version, remaster…).
const NOISE = /\s*[([][^)\]]*(?:générique|generique|soundtrack|score|bande originale|b\.\s?o|from|issu|extrait|version|remaster|live|feat|with|série|serie|edit|mix|thème|theme)[^)\]]*[)\]]/gi;

export function cleanTitle(title) {
  return String(title)
    .replace(NOISE, "")
    .replace(/\s*-\s*(?:remaster(?:ed)?|radio edit|version|from).*$/i, "")
    .replace(/\s+(?:main title|theme|thème)$/i, "")
    .replace(/^(?:main\s+)?(?:theme|thème)\s+(?:from|de)\s+/i, "")
    .trim() || String(title).trim();
}

// Albums de compilation : leur nom ne dit rien de l'œuvre.
const COMPILATION = /collection|classic|greatest|game on|level \d|essential|covers|top \d|piano|symphony|celebrating|best of|hits|compilation|nessary|8-bit|all-stars|mario music|pure\.\.\.|dance|single|intégrale/i;

// Nom de l'œuvre tiré de l'album : « Far Cry 5 (Original Game Soundtrack) » → « Far Cry 5 ».
export function albumWork(album) {
  const a = String(album || "");
  if (!a || COMPILATION.test(a)) return null;
  const name = a
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/^(?:the )?music (?:of|from) /i, "")
    .replace(/\s+-\s+(?:main\s+)?(?:theme|thème).*$/i, "")
    .replace(/,?\s*-?\s*vol(?:ume)?\.?\s*\d+.*$/i, "")
    .replace(/\s+(?:original|official)?\s*(?:video game|game)?\s*(?:soundtrack|score|ost)$/i, "")
    .replace(/\s+(?:definitive|deluxe|special) edition$/i, "")
    .replace(/\s+(?:original|official|standard)$/i, "")
    .trim();
  return name.length >= 2 ? name : null;
}

// Jeux vidéo / comédies musicales : on fait deviner le jeu ou le spectacle, pas le morceau.
export function albumLabel(track) {
  const strip = s => s.replace(/[®™]/g, "").trim();
  const fromTitle = workName(track.title);
  if (fromTitle) return strip(fromTitle);
  const fromAlbum = albumWork(track.album?.title);
  if (fromAlbum) return strip(fromAlbum);
  let t = strip(String(track.title));
  const dup = t.match(/^(.+?)\s+:\s+(.+)$/);
  if (dup && dup[1] === dup[2]) t = dup[1];
  t = t.replace(/\s*[([][^)\]]*[)\]]/g, "").split(/\s*:\s/)[0].split(/\s+-\s+/)[0];
  return t.replace(/\s+(?:main\s+)?(?:theme|thème)$/i, "").trim() || cleanTitle(track.title);
}

export function labelFor(track, kind) {
  if (kind === "album") return albumLabel(track);
  if (kind === "work") return workName(track.title) || cleanTitle(track.title);
  return `${track.artist?.name || "?"} – ${cleanTitle(track.title)}`;
}

async function playlistTracks(id) {
  const data = await jsonp(`https://api.deezer.com/playlist/${id}/tracks?limit=200`);
  return (data?.data || []).filter(t => t && t.readable !== false && t.preview);
}

const shuffle = list => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Prépare `count` manches : un morceau + 4 propositions (1 bonne, 3 du même thème).
// `themeKeys` : un ou plusieurs thèmes (« mix » = tous) ; les manches alternent entre eux.
export async function buildRounds(themeKeys, count) {
  const wanted = [].concat(themeKeys || "mix").filter(k => THEMES[k]);
  const keys = !wanted.length || wanted.includes("mix") ? Object.keys(THEMES).filter(k => k !== "mix") : wanted;
  // Toutes les playlists sont demandées en même temps (le grand mix en compte une vingtaine).
  const loaded = await Promise.all(keys.map(async key => {
    const lists = await Promise.all(THEMES[key].playlists.map(id => playlistTracks(id).catch(() => [])));
    return { key, answers: shuffle(answersFor(THEMES[key], lists.flat())) };
  }));
  const pools = loaded.filter(p => p.answers.length >= 4);
  if (!pools.length) return [];
  // Chaque thème : une file de réponses à faire deviner ; toutes les réponses du thème peuvent
  // servir de mauvaises propositions. Une même réponse ne tombe qu'une fois par partie.
  pools.forEach(p => { p.queue = [...p.answers]; });
  const used = new Set();
  const rounds = [];
  let turn = 0;
  while (rounds.length < count && pools.some(p => p.queue.length)) {
    const pool = pools[turn++ % pools.length];
    const pick = pool.queue.pop();
    if (!pick || used.has(pick.key)) continue;
    const others = shuffle(pool.answers.filter(x => x.key !== pick.key)).slice(0, 3);
    if (others.length < 3) continue;
    used.add(pick.key);
    const t = pick.tracks[Math.floor(Math.random() * pick.tracks.length)];
    const choices = shuffle([pick.label, ...others.map(o => o.label)]);
    rounds.push({
      trackId: t.id,
      theme: pool.key,
      title: t.title,
      artist: t.artist?.name || "",
      cover: t.album?.cover_medium || "",
      choices,
      answer: choices.indexOf(pick.label)
    });
  }
  return rounds;
}

// Regroupe les morceaux d'un thème par réponse : [{ key, label, tracks }]. Pour les œuvres, la
// réponse passe par la table des noms français (bt-fr.js) : plusieurs chansons d'un même film
// donnent une seule réponse, et les morceaux impossibles à deviner sont écartés.
export function answersFor(theme, tracks) {
  const groups = new Map();
  tracks.forEach(t => {
    let label = labelFor(t, theme.kind);
    if (theme.kind !== "music") {
      const fr = frName(label);
      if (fr === null || (fr === undefined && theme.strict)) return;
      if (fr) label = fr;
    }
    if (!label) return;
    const key = label.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!groups.has(key)) groups.set(key, { key, label, tracks: [] });
    const group = groups.get(key);
    if (!group.tracks.some(x => x.id === t.id)) group.tracks.push(t);
  });
  return [...groups.values()];
}

// Lien d'extrait frais (les liens expirent au bout de ~15 min).
export async function freshPreview(trackId) {
  const data = await jsonp(`https://api.deezer.com/track/${trackId}`);
  if (!data?.preview) throw new Error("Extrait indisponible.");
  return data.preview;
}
