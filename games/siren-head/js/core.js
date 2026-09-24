/* =========================================================================
   SIREN HEAD: TORONTO NIGHT — core.js
   Renderer, quality tiers, scene/camera/lights, shadows, post-processing,
   shared materials + procedural (canvas) textures. Everything hangs off
   the global `G` so the other files (world.js, models.js, game.js) can use it.
   ========================================================================= */
(function () {
"use strict";
const THREE = window.THREE;
const G = window.G = {};

/* ---------- constants / tuning ---------- */
G.HUMAN = 1.8; G.SCALE = 5; G.PLAYER_H = G.HUMAN * G.SCALE;   // ~9 m
G.CFG = {
  walk: 9, run: 18, turn: 2.2,
  gravity: 34, jump: 13,
  strikeCd: 0.55, strikeDmg: 55, strikeRange: 11, strikeArc: Math.PI * 0.6,
  biteCd: 1.15,  biteDmg: 120,  biteRange: 9,   biteArc: Math.PI * 0.45,
  blastCd: 6.5,  blastDmg: 45,  blastRange: 30,
  hpMax: 100, hpRegen: 1.6,
  // the big thunder + white-flash event: first one soon so it's seen, then every 1–5 minutes
  stormFirst: [30, 75], stormEvery: [60, 300],
};

/* ---------- quality tiers (chosen on the start screen, persisted, page reloads) ---------- */
G.PRESETS = {
  low:    { post:false, bloom:false, shadows:false, shadowRes:512,  reflect:false, reflectRes:256,  rain:1800, splash:0,   dpr:1.0,  cones:false, aa:true  },
  medium: { post:true,  bloom:true,  shadows:true,  shadowRes:1024, reflect:true,  reflectRes:512,  rain:3600, splash:110, dpr:1.25, cones:true,  aa:true  },
  high:   { post:true,  bloom:true,  shadows:true,  shadowRes:2048, reflect:true,  reflectRes:1024, rain:5600, splash:220, dpr:1.75, cones:true,  aa:true  },
};
let qName = 'medium';
try { qName = localStorage.getItem('shq') || 'medium'; } catch (e) {}
if (!G.PRESETS[qName]) qName = 'medium';
G.qualityName = qName;
const Q = G.Q = G.PRESETS[qName];

/* ---------- renderer ---------- */
const renderer = G.renderer = new THREE.WebGLRenderer({
  antialias: !Q.post, powerPreference: 'high-performance', preserveDrawingBuffer: true,
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr));
renderer.setClearColor(0x05060a, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = Q.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

/* ---------- scene / camera / fog ---------- */
const scene = G.scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
G.FOG_COLOR = 0x0b1018;
scene.fog = new THREE.Fog(G.FOG_COLOR, 60, 520);
const camera = G.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 6000);

/* ---------- lights ---------- */
// moon direction: up-right in the NORTH sky so the moon disc is visible while heading to the tower
G.moonDir = new THREE.Vector3(0.22, 0.26, 0.94).normalize();   // ~15° up, just right of the tower in the avenue view
const hemi = G.hemi = new THREE.HemisphereLight(0x3d566f, 0x0e1118, 0.8);
scene.add(hemi);
const moon = G.moon = new THREE.DirectionalLight(0xb9c6e6, 0.85);
moon.position.copy(G.moonDir).multiplyScalar(260);
moon.castShadow = Q.shadows;
if (Q.shadows) {
  moon.shadow.mapSize.set(Q.shadowRes, Q.shadowRes);
  const sc = moon.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 20; sc.far = 600;
  moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03; moon.shadow.radius = 2;
}
scene.add(moon); scene.add(moon.target);
const moonFill = G.moonFill = new THREE.DirectionalLight(0x6c86b8, 0.5);   // soft fill from the camera side
moonFill.position.set(40, 90, -120); scene.add(moonFill);
// character key light: follows the player on the camera side so Siren Head always reads against the dark city
const playerLight = G.playerLight = new THREE.PointLight(0xaec3ec, 1.8, 38, 1.3);
scene.add(playerLight);
const ambient = G.ambient = new THREE.AmbientLight(0x222836, 1.0);
scene.add(ambient);
const lightning = G.lightning = new THREE.DirectionalLight(0xdfe6ff, 0.0);
lightning.position.set(80, 160, 120); scene.add(lightning);

/* ---------- post-processing (bloom + FXAA + film pass); falls back to plain render ---------- */
G.composer = null; G.finalPass = null; G.bloomPass = null;
(function setupPost() {
  if (!Q.post || !THREE.EffectComposer || !THREE.RenderPass || !THREE.ShaderPass) return;
  try {
    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    if (Q.bloom && THREE.UnrealBloomPass) {
      const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.42, 0.82);
      composer.addPass(bloom); G.bloomPass = bloom;
    }
    if (Q.aa && THREE.FXAAShader) {
      const fxaa = new THREE.ShaderPass(THREE.FXAAShader);
      const pr = renderer.getPixelRatio();
      fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
      composer.addPass(fxaa); G.fxaaPass = fxaa;
    }
    // film pass: chromatic aberration (spikes on siren blast / boss hits), vignette, grain
    const FilmShader = {
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: 0.0 }, uVignette: { value: 0.55 }, uGrain: { value: 0.035 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime,uAberr,uVignette,uGrain; varying vec2 vUv;
        void main(){
          vec2 c=vUv-0.5; float r=length(c); vec2 off=c*uAberr*(0.3+r);
          float R=texture2D(tDiffuse,vUv+off).r; float Gc=texture2D(tDiffuse,vUv).g; float B=texture2D(tDiffuse,vUv-off).b;
          vec3 col=vec3(R,Gc,B);
          col*=1.0-uVignette*smoothstep(0.38,1.05,r);
          float n=fract(sin(dot(vUv*(uTime+1.0),vec2(12.9898,78.233)))*43758.5453);
          col+=(n-0.5)*uGrain;
          gl_FragColor=vec4(col,1.0);
        }`,
    };
    const film = new THREE.ShaderPass(FilmShader);
    composer.addPass(film);
    G.composer = composer; G.finalPass = film;
  } catch (e) { console.warn('Post-processing unavailable, rendering directly.', e); G.composer = null; }
})();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (G.composer) G.composer.setSize(innerWidth, innerHeight);
  if (G.fxaaPass) { const pr = renderer.getPixelRatio(); G.fxaaPass.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr)); }
});

/* =========================================================================
   PROCEDURAL TEXTURES (canvas) — no downloads needed, fully portable
   ========================================================================= */
const T = G.tex = {};
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, repeat) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4; return t; }
const rnd = Math.random;

// grayscale value noise → generic grunge / bump
T.noise = function (size, cells, contrast, base) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = `rgb(${base||128},${base||128},${base||128})`; g.fillRect(0, 0, size, size);
  for (let layer = 0; layer < 3; layer++) {
    const n = cells * (layer + 1);
    for (let i = 0; i < n * n * 0.6; i++) {
      const v = 128 + (rnd() - 0.5) * 2 * contrast / (layer + 1);
      g.fillStyle = `rgba(${v|0},${v|0},${v|0},${0.35/(layer+1)})`;
      const s = size / n * (0.6 + rnd());
      g.fillRect(rnd() * size, rnd() * size, s, s);
    }
  }
  return c;
};
T.noiseTex = (size, cells, contrast, repeat, base) => toTex(T.noise(size, cells, contrast, base), repeat);

// soft radial disc (splashes, dust, glow, contact shadows)
T.softDisc = function (inner, outer) {
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
};
// thin ring (rain splash)
T.ring = function () {
  const c = canvas(64, 64), g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 6; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.stroke();
  return new THREE.CanvasTexture(c);
};

// building facade: dark wall + window grid. Returns {map, emissive} (emissive = only the lit windows)
T.facade = function (cols, rows, tint) {
  const W = 256, H = 512, c = canvas(W, H), g = c.getContext('2d'), e = canvas(W, H), ge = e.getContext('2d');
  const wall = tint || [34, 38, 48];
  g.fillStyle = `rgb(${wall[0]},${wall[1]},${wall[2]})`; g.fillRect(0, 0, W, H);
  // subtle panel lines + grime
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < H; y += H / rows) g.fillRect(0, y, W, 2);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${rnd()*0.15})`; g.fillRect(rnd() * W, rnd() * H, rnd() * 40, rnd() * 60); }
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  const palette = [[255, 205, 135], [255, 190, 110], [190, 215, 255], [255, 228, 170], [160, 190, 240]];
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
    const px = x * cw + cw * 0.22, py = y * ch + ch * 0.2, ww = cw * 0.56, hh = ch * 0.55;
    g.fillStyle = 'rgb(10,12,18)'; g.fillRect(px, py, ww, hh);                    // dark glass
    if (rnd() < 0.42) {                                                            // lit
      const p = palette[(rnd() * palette.length) | 0], b = 0.45 + rnd() * 0.55;
      const col = `rgb(${(p[0]*b)|0},${(p[1]*b)|0},${(p[2]*b)|0})`;
      g.fillStyle = col; g.fillRect(px, py, ww, hh);
      ge.fillStyle = col; ge.fillRect(px, py, ww, hh);
      if (rnd() < 0.5) { ge.fillStyle = 'rgba(0,0,0,0.5)'; ge.fillRect(px, py + hh * 0.5, ww, 2); } // blind line
    }
  }
  return { map: toTex(c), emissive: toTex(e) };
};

// camo for the soldiers
T.camo = function () {
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#5d6a3c'; g.fillRect(0, 0, S, S);
  const cols = ['#3c4a2a', '#6f7a48', '#2c3320', '#8a8a5a'];
  for (let i = 0; i < 90; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath();
    g.ellipse(rnd() * S, rnd() * S, 6 + rnd() * 14, 4 + rnd() * 10, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  return toTex(c, [2, 2]);
};

// rusty weathered metal (siren horns, crossbar)
T.rust = function () {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#5a534a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) { const r = rnd(); g.fillStyle = r < 0.5 ? `rgba(120,70,40,${rnd()*0.5})` : r < 0.8 ? `rgba(60,55,50,${rnd()*0.6})` : `rgba(150,110,70,${rnd()*0.35})`;
    g.beginPath(); g.ellipse(rnd() * S, rnd() * S, 2 + rnd() * 14, 1 + rnd() * 8, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,30,20,${rnd()*0.5})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(rnd() * S, 0); g.lineTo(rnd() * S, S); g.stroke(); }
  return toTex(c, [2, 1]);
};

// dark leathery striated flesh (Siren Head body)
T.flesh = function () {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(${20+rnd()*30|0},${12+rnd()*20|0},${8+rnd()*14|0},${0.25+rnd()*0.5})`;
    g.lineWidth = 1 + rnd() * 3; g.beginPath(); const x = rnd() * S; g.moveTo(x, 0); g.bezierCurveTo(x + (rnd()-0.5)*40, S*0.33, x + (rnd()-0.5)*40, S*0.66, x + (rnd()-0.5)*20, S); g.stroke(); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${90+rnd()*40|0},${60+rnd()*30|0},${40+rnd()*20|0},${rnd()*0.35})`; g.beginPath(); g.ellipse(rnd()*S, rnd()*S, 1+rnd()*4, 1+rnd()*10, 0, 0, Math.PI*2); g.fill(); }
  return toTex(c, [1, 2]);
};

// high-detail striated flesh: long muscle fibres, creases, wet highlights, sub-surface blotches, pores
T.flesh2 = function () {
  const S = 512, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#4a3627'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 420; i++) { const x = rnd() * S, w = 0.8 + rnd() * 2.6, dark = rnd() < 0.55, v = dark ? 20 + rnd() * 30 : 95 + rnd() * 60;
    g.strokeStyle = `rgba(${v|0},${(v*0.7)|0},${(v*0.5)|0},${0.18 + rnd() * 0.4})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, -10);
    g.bezierCurveTo(x + (rnd() - 0.5) * 50, S * 0.33, x + (rnd() - 0.5) * 50, S * 0.66, x + (rnd() - 0.5) * 30, S + 10); g.stroke(); }
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(12,6,4,${0.3 + rnd() * 0.4})`; g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); const x = rnd() * S, y = rnd() * S; g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 40, y + 20 + rnd() * 90); g.stroke(); }
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(200,170,140,${0.08 + rnd() * 0.16})`; g.lineWidth = 0.6 + rnd(); g.beginPath(); const x = rnd() * S, y = rnd() * S; g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 20, y + 15 + rnd() * 70); g.stroke(); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(120,40,30,${rnd() * 0.18})`; g.beginPath(); g.ellipse(rnd() * S, rnd() * S, 10 + rnd() * 40, 6 + rnd() * 22, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.35})`; g.fillRect(rnd() * S, rnd() * S, 1.2, 1.2 + rnd() * 1.5); }
  return toTex(c, [1, 2]);
};
// heavy weathered iron: rust blooms, rain streaks, pits, scratches
T.rust2 = function () {
  const S = 512, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#4e4741'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${110 + rnd() * 60|0},${55 + rnd() * 30|0},${25 + rnd() * 15|0},${0.25 + rnd() * 0.45})`; g.beginPath(); g.ellipse(rnd() * S, rnd() * S, 6 + rnd() * 40, 4 + rnd() * 24, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 120; i++) { const x = rnd() * S; g.strokeStyle = `rgba(${70 + rnd() * 50|0},${40 + rnd() * 25|0},20,${0.15 + rnd() * 0.35})`; g.lineWidth = 1 + rnd() * 3; g.beginPath(); g.moveTo(x, rnd() * S * 0.5); g.lineTo(x + (rnd() - 0.5) * 14, S); g.stroke(); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(20,14,10,${0.3 + rnd() * 0.5})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 0.8 + rnd() * 2.6, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(200,190,170,${0.1 + rnd() * 0.25})`; g.lineWidth = 0.7; g.beginPath(); const x = rnd() * S, y = rnd() * S; g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 60); g.stroke(); }
  return toTex(c, [2, 1]);
};

// House Head surfaces
T.planks = function () {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  for (let x = 0; x < S; x += 24) { const v = 55 + rnd() * 25; g.fillStyle = `rgb(${v|0},${(v*0.72)|0},${(v*0.5)|0})`; g.fillRect(x, 0, 24, S);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, 0, 2, S);
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(0,0,0,${rnd()*0.3})`; g.fillRect(x + rnd() * 20, rnd() * S, 2, 10 + rnd() * 50); } }
  return toTex(c, [2, 1]);
};
T.shingles = function () {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#24190f'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 16) for (let x = -16; x < S; x += 20) { const v = 35 + rnd() * 30;
    g.fillStyle = `rgb(${v|0},${(v*0.75)|0},${(v*0.55)|0})`; g.fillRect(x + (y / 16 % 2) * 10, y, 18, 14); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x + (y/16%2)*10, y + 13, 18, 3); }
  return toTex(c, [2, 2]);
};
T.bricks = function () {
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#2a2220'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 10) for (let x = -10; x < S; x += 20) { const v = 80 + rnd() * 40;
    g.fillStyle = `rgb(${v|0},${(v*0.5)|0},${(v*0.4)|0})`; g.fillRect(x + (y / 10 % 2) * 10, y, 18, 8); }
  return toTex(c, [2, 3]);
};

