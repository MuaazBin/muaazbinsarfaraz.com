/* =========================================================================
   SIREN HEAD: TORONTO NIGHT — game.js
   Audio, entities, input, combat, soldier + boss AI, storm scheduler
   (thunder + white flash every 1–5 min), camera, HUD, flow, main loop.
   ========================================================================= */
(function () {
"use strict";
const THREE = window.THREE, G = window.G, CFG = G.CFG, M = G.M, rnd = Math.random;
const scene = G.scene, camera = G.camera, renderer = G.renderer;

/* =========================================================================
   AUDIO — your mp3s (rain / thunder / househead / siren) + procedural SFX
   with distance attenuation and stereo pan relative to the camera.
   ========================================================================= */
const Audio = (function () {
  let ctx, master, ready = false; const el = {};
  function mk(name, vol, loop) { const a = new window.Audio('audio/' + name); a.loop = !!loop; a.volume = vol; el[name] = a; return a; }
  function init() { if (ready) return; ready = true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); } catch (e) {}
    mk('rain.mp3', 0.5, true); mk('thunder.mp3', 0.8, false); mk('siren.mp3', 0.95, false); mk('househead.mp3', 0.0, true);
    play('rain.mp3'); }
  function play(name) { const a = el[name]; if (!a) return; try { a.currentTime = 0; a.play().catch(() => {}); } catch (e) {} }
  function playHouse(v) { const a = el['househead.mp3']; if (a) { a.volume = v; a.play().catch(() => {}); } }
  function thunder() { const a = el['thunder.mp3']; if (a) { try { a.currentTime = 0; a.volume = 0.7 + rnd() * 0.3; a.play().catch(() => {}); } catch (e) {} } }
  // spatial helper: gain by distance + pan by camera-relative x
  function spatial(pos) { if (!ctx) return null; const g = ctx.createGain(); let vol = 1, pan = 0;
    if (pos) { const d = camera.position.distanceTo(pos); vol = Math.max(0.05, Math.min(1, 40 / (d + 8)));
      const rel = pos.clone().sub(camera.position); const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); pan = Math.max(-1, Math.min(1, rel.normalize().dot(right))); }
    g.gain.value = vol; let node = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(master); return g; }
  function noise(dur) { const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; return b; }
  function gun(pos) { if (!ctx) return; const t = ctx.currentTime, out = spatial(pos); const s = ctx.createBufferSource(); s.buffer = noise(0.14); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 700;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); s.connect(f); f.connect(g); g.connect(out); s.start(t);
    const o = ctx.createOscillator(); const og = ctx.createGain(); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.08); og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.1); }
  function thud(freq, vol, dur, pos) { if (!ctx) return; const t = ctx.currentTime, out = spatial(pos); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.35, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur); }
  function footstep(pos) { thud(62, 0.55, 0.22, pos); if (!ctx) return; const t = ctx.currentTime, out = spatial(pos); const s = ctx.createBufferSource(); s.buffer = noise(0.12); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(f); f.connect(g); g.connect(out); s.start(t); }
  function strike() { thud(120, 0.55, 0.22); if (!ctx) return; const t = ctx.currentTime; const s = ctx.createBufferSource(); s.buffer = noise(0.16); const g = ctx.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); s.connect(g); g.connect(master); s.start(t); }
  function bite() { thud(90, 0.6, 0.3); }
  function boom(vol) { thud(40, vol || 0.7, 0.9); }
  return { init, play, playHouse, thunder, gun, footstep, strike, bite, boom, isReady: () => ready };
})();

/* =========================================================================
   ENTITIES
   ========================================================================= */
const playerModel = G.makeSirenHead(); scene.add(playerModel.group);
const player = {
  pos: new THREE.Vector3(0, 0, -4), vel: new THREE.Vector3(), yaw: Math.PI /* face NORTH toward the tower */, grounded: true,
  hp: CFG.hpMax, strikeT: 0, biteT: 0, blastT: 0, strikeAnim: 0, biteAnim: 0, blastAnim: 0, walkCycle: 0, footT: 0, footSide: 1, alive: true,
};
const soldiers = [];
function spawnSoldier(x, z, group) { const m = G.makeSoldier(); scene.add(m.group);
  soldiers.push({ model: m, pos: new THREE.Vector3(x, 0, z), vel: new THREE.Vector3(), hp: 55, state: 'patrol', stateT: rnd() * 2, fireT: 1 + rnd(),
    home: new THREE.Vector3(x, 0, z), target: new THREE.Vector3(x, 0, z), stun: 0, dead: false, deadT: 0, group, yaw: 0, walk: 0 }); }
spawnSoldier(-8, 58, 'B'); spawnSoldier(6, 66, 'B'); spawnSoldier(-3, 74, 'B'); spawnSoldier(9, 52, 'B');
spawnSoldier(-9, 138, 'C'); spawnSoldier(-2, 146, 'C'); spawnSoldier(7, 140, 'C'); spawnSoldier(9, 160, 'C'); spawnSoldier(0, 158, 'C'); spawnSoldier(-7, 164, 'C');
spawnSoldier(-6, 205, 'D'); spawnSoldier(8, 212, 'D'); spawnSoldier(0, 222, 'D'); spawnSoldier(-9, 218, 'D');

