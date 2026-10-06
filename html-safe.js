// Protection XSS : tout texte venant d'un joueur (pseudo, avatar...) doit passer
// par ces fonctions avant d'être inséré avec innerHTML.

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// N'accepte que les avatars image en Data URL (photo de profil compressée) ou en https.
export function safeImageSrc(value) {
  const src = String(value ?? "").trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(src)) return src;
  if (/^https:\/\/[^\s"'<>]+$/i.test(src)) return src;
  return "";
}

// Retire les caractères dangereux d'un pseudo saisi.
export function cleanPseudo(value) {
  return String(value ?? "").replace(/[<>"'&`]/g, "");
}
