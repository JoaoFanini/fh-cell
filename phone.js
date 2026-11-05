import * as THREE from 'three';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('phone3d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  stage.classList.add('nogl');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
camera.position.set(0, 0, 4.3);

const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 3, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0x38d430, 2.2); rim.position.set(-3, 1, -2); scene.add(rim);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

/* ---------- geometria ---------- */
const W = 0.72, H = 1.48, D = 0.078, R = 0.105;

function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function flatRR(w, h, r) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 32);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}

const phone = new THREE.Group();
scene.add(phone);

// moldura metálica
const bevel = 0.014;
const bodyGeo = new THREE.ExtrudeGeometry(rrShape(W - bevel * 2, H - bevel * 2, R - bevel), {
  depth: D - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
  bevelSegments: 6, curveSegments: 28
});
bodyGeo.translate(0, 0, -(D - bevel * 2) / 2);
const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x3a403d, metalness: 1, roughness: 0.26, clearcoat: 0.4 });
phone.add(new THREE.Mesh(bodyGeo, frameMat));

// vidro frontal (bordas pretas)
const glass = new THREE.Mesh(flatRR(W - 0.012, H - 0.012, R - 0.006),
  new THREE.MeshPhysicalMaterial({ color: 0x030303, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 }));
glass.position.z = D / 2 + 0.0008;
phone.add(glass);

// tela (textura desenhada)
const sc = document.createElement('canvas');
sc.width = 720; sc.height = 1480;
drawScreen(sc.getContext('2d'));
const screenTex = new THREE.CanvasTexture(sc);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = 8;
const screen = new THREE.Mesh(flatRR(W - 0.05, H - 0.05, R - 0.03),
  new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
screen.position.z = D / 2 + 0.0016;
phone.add(screen);

// reflexo sutil por cima da tela
const gloss = new THREE.Mesh(flatRR(W - 0.05, H - 0.05, R - 0.03),
  new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0, metalness: 0, clearcoat: 1 }));
gloss.position.z = D / 2 + 0.0024;
phone.add(gloss);

// traseira em vidro fosco
const back = new THREE.Mesh(flatRR(W - 0.012, H - 0.012, R - 0.006),
  new THREE.MeshPhysicalMaterial({ color: 0x18231d, roughness: 0.42, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
back.rotation.y = Math.PI;
back.position.z = -D / 2 - 0.0008;
phone.add(back);

// logo na traseira
const lc = document.createElement('canvas'); lc.width = 512; lc.height = 160;
const lx = lc.getContext('2d');
lx.font = 'italic 900 110px Archivo, Arial Black, sans-serif'; lx.textBaseline = 'middle';
lx.fillStyle = '#38d430'; lx.fillText('FH', 20, 84);
lx.fillStyle = '#e9efec'; lx.fillText('CELL', 196, 84);
const logoTex = new THREE.CanvasTexture(lc); logoTex.colorSpace = THREE.SRGBColorSpace;
const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.106),
  new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.3, metalness: 0.4 }));
logo.rotation.y = Math.PI; logo.position.set(0, -0.12, -D / 2 - 0.0015);
phone.add(logo);

// módulo de câmera
const camShape = rrShape(0.3, 0.3, 0.07);
const camGeo = new THREE.ExtrudeGeometry(camShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 4, curveSegments: 20 });
const camMod = new THREE.Mesh(camGeo, new THREE.MeshPhysicalMaterial({ color: 0x1d2a22, roughness: 0.15, metalness: 0.3, clearcoat: 1 }));
camMod.rotation.y = Math.PI;
camMod.position.set(W / 2 - 0.2, H / 2 - 0.2, -D / 2 - 0.0005);
phone.add(camMod);