let boss = null;
function spawnBoss() { const m = G.makeHouseHead(); scene.add(m.group);
  boss = { model: m, pos: new THREE.Vector3(8, 0, 250), hp: 1000, hpMax: 1000, state: 'approach', atkT: 2, atkKind: null, windup: 0, active: 0, walk: 0, dead: false, deadT: 0, yaw: Math.PI };
  m.group.position.copy(boss.pos); }

/* ---------- effects ---------- */
const tracers = [], shocks = [], sparks = [];
function tracer(from, to) { const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]), new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 })); scene.add(line); tracers.push({ line, t: 0 }); }
function shockwave(pos) { const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.7, 48), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, 1.2, pos.z); scene.add(ring); shocks.push({ ring, t: 0 });
  const ring2 = ring.clone(); ring2.material = ring.material.clone(); ring2.position.y = 9.5; ring2.rotation.x = -Math.PI / 2 + 0.25; scene.add(ring2); shocks.push({ ring: ring2, t: -0.06 }); }
function hitSpark(pos, color) { const s = new THREE.Mesh(G.GEO.sph, new THREE.MeshBasicMaterial({ color: color || 0xffaa55, transparent: true })); s.scale.setScalar(0.4); s.position.copy(pos); scene.add(s); sparks.push({ s, t: 0, vy: 6 + rnd() * 4 }); }

/* =========================================================================
   INPUT
   ========================================================================= */
function lockPointer() { try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
const keys = {}; const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
addEventListener('keydown', e => { keys[e.code] = true; if (SCROLL_KEYS.includes(e.code)) e.preventDefault(); if (e.code === 'Escape') pauseGame(); }, { passive: false });
addEventListener('keyup', e => { keys[e.code] = false; });
let pitch = 0.24, lookNX = 0, lookNY = 0, cursorLook = false, lastMouseMove = 0;
const isLocked = () => document.pointerLockElement === renderer.domElement;
renderer.domElement.style.cursor = 'crosshair';
// Mouse-look uses RELATIVE motion whether or not pointer-lock is available, so the view only moves
// while the mouse moves (no drift when the mouse is still). Without lock the cursor eventually hits
// the window edge, so parking it in the outer 4% of the width keeps turning (for up to 3 s).
document.addEventListener('mousemove', e => {
  if (state !== State.PLAY) return;
  player.yaw -= e.movementX * 0.0026; pitch -= e.movementY * 0.0022; pitch = Math.max(-0.08, Math.min(1.1, pitch));
  lookNX = (e.clientX / innerWidth) * 2 - 1; lookNY = (e.clientY / innerHeight) * 2 - 1; cursorLook = !isLocked(); lastMouseMove = performance.now();
});
document.addEventListener('mouseout', e => { if (!e.relatedTarget) cursorLook = false; });
addEventListener('blur', () => { cursorLook = false; });
function cursorSteer(dt) {
  if (isLocked() || !cursorLook || performance.now() - lastMouseMove > 3000) return;
  const ax = Math.abs(lookNX); if (ax > 0.92) player.yaw -= Math.sign(lookNX) * ((ax - 0.92) / 0.08) * 2.0 * dt;
}
// clicks always attack; we also (re)try to grab pointer lock where the browser allows it
renderer.domElement.addEventListener('mousedown', e => { if (state !== State.PLAY) return; if (!isLocked()) lockPointer(); if (e.button === 0) doStrike(); else if (e.button === 2) doBite(); });
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

/* =========================================================================
   COMBAT
   ========================================================================= */
function forwardVec() { return new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); }
function inArc(ex, ez, range, arc) { const dx = ex - player.pos.x, dz = ez - player.pos.z, d = Math.hypot(dx, dz); if (d > range) return false; const f = forwardVec(); return (dx * f.x + dz * f.z) / (d || 1) > Math.cos(arc / 2); }
function damageSoldier(s, dmg, knock) { if (s.dead) return; s.hp -= dmg; hitSpark(new THREE.Vector3(s.pos.x, 2.2, s.pos.z), 0xcc3322);
  const dx = s.pos.x - player.pos.x, dz = s.pos.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
  if (knock) { s.vel.x += dx / d * knock; s.vel.z += dz / d * knock; }
  if (s.hp <= 0) { s.dead = true; s.deadT = 0; s.state = 'dead'; s.vel.x = dx / d * (knock || 10); s.vel.z = dz / d * (knock || 10); s.vel.y = 7; } }
function doStrike() { if (!player.alive || player.strikeT > 0) return; player.strikeT = CFG.strikeCd; player.strikeAnim = 1; Audio.strike(); G.shake = Math.max(G.shake, 0.25);
  for (const s of soldiers) if (!s.dead && inArc(s.pos.x, s.pos.z, CFG.strikeRange, CFG.strikeArc)) damageSoldier(s, CFG.strikeDmg, 16);
  if (boss && !boss.dead && inArc(boss.pos.x, boss.pos.z, CFG.strikeRange + 8, CFG.strikeArc)) damageBoss(CFG.strikeDmg * 0.55); }
