import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('phone3d');
const POSTER = /[?&]poster/.test(location.search);
const reduce = POSTER || matchMedia('(prefers-reduced-motion: reduce)').matches;

function fail(e) { console.warn('3D indisponível, usando imagem', e); stage.classList.add('nogl'); }

try { init(); } catch (e) { fail(e); }

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: POSTER });
  if (!renderer.getContext()) throw new Error('sem WebGL');
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x38d430, 2.4); rim.position.set(-3, 1, -2.5); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffffff, 0.8); rim2.position.set(3, -1, -3); scene.add(rim2);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  /* proporções de um Pro Max: ~78 x 163 x 8,7 mm */
  const H = 1.6, W = H * 78 / 163.4, D = H * 8.75 / 163.4, R = 0.125;

  const rrShape = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const flatRR = (w, h, r) => {
    const g = new THREE.ShapeGeometry(rrShape(w, h, r), 36);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
    return g;
  };
  const extr = (w, h, r, depth, bevel, seg = 6) => {
    const g = new THREE.ExtrudeGeometry(rrShape(w - bevel * 2, h - bevel * 2, Math.max(0.004, r - bevel)), {
      depth: Math.max(0.0005, depth - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: seg, curveSegments: 32
    });
    g.translate(0, 0, -(depth - bevel * 2) / 2);
    return g;
  };

  const COLORS = {
    prata:  { frame: 0xc9cdd0, back: 0xdfe2e4, rough: 0.32 },
    preto:  { frame: 0x2b2d30, back: 0x202226, rough: 0.3 },
    vinho:  { frame: 0x6a2130, back: 0x7a2a38, rough: 0.34 },
    gelo:   { frame: 0xa9c3d3, back: 0xc3d7e3, rough: 0.32 }
  };

  const phone = new THREE.Group();
  scene.add(phone);

  // corpo de alumínio (unibody)
  const frameMat = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  phone.add(new THREE.Mesh(extr(W, H, R, D, 0.016, 8), frameMat));

  // frente: vidro preto com bordas finas
  const glass = new THREE.Mesh(flatRR(W - 0.01, H - 0.01, R - 0.005),
    new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 }));
  glass.position.z = D / 2 + 0.0008; phone.add(glass);

  const sc = document.createElement('canvas'); sc.width = 760; sc.height = 1590;
  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;
  drawScreen(sc.getContext('2d')); screenTex.needsUpdate = true;
  const scr = new THREE.Mesh(flatRR(W - 0.04, H - 0.04, R - 0.022), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  scr.position.z = D / 2 + 0.0016; phone.add(scr);
  const gloss = new THREE.Mesh(flatRR(W - 0.04, H - 0.04, R - 0.022),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, roughness: 0, clearcoat: 1 }));
  gloss.position.z = D / 2 + 0.0024; phone.add(gloss);

  // traseira: painel de vidro fosco na parte de baixo
  const PLAT_H = 0.42; // altura do platô de câmeras
  const backMat = new THREE.MeshPhysicalMaterial({ metalness: 0.15, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const panelH = H - PLAT_H - 0.04;
  const panel = new THREE.Mesh(flatRR(W - 0.06, panelH, 0.09), backMat);
  panel.rotation.y = Math.PI; panel.position.set(0, -H / 2 + 0.03 + panelH / 2, -D / 2 - 0.0008);
  phone.add(panel);

  // logo FH CELL na traseira
  const lc = document.createElement('canvas'); lc.width = 512; lc.height = 160;
  const logoTex = new THREE.CanvasTexture(lc); logoTex.colorSpace = THREE.SRGBColorSpace;
  const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.25, metalness: 0.5 });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.094), logoMat);
  logo.rotation.y = Math.PI; logo.position.set(0, -0.2, -D / 2 - 0.0016); phone.add(logo);
  let logoDark = false;
  const drawLogo = () => {
    const x = lc.getContext('2d'); x.clearRect(0, 0, 512, 160);
    x.font = 'italic 900 110px Archivo, "Arial Black", sans-serif'; x.textBaseline = 'middle';
    x.fillStyle = '#2fbf28'; x.fillText('FH', 20, 84);
    x.fillStyle = logoDark ? '#1a1d1f' : '#eef2f0'; x.fillText('CELL', 196, 84);
    logoTex.needsUpdate = true;
  };
  drawLogo();

  // platô de câmeras de ponta a ponta
  const plateau = new THREE.Mesh(extr(W - 0.03, PLAT_H, 0.1, 0.03, 0.012, 6), frameMat);
  plateau.position.set(0, H / 2 - 0.02 - PLAT_H / 2, -D / 2 - 0.004);
  phone.add(plateau);
  const pz = -D / 2 - 0.004 - 0.015; // face do platô

  const ringMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2c2e, metalness: 1, roughness: 0.15 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x030405, roughness: 0, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0 });
  const innerMat = new THREE.MeshPhysicalMaterial({ color: 0x14205a, roughness: 0, metalness: 0.7, clearcoat: 1 });
  const cy = H / 2 - 0.02 - PLAT_H / 2, cx = W / 2 - 0.2; // lado esquerdo visto de trás = +x
  const lensR = 0.072;
  [[0.075, 0.085], [0.075, -0.085], [-0.07, 0]].forEach(([dx, dy]) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(lensR + 0.012, lensR + 0.014, 0.012, 48), ringMat);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(lensR, lensR + 0.002, 0.024, 48),
      new THREE.MeshPhysicalMaterial({ color: 0x8e9295, metalness: 1, roughness: 0.12 }));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(lensR - 0.012, lensR - 0.012, 0.026, 48), lensMat);
    [base, ring, lens].forEach(m => { m.rotation.x = Math.PI / 2; g.add(m); });
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.026, 32), innerMat);
    inner.rotation.y = Math.PI; inner.position.z = -0.0135; g.add(inner);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), new THREE.MeshBasicMaterial({ color: 0x7f9cff }));
    glint.rotation.y = Math.PI; glint.position.set(-0.012, 0.014, -0.0137); g.add(glint);
    g.position.set(cx + dx, cy + dy, pz - 0.01);
    phone.add(g);
  });
  // flash, LiDAR e microfone (lado direito do platô visto de trás = -x)
  const fx = -W / 2 + 0.13;
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.028, 32), new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0x2a2310, roughness: 0.25 }));
  flash.rotation.y = Math.PI; flash.position.set(fx, cy + 0.07, pz - 0.0005); phone.add(flash);
  const lidar = new THREE.Mesh(new THREE.CircleGeometry(0.026, 32), new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, clearcoat: 1 }));
  lidar.rotation.y = Math.PI; lidar.position.set(fx, cy - 0.07, pz - 0.0005); phone.add(lidar);
  const mic = new THREE.Mesh(new THREE.CircleGeometry(0.006, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  mic.rotation.y = Math.PI; mic.position.set(fx + 0.06, cy, pz - 0.0005); phone.add(mic);

  // botões: ação + volume (esquerda), power + controle de câmera (direita)
  const btn = (x, y, h, d = 0.028) => {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(d / 2.4, h, 4, 12), frameMat);
    b.rotation.x = 0; b.scale.set(0.5, 1, 1); b.position.set(x, y, 0); phone.add(b);
  };
  btn(-W / 2 - 0.002, 0.5, 0.07); btn(-W / 2 - 0.002, 0.33, 0.12); btn(-W / 2 - 0.002, 0.17, 0.12);
  btn(W / 2 + 0.002, 0.3, 0.18);
  const camCtl = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.11, 0.024), new THREE.MeshPhysicalMaterial({ color: 0x111214, roughness: 0.1, clearcoat: 1 }));
  camCtl.position.set(W / 2 + 0.002, -0.2, 0); phone.add(camCtl);

  function setColor(name) {
    const c = COLORS[name] || COLORS.prata;
    frameMat.color.setHex(c.frame); frameMat.roughness = c.rough;
    backMat.color.setHex(c.back);
    logoDark = name === 'prata' || name === 'gelo'; drawLogo();
  }
  setColor('prata');
  document.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x === b));
    setColor(b.dataset.color);
    tY = Math.round(tY / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 0.85; // vira pra mostrar a traseira
    lastInteract = performance.now(); stage.classList.add('touched');
  }));

  document.fonts && document.fonts.ready.then(() => { drawScreen(sc.getContext('2d')); screenTex.needsUpdate = true; drawLogo(); });

  /* interação */
  let tY = -0.4, tX = 0.06, vel = 0, dragging = false, lastX = 0, lastY = 0, lastInteract = 0;
  let rotY = reduce ? tY : -Math.PI * 1.6, rotX = tX;
  let introT = reduce ? 1 : 0, introStart = null;
  const startIntro = () => { introStart = performance.now(); };
  if (reduce || document.body.classList.contains('ready')) startIntro();
  else { addEventListener('intro-done', startIntro, { once: true }); setTimeout(startIntro, 2500); }

  canvas.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; vel = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    stage.classList.add('grab', 'touched');
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
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    const fit = (H * 1.32) / (2 * Math.tan(THREE.MathUtils.degToRad(15))); // enquadra a altura
    camera.position.set(0, 0, Math.max(fit, (W * 1.9) / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * camera.aspect)));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);

  const ease = t => 1 - Math.pow(1 - t, 3);
  const clock = new THREE.Clock();
  let first = true;
  (function tick() {
    requestAnimationFrame(tick);
    if (!visible && !first) return;
    const t = clock.getElapsedTime(), now = performance.now();
    if (introStart !== null && introT < 1) introT = Math.min(1, (now - introStart) / 1700);
    const k = ease(introT);
    if (!dragging) {
      tY += vel; vel *= 0.94;
      if (!reduce && now - lastInteract > 3000 && Math.abs(vel) < 0.002) { tY += 0.0035; tX += (0.06 - tX) * 0.02; }
    }
    if (introT < 1) rotY = -Math.PI * 1.6 + (tY + Math.PI * 1.6) * k;
    else rotY += (tY - rotY) * 0.12;
    rotX += (tX - rotX) * 0.12;
    phone.rotation.set(rotX, rotY, reduce ? 0 : Math.sin(t * 0.8) * 0.03);
    phone.position.y = (reduce ? 0 : Math.sin(t * 1.2) * 0.03) - (1 - k) * 0.8;
    phone.scale.setScalar(0.6 + 0.4 * k);
    renderer.render(scene, camera);
    if (first) { first = false; stage.classList.add('live'); }
  })();
}

