// -------------------------------------------------
// CONFIGURAÇÕES BÁSICAS
// -------------------------------------------------
const fps = 30;
const totalSec = 30;
const totalFrames = fps * totalSec;
gsap.defaults({ ease: "power2.out" });

// Helper: converte segundos → frames (usado para rótulos)
const sec = s => s * fps;

// -------------------------------------------------
// CRIAÇÃO DA TIMELINE PRINCIPAL
// -------------------------------------------------
const tl = gsap.timeline({ paused:true });

// ---------- CENA 1 (0‑4 s) ----------
tl.addLabel("scene1", sec(0))
  .to("#scene-1", {opacity:1, duration:0.5})
  .from("#scene-1 .headline", {opacity:0, y:30, duration:0.8}, "-=0.3")
  .from("#scene-1 .agenda", {scale:0.9, opacity:0, duration:0.8}, "-=0.6")
  .to("#scene-1", {opacity:0, duration:0.5}, sec(4));

// ---------- CENA 2 (4‑8 s) ----------
tl.addLabel("scene2", sec(4))
  .to("#scene-2", {opacity:1, duration:0.5})
  .from("#scene-2 .headline", {opacity:0, y:30, duration:0.8}, "-=0.3")
  .from("#scene-2 .online", {scale:0.9, opacity:0, duration:0.8}, "-=0.6")
  .to("#scene-2", {opacity:0, duration:0.5}, sec(8));

// ---------- CENA 3 (8‑12 s) ----------
tl.addLabel("scene3", sec(8))
  .to("#scene-3", {opacity:1, duration:0.5})
  .from("#scene-3 .headline", {opacity:0, y:30, duration:0.8}, "-=0.3")
  .from("#scene-3 .board", {scale:0.9, opacity:
