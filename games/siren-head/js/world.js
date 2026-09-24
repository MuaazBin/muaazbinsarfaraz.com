/* =========================================================================
   SIREN HEAD: TORONTO NIGHT — world.js
   Sky (gradient + drifting clouds + moon + stars), mirror-wet ground,
   roads/tracks, textured buildings, far skyline, full-height CN Tower,
   trees, streetlights w/ light cones, vehicles, military props,
   rain / splash / dust / muzzle-flash particle pools.
   ========================================================================= */
(function () {
"use strict";
const THREE = window.THREE, G = window.G, M = G.M, Q = G.Q, T = G.tex, rnd = Math.random;
const scene = G.scene;
const world = G.world = new THREE.Group(); scene.add(world);
G.colliders = [];          // {x,z,r} soft repulsion for soldiers / boss
G.streetLights = [];
G.trees = [];
const ROAD_W = G.ROAD_W = 26;

/* =========================================================================
   SKY DOME — gradient, two drifting cloud layers, moon disc + halo, stars,
   and a flash uniform for lightning. One shader, one draw call.
   ========================================================================= */
const skyMat = G.skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uMoonDir: { value: G.moonDir.clone() } },
  vertexShader: `varying vec3 vDir; void main(){ vDir=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    varying vec3 vDir; uniform float uTime,uFlash; uniform vec3 uMoonDir;
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
      return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
    float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(17.1,9.3); a*=0.5; } return v; }
    void main(){
      vec3 d=normalize(vDir); float h=clamp(d.y,0.0,1.0);
      vec3 zen=vec3(0.010,0.014,0.030), hor=vec3(0.043,0.063,0.094), glow=vec3(0.16,0.09,0.06);
      vec3 col=mix(hor,zen,pow(h,0.5));
      col=mix(col,glow,(1.0-smoothstep(0.0,0.16,h))*0.55);          // warm city glow hugging the horizon
      vec2 cuv=d.xz/(abs(d.y)+0.14);
      float c1=fbm(cuv*1.5+vec2(uTime*0.010,uTime*0.004));
      float c2=fbm(cuv*3.4-vec2(uTime*0.018,uTime*0.002));
      float m=dot(d,uMoonDir);
      float cloud=smoothstep(0.44,0.74,c1*0.62+c2*0.48)*smoothstep(0.0,0.10,h);
      cloud*=1.0-smoothstep(0.990,0.9997,m)*0.85;                  // a break in the clouds around the moon
      float disc=smoothstep(0.99955,0.99978,m);
      float halo=pow(max(m,0.0),420.0)*0.7+pow(max(m,0.0),50.0)*0.14;
      vec3 moonCol=vec3(0.98,0.95,0.86);
      col+=moonCol*halo*(1.0-cloud*0.75);
      float st=step(0.9982,hash(floor(d.xz/(abs(d.y)+0.2)*240.0)))*(1.0-cloud)*smoothstep(0.08,0.35,h)*0.55;
      col+=vec3(st);
      vec3 cloudCol=vec3(0.075,0.085,0.12)+moonCol*halo*0.9+uFlash*vec3(0.95,0.97,1.0);
      col=mix(col,cloudCol,cloud*0.93);
      col=mix(col,moonCol,disc*(1.0-cloud*0.9));
      col+=uFlash*0.35;
      gl_FragColor=vec4(col,1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 40, 24), skyMat);
sky.frustumCulled = false; scene.add(sky);

/* =========================================================================
   GROUND — mirror-wet asphalt: Reflector (real planar reflections) under a
   patchy translucent asphalt layer (puddles = clearer patches) + a shadow-only
   layer so the giants still cast shadows onto the wet street.
   ========================================================================= */
if (Q.reflect && THREE.Reflector) {
  const refl = G.reflector = new THREE.Reflector(new THREE.PlaneGeometry(1600, 1600), {
    clipBias: 0.003, textureWidth: Q.reflectRes, textureHeight: Q.reflectRes, color: 0x3a3f48 });
  refl.rotation.x = -Math.PI / 2; refl.position.y = 0; world.add(refl);
} else {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), M.road); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; world.add(g);
}
// patchy asphalt film — alpha noise makes some areas mirror-clear (puddles) and others matte
const puddleAlpha = T.noiseTex(256, 5, 110, [14, 14]);
const overlayMat = M.roadOverlay.clone(); overlayMat.alphaMap = puddleAlpha; overlayMat.opacity = 0.78;
const overlay = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), overlayMat); overlay.rotation.x = -Math.PI / 2; overlay.position.y = 0.02; overlay.renderOrder = 1; world.add(overlay);
if (Q.shadows) {
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.ShadowMaterial({ opacity: 0.6 }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.receiveShadow = true; sh.renderOrder = 2; world.add(sh);
}
// far dark ground beyond the wet zone (fades into fog / horizon)
const far = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x07090e, roughness: 1 }));
far.rotation.x = -Math.PI / 2; far.position.y = -0.08; world.add(far);

/* ---------- avenue dressing ---------- */
function sidewalk(x, z, w, d) { const s = G.box(w, 0.6, d, M.walk); s.position.set(x, 0.3, z); world.add(s); }
sidewalk(-ROAD_W / 2 - 3, 130, 6, 380); sidewalk(ROAD_W / 2 + 3, 130, 6, 380);
// cross-street sidewalk breaks are implied by the building gaps; lane lines + streetcar tracks:
for (let z = -40; z < 300; z += 9) { const l = G.box(0.5, 0.05, 4, M.line, false); l.position.set(0, 0.07, z); world.add(l); }
for (const off of [-4, 4]) { const rail = G.box(0.25, 0.12, 380, new THREE.MeshStandardMaterial({ color: 0x6a7078, metalness: 0.85, roughness: 0.35 }), false); rail.position.set(off, 0.1, 130); world.add(rail); }
for (let z = -40; z < 300; z += 4) { const tie = G.box(11, 0.1, 0.6, M.fleshDk, false); tie.position.set(0, 0.06, z); world.add(tie); }

/* =========================================================================
   BUILDINGS — procedural facade textures (wall + glowing windows)
   ========================================================================= */
const wallTints = [[34, 38, 48], [28, 31, 40], [40, 40, 46], [30, 36, 50], [46, 42, 40]];
function building(x, z, w, h, d) {
  const tint = wallTints[(rnd() * wallTints.length) | 0];
  const wide = T.facade(Math.max(3, Math.round(w / 2.6)), Math.max(4, Math.round(h / 3.4)), tint);
  const deep = T.facade(Math.max(3, Math.round(d / 2.6)), Math.max(4, Math.round(h / 3.4)), tint);
  const mk = (f) => new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.95 });
  const mW = mk(wide), mD = mk(deep);
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mD, mD, roofMat, roofMat, mW, mW]);
  b.position.set(x, h / 2, z); b.castShadow = true; b.receiveShadow = true; world.add(b);
  // rooftop clutter + a red aircraft light on tall ones
  if (h > 60) { const bl = G.sphere(0.6, M.glowR); bl.position.set(x, h + 0.6, z); world.add(bl); }
  if (rnd() < 0.6) { const ac = G.box(w * 0.25, 2.5, d * 0.25, M.concrete2); ac.position.set(x + w * 0.2, h + 1.25, z - d * 0.15); world.add(ac); }
  G.colliders.push({ x, z, r: Math.max(w, d) * 0.5 + 3 });
  return b;
}
for (let z = -20; z < 300; z += 34) {
  if (Math.abs(z - 60) < 20 || Math.abs(z - 150) < 20) continue;   // cross-street gaps
  if (z > 194 && z < 264) continue;                                 // plaza / boss arena
  for (const side of [-1, 1]) {
    const w = 16 + rnd() * 12, d = 16 + rnd() * 10, h = 26 + rnd() * 74;
    const x = side * (ROAD_W / 2 + 12 + rnd() * 6);
    building(x + side * (w / 2 - 8), z + (rnd() - 0.5) * 10, w, h, d);
  }
}
building(-70, 300, 30, 130, 30); building(80, 310, 26, 150, 26); building(120, 270, 24, 110, 24);
building(-110, 200, 34, 96, 30); building(115, 80, 30, 120, 30); building(-115, 40, 28, 88, 28);

/* ---------- distant skyline silhouette (fog-exempt, keeps the tower corridor clear) ---------- */
(function skyline() {
  const dimFacade = T.facade(6, 18, [10, 12, 18]);
  const mat = new THREE.MeshStandardMaterial({ map: dimFacade.map, emissiveMap: dimFacade.emissive, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 1, fog: false, color: 0x8a8f9a });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: 1, fog: false });
  function block(x, z, w, h, d) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, dark, dark, mat, mat]); b.position.set(x, h / 2, z); world.add(b);
    if (h > 200 && rnd() < 0.7) { const l = new THREE.Mesh(G.GEO.sph, new THREE.MeshStandardMaterial({ color: 0xff4a3a, emissive: 0xff2a1a, emissiveIntensity: 2, fog: false })); l.scale.setScalar(2.2); l.position.set(x, h + 2, z); world.add(l); } }
  for (let z = 720; z < 1500; z += 55) for (const side of [-1, 1]) {
    const x = side * (75 + rnd() * 330); block(x, z + (rnd() - 0.5) * 30, 30 + rnd() * 45, 80 + rnd() * 240, 30 + rnd() * 30); }
  for (let z = -300; z < 700; z += 70) for (const side of [-1, 1]) { const x = side * (420 + rnd() * 500); block(x, z, 40 + rnd() * 50, 90 + rnd() * 260, 40 + rnd() * 40); }
  for (let z = 1500; z < 2400; z += 90) { const x = (rnd() - 0.5) * 1800; if (Math.abs(x) < 120) continue; block(x, z, 50 + rnd() * 60, 120 + rnd() * 300, 50 + rnd() * 50); }
})();

/* =========================================================================
   CN TOWER — full height, centred on the avenue, far enough to fit in frame,
   fog-exempt and self-lit so it always reads; flares during lightning.
   ========================================================================= */
G.CN = (function cnTower(x, z) {
  const g = new THREE.Group(); const glowMats = [];
  const conc = new THREE.MeshStandardMaterial({ color: 0x555b68, emissive: 0x1d2130, emissiveIntensity: 1.0, roughness: 0.85, fog: false });
  const conc2 = new THREE.MeshStandardMaterial({ color: 0x3c414c, emissive: 0x141824, emissiveIntensity: 1.0, roughness: 0.85, fog: false });
  const glow = (c, e, i) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: i, roughness: 0.4, fog: false }); m.userData.base = i; glowMats.push(m); return m; };
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(6, 17, 340, 14), conc); shaft.position.y = 170; g.add(shaft);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const fin = new THREE.Mesh(new THREE.BoxGeometry(3, 320, 9), conc2); fin.position.set(Math.cos(a) * 9, 160, Math.sin(a) * 9); fin.rotation.y = -a; g.add(fin); }
  // red LED strip up the south face (as in the reference art)
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 300, 1.2), glow(0xff4a3a, 0xff2a1a, 1.5)); strip.position.set(0, 150, -10.5); g.add(strip);
  // main SkyPod
  const under = new THREE.Mesh(new THREE.CylinderGeometry(10, 27, 18, 16), conc); under.position.y = 236; g.add(under);
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(27, 24, 20, 20), conc2); pod.position.y = 255; g.add(pod);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(27.6, 27.6, 5, 20), glow(0xffcf85, 0xffb347, 2.3)); band.position.y = 258; g.add(band);
  const band2 = new THREE.Mesh(new THREE.CylinderGeometry(25.2, 25.2, 2.2, 20), glow(0xffffff, 0xffe8d0, 2.0)); band2.position.y = 249; g.add(band2);
  const podTop = new THREE.Mesh(new THREE.CylinderGeometry(12, 27, 10, 20), conc); podTop.position.y = 270; g.add(podTop);
  // upper "SkyPod" deck
  const up = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 11, 9, 16), conc2); up.position.y = 322; g.add(up);
  const upBand = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 2.4, 16), glow(0xbcd8ff, 0x7fa8ff, 2.2)); upBand.position.y = 322; g.add(upBand);
  // antenna with alternating red / white lit segments
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.2, 140, 10), conc); mast.position.y = 410; g.add(mast);
  for (let i = 0; i < 6; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.4 - i * 0.2, 2.6 - i * 0.2, 9, 10), i % 2 ? glow(0xffffff, 0xffeedd, 1.6) : glow(0xff4a3a, 0xff2a1a, 1.8)); seg.position.y = 352 + i * 21; g.add(seg); }
  const beacon = new THREE.Mesh(G.GEO.sph, glow(0xff5a3a, 0xff2a12, 3.0)); beacon.scale.setScalar(3.4); beacon.position.y = 482; g.add(beacon);
  const bl = new THREE.PointLight(0xff4a3a, 1.6, 90); bl.position.y = 482; g.add(bl);
  const podLight = new THREE.PointLight(0xffd9a0, 2.2, 140, 1.4); podLight.position.y = 262; g.add(podLight);
  g.position.set(x, 0, z); world.add(g);
  return { group: g, glowMats, beacon, flare: 0 };
})(0, 1400);

/* =========================================================================
   STREET PROPS
   ========================================================================= */
const coneMat = new THREE.MeshBasicMaterial({ color: 0xffcf85, transparent: true, opacity: 0.075, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
function streetlight(x, z, withLight) {
  const g = new THREE.Group();
  const pole = G.cyl(0.18, 0.26, 10, M.metalDk, 8); pole.position.y = 5; g.add(pole);
  const arm = G.box(0.2, 0.2, 3.2, M.metalDk); arm.position.set(0, 9.8, 1.4); g.add(arm);
  const head = G.box(1, 0.4, 1.6, M.metalDk); head.position.set(0, 9.6, 2.9); g.add(head);
  const bulb = G.box(0.7, 0.15, 1.2, M.glowW, false); bulb.position.set(0, 9.4, 2.9); g.add(bulb);
  if (withLight) { const L = new THREE.PointLight(0xffcf85, 2.0, 58, 1.5); L.position.set(0, 9.3, 2.9); g.add(L); G.streetLights.push(L); }
  if (Q.cones) { const cone = new THREE.Mesh(new THREE.ConeGeometry(5.5, 9.4, 18, 1, true), coneMat); cone.position.set(0, 4.7, 2.9); cone.renderOrder = 3; g.add(cone); }
  g.position.set(x, 0, z); world.add(g); return g;
}
let li = 0;
for (let z = 0; z < 290; z += 30) { streetlight(-ROAD_W / 2 - 2, z, li % 2 === 0); streetlight(ROAD_W / 2 + 2, z, li % 2 === 1); li++; }

function trafficLight(x, z) {
  const g = new THREE.Group(); const pole = G.cyl(0.15, 0.2, 6.5, M.metalDk, 8); pole.position.y = 3.2; g.add(pole);
  const bx = G.box(0.7, 2, 0.7, M.gun); bx.position.set(0, 6.2, 0.4); g.add(bx);
  const cols = [M.glowR, new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0xaa7700, emissiveIntensity: 1.2 }), new THREE.MeshStandardMaterial({ color: 0x33cc55, emissive: 0x0a7a2a, emissiveIntensity: 1.2 })];
  cols.forEach((m, i) => { const l = new THREE.Mesh(G.GEO.sph, m); l.scale.setScalar(0.22); l.position.set(0, 6.7 - i * 0.55, 0.78); g.add(l); });
  g.position.set(x, 0, z); world.add(g);
}
trafficLight(-ROAD_W / 2 - 1, 58); trafficLight(ROAD_W / 2 + 1, 152);

function paint(col) { return new THREE.MeshStandardMaterial({ color: col, roughness: 0.28, metalness: 0.55, envMapIntensity: 1 }); }
function car(x, z, col, rot) {
  const g = new THREE.Group(); const p = paint(col);
  const body = G.box(2.2, 1.0, 4.6, p); body.position.y = 0.8; g.add(body);
  const cab = G.box(2.0, 0.9, 2.4, p); cab.position.set(0, 1.6, -0.2); g.add(cab);
  const glass = G.box(1.9, 0.8, 2.2, M.glass); glass.position.set(0, 1.65, -0.2); g.add(glass);
  for (const sx of [-1, 1]) for (const sz of [-1.6, 1.6]) { const w = G.cyl(0.5, 0.5, 0.4, M.gun, 12); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.05, 0.5, sz); g.add(w); }
  for (const sx of [-0.7, 0.7]) { const hl = new THREE.Mesh(G.GEO.sph, M.glowW); hl.scale.set(0.25, 0.2, 0.2); hl.position.set(sx, 0.8, 2.35); g.add(hl);
    const tl = new THREE.Mesh(G.GEO.sph, M.glowR); tl.scale.set(0.3, 0.15, 0.1); tl.position.set(sx, 0.9, -2.32); g.add(tl); }
  g.position.set(x, 0, z); g.rotation.y = rot || 0; world.add(g); G.colliders.push({ x, z, r: 3 }); return g;
}
car(-6, 20, 0x992222, 0); car(7, 42, 0x223399, Math.PI); car(-7, 95, 0x555555, 0); car(6, 175, 0x226644, Math.PI); car(-6, 205, 0x888888, 0); car(9, 235, 0xaaaaaa, Math.PI);

(function bus() { const g = new THREE.Group(); const body = G.box(3, 3.2, 11, paint(0xb43a3a)); body.position.y = 2; g.add(body);
  const win = new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffc070, emissiveIntensity: 0.8 });
  for (let i = -4; i <= 4; i += 1.5) { const w = G.box(0.05, 1.1, 1.0, win, false); w.position.set(1.53, 2.4, i); g.add(w); const w2 = w.clone(); w2.position.x = -1.53; g.add(w2); }
  g.position.set(9, 0, 108); world.add(g); G.colliders.push({ x: 9, z: 108, r: 6 }); })();

(function streetcar() { const g = new THREE.Group(); const body = G.box(4, 3.4, 18, paint(0xc0392b)); body.position.y = 2.2; g.add(body);
  const stripe = G.box(4.05, 0.5, 18, new THREE.MeshStandardMaterial({ color: 0xf0d060, emissive: 0x6a4a00, emissiveIntensity: 0.6 }), false); stripe.position.y = 2.9; g.add(stripe);
  const win = new THREE.MeshStandardMaterial({ color: 0xffe6c0, emissive: 0xffcf85, emissiveIntensity: 1.0 });
  for (let i = -7; i <= 7; i += 2) { const w = G.box(0.05, 1.3, 1.4, win, false); w.position.set(2.03, 2.6, i); g.add(w); const w2 = w.clone(); w2.position.x = -2.03; g.add(w2); }
  for (const sx of [-1.2, 1.2]) { const hl = new THREE.Mesh(G.GEO.sph, M.glowW); hl.scale.set(0.35, 0.3, 0.2); hl.position.set(sx, 1.2, -9.02); g.add(hl); }
  const pole = G.cyl(0.08, 0.08, 3, M.metalDk, 6); pole.position.set(0, 5.4, 0); g.add(pole);
  g.position.set(0, 0, 150); world.add(g); G.colliders.push({ x: 0, z: 150, r: 8 }); })();

(function goTrain() { const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const c = G.box(4.5, 4, 16, paint(0x1c4b6e)); c.position.set(0, 2.5, i * 17); g.add(c);
    const s = G.box(4.55, 0.6, 16, new THREE.MeshStandardMaterial({ color: 0x2fbf4f, emissive: 0x0a5a1a, emissiveIntensity: 0.8 }), false); s.position.set(0, 3.4, i * 17); g.add(s); }
  g.position.set(-95, 0, 120); g.rotation.y = 0.2; world.add(g); })();

function truck(x, z, rot) { const g = new THREE.Group();
  const bed = G.box(3.4, 2.6, 7, M.vest); bed.position.y = 2.1; g.add(bed);
  const cab = G.box(3.2, 2.4, 2.6, M.camo); cab.position.set(0, 1.9, 4.2); g.add(cab);
  const cover = G.box(3.5, 0.3, 7, M.camo); cover.position.y = 3.5; g.add(cover);
  for (const sx of [-1, 1]) for (const sz of [-2.2, 2.2, 4.5]) { const w = G.cyl(0.7, 0.7, 0.6, M.gun, 12); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.7, 0.7, sz); g.add(w); }
  g.position.set(x, 0, z); g.rotation.y = rot || 0; world.add(g); G.colliders.push({ x, z, r: 4.5 }); }
function barricade(x, z, rot) { const g = new THREE.Group();
  for (let i = -1; i <= 1; i++) { const s = G.box(0.3, 1.4, 0.3, M.barricade); s.position.set(i * 1.4, 0.7, 0); g.add(s); }
  const t = G.box(3.4, 0.3, 0.3, M.barricade); t.position.y = 1.3; g.add(t); const t2 = t.clone(); t2.position.y = 0.6; g.add(t2);
  const stripe = G.box(3.42, 0.32, 0.32, M.glowY, false); stripe.position.y = 1.3; g.add(stripe);
  g.position.set(x, 0, z); g.rotation.y = rot || 0; world.add(g); }
function sandbags(x, z) { const g = new THREE.Group();
  for (let r = 0; r < 3; r++) for (let i = -2; i <= 2; i++) { const s = new THREE.Mesh(G.GEO.sph, M.sandbag); s.castShadow = true; s.scale.set(0.9, 0.55, 0.7); s.position.set(i * 1.0 + (r % 2 ? 0.5 : 0), 0.5 + r * 0.7, 0); g.add(s); }
  g.position.set(x, 0, z); world.add(g); }
truck(-11, 140, 0.3); truck(12, 162, -0.4); barricade(-6, 135, 0); barricade(6, 135, 0); barricade(0, 166, 0); sandbags(-9, 155); sandbags(9, 148);

/* ---------- trees (leafy + bare/dead), swaying in the storm ---------- */
function tree(x, z, bare) {
  const g = new THREE.Group();
  const trunk = G.cyl(0.2, 0.36, 4.6, M.bark, 7); trunk.position.y = 2.3; g.add(trunk);
  const top = new THREE.Group(); top.position.y = 4.4; g.add(top);
  if (bare) {
    for (let i = 0; i < 7; i++) { const len = 2.4 + rnd() * 2; const geo = new THREE.CylinderGeometry(0.03, 0.11, len, 5); geo.translate(0, len / 2, 0);
      const b = new THREE.Mesh(geo, M.bark); b.castShadow = true; b.position.y = rnd() * 0.6; b.rotation.set((rnd() - 0.5) * 1.5, rnd() * 6.28, (rnd() - 0.5) * 1.5); top.add(b);
      for (let k = 0; k < 2; k++) { const l2 = 1 + rnd() * 1.2; const g2 = new THREE.CylinderGeometry(0.02, 0.05, l2, 4); g2.translate(0, l2 / 2, 0); const t2 = new THREE.Mesh(g2, M.bark); t2.position.y = len * (0.5 + rnd() * 0.4); t2.rotation.set((rnd() - 0.5) * 1.6, rnd() * 6.28, (rnd() - 0.5) * 1.6); b.add(t2); } }
  } else {
    const blobs = [[0, 1.4, 0, 2.4], [1.1, 2.2, 0.6, 1.8], [-1.0, 2.4, -0.4, 1.7], [0.2, 3.3, 0.3, 1.5]];
    blobs.forEach((b, i) => { const s = new THREE.Mesh(G.GEO.sph, i % 2 ? M.leaf : M.leaf2); s.castShadow = true; s.scale.set(b[3], b[3] * 0.85, b[3]); s.position.set(b[0], b[1], b[2]); top.add(s); });
  }
  g.userData.top = top; g.userData.phase = rnd() * 6.28;
  g.position.set(x, 0, z); g.rotation.y = rnd() * 6.28; world.add(g); G.trees.push(g); G.colliders.push({ x, z, r: 1.2 });
  return g;
}
for (let z = 15; z < 290; z += 30) {
  if (z > 128 && z < 172) continue;                       // keep the checkpoint clear
  for (const side of [-1, 1]) tree(side * (ROAD_W / 2 + 4.6), z + (rnd() - 0.5) * 4, z < 45 || rnd() < 0.3);
}
for (let i = 0; i < 10; i++) { const side = i % 2 ? 1 : -1; tree(side * (22 + rnd() * 16), 200 + rnd() * 42, rnd() < 0.35); }   // plaza park
for (let i = 0; i < 6; i++) tree(-24 - rnd() * 10, -30 + i * 9, true);                                                        // dead trees by the start

/* =========================================================================
   PARTICLES — rain streaks, ground splashes, dust puffs, muzzle flashes
   ========================================================================= */
const RAIN_N = Q.rain, rainGeo = new THREE.BufferGeometry();
const rPos = new Float32Array(RAIN_N * 6), rVel = new Float32Array(RAIN_N);
function seedDrop(i, px, pz, top) { const x = px + (rnd() - 0.5) * 220, y = top ? 118 : rnd() * 120, z = pz + (rnd() - 0.5) * 220, len = 1.4 + rnd() * 1.8;
  rPos[i * 6] = x; rPos[i * 6 + 1] = y; rPos[i * 6 + 2] = z; rPos[i * 6 + 3] = x - 0.35; rPos[i * 6 + 4] = y - len; rPos[i * 6 + 5] = z - 0.15; rVel[i] = 52 + rnd() * 44; }
for (let i = 0; i < RAIN_N; i++) seedDrop(i, 0, 0, false);
rainGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa9bdd6, transparent: true, opacity: 0.34 }));
rain.frustumCulled = false; scene.add(rain);
const WIND = new THREE.Vector3(7, 0, 3);

// splash rings on the ground (pooled)
const ringTex = T.ring(), splashes = [];
for (let i = 0; i < Q.splash; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.12; m.visible = false; scene.add(m); splashes.push({ m, t: 1, life: 0.35 }); }
let splashIdx = 0;
function spawnSplash(x, z) { if (!splashes.length) return; const s = splashes[splashIdx++ % splashes.length]; s.t = 0; s.m.visible = true; s.m.position.set(x, 0.12, z); }

// generic soft puffs (dust / muzzle flash), pooled
const puffTex = T.softDisc('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
const puffs = []; let puffIdx = 0;
for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }));
  m.visible = false; scene.add(m); puffs.push({ m, t: 1, life: 0.6, grow: 1, color: 0xffffff, additive: false }); }
G.spawnPuff = function (pos, size, color, life, additive) { const p = puffs[puffIdx++ % puffs.length]; p.t = 0; p.life = life || 0.6; p.grow = size || 3;
  p.m.material.color.set(color || 0x8a7a66); p.m.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending; p.m.position.copy(pos); p.m.visible = true; p.m.scale.setScalar(size * 0.4); };
G.spawnDust = (pos, size) => G.spawnPuff(pos, size || 4, 0x6e6252, 0.8, false);
G.spawnFlash = (pos) => G.spawnPuff(pos, 1.4, 0xffd27a, 0.08, true);

/* =========================================================================
   PER-FRAME WORLD UPDATE
   ========================================================================= */
G.updateWorld = function (dt, playerPos, camera, time) {
  // sky
  skyMat.uniforms.uTime.value = time; skyMat.uniforms.uFlash.value = G.flashSky;
  sky.position.set(camera.position.x, 0, camera.position.z);
  // rain (wind-blown, recycled around the player)
  const p = rainGeo.attributes.position.array;
  for (let i = 0; i < RAIN_N; i++) {
    const dy = rVel[i] * dt, dx = WIND.x * dt, dz = WIND.z * dt;
    p[i * 6] += dx; p[i * 6 + 1] -= dy; p[i * 6 + 2] += dz; p[i * 6 + 3] += dx; p[i * 6 + 4] -= dy; p[i * 6 + 5] += dz;
    if (p[i * 6 + 4] < -1) { if (Q.splash && rnd() < 0.05 && Math.abs(p[i*6]-playerPos.x) < 45 && Math.abs(p[i*6+2]-playerPos.z) < 45) spawnSplash(p[i * 6], p[i * 6 + 2]); seedDrop(i, playerPos.x, playerPos.z, true); }
  }
  rainGeo.attributes.position.needsUpdate = true;
  for (const s of splashes) { if (s.t >= 1) continue; s.t += dt / s.life; const k = Math.min(1, s.t); s.m.scale.setScalar(0.3 + k * 1.6); s.m.material.opacity = 0.7 * (1 - k); if (k >= 1) s.m.visible = false; }
  for (const q of puffs) { if (q.t >= 1) continue; q.t += dt / q.life; const k = Math.min(1, q.t); q.m.scale.setScalar(q.grow * (0.4 + k)); q.m.material.opacity = 0.55 * (1 - k); q.m.quaternion.copy(camera.quaternion); if (k >= 1) q.m.visible = false; }
  // trees sway
  for (const t of G.trees) { const top = t.userData.top; top.rotation.z = Math.sin(time * 1.3 + t.userData.phase) * 0.05; top.rotation.x = Math.cos(time * 0.9 + t.userData.phase) * 0.035; }
  // tower flare (lightning) + beacon pulse
  const cn = G.CN; cn.flare = Math.max(0, cn.flare - dt * 1.6);
  const pulse = 0.75 + Math.sin(time * 3.2) * 0.25;
  for (const m of cn.glowMats) m.emissiveIntensity = m.userData.base * (1 + cn.flare * 2.5) * (m === cn.beacon.material ? pulse : 1);
};
})();