function doBite() { if (!player.alive || player.biteT > 0) return; player.biteT = CFG.biteCd; player.biteAnim = 1; Audio.bite(); G.shake = Math.max(G.shake, 0.3);
  for (const s of soldiers) if (!s.dead && inArc(s.pos.x, s.pos.z, CFG.biteRange, CFG.biteArc)) damageSoldier(s, CFG.biteDmg, 20);
  if (boss && !boss.dead && inArc(boss.pos.x, boss.pos.z, CFG.biteRange + 8, CFG.biteArc)) damageBoss(CFG.biteDmg * 0.6); }
function doBlast() { if (!player.alive || player.blastT > 0) return; player.blastT = CFG.blastCd; player.blastAnim = 1;
  Audio.play('siren.mp3'); shockwave(player.pos); screenFlash(0.45); G.shake = 1.1; G.aberr = 0.05; G.spawnDust(new THREE.Vector3(player.pos.x, 1.5, player.pos.z), 22);
  for (const s of soldiers) if (!s.dead && G.dist2D(s.pos.x, s.pos.z, player.pos.x, player.pos.z) < CFG.blastRange) { damageSoldier(s, CFG.blastDmg, 12); s.stun = 3.0; s.state = 'stunned'; }
  if (boss && !boss.dead && G.dist2D(boss.pos.x, boss.pos.z, player.pos.x, player.pos.z) < CFG.blastRange + 10) damageBoss(CFG.blastDmg * 1.1); }
function damageBoss(dmg) { if (!boss || boss.dead) return; boss.hp -= dmg; hitSpark(new THREE.Vector3(boss.pos.x + (rnd() - 0.5) * 4, 7, boss.pos.z + 2), 0xffcc44);
  if (boss.hp <= 0) { boss.hp = 0; boss.dead = true; boss.deadT = 0; boss.state = 'dead'; Audio.boom(0.9); G.shake = 1.4; } }
function hurtPlayer(dmg) { if (!player.alive) return; player.hp -= dmg; screenHurt(); G.shake = Math.max(G.shake, 0.15); if (player.hp <= 0) { player.hp = 0; player.alive = false; endGame(false); } }

/* =========================================================================
   UI
   ========================================================================= */
const $ = id => document.getElementById(id);
const UI = { hp: $('hpFill'), siren: $('sirenFill'), sirenReady: $('sirenReady'), bossWrap: $('bossWrap'), bossFill: $('bossFill'), objText: $('objText'), toast: $('toast'), flash: $('flash'), hurt: $('hurt'), lookHint: $('lookHint') };
function setObjective(t) { UI.objText.textContent = t; }
let toastT = 0; function toast(t, ms) { UI.toast.textContent = t; UI.toast.style.opacity = 1; toastT = (ms || 2200) / 1000; }
function screenFlash(a) { UI.flash.style.transition = 'none'; UI.flash.style.opacity = a; requestAnimationFrame(() => { UI.flash.style.transition = 'opacity .55s'; UI.flash.style.opacity = 0; }); }
let hurtT = 0; function screenHurt() { UI.hurt.style.opacity = 0.9; hurtT = 0.25; }
$('qualityTag').textContent = 'Graphics: ' + G.qualityName;
document.querySelectorAll('.quality button').forEach(b => { if (b.dataset.q === G.qualityName) b.classList.add('active');
  b.addEventListener('click', () => { try { localStorage.setItem('shq', b.dataset.q); } catch (e) {} location.reload(); }); });

/* =========================================================================
   FLOW / OBJECTIVES
   ========================================================================= */
const State = { MENU: 0, PLAY: 1, PAUSE: 2, END: 3 }; let state = State.MENU, phase = 0, bossStarted = false;
const livingIn = z => soldiers.filter(s => s.group === z && !s.dead).length;
function updateObjectives() {
  if (phase === 0) { if (G.dist2D(player.pos.x, player.pos.z, 0, 58) < 40) { phase = 1; setObjective('Crush the army patrol'); toast('ARMY PATROL', 1600); } }
  else if (phase === 1) { if (livingIn('B') === 0) { phase = 2; setObjective('Break the military checkpoint ahead'); toast('CHECKPOINT AHEAD', 1800); } }
  else if (phase === 2) { if (G.dist2D(player.pos.x, player.pos.z, 0, 150) < 45 && !player._hint) { player._hint = true; toast('PRESS  E  —  SIREN BLAST', 2600); }
    if (livingIn('C') === 0) { phase = 3; setObjective('Advance to the plaza beneath the CN Tower'); toast('PUSH TO THE TOWER', 1800); } }
  else if (phase === 3) { if (player.pos.z > 195) { phase = 4; startBoss(); } }
}
function startBoss() { if (bossStarted) return; bossStarted = true; spawnBoss(); setObjective('Destroy HOUSE HEAD'); UI.bossWrap.style.display = 'block'; toast('HOUSE HEAD', 2600);
  Audio.thunder(); Audio.playHouse(0.7); Audio.boom(0.6); G.shake = 0.8; document.body.classList.add('cinematic'); setTimeout(() => document.body.classList.remove('cinematic'), 4200); }