const ringMat = new THREE.MeshPhysicalMaterial({ color: 0x8c948f, metalness: 1, roughness: 0.18 });
const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0 });
const innerMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1a3a, roughness: 0, metalness: 0.6, clearcoat: 1 });
const lensPos = [[0.065, 0.065], [0.065, -0.065], [-0.065, 0]];
lensPos.forEach(([dx, dy]) => {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.058, 0.022, 40), ringMat);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.024, 40), lensMat);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.02, 32), innerMat);
  [ring, lens].forEach(m => { m.rotation.x = Math.PI / 2; g.add(m); });
  inner.rotation.y = Math.PI; inner.position.z = -0.0125; g.add(inner);
  g.position.set(W / 2 - 0.2 - dx, H / 2 - 0.2 + dy, -D / 2 - 0.022);
  phone.add(g);
});
const flash = new THREE.Mesh(new THREE.CircleGeometry(0.018, 24), new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0x332a10, roughness: 0.3 }));
flash.rotation.y = Math.PI; flash.position.set(W / 2 - 0.2 + 0.075, H / 2 - 0.2 - 0.075, -D / 2 - 0.016);
phone.add(flash);

// botões laterais
const btnMat = frameMat;
function sideBtn(x, y, h) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, h, 0.03), btnMat);
  b.position.set(x, y, 0); phone.add(b);
}
sideBtn(W / 2 + 0.003, 0.28, 0.2);
sideBtn(-W / 2 - 0.003, 0.36, 0.11);
sideBtn(-W / 2 - 0.003, 0.2, 0.11);

