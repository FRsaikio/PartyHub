/* PartyHub V33 — Ultra Smooth Animations + Audio FX
   Aucun fichier audio externe : sons générés en Web Audio, activés après le premier clic. */
(() => {
  const KEY = "partyhubFxEnabled";
  const SOUND_KEY = "partyhubFxSoundEnabled";

  const state = {
    enabled: localStorage.getItem(KEY) !== "false",
    sound: localStorage.getItem(SOUND_KEY) !== "false",
    ctx: null,
    master: null,
    lastBoomAt: 0,
    lastJoinCount: null,
    lastRoute: location.href,
    seenTexts: new Set(),
  };

  function injectStyle(){
    if(document.getElementById("partyhub-v33-fx-style")) return;
    const style = document.createElement("style");
    style.id = "partyhub-v33-fx-style";
    style.textContent = `
      :root{--ph-fx-fast:.18s;--ph-fx-med:.42s;--ph-fx-slow:.75s;}
      body:not(.ph-no-fx) .screen.active,
      body:not(.ph-no-fx) main,
      body:not(.ph-no-fx) .tv-panel,
      body:not(.ph-no-fx) .panel,
      body:not(.ph-no-fx) .card{animation:phFadeUp var(--ph-fx-med) cubic-bezier(.2,.9,.2,1) both;}
      body:not(.ph-no-fx) button,
      body:not(.ph-no-fx) .btn,
      body:not(.ph-no-fx) .game-card,
      body:not(.ph-no-fx) .mode-card,
      body:not(.ph-no-fx) .tv-control-btn{transition:transform var(--ph-fx-fast) ease, box-shadow var(--ph-fx-fast) ease, filter var(--ph-fx-fast) ease, opacity var(--ph-fx-fast) ease; will-change:transform;}
      body:not(.ph-no-fx) button:not(:disabled):hover,
      body:not(.ph-no-fx) .btn:not(:disabled):hover,
      body:not(.ph-no-fx) .game-card:hover,
      body:not(.ph-no-fx) .mode-card:hover,
      body:not(.ph-no-fx) .tv-control-btn:not(:disabled):hover{transform:translateY(-2px) scale(1.015); filter:saturate(1.08);}
      body:not(.ph-no-fx) button:not(:disabled):active,
      body:not(.ph-no-fx) .btn:not(:disabled):active,
      body:not(.ph-no-fx) .game-card:active,
      body:not(.ph-no-fx) .mode-card:active{transform:translateY(1px) scale(.985);}
      .ph-pop-in{animation:phPop .48s cubic-bezier(.16,1.35,.38,1) both;}
      .ph-score-pop{animation:phScorePop .65s cubic-bezier(.18,1.4,.3,1) both;}
      .ph-shake{animation:phShake .48s ease both;}
      .ph-pulse-glow{animation:phPulseGlow 1.4s ease-in-out infinite;}
      .ph-confetti{position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden;}
      .ph-confetti i{position:absolute;top:-24px;font-style:normal;font-size:18px;animation:phConfettiFall var(--fall,2.8s) linear forwards;left:var(--x,50vw);transform:rotate(var(--r,0deg));}
      .ph-audio-toast{position:fixed;left:18px;bottom:18px;z-index:99998;padding:10px 14px;border-radius:999px;background:rgba(12,12,24,.82);color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 40px rgba(0,0,0,.35);font:800 13px/1 system-ui,Arial;backdrop-filter:blur(12px);opacity:0;transform:translateY(10px);transition:.25s ease;}
      .ph-audio-toast.show{opacity:1;transform:translateY(0);}
      @keyframes phFadeUp{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
      @keyframes phPop{0%{opacity:0;transform:scale(.86)}70%{opacity:1;transform:scale(1.035)}100%{transform:scale(1)}}
      @keyframes phScorePop{0%{transform:scale(.82);filter:brightness(1)}40%{transform:scale(1.12);filter:brightness(1.45)}100%{transform:scale(1);filter:brightness(1)}}
      @keyframes phShake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}
      @keyframes phPulseGlow{0%,100%{box-shadow:0 0 18px rgba(255,0,170,.22)}50%{box-shadow:0 0 42px rgba(0,200,255,.38),0 0 70px rgba(255,0,170,.28)}}
      @keyframes phConfettiFall{to{top:110vh;transform:translateX(var(--drift,0px)) rotate(calc(var(--r,0deg) + 580deg));opacity:.05}}
      @media (prefers-reduced-motion: reduce){.ph-pop-in,.ph-score-pop,.ph-shake,.ph-pulse-glow,body *{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function initAudio(){
    if(!state.sound) return null;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      if(!state.ctx){
        state.ctx = new AC();
        state.master = state.ctx.createGain();
        state.master.gain.value = 0.055;
        state.master.connect(state.ctx.destination);
      }
      if(state.ctx.state === "suspended") state.ctx.resume();
      return state.ctx;
    }catch{return null;}
  }

  function panFromEvent(evt){
    if(!evt || !window.StereoPannerNode) return null;
    const ctx = initAudio();
    if(!ctx) return null;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, ((evt.clientX || innerWidth/2) / innerWidth) * 2 - 1));
    pan.connect(state.master);
    return pan;
  }

  function tone(freq=440, duration=.12, type="triangle", volume=1, evt=null, delay=0){
    if(!state.enabled || !state.sound) return;
    const ctx = initAudio();
    if(!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const destination = panFromEvent(evt) || state.master;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), ctx.currentTime + delay + .015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + .03);
  }

  function noise(duration=.22, filterFreq=900, volume=.7, evt=null){
    if(!state.enabled || !state.sound) return;
    const ctx = initAudio();
    if(!ctx) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * Math.pow(1-i/data.length, 2);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter); filter.connect(gain); gain.connect(panFromEvent(evt) || state.master);
    src.start();
  }

  const sounds = {
    click: evt => { tone(520,.055,"triangle",.55,evt); tone(740,.06,"triangle",.35,evt,.045); },
    select: evt => { tone(410,.08,"sine",.45,evt); tone(620,.12,"sine",.35,evt,.07); },
    launch: evt => { tone(392,.11,"triangle",.75,evt); tone(523,.12,"triangle",.75,evt,.12); tone(659,.16,"triangle",.8,evt,.25); tone(784,.24,"triangle",.65,evt,.42); },
    join: evt => { tone(660,.09,"sine",.45,evt); tone(880,.16,"sine",.35,evt,.08); },
    back: evt => { tone(330,.1,"triangle",.55,evt); tone(260,.15,"triangle",.45,evt,.1); },
    spin: evt => { for(let i=0;i<10;i++) tone(220+i*38,.035,"sawtooth",.22,evt,i*.045); },
    bomb: evt => { noise(.45,700,.9,evt); tone(90,.45,"sawtooth",1,evt); tone(55,.55,"sine",.8,evt,.06); },
    win: evt => { sounds.launch(evt); setTimeout(()=>confetti(),80); },
    error: evt => { tone(150,.1,"sawtooth",.7,evt); tone(110,.16,"sawtooth",.55,evt,.09); },
  };

  function confetti(count=50){
    if(!state.enabled) return;
    const box = document.createElement("div");
    box.className = "ph-confetti";
    const pieces = ["🎉","✨","🍻","🔥","💫","⭐"];
    for(let i=0;i<count;i++){
      const p = document.createElement("i");
      p.textContent = pieces[Math.floor(Math.random()*pieces.length)];
      p.style.setProperty("--x", Math.random()*100 + "vw");
      p.style.setProperty("--r", Math.random()*360 + "deg");
      p.style.setProperty("--drift", (Math.random()*220-110) + "px");
      p.style.setProperty("--fall", (2.1 + Math.random()*2.2) + "s");
      p.style.animationDelay = Math.random()*.35 + "s";
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(()=>box.remove(),5200);
  }

  function toast(text){
    let t = document.querySelector(".ph-audio-toast");
    if(!t){ t = document.createElement("div"); t.className = "ph-audio-toast"; document.body.appendChild(t); }
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(()=>t.classList.remove("show"),1800);
  }

  function addPop(el){
    if(!state.enabled || !el || el.classList?.contains("ph-pop-in")) return;
    el.classList.add("ph-pop-in");
    setTimeout(()=>el.classList.remove("ph-pop-in"),800);
  }

  function scanAndAnimate(root=document){
    const selectors = [
      ".tv-player", ".player-item", ".players li", ".activity-list li", ".tv-activity li",
      ".tv-event", ".tv-live-history-list li", ".score-row", ".history li", ".game-card.selected"
    ].join(",");
    root.querySelectorAll?.(selectors).forEach(addPop);
  }

  function semanticSoundFromText(text){
    const t = String(text || "").toLowerCase();
    if(!t || state.seenTexts.has(t)) return;
    state.seenTexts.add(t);
    if(state.seenTexts.size > 80) state.seenTexts.clear();
    if(t.includes("explos") || t.includes("bombe")) sounds.bomb();
    else if(t.includes("rejoint") || t.includes("join")) sounds.join();
    else if(t.includes("lance") || t.includes("partie lanc") || t.includes("jeu lancé")) sounds.launch();
    else if(t.includes("gagn") || t.includes("victoire") || t.includes("winner")) sounds.win();
  }

  function bind(){
    document.addEventListener("pointerdown", (evt) => {
      const target = evt.target.closest?.("button,.btn,.game-card,.mode-card,.tv-control-btn,.card,.casino-card");
      if(!target) return;
      initAudio();
      if(target.disabled || target.getAttribute("aria-disabled") === "true") { sounds.error(evt); return; }
      const txt = (target.textContent || "").toLowerCase();
      if(txt.includes("lancer") || txt.includes("spin") || txt.includes("nouvelle bombe")) sounds.launch(evt);
      else if(txt.includes("retour") || txt.includes("lobby") || txt.includes("quitter")) sounds.back(evt);
      else if(target.classList.contains("game-card") || target.classList.contains("mode-card")) sounds.select(evt);
      else sounds.click(evt);
    }, {passive:true});

    document.addEventListener("change", (evt) => {
      if(evt.target.matches?.("select,input[type='checkbox'],input[type='range']")) sounds.select(evt);
    });

    const obs = new MutationObserver((mutations) => {
      for(const m of mutations){
        m.addedNodes.forEach(node => {
          if(node.nodeType !== 1) return;
          addPop(node.matches?.(".tv-player,.player-item,.game-card,.mode-card,.activity-list li,.tv-activity li,.tv-live-history-list li") ? node : null);
          scanAndAnimate(node);
          semanticSoundFromText(node.textContent);
        });
        if(m.type === "characterData") semanticSoundFromText(m.target.textContent);
      }
    });
    obs.observe(document.body, {childList:true, subtree:true, characterData:true});
  }

  function addFxToggle(){
    if(document.getElementById("partyhubFxMiniToggle")) return;
    const btn = document.createElement("button");
    btn.id = "partyhubFxMiniToggle";
    btn.type = "button";
    btn.textContent = state.sound ? "🔊 FX" : "🔇 FX";
    btn.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:99990;border:1px solid rgba(255,255,255,.16);background:rgba(15,15,28,.72);color:#fff;border-radius:999px;padding:9px 12px;font:900 12px system-ui;backdrop-filter:blur(12px);cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.3)";
    btn.addEventListener("click", (evt)=>{
      state.sound = !state.sound;
      localStorage.setItem(SOUND_KEY, String(state.sound));
      btn.textContent = state.sound ? "🔊 FX" : "🔇 FX";
      toast(state.sound ? "Sons PartyHub activés" : "Sons PartyHub coupés");
      if(state.sound) sounds.win(evt);
    });
    document.body.appendChild(btn);
  }

  function boot(){
    if(!state.enabled) document.body.classList.add("ph-no-fx");
    injectStyle();
    bind();
    scanAndAnimate();
    addFxToggle();
    setTimeout(()=>toast("V33 FX prêt · clique pour activer le son"),500);
  }

  window.PartyHubFX = { sounds, confetti, tone, noise, enableSound(){ state.sound = true; localStorage.setItem(SOUND_KEY,"true"); initAudio(); }, disableSound(){ state.sound = false; localStorage.setItem(SOUND_KEY,"false"); } };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