/* =========================================================================
   STORM — the big thunder + WHITE FLASH event, randomly every 1–5 minutes
   (first one sooner so it's seen). Plus faint silent far-off sky flicker.
   ========================================================================= */
const storm = { next: G.rand(CFG.stormFirst[0], CFG.stormFirst[1]), flashT: 0, flicker: G.rand(8, 25), bolt: null, boltT: 0, count: 0 };
function makeBolt() { const pts = []; let x = (rnd() - 0.5) * 600 + camera.position.x, z = camera.position.z + 700 + rnd() * 500, y = 900;
  for (let i = 0; i < 14; i++) { pts.push(new THREE.Vector3(x, y, z)); x += (rnd() - 0.5) * 90; z += (rnd() - 0.5) * 60; y -= 55 + rnd() * 40; }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xeef3ff, transparent: true, opacity: 1, fog: false, linewidth: 2 })); scene.add(line); return line; }
function bigStrike() { storm.count++; storm.flashT = 0.75; storm.boltT = 0.28; if (storm.bolt) scene.remove(storm.bolt); storm.bolt = makeBolt();
  screenFlash(0.9); G.CN.flare = 1.0; G.shake = Math.max(G.shake, 0.35); setTimeout(() => Audio.thunder(), 350 + rnd() * 1100); }
function updateStorm(dt) {
  storm.next -= dt; if (storm.next <= 0) { bigStrike(); storm.next = G.rand(CFG.stormEvery[0], CFG.stormEvery[1]); }
  if (storm.flashT > 0) { storm.flashT -= dt; const k = storm.flashT / 0.75; const flick = (Math.sin(storm.flashT * 55) > -0.2 ? 1 : 0.25) * k;
    G.lightning.intensity = 3.2 * flick; G.hemi.intensity = 0.8 + 2.8 * flick; G.flashSky = 0.9 * flick;
    if (G.bloomPass) G.bloomPass.strength = 0.62 + 0.5 * flick; }
  else { G.lightning.intensity = 0; G.hemi.intensity = 0.8; G.flashSky = Math.max(0, G.flashSky - dt * 2); if (G.bloomPass) G.bloomPass.strength = 0.62; }
  if (storm.bolt) { storm.boltT -= dt; storm.bolt.material.opacity = Math.max(0, storm.boltT / 0.28); if (storm.boltT <= 0) { scene.remove(storm.bolt); storm.bolt = null; } }
  storm.flicker -= dt; if (storm.flicker <= 0 && storm.flashT <= 0) { storm.flicker = G.rand(10, 30); G.flashSky = 0.18; }   // distant silent flicker in the clouds
}

/* =========================================================================
   UPDATES
   ========================================================================= */