/* ---------- tela: interface FH Cell ---------- */
function drawScreen(c) {
  const w = 720, h = 1480;
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0d1a12'); bg.addColorStop(0.55, '#07100a'); bg.addColorStop(1, '#030604');
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const glow = c.createRadialGradient(560, 260, 10, 560, 260, 520);
  glow.addColorStop(0, 'rgba(56,212,48,.35)'); glow.addColorStop(1, 'rgba(56,212,48,0)');
  c.fillStyle = glow; c.fillRect(0, 0, w, h);

  const F = 'Inter, Arial, sans-serif', A = 'Archivo, Arial Black, sans-serif';
  // status bar
  c.fillStyle = '#fff'; c.font = `600 34px ${F}`; c.fillText('9:41', 64, 74);
  c.fillRect(560, 50, 52, 26); c.fillStyle = '#0d1a12'; c.fillRect(563, 53, 46, 20);
  c.fillStyle = '#38d430'; c.fillRect(565, 55, 38, 16); c.fillStyle = '#fff'; c.fillRect(614, 57, 5, 12);
  [0, 1, 2, 3].forEach(i => c.fillRect(470 + i * 16, 74 - (i + 1) * 7, 10, (i + 1) * 7));
  // câmera frontal
  c.fillStyle = '#000'; round(c, 270, 36, 180, 52, 26); c.fill();

  // logo
  c.font = `italic 900 64px ${A}`; c.fillStyle = '#38d430'; c.fillText('FH', 64, 200);
  c.fillStyle = '#fff'; c.fillText(' CELL', 64 + c.measureText('FH').width, 200);
  c.font = `500 30px ${F}`; c.fillStyle = '#9aa6a0'; c.fillText('Assistência técnica · Uberlândia', 64, 250);

  // hero texto
  c.font = `800 66px ${A}`; c.fillStyle = '#fff';
  c.fillText('Seu celular', 64, 380); c.fillText('consertado', 64, 452);
  c.fillStyle = '#38d430'; c.fillText('sem sair de casa.', 64, 524);

  // card orçamento
  c.fillStyle = 'rgba(255,255,255,.06)'; round(c, 48, 590, 624, 540, 40); c.fill();
  c.strokeStyle = 'rgba(56,212,48,.35)'; c.lineWidth = 2; c.stroke();
  c.font = `700 36px ${F}`; c.fillStyle = '#fff'; c.fillText('Seu orçamento', 92, 660);
  const rows = [['📱', 'Aparelho', 'iPhone 14 Pro'], ['🔧', 'Problema', 'Troca de bateria'], ['🛵', 'Entrega', 'Busca grátis']];
  rows.forEach(([ic, k, v], i) => {
    const y = 720 + i * 118;
    c.fillStyle = 'rgba(56,212,48,.14)'; round(c, 92, y, 76, 76, 20); c.fill();
    c.font = `40px ${F}`; c.fillText(ic, 108, y + 52);
    c.font = `500 26px ${F}`; c.fillStyle = '#9aa6a0'; c.fillText(k, 196, y + 30);
    c.font = `700 32px ${F}`; c.fillStyle = '#fff'; c.fillText(v, 196, y + 68);
  });
  // botão
  c.fillStyle = '#38d430'; round(c, 48, 1170, 624, 112, 30); c.fill();
  c.fillStyle = '#041004'; c.font = `800 36px ${F}`; c.textAlign = 'center';
  c.fillText('Enviar no WhatsApp', 360, 1238); c.textAlign = 'left';
  // selos
  c.font = `600 28px ${F}`; c.fillStyle = '#c9d6cf';
  c.fillText('⚡ ~40 min', 72, 1350); c.fillText('🛡️ 3 meses de garantia', 300, 1350);
  // home bar
  c.fillStyle = 'rgba(255,255,255,.7)'; round(c, 260, 1420, 200, 10, 5); c.fill();
}
function round(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
// redesenha quando as fontes carregarem
document.fonts && document.fonts.ready.then(() => {
  drawScreen(sc.getContext('2d')); screenTex.needsUpdate = true;
  lx.clearRect(0, 0, 512, 160);
  lx.font = 'italic 900 110px Archivo, Arial Black, sans-serif';
  lx.fillStyle = '#38d430'; lx.fillText('FH', 20, 84); lx.fillStyle = '#e9efec'; lx.fillText('CELL', 196, 84);
  logoTex.needsUpdate = true;
});

/* ---------- interação ---------- */
let rotY = reduce ? -0.35 : -Math.PI * 1.6, rotX = 0.08;
let tY = -0.35, tX = 0.08, vel = 0, dragging = false, lastX = 0, lastY = 0, lastInteract = 0;
let introT = reduce ? 1 : 0, introStart = null;
const startIntro = () => { introStart = performance.now(); };
if (document.body.classList.contains('ready')) startIntro();
else addEventListener('intro-done', startIntro, { once: true });

canvas.addEventListener('pointerdown', e => {
  dragging = true; lastX = e.clientX; lastY = e.clientY; vel = 0;
  canvas.setPointerCapture(e.pointerId); stage.classList.add('grab'); stage.classList.add('touched');
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  vel = dx * 0.012; tY += vel;
  tX = Math.max(-0.6, Math.min(0.6, tX + dy * 0.006));
  lastInteract = performance.now();
});
const end = () => { dragging = false; stage.classList.remove('grab'); lastInteract = performance.now(); };
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', end);

function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.position.z = r.width < 600 ? 3.75 : 3.9;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);

const ease = t => 1 - Math.pow(1 - t, 3);
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  if (!visible) return;
  const t = clock.getElapsedTime(), now = performance.now();

  if (introStart !== null && introT < 1) introT = Math.min(1, (now - introStart) / 1700);
  const k = ease(introT);

  if (!dragging) {
    tY += vel; vel *= 0.94;
    if (!reduce && now - lastInteract > 2500 && Math.abs(vel) < 0.002) {
      tY += 0.0035; // gira devagar sozinho
      tX += (0.08 - tX) * 0.02;
    }
  }
  if (introT < 1) { rotY = -Math.PI * 1.6 + (tY + Math.PI * 1.6) * k; }
  else rotY += (tY - rotY) * 0.12;
  rotX += (tX - rotX) * 0.12;

  phone.rotation.set(rotX, rotY, reduce ? 0 : Math.sin(t * 0.8) * 0.03);
  phone.position.y = (reduce ? 0 : Math.sin(t * 1.2) * 0.035) - (1 - k) * 0.8;
  const s = 0.6 + 0.4 * k; phone.scale.setScalar(s);
  renderer.render(scene, camera);
}
tick();
stage.classList.add('live');