/* =========================================================================
   SHARED GEOMETRY + MATERIALS
   ========================================================================= */
const MS = (o) => new THREE.MeshStandardMaterial(o);
const asphaltBump = T.noiseTex(256, 24, 60, [60, 60]);
const rustTex = T.rust(), fleshTex = T.flesh(), camoTex = T.camo();
const fleshTex2 = T.flesh2(), rustTex2 = T.rust2();
const MP = (o) => new THREE.MeshPhysicalMaterial(o);
// Siren Head surfaces: rain-slick skin (clearcoat) with a faint warm emissive so shadow sides never go black
const sirenSkin = {
  fleshP:   MP({ color: 0x8a6b58, map: fleshTex2, bumpMap: fleshTex2, bumpScale: 0.09, roughness: 0.58, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.38, emissive: 0x1c0e09, emissiveIntensity: 0.4 }),
  fleshDkP: MP({ color: 0x5a4434, map: fleshTex2, bumpMap: fleshTex2, bumpScale: 0.07, roughness: 0.62, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.45, emissive: 0x140906, emissiveIntensity: 0.35 }),
  metalR:   MS({ color: 0xa08c78, map: rustTex2, bumpMap: rustTex2, bumpScale: 0.06, roughness: 0.48, metalness: 0.78 }),
  metalR2:  MS({ color: 0xa08c78, map: rustTex2, bumpMap: rustTex2, bumpScale: 0.06, roughness: 0.48, metalness: 0.78, side: THREE.DoubleSide }),
  mouthIn:  MS({ color: 0x5a1414, roughness: 0.6, emissive: 0x2a0606, emissiveIntensity: 0.8, side: THREE.BackSide }),
  clawDk:   MS({ color: 0x1e1610, roughness: 0.45, metalness: 0.15 }),
};
G.M = Object.assign(sirenSkin, {
  road:     MS({ color: 0x0a0d14, roughness: 0.32, metalness: 0.55, bumpMap: asphaltBump, bumpScale: 0.02 }),
  roadOverlay: MS({ color: 0x151920, roughness: 0.9, metalness: 0.1, map: T.noiseTex(256, 18, 70, [50, 50]), transparent: true, opacity: 0.5, depthWrite: false }),
  line:     MS({ color: 0x8a8560, roughness: 0.6, emissive: 0x1a1808, emissiveIntensity: 0.4 }),
  walk:     MS({ color: 0x1a1e28, roughness: 0.95, bumpMap: T.noiseTex(256, 30, 50, [40, 40]), bumpScale: 0.03 }),
  flesh:    MS({ color: 0x6a5240, roughness: 0.9, map: fleshTex, bumpMap: fleshTex, bumpScale: 0.06 }),
  fleshDk:  MS({ color: 0x3f3225, roughness: 0.95, map: fleshTex }),
  metal:    MS({ color: 0x8c7f70, roughness: 0.55, metalness: 0.7, map: rustTex, bumpMap: rustTex, bumpScale: 0.04 }),
  metalDk:  MS({ color: 0x4a4540, roughness: 0.6, metalness: 0.6 }),
  mouth:    MS({ color: 0x7a1e1e, roughness: 0.65, emissive: 0x3a0808, emissiveIntensity: 0.7 }),
  teeth:    MS({ color: 0xe0d3b0, roughness: 0.5 }),
  camo:     MS({ color: 0xffffff, roughness: 0.9, map: camoTex }),
  vest:     MS({ color: 0x3a4028, roughness: 0.95 }),
  helmet:   MS({ color: 0x4f5a34, roughness: 0.7, metalness: 0.1 }),
  mask:     MS({ color: 0xd9d0b6, roughness: 0.75 }),
  hole:     MS({ color: 0x0a0806, roughness: 1 }),
  gun:      MS({ color: 0x14140f, roughness: 0.55, metalness: 0.5 }),
  boot:     MS({ color: 0x1e1a14, roughness: 0.9 }),
  wood:     MS({ color: 0xffffff, roughness: 0.95, map: T.planks() }),
  roof:     MS({ color: 0xffffff, roughness: 0.95, map: T.shingles() }),
  brick:    MS({ color: 0xffffff, roughness: 0.95, map: T.bricks() }),
  root:     MS({ color: 0x3a2c20, roughness: 0.98, map: fleshTex }),
  claw:     MS({ color: 0x2b241c, roughness: 0.7 }),
  glowY:    MS({ color: 0xffcc55, emissive: 0xffb733, emissiveIntensity: 1.6, roughness: 0.4 }),
  glowR:    MS({ color: 0xff5a3a, emissive: 0xdd2a12, emissiveIntensity: 1.6, roughness: 0.4 }),
  glowW:    MS({ color: 0xfff6e8, emissive: 0xfff0d0, emissiveIntensity: 1.8, roughness: 0.4 }),
  concrete: MS({ color: 0x363b45, roughness: 0.9, bumpMap: asphaltBump, bumpScale: 0.02 }),
  concrete2:MS({ color: 0x2a2f38, roughness: 0.9 }),
  glass:    MS({ color: 0x0c1018, roughness: 0.2, metalness: 0.5 }),
  barricade:MS({ color: 0x5a3a12, roughness: 0.9 }),
  sandbag:  MS({ color: 0x4a4530, roughness: 1 }),
  bark:     MS({ color: 0x3a2e24, roughness: 1, map: T.planks() }),
  leaf:     MS({ color: 0x07110a, roughness: 1 }),
  leaf2:    MS({ color: 0x0b1a10, roughness: 1 }),
});
G.GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 14, 12),
  cone: new THREE.ConeGeometry(1, 1, 10),
};
G.box = function (w, h, d, mat, shadow) { const m = new THREE.Mesh(G.GEO.box, mat); m.scale.set(w, h, d); if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; } return m; };
G.cyl = function (rt, rb, h, mat, seg, shadow) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat); if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; } return m; };
G.sphere = function (r, mat) { const m = new THREE.Mesh(G.GEO.sph, mat); m.scale.setScalar(r); m.castShadow = true; return m; };

// soft fake contact shadow (cheap grounding for characters even on Low)
const shadowTex = T.softDisc('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)');
G.contactShadow = function (r) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r, r), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.06; return m; };

/* ---------- small shared helpers ---------- */
G.dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
G.lerp = (a, b, t) => a + (b - a) * t;
G.rand = (a, b) => a + Math.random() * (b - a);
G.shake = 0;        // camera shake amount (decays)
G.aberr = 0;        // chromatic aberration amount (decays)
G.flashSky = 0;     // sky flash amount (lightning)
})();