function updatePlayer(dt) {
  const rig = playerModel.rig;
  if (!player.alive) { playerModel.group.rotation.z = Math.min(playerModel.group.rotation.z + dt * 0.8, 1.4); return; }
  if (keys['ArrowLeft']) player.yaw += CFG.turn * dt; if (keys['ArrowRight']) player.yaw -= CFG.turn * dt;
  cursorSteer(dt);
  const f = forwardVec(), right = new THREE.Vector3(-f.z, 0, f.x); let mx = 0, mz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) { mx += f.x; mz += f.z; } if (keys['KeyS'] || keys['ArrowDown']) { mx -= f.x; mz -= f.z; }
  if (keys['KeyD']) { mx += right.x; mz += right.z; } if (keys['KeyA']) { mx -= right.x; mz -= right.z; }
  const len = Math.hypot(mx, mz), running = keys['ShiftLeft'] || keys['ShiftRight'], speed = running ? CFG.run : CFG.walk; let moving = false;
  if (len > 0) { mx /= len; mz /= len; player.pos.x += mx * speed * dt; player.pos.z += mz * speed * dt; moving = true; player.walkCycle += dt * (running ? 11 : 7); }
  if (keys['KeyE'] || keys['KeyF']) doBlast();
  if (keys['Space'] && player.grounded) { player.vel.y = CFG.jump; player.grounded = false; }
  player.vel.y -= CFG.gravity * dt; player.pos.y += player.vel.y * dt;
  if (player.pos.y <= 0) { if (!player.grounded) { G.shake = Math.max(G.shake, 0.5); Audio.footstep(player.pos); G.spawnDust(new THREE.Vector3(player.pos.x, 0.8, player.pos.z), 10); } player.pos.y = 0; player.vel.y = 0; player.grounded = true; }
  player.pos.x = Math.max(-120, Math.min(120, player.pos.x)); player.pos.z = Math.max(-40, Math.min(300, player.pos.z));
  playerModel.group.position.copy(player.pos); playerModel.group.rotation.y = player.yaw;
  if (player.hp < CFG.hpMax) player.hp = Math.min(CFG.hpMax, player.hp + CFG.hpRegen * dt);
  player.strikeT = Math.max(0, player.strikeT - dt); player.biteT = Math.max(0, player.biteT - dt); player.blastT = Math.max(0, player.blastT - dt);
  if (moving) { player.footT -= dt; if (player.footT <= 0) { player.footSide *= -1; const fp = new THREE.Vector3(player.pos.x + right.x * player.footSide * 0.8, 0.5, player.pos.z + right.z * player.footSide * 0.8);
      Audio.footstep(fp); G.spawnDust(fp, running ? 7 : 5); G.shake = Math.max(G.shake, running ? 0.09 : 0.045); player.footT = running ? 0.32 : 0.46; } }
  // animation
  const sw = Math.sin(player.walkCycle) * (moving ? 0.62 : 0.05);
  rig.legL.rotation.x = sw; rig.legR.rotation.x = -sw; rig.legL.userData.shin.rotation.x = Math.max(0, -sw) * 0.9; rig.legR.userData.shin.rotation.x = Math.max(0, sw) * 0.9;
  rig.armL.rotation.x = 0.15 + Math.sin(player.walkCycle) * (moving ? 0.28 : 0.04); rig.armL.userData.fore.rotation.x = -0.25 - Math.max(0, Math.sin(player.walkCycle)) * 0.2;
  if (player.strikeAnim <= 0) { rig.armR.rotation.x = 0.15 - Math.sin(player.walkCycle) * (moving ? 0.28 : 0.04); rig.armR.rotation.z = 0; rig.armR.userData.fore.rotation.x = -0.25; }
  playerModel.group.position.y = player.pos.y + Math.abs(Math.sin(player.walkCycle)) * (moving ? 0.28 : 0.05);
  playerModel.group.rotation.z = Math.sin(player.walkCycle) * (moving ? 0.03 : 0);
  if (player.strikeAnim > 0) { player.strikeAnim = Math.max(0, player.strikeAnim - dt / 0.42); const p = 1 - player.strikeAnim, s = Math.sin(p * Math.PI);
    rig.armR.rotation.x = 0.15 - s * 2.3; rig.armR.rotation.z = -s * 1.3; rig.armR.userData.fore.rotation.x = -0.25 - s * 0.6; }
  if (player.biteAnim > 0) { player.biteAnim = Math.max(0, player.biteAnim - dt / 0.5); const p = 1 - player.biteAnim, s = Math.sin(p * Math.PI); rig.head.rotation.x = s * 0.85; rig.head.position.z = s * 1.6; rig.head.position.y = rig.headY - s * 0.8; }
  else { rig.head.rotation.x *= 0.85; rig.head.position.z *= 0.85; rig.head.position.y = G.lerp(rig.head.position.y, rig.headY, 0.2); }
  if (player.blastAnim > 0) { player.blastAnim = Math.max(0, player.blastAnim - dt / 0.7); const a = player.blastAnim;   // horns vibrate + flare open
    for (const h of rig.horns) { h.position.y = 0.2 + (rnd() - 0.5) * 0.25 * a; h.rotation.x = -0.35 + (rnd() - 0.5) * 0.3 * a; h.scale.setScalar(1 + 0.12 * a); }
    rig.head.rotation.z = (rnd() - 0.5) * 0.12 * a; }
  else { for (const h of rig.horns) { h.position.y = 0.2; h.rotation.x = -0.35; h.scale.setScalar(1); } rig.head.rotation.z = 0; }
}

function moveToward(s, tp, spd, dt) { const dx = tp.x - s.pos.x, dz = tp.z - s.pos.z, d = Math.hypot(dx, dz) || 1; if (d > 0.5) { s.pos.x += dx / d * spd * dt; s.pos.z += dz / d * spd * dt; s.yaw = Math.atan2(dx, dz); } }
function moveAway(s, tp, spd, dt) { const dx = s.pos.x - tp.x, dz = s.pos.z - tp.z, d = Math.hypot(dx, dz) || 1; s.pos.x += dx / d * spd * dt; s.pos.z += dz / d * spd * dt; s.yaw = Math.atan2(tp.x - s.pos.x, tp.z - s.pos.z); }
function resolveColliders(pos, r) { for (const c of G.colliders) { const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz); if (d < c.r + r && d > 0.001) { const push = c.r + r - d; pos.x += dx / d * push; pos.z += dz / d * push; } } }
function fireAtPlayer(s) { const muz = new THREE.Vector3(); s.model.rig.muzzle.getWorldPosition(muz); Audio.gun(muz); G.spawnFlash(muz);
  const aim = new THREE.Vector3(player.pos.x + (rnd() - 0.5) * 3, 4.5 + (rnd() - 0.5) * 3, player.pos.z + (rnd() - 0.5) * 3); tracer(muz, aim);
  const dP = G.dist2D(s.pos.x, s.pos.z, player.pos.x, player.pos.z), chance = dP < 20 ? 0.7 : dP < 32 ? 0.45 : 0.25;
  if (rnd() < chance) { hurtPlayer(3 + rnd() * 3); hitSpark(aim, 0xffdd88); } }