/* tela com a interface da FH Cell */
function drawScreen(c) {
  const w = 760, h = 1590;
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0d1a12'); bg.addColorStop(0.55, '#07100a'); bg.addColorStop(1, '#030604');
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const glow = c.createRadialGradient(600, 280, 10, 600, 280, 560);
  glow.addColorStop(0, 'rgba(56,212,48,.35)'); glow.addColorStop(1, 'rgba(56,212,48,0)');
  c.fillStyle = glow; c.fillRect(0, 0, w, h);
  const F = 'Inter, Arial, sans-serif', A = 'Archivo, "Arial Black", sans-serif';
  c.fillStyle = '#fff'; c.font = `600 36px ${F}`; c.fillText('9:41', 74, 84);
  [0, 1, 2, 3].forEach(i => c.fillRect(500 + i * 16, 84 - (i + 1) * 7, 10, (i + 1) * 7));
  c.fillRect(592, 58, 56, 28); c.fillStyle = '#0d1a12'; c.fillRect(595, 61, 50, 22);
  c.fillStyle = '#38d430'; c.fillRect(597, 63, 42, 18); c.fillStyle = '#fff'; c.fillRect(650, 66, 5, 12);
  c.fillStyle = '#000'; rr(c, 270, 40, 220, 64, 32); c.fill(); // Dynamic Island
  c.font = `italic 900 66px ${A}`; c.fillStyle = '#38d430'; c.fillText('FH', 70, 220);
  c.fillStyle = '#fff'; c.fillText(' CELL', 70 + c.measureText('FH').width, 220);
  c.font = `500 30px ${F}`; c.fillStyle = '#9aa6a0'; c.fillText('Assistência técnica · Uberlândia', 70, 272);
  c.font = `800 70px ${A}`; c.fillStyle = '#fff';
  c.fillText('Seu celular', 70, 410); c.fillText('consertado', 70, 486);
  c.fillStyle = '#38d430'; c.fillText('sem sair de casa.', 70, 562);
  c.fillStyle = 'rgba(255,255,255,.06)'; rr(c, 52, 630, 656, 560, 42); c.fill();
  c.strokeStyle = 'rgba(56,212,48,.35)'; c.lineWidth = 2; c.stroke();
  c.font = `700 38px ${F}`; c.fillStyle = '#fff'; c.fillText('Seu orçamento', 98, 702);
  [['Aparelho', 'iPhone 18 Pro Max'], ['Problema', 'Troca de tela'], ['Entrega', 'Busca grátis']].forEach(([k, v], i) => {
    const y = 760 + i * 124;
    c.fillStyle = 'rgba(56,212,48,.16)'; rr(c, 98, y, 80, 80, 22); c.fill();
    c.strokeStyle = '#38d430'; c.lineWidth = 5; c.beginPath();
    c.moveTo(120, y + 42); c.lineTo(134, y + 56); c.lineTo(158, y + 28); c.stroke();
    c.font = `500 28px ${F}`; c.fillStyle = '#9aa6a0'; c.fillText(k, 206, y + 32);
    c.font = `700 34px ${F}`; c.fillStyle = '#fff'; c.fillText(v, 206, y + 72);
  });
  c.fillStyle = '#38d430'; rr(c, 52, 1236, 656, 118, 32); c.fill();
  c.fillStyle = '#041004'; c.font = `800 38px ${F}`; c.textAlign = 'center';
  c.fillText('Enviar no WhatsApp', 380, 1308); c.textAlign = 'left';
  c.font = `600 30px ${F}`; c.fillStyle = '#c9d6cf';
  c.fillText('~40 min', 92, 1430); c.fillText('3 meses de garantia', 330, 1430);
  c.fillStyle = '#38d430'; c.beginPath(); c.arc(74, 1420, 8, 0, 7); c.fill(); c.beginPath(); c.arc(312, 1420, 8, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)'; rr(c, 280, 1530, 200, 10, 5); c.fill();
}
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
