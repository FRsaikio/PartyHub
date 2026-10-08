// Morceaux du Blind test, tirés de playlists Deezer publiques (extraits de 30 s, sans compte).
// L'API Deezer ne permet pas les appels directs depuis un site (pas de CORS) : on passe par
// JSONP (balise <script> + callback). Les liens d'extraits expirent au bout de ~15 min, donc
// on ne garde que l'identifiant du morceau et on redemande un lien frais au moment de jouer.

export const THEMES = {
  films: { icon: "🎬", name: "Musiques de films", kind: "work", playlists: [1602126835, 8531512122] },
  series: { icon: "📺", name: "Séries & génériques TV", kind: "work", playlists: [3721524742, 13511043423] },
  cartoons: { icon: "🧸", name: "Dessins animés", kind: "work", playlists: [9976576142, 8390630182] },
  disney: { icon: "🏰", name: "Disney", kind: "work", playlists: [613860315, 14511914743] },
  games: { icon: "🎮", name: "Jeux vidéo", kind: "work", playlists: [7747193762] },
  hits: { icon: "🔥", name: "Hits du moment", kind: "music", playlists: [53362031] },
  retro: { icon: "🕺", name: "Années 80-90-2000", kind: "music", playlists: [7089916404, 10109031722] },
  rap: { icon: "🎤", name: "Rap français", kind: "music", playlists: [7708037842, 13154564983] },
  pub: { icon: "📢", name: "Musiques de pub", kind: "music", playlists: [1267962552] },
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

export function labelFor(track, kind) {
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
  const pools = [];
  for (const key of keys) {
    const theme = THEMES[key];
    const ids = theme.playlists;
    const lists = await Promise.all(ids.map(id => playlistTracks(id).catch(() => [])));
    const seen = new Set();
    const tracks = [];
    lists.flat().forEach(t => {
      const label = labelFor(t, theme.kind);
      const k = label.toLowerCase();
      if (!label || seen.has(k)) return;
      seen.add(k);
      tracks.push({ t, label });
    });
    if (tracks.length >= 4) pools.push({ key, theme, tracks: shuffle(tracks) });
  }
  if (!pools.length) return [];
  // Chaque thème : une file de morceaux à faire deviner (sans répétition) ; tous les morceaux
  // du thème peuvent servir de mauvaises propositions.
  pools.forEach(p => { p.queue = [...p.tracks]; });
  const rounds = [];
  let turn = 0;
  while (rounds.length < count && pools.some(p => p.queue.length)) {
    const pool = pools[turn++ % pools.length];
    const pick = pool.queue.pop();
    if (!pick) continue;
    const others = shuffle(pool.tracks.filter(x => x.label !== pick.label)).slice(0, 3);
    if (others.length < 3) continue;
    const choices = shuffle([pick.label, ...others.map(o => o.label)]);
    rounds.push({
      trackId: pick.t.id,
      theme: pool.key,
      title: pick.t.title,
      artist: pick.t.artist?.name || "",
      cover: pick.t.album?.cover_medium || "",
      choices,
      answer: choices.indexOf(pick.label)
    });
  }
  return rounds;
}

// Lien d'extrait frais (les liens expirent au bout de ~15 min).
export async function freshPreview(trackId) {
  const data = await jsonp(`https://api.deezer.com/track/${trackId}`);
  if (!data?.preview) throw new Error("Extrait indisponible.");
  return data.preview;
}