function updateSoldiers(dt) {
  for (const s of soldiers) { const g = s.model.group, rig = s.model.rig;
    if (s.dead) { s.deadT += dt; s.vel.y -= CFG.gravity * dt; s.pos.y += s.vel.y * dt; s.pos.x += s.vel.x * dt; s.pos.z += s.vel.z * dt; s.vel.x *= 0.9; s.vel.z *= 0.9;
      if (s.pos.y < 0) { s.pos.y = 0; s.vel.y = 0; } g.position.copy(s.pos); g.rotation.z = Math.min(g.rotation.z + dt * 4, Math.PI / 2); g.rotation.x = Math.min(g.rotation.x + dt * 2, 0.4);
      if (s.deadT > 4) g.visible = false; continue; }
    const dP = G.dist2D(s.pos.x, s.pos.z, player.pos.x, player.pos.z);
    if (s.stun > 0) { s.stun -= dt; s.state = 'stunned'; g.rotation.z = Math.sin(performance.now() * 0.02) * 0.3; g.position.copy(s.pos); if (s.stun <= 0) { s.state = 'engage'; g.rotation.z = 0; } continue; }
    g.rotation.z = 0;
    if (s.state === 'patrol') { if (dP < 46) s.state = 'engage'; else { s.stateT -= dt; if (s.stateT <= 0) { s.stateT = 2 + rnd() * 3; s.target.set(s.home.x + (rnd() - 0.5) * 10, 0, s.home.z + (rnd() - 0.5) * 10); } moveToward(s, s.target, 2.4, dt); } }
    if (s.state === 'engage') { s.yaw = Math.atan2(player.pos.x - s.pos.x, player.pos.z - s.pos.z);
      if (dP < 14) moveAway(s, player.pos, 4.2, dt); else if (dP > 34) moveToward(s, player.pos, 4.0, dt);
      else { s.stateT -= dt; if (s.stateT <= 0) { s.stateT = 1.5 + rnd() * 2; const side = rnd() < 0.5 ? 1 : -1; s.target.copy(s.pos).addScaledVector(new THREE.Vector3(Math.cos(s.yaw) * side, 0, -Math.sin(s.yaw) * side), 6); } moveToward(s, s.target, 3.0, dt); }
      s.fireT -= dt; if (s.fireT <= 0 && dP < 40) { s.fireT = 1.1 + rnd() * 0.8; fireAtPlayer(s); } }
    s.pos.x += s.vel.x * dt; s.pos.z += s.vel.z * dt; s.vel.x *= 0.86; s.vel.z *= 0.86; resolveColliders(s.pos, 1.2);
    s.pos.x = Math.max(-120, Math.min(120, s.pos.x)); s.pos.z = Math.max(-40, Math.min(300, s.pos.z));
    g.position.set(s.pos.x, 0, s.pos.z); g.rotation.y = s.yaw;
    s.walk += dt * 8; const mv = s.state !== 'patrol' ? 0.45 : 0.28; rig.legL.rotation.x = Math.sin(s.walk) * mv; rig.legR.rotation.x = -Math.sin(s.walk) * mv;
    rig.armR.rotation.x = s.state === 'engage' ? -0.15 : 0.6;   // pistol raised when engaging
  }
}

function doBossHit(kind) { Audio.boom(0.8); const range = kind === 'swipe' ? 18 : 15, dP = G.dist2D(boss.pos.x, boss.pos.z, player.pos.x, player.pos.z);
  G.shake = Math.max(G.shake, kind === 'stomp' ? 1.2 : 0.7); G.spawnDust(new THREE.Vector3(boss.pos.x, 1.5, boss.pos.z + 4), kind === 'stomp' ? 24 : 12);
  if (dP < range) { hurtPlayer(kind === 'swipe' ? 18 : 26); G.aberr = 0.04; const dx = player.pos.x - boss.pos.x, dz = player.pos.z - boss.pos.z, d = Math.hypot(dx, dz) || 1; player.pos.x += dx / d * 6; player.pos.z += dz / d * 6; player.vel.y = 8; player.grounded = false; } }
