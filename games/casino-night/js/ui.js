// Interface commune du casino : sons, toasts, encadré de résultat, effets plein écran.
// Tout le texte est inséré avec textContent (pas d'innerHTML) : aucun risque XSS.

const fx = () => window.PartyHubFX;

export const sound = {
  click: () => fx()?.sounds?.click?.(),
  spin: () => fx()?.sounds?.spin?.(),
  card: () => fx()?.tone?.(320, 0.05, "triangle", 0.5),
  chip: () => { fx()?.tone?.(880, 0.04, "sine", 0.4); fx()?.tone?.(1180, 0.05, "sine", 0.3, null, 0.04); },
  win: () => { [523, 659, 784].forEach((f, i) => fx()?.tone?.(f, 0.18, "triangle", 0.7, null, i * 0.12)); },
  jackpot: () => { [523, 659, 784, 1046].forEach((f, i) => fx()?.tone?.(f, 0.22, "triangle", 0.9, null, i * 0.12)); },
  lose: () => fx()?.tone?.(160, 0.4, "sawtooth", 0.6),
  alarm: () => { for (let i = 0; i < 6; i++) fx()?.tone?.(i % 2 ? 220 : 420, 0.16, "sawtooth", 0.4, null, i * 0.18); }
};

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function formatChips(n) {
  // Espace fine insécable (U+202F) absente de la police Unbounded : on met une espace insécable classique.
  return Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0");
}

// ---------- Toasts (annonces de la room, petites infos) ----------

const toastZone = document.createElement("div");
toastZone.className = "casino-toasts";
toastZone.setAttribute("aria-live", "polite");
document.body.appendChild(toastZone);

export function toast(text, tone = "info") {
  const el = document.createElement("div");
  el.className = `casino-toast tone-${tone}`;
  el.textContent = text;
  toastZone.appendChild(el);
  setTimeout(() => el.classList.add("leaving"), 4200);
  setTimeout(() => el.remove(), 4700);
}

// ---------- Encadré de résultat ----------
// result : { title, lines: [texte], tone: "win"|"lose"|"push"|"info"|"gold", choices: [{ label, variant, onClick }] }

export function showResult(box, { title = "", lines = [], tone = "info", choices = [] }) {
  box.className = `casino-result tone-${tone}`;
  box.replaceChildren();

  if (title) {
    const h = document.createElement("strong");
    h.className = "casino-result-title";
    h.textContent = title;
    box.appendChild(h);
  }

  lines.filter(Boolean).forEach(line => {
    const p = document.createElement("p");
    p.textContent = line;
    box.appendChild(p);
  });

  if (choices.length) {
    const row = document.createElement("div");
    row.className = "casino-choices";
    choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn small ${choice.variant || "secondary"}`;
      btn.textContent = choice.label;
      btn.addEventListener("click", () => {
        row.querySelectorAll("button").forEach(b => { b.disabled = true; });
        btn.classList.add("chosen");
        choice.onClick?.();
      }, { once: true });
      row.appendChild(btn);
    });
    box.appendChild(row);
  }

  // relance l'animation d'apparition
  box.classList.remove("pop");
  void box.offsetWidth;
  box.classList.add("pop");
}

// ---------- Effets plein écran ----------

const overlay = document.createElement("div");
overlay.className = "casino-cinematic";
overlay.innerHTML = `<div class="casino-cinematic-title"></div><div class="casino-cinematic-sub"></div>`;
document.body.appendChild(overlay);

export function cinematic(title, sub = "", tone = "gold") {
  overlay.querySelector(".casino-cinematic-title").textContent = title;
  overlay.querySelector(".casino-cinematic-sub").textContent = sub;
  overlay.className = `casino-cinematic active tone-${tone}`;
  navigator.vibrate?.([120, 80, 120]);
  setTimeout(() => { overlay.className = "casino-cinematic"; }, 2600);
}

export function goldRain(count = 40) {
  const rain = document.createElement("div");
  rain.className = "casino-gold-rain";
  for (let i = 0; i < count; i++) {
    const coin = document.createElement("span");
    coin.className = "casino-coin";
    coin.style.left = `${Math.random() * 100}vw`;
    coin.style.animationDuration = `${2 + Math.random() * 2}s`;
    coin.style.animationDelay = `${Math.random() * 0.8}s`;
    rain.appendChild(coin);
  }
  document.body.appendChild(rain);
  setTimeout(() => rain.remove(), 5000);
}
