// Mini-jeux d'épreuve, joués sur chaque téléphone. Chacun mesure son propre score avec
// SA montre (performance.now) : aucune synchro d'horloge entre téléphones n'est nécessaire.
// mount(container, onDone(score)) affiche le jeu ; le score part une seule fois.

import { FALSE_START } from "./survivor-logic.js";

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};
const fx = () => window.PartyHubFX;
const beep = (f, d = 0.06, type = "triangle", v = 0.5) => fx()?.tone?.(f, d, type, v);

// ⚡ Réflexe : tape dès que l'écran passe au vert.
function reflex(box, done) {
  const pad = h("button", "sv-pad", "Touche pour commencer");
  pad.type = "button";
  let state = "idle";
  let goAt = 0;
  let timer = null;

  pad.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (state === "idle") {
      state = "wait";
      pad.className = "sv-pad wait";
      pad.textContent = "Attends le vert…";
      timer = setTimeout(() => {
        state = "go";
        goAt = performance.now();
        pad.className = "sv-pad go";
        pad.textContent = "TAPE !";
        beep(880, 0.08, "square", 0.4);
      }, 1200 + Math.random() * 2800);
    } else if (state === "wait") {
      clearTimeout(timer);
      state = "done";
      pad.className = "sv-pad fail";
      pad.textContent = "Faux départ ! 💀";
      beep(160, 0.3, "sawtooth");
      done(FALSE_START);
    } else if (state === "go") {
      state = "done";
      const ms = Math.round(performance.now() - goAt);
      pad.className = "sv-pad ok";
      pad.textContent = `${ms} ms`;
      beep(660);
      done(ms);
    }
  });
  box.append(pad);
}

// 👆 Sprint : le plus de taps en 5 secondes.
function tap(box, done) {
  const pad = h("button", "sv-pad", "Prêt ? Touche pour lancer");
  pad.type = "button";
  const bar = h("div", "sv-timebar");
  const fill = h("span");
  bar.append(fill);
  let state = "idle";
  let count = 0;

  pad.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (state === "idle") {
      state = "count";
      let n = 3;
      pad.className = "sv-pad wait";
      pad.textContent = String(n);
      beep(440);
      const tick = setInterval(() => {
        n -= 1;
        if (n > 0) { pad.textContent = String(n); beep(440); return; }
        clearInterval(tick);
        state = "go";
        pad.className = "sv-pad go";
        pad.textContent = "0";
        beep(880, 0.08, "square", 0.4);
        fill.style.transition = "width 5s linear";
        requestAnimationFrame(() => { fill.style.width = "0%"; });
        setTimeout(() => {
          state = "done";
          pad.className = "sv-pad ok";
          pad.textContent = `${count} taps !`;
          beep(660);
          done(count);
        }, 5000);
      }, 700);
    } else if (state === "go") {
      count += 1;
      pad.textContent = String(count);
      navigator.vibrate?.(8);
    }
  });
  box.append(bar, pad);
}

// 🧠 Mémoire : reproduis la suite, elle s'allonge à chaque réussite.
const SYMBOLS = ["🔥", "🌊", "🌿", "⭐"];
const NOTES = [330, 392, 494, 587];

function simon(box, done) {
  const info = h("p", "sv-simon-info", "Regarde bien la suite…");
  const grid = h("div", "sv-simon");
  const start = h("button", "btn primary", "Je suis prêt");
  start.type = "button";
  const pads = SYMBOLS.map((symbol, i) => {
    const b = h("button", "sv-simon-pad", symbol);
    b.type = "button";
    b.disabled = true;
    b.dataset.i = i;
    grid.append(b);
    return b;
  });
  let seq = [];
  let input = 0;
  let over = false;

  const flash = i => {
    pads[i].classList.add("lit");
    beep(NOTES[i], 0.25);
    setTimeout(() => pads[i].classList.remove("lit"), 380);
  };

  function play() {
    pads.forEach(p => { p.disabled = true; });
    info.textContent = `Suite de ${seq.length} : regarde…`;
    seq.forEach((i, k) => setTimeout(() => flash(i), 650 * k + 400));
    setTimeout(() => {
      input = 0;
      info.textContent = "À toi ! Reproduis la suite.";
      pads.forEach(p => { p.disabled = false; });
    }, 650 * seq.length + 500);
  }

  function next() {
    seq.push(Math.floor(Math.random() * SYMBOLS.length));
    if (seq.length > 15) { finish(15); return; }
    play();
  }

  function finish(score) {
    if (over) return;
    over = true;
    pads.forEach(p => { p.disabled = true; });
    info.textContent = `Score : ${score} symbole${score > 1 ? "s" : ""}`;
    done(score);
  }

  pads.forEach(pad => pad.addEventListener("click", () => {
    if (over) return;
    const i = Number(pad.dataset.i);
    flash(i);
    if (i !== seq[input]) {
      beep(160, 0.3, "sawtooth");
      finish(seq.length - 1);
      return;
    }
    input += 1;
    if (input === seq.length) {
      pads.forEach(p => { p.disabled = true; });
      info.textContent = "Bien joué !";
      setTimeout(next, 700);
    }
  }));

  start.addEventListener("click", () => {
    start.remove();
    seq = [0, 0, 0].map(() => Math.floor(Math.random() * SYMBOLS.length));
    play();
  });

  box.append(info, grid, start);
}

export const MINIGAMES = { reflex, tap, simon };

export function mountMinigame(kind, container, onDone) {
  let sent = false;
  const box = h("div", `sv-game sv-game-${kind}`);
  container.replaceChildren(box);
  MINIGAMES[kind](box, score => {
    if (sent) return;
    sent = true;
    onDone(score);
  });
}