function updateBoss(dt) { if (!boss) return; const g = boss.model.group, rig = boss.model.rig;
  if (boss.dead) { boss.deadT += dt; rig.house.rotation.z = Math.min(rig.house.rotation.z + dt * 0.5, 0.8); rig.house.position.y = 9.6 - Math.min(boss.deadT * 1.5, 5); boss.pos.y = Math.max(-3, -boss.deadT * 0.6);
    rig.eyeLight.intensity = Math.max(0, 2.4 - boss.deadT); for (const e of rig.eyes) e.material.emissiveIntensity = Math.max(0, 2.6 - boss.deadT);
    for (const l of rig.legs) l.coxa.rotation.z += l.side * dt * 0.25; g.position.copy(boss.pos); if (boss.deadT > 2.6 && !player._won) { player._won = true; endGame(true); } return; }
  boss.walk += dt; const dP = G.dist2D(boss.pos.x, boss.pos.z, player.pos.x, player.pos.z); boss.yaw = Math.atan2(player.pos.x - boss.pos.x, player.pos.z - boss.pos.z); g.rotation.y = boss.yaw;
  const stepping = boss.state === 'approach' ? 1 : 0.3;
  for (const l of rig.legs) { const ph = boss.walk * 2.2 + l.phase; l.coxa.rotation.z = Math.sin(ph) * 0.14 * stepping * l.side * -1; l.knee.rotation.z = Math.max(0, Math.sin(ph)) * 0.22 * stepping * l.side; }
  rig.house.rotation.z = Math.sin(boss.walk * 1.1) * 0.02; rig.eyeLight.intensity = 2.4 * (0.85 + Math.sin(performance.now() * 0.008) * 0.25 + rnd() * 0.1);
  if (boss.state === 'approach') { if (dP > 13) { moveToward(boss, player.pos, 5.2, dt); boss._stepT = (boss._stepT || 0) - dt; if (boss._stepT <= 0) { boss._stepT = 0.55; Audio.footstep(boss.pos); G.shake = Math.max(G.shake, 0.2); } } else { boss.state = 'attack'; boss.atkT = 0.2; } }
  else if (boss.state === 'attack') { boss.atkT -= dt;
    if (boss.atkT <= 0 && boss.windup <= 0 && boss.active <= 0) { boss.atkKind = rnd() < 0.5 ? 'swipe' : 'stomp'; boss.windup = 0.7; }
    if (boss.windup > 0) { boss.windup -= dt; if (boss.atkKind === 'swipe') rig.claw.rotation.z = Math.min(rig.claw.rotation.z + dt * 3, 1.2); else rig.house.position.y = 9.6 + Math.min((0.7 - boss.windup) * 6, 3);
      if (boss.windup <= 0) { boss.active = 0.35; doBossHit(boss.atkKind); } }
    else if (boss.active > 0) { boss.active -= dt; if (boss.atkKind === 'swipe') rig.claw.rotation.z = Math.max(rig.claw.rotation.z - dt * 8, -0.6); else rig.house.position.y = Math.max(rig.house.position.y - dt * 20, 9.6);
      if (boss.active <= 0) { rig.claw.rotation.z = 0; rig.house.position.y = 9.6; boss.atkT = 1.3 + rnd(); } }
    else { rig.claw.rotation.z *= 0.9; if (dP > 16) boss.state = 'approach'; } }
  resolveColliders(boss.pos, 0); boss.pos.x = Math.max(-110, Math.min(110, boss.pos.x)); boss.pos.z = Math.max(0, Math.min(295, boss.pos.z)); g.position.set(boss.pos.x, boss.pos.y || 0, boss.pos.z); }

/* ---------- camera: behind + above, framed to keep the skyline / tower in view, with shake ---------- */
const camTarget = new THREE.Vector3(), tmpV = new THREE.Vector3();
function updateCamera(dt) { const dist = 24, camH = 8;
  camTarget.set(player.pos.x + Math.sin(player.yaw) * dist * Math.cos(pitch), player.pos.y + camH + Math.sin(pitch) * dist, player.pos.z + Math.cos(player.yaw) * dist * Math.cos(pitch));
  camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
  G.shake = Math.max(0, G.shake - dt * 2.2); const sh = G.shake * 0.35;
  camera.position.x += (rnd() - 0.5) * sh; camera.position.y += (rnd() - 0.5) * sh; camera.position.z += (rnd() - 0.5) * sh;
  camera.lookAt(player.pos.x, player.pos.y + 9.2, player.pos.z);
  // character key light sits between camera and player, above head height
  tmpV.copy(camera.position).sub(player.pos); tmpV.y = 0; tmpV.normalize();
  G.playerLight.position.set(player.pos.x + tmpV.x * 9, player.pos.y + 11.5, player.pos.z + tmpV.z * 9);
  if (G.Q.shadows) { G.moon.position.copy(player.pos).addScaledVector(G.moonDir, 260); G.moon.target.position.copy(player.pos); G.moon.target.updateMatrixWorld(); }
}
function updateEffects(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t += dt; t.line.material.opacity = 0.95 * (1 - t.t / 0.12); if (t.t > 0.12) { scene.remove(t.line); t.line.geometry.dispose(); tracers.splice(i, 1); } }
  for (let i = shocks.length - 1; i >= 0; i--) { const sh = shocks[i]; sh.t += dt; if (sh.t < 0) continue; const s = 1 + sh.t * CFG.blastRange * 1.5; sh.ring.scale.set(s, s, s); sh.ring.material.opacity = 0.85 * (1 - sh.t / 0.55); if (sh.t > 0.55) { scene.remove(sh.ring); shocks.splice(i, 1); } }
  for (let i = sparks.length - 1; i >= 0; i--) { const sp = sparks[i]; sp.t += dt; sp.vy -= 30 * dt; sp.s.position.y += sp.vy * dt; sp.s.material.opacity = 1 - sp.t / 0.5; sp.s.scale.multiplyScalar(0.92); if (sp.t > 0.5) { scene.remove(sp.s); sparks.splice(i, 1); } }
  G.aberr = Math.max(0, G.aberr - dt * 0.08);
  if (G.finalPass) { G.finalPass.uniforms.uAberr.value = 0.0025 + G.aberr; G.finalPass.uniforms.uTime.value = performance.now() * 0.001; }
}
function updateHUD() { UI.hp.style.width = (player.hp / CFG.hpMax * 100) + '%'; const sr = 1 - player.blastT / CFG.blastCd; UI.siren.style.width = (sr * 100) + '%';
  UI.sirenReady.textContent = player.blastT <= 0 ? 'READY' : '…'; UI.sirenReady.style.color = player.blastT <= 0 ? '#6ff' : '#889';
  if (boss) UI.bossFill.style.width = (boss.hp / boss.hpMax * 100) + '%';
  UI.lookHint.style.display = isLocked() ? 'none' : 'block';
  if (toastT > 0) { toastT -= 1 / 60; if (toastT <= 0) UI.toast.style.opacity = 0; } if (hurtT > 0) { hurtT -= 1 / 60; if (hurtT <= 0) UI.hurt.style.opacity = 0; } }

/* =========================================================================
   MAIN LOOP
   ========================================================================= */
let last = performance.now(), elapsed = 0;
function loop(now) { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; elapsed += dt;
  if (state === State.PLAY) { updatePlayer(dt); updateSoldiers(dt); updateBoss(dt); updateEffects(dt); updateStorm(dt); updateObjectives(); updateCamera(dt); updateHUD(); }
  else { updateEffects(dt); updateStorm(dt); if (state === State.MENU) { const t = now * 0.00018; camera.position.set(Math.sin(t) * 34, 14, -46 + Math.cos(t) * 26); camera.lookAt(player.pos.x, 9, player.pos.z + 40); } }
  G.updateWorld(dt, player.pos, camera, elapsed);
  if (G.composer) G.composer.render(); else renderer.render(scene, camera); }
requestAnimationFrame(loop);

/* ---------- screens ---------- */
const startScreen = $('start'), pauseScreen = $('pause'), endScreen = $('end');
function startGame() { Audio.init(); startScreen.classList.add('hidden'); state = State.PLAY; lockPointer(); }
function pauseGame() { if (state !== State.PLAY) return; state = State.PAUSE; pauseScreen.classList.remove('hidden'); document.exitPointerLock && document.exitPointerLock(); }
function resumeGame() { if (state !== State.PAUSE) return; pauseScreen.classList.add('hidden'); state = State.PLAY; lockPointer(); }
function endGame(win) { state = State.END; $('endTitle').textContent = win ? 'PROTOTYPE COMPLETE' : 'SIREN HEAD DOWN'; $('endTitle').className = win ? 'win' : 'lose';
  $('endMsg').textContent = win ? 'House Head lies broken beneath the tower. The storm rolls on.' : 'The army swarmed you under the tower lights. Try again.';
  endScreen.classList.remove('hidden'); document.exitPointerLock && document.exitPointerLock(); }
$('startBtn').addEventListener('click', startGame); $('resumeBtn').addEventListener('click', resumeGame); $('restartBtn').addEventListener('click', () => location.reload());
document.addEventListener('pointerlockchange', () => { if (state === State.PLAY && document.pointerLockElement !== renderer.domElement) pauseGame(); });
playerModel.group.position.copy(player.pos);

/* ---------- dev hook ---------- */
window.SH = { tp: (x, z) => player.pos.set(x, 0, z), face: (x, z) => { player.yaw = Math.atan2(-(x - player.pos.x), -(z - player.pos.z)); }, pitch: v => { pitch = v; },
  godmode: () => { CFG.hpRegen = 999; }, state: () => ['MENU', 'PLAY', 'PAUSE', 'END'][state], phase: () => phase,
  info: () => ({ state: ['MENU', 'PLAY', 'PAUSE', 'END'][state], phase, pos: player.pos.toArray().map(n => +n.toFixed(1)), soldiersAlive: soldiers.filter(s => !s.dead).length, bossHp: boss ? boss.hp : null, playerHp: +player.hp.toFixed(0), blastReady: player.blastT <= 0, nextStormIn: +storm.next.toFixed(0), quality: G.qualityName, post: !!G.composer, reflect: !!G.reflector }),
  strike: doStrike, bite: doBite, blast: doBlast, boss: startBoss, storm: bigStrike, keys: () => Object.keys(keys).filter(k => keys[k]),
  look: () => ({ locked: isLocked(), cursorLook, nx: +lookNX.toFixed(2), ny: +lookNY.toFixed(2), pitch: +pitch.toFixed(2), yaw: +player.yaw.toFixed(2) }) };
})();
