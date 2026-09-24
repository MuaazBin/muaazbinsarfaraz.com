/* =========================================================================
   SIREN HEAD: TORONTO NIGHT — models.js
   Character builders: Siren Head (player), Army Soldier (mask-face / pistol
   concept), House Head (boss). All procedural, shadow-casting. Y = 0 is
   ground level for every model; feet land on the road.
   ========================================================================= */
(function () {
"use strict";
const THREE = window.THREE, G = window.G, M = G.M, rnd = Math.random;

function tube(points, r, mat, seg) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg || 12, r, 6, false), mat); m.castShadow = true; return m;
}
function claw(len, r, mat) { const geo = new THREE.CylinderGeometry(0.02, r, len, 6); geo.translate(0, -len / 2, 0); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }
const lathe = (pts, mat, seg) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 14), mat); m.castShadow = true; m.receiveShadow = true; return m; };
const sph = (r, mat, sx, sy, sz) => { const s = G.sphere(r, mat); if (sx) s.scale.set(sx, sy, sz); return s; };

/* =========================================================================
   SIREN HEAD — ~11 m to the horn tops. Organic lathe-shaped limbs, knuckled
   clawed fingers hanging to the ground, ribcage / sternum / spine / sinew,
   rain-slick skin, riveted rusted bell horns (openings OUTWARD) with motor
   housings, gums + varied teeth pointing into the throat, neck coil + cables.
   ========================================================================= */
G.makeSirenHead = function () {
  const g = new THREE.Group(), rig = {};
  const F = M.fleshP, FD = M.fleshDkP, MT = M.metalR, MT2 = M.metalR2, MD = M.metalDk;
  const HEAD_Y = 11.0; rig.headY = HEAD_Y;

  // narrow pelvis + gaunt torso (tiny waist, flat flared ribcage) — the concept is skeletal, not bulky
  const pelvis = lathe([[0.4, 4.7], [0.72, 5.0], [0.78, 5.4], [0.62, 5.8], [0.45, 6.0]], FD); pelvis.scale.z = 0.75; g.add(pelvis);
  const torso = lathe([[0.45, 5.95], [0.52, 6.4], [0.78, 7.0], [0.98, 7.7], [1.02, 8.4], [0.9, 9.0], [0.68, 9.45], [0.42, 9.75]], F, 18); torso.scale.z = 0.6; g.add(torso);
  for (let i = 0; i < 7; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.84 - i * 0.035, 0.06, 6, 18, Math.PI * 1.15), FD); rib.castShadow = true;
    rib.rotation.x = Math.PI / 2; rib.rotation.z = Math.PI * 0.925; rib.position.set(0, 7.0 + i * 0.34, 0.02); rib.scale.z = 0.62; g.add(rib); }
  const sternum = G.box(0.18, 2.2, 0.14, FD); sternum.position.set(0, 8.0, 0.62); g.add(sternum);
  for (let i = 0; i < 11; i++) { const v = sph(0.12 - i * 0.003, FD); v.position.set(0, 5.7 + i * 0.38, -0.42 - Math.sin(i * 0.35) * 0.06); g.add(v); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = 0.62;   // sinew over the torso
    g.add(tube([[Math.cos(a) * r * 0.7, 6.4, Math.sin(a) * r * 0.5], [Math.cos(a + 0.3) * r * 1.05, 7.5, Math.sin(a + 0.3) * r * 0.62], [Math.cos(a + 0.1) * r * 1.0, 8.6, Math.sin(a + 0.1) * r * 0.6], [Math.cos(a - 0.2) * r * 0.55, 9.5, Math.sin(a - 0.2) * r * 0.4]], 0.04, FD, 10)); }
  g.add(lathe([[0.34, 9.7], [0.28, 10.1], [0.25, 10.5], [0.3, 10.85]], FD));                   // neck
  const coil = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 7; coil.push([Math.cos(a) * 0.38, 9.85 + t * 0.95, Math.sin(a) * 0.38]); }
  g.add(tube(coil, 0.03, MD, 60));                                                              // coiled wire around the neck

  // head: crossbar, hub, two outward bell horns, cables
  const head = new THREE.Group(); head.position.y = HEAD_Y; g.add(head); rig.head = head;
  const bar = G.cyl(0.34, 0.34, 4.8, MT, 14); bar.rotation.z = Math.PI / 2; head.add(bar);
  const hub = G.cyl(0.6, 0.6, 1.0, MD, 14); head.add(hub);
  const hubCap = G.cyl(0.66, 0.66, 0.16, MT, 14); hubCap.position.y = 0.55; head.add(hubCap);
  rig.horns = [];
  function siren(dir) {
    const s = new THREE.Group();
    const bellPts = [[0.5, -1.35], [0.54, -0.9], [0.62, -0.45], [0.78, 0.05], [1.02, 0.5], [1.3, 0.92], [1.52, 1.22], [1.62, 1.38]];
    s.add(lathe(bellPts, MT2, 28));                                                             // rusted bell (double-sided)
    s.add(lathe(bellPts.map(p => [p[0] * 0.94, p[1]]), M.mouthIn, 28));                        // red fleshy lining inside
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.1, 10, 28), MD); rim.rotation.x = Math.PI / 2; rim.position.y = 1.38; rim.castShadow = true; s.add(rim);
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; const rv = sph(0.055, MD); rv.position.set(Math.cos(a) * 1.62, 1.38, Math.sin(a) * 1.62); s.add(rv); }   // rivets
    const gums = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.13, 8, 28), M.mouth); gums.rotation.x = Math.PI / 2; gums.position.y = 1.12; s.add(gums);
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2 + (i % 2) * 0.05, len = 0.42 + (i % 4 === 0 ? 0.36 : i % 2 ? 0.12 : 0);
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.1, len, 7), M.teeth); t.castShadow = true;
      t.position.set(Math.cos(a) * 1.24, 1.1, Math.sin(a) * 1.24); t.lookAt(0, 0.2, 0); t.rotateX(Math.PI / 2); s.add(t); }   // teeth point into the throat
    const tongue = sph(1, M.mouth, 0.42, 0.24, 0.85); tongue.position.set(0, 0.95, 0.12); s.add(tongue);
    const motor = G.cyl(0.58, 0.5, 0.9, MD, 16); motor.position.y = -1.75; s.add(motor);       // rear motor housing
    const cap = G.cyl(0.42, 0.58, 0.25, MT, 16); cap.position.y = -2.3; s.add(cap);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const b = sph(0.06, MT); b.position.set(Math.cos(a) * 0.45, -2.42, Math.sin(a) * 0.45); s.add(b); }
    s.rotation.z = -Math.PI / 2 * dir;      // toothed opening faces OUTWARD
    s.rotation.x = -0.35;
    s.position.set(dir * 2.35, 0.2, 0.15);
    rig.horns.push(s); return s;
  }
  head.add(siren(1)); head.add(siren(-1));
  for (let i = 0; i < 6; i++) { const side = i < 3 ? -1 : 1, k = i % 3;
    head.add(tube([[side * (0.8 + k * 0.15), -0.25 + k * 0.15, 0.3 + k * 0.15], [side * 0.5, -1.0 - k * 0.25, 0.6 - k * 0.1], [side * 0.15, -1.9 - k * 0.1, 0.35 - k * 0.2], [side * 0.05, -2.6, -0.1 + k * 0.1]], 0.04, MD, 12)); }

  // knuckled fingers with claws
  function finger(len, r, curl) { const grp = new THREE.Group(); let parent = grp; const segs = [0.42, 0.34, 0.3];
    for (let i = 0; i < 3; i++) { const L = len * segs[i], k = 1 - i * 0.18;
      parent.add(lathe([[r * k, 0], [r * 0.9 * k, -L * 0.5], [r * 0.78 * k, -L]], FD, 8));
      const knuckle = sph(r * 0.95 * k, FD); knuckle.position.y = -L; parent.add(knuckle);
      const next = new THREE.Group(); next.position.y = -L; next.rotation.x = curl; parent.add(next); parent = next; }
    const c = claw(len * 0.55, r * 0.55, M.clawDk); c.rotation.x = 0.1; parent.add(c); return grp; }
  function arm(side) {
    const a = new THREE.Group(); a.position.set(side * 1.08, 9.15, 0);
    a.add(sph(0.36, FD));
    a.add(lathe([[0.26, 0], [0.3, -0.5], [0.25, -1.5], [0.21, -2.5], [0.26, -3.0]], F, 12));
    const fore = new THREE.Group(); fore.position.y = -3.0; a.add(fore);
    fore.add(sph(0.28, FD));
    fore.add(lathe([[0.23, 0], [0.2, -0.9], [0.17, -2.0], [0.2, -2.9]], F, 12));
    const hand = new THREE.Group(); hand.position.y = -2.9; fore.add(hand); hand.add(sph(0.26, FD, 0.3, 0.24, 0.18));
    for (let i = 0; i < 4; i++) { const f = finger(1.4 + (i === 1 || i === 2 ? 0.25 : 0), 0.1, 0.3 + i * 0.03); f.position.set((i - 1.5) * 0.2, -0.15, 0.05); f.rotation.x = 0.2; f.rotation.z = (i - 1.5) * 0.06; hand.add(f); }
    const th = finger(1.0, 0.09, 0.35); th.position.set(side * -0.3, -0.05, -0.12); th.rotation.z = side * -0.9; th.rotation.x = 0.3; hand.add(th);
    a.userData.fore = fore; a.userData.hand = hand; return a;
  }
  rig.armL = arm(-1); rig.armR = arm(1); g.add(rig.armL); g.add(rig.armR);
  function leg(side) {
    const l = new THREE.Group(); l.position.set(side * 0.5, 5.2, 0);
    l.add(sph(0.32, FD));
    l.add(lathe([[0.3, 0], [0.34, -0.6], [0.27, -1.6], [0.24, -2.3], [0.3, -2.6]], F, 12));
    const shin = new THREE.Group(); shin.position.y = -2.6; l.add(shin);
    shin.add(sph(0.3, FD));
    shin.add(lathe([[0.26, 0], [0.25, -0.7], [0.19, -1.8], [0.21, -2.55]], F, 12));
    const foot = lathe([[0.26, 0], [0.32, -0.15], [0.26, -0.3]], FD, 10); foot.position.set(0, -2.5, 0.3); foot.scale.set(1, 1, 2.6); shin.add(foot);
    for (let i = 0; i < 3; i++) { const t = finger(0.9, 0.07, 0.2); t.position.set((i - 1) * 0.22, -2.45, 0.9); t.rotation.x = -Math.PI / 2 + 0.35; shin.add(t); }
    l.userData.shin = shin; return l;
  }
  rig.legL = leg(-1); rig.legR = leg(1); g.add(rig.legL); g.add(rig.legR);
  g.add(G.contactShadow(8));
  return { group: g, rig };
};

/* =========================================================================
   ARMY SOLDIER — 1.8 m. Pale round mask-face with three dark holes, olive
   helmet, camo fatigues + tactical vest, knee pads, boots, pistol raised.
   ========================================================================= */
G.makeSoldier = function () {
  const g = new THREE.Group(), rig = {};
  function leg(side) { const l = new THREE.Group(); l.position.set(side * 0.16, 0.86, 0);
    const th = G.box(0.22, 0.86, 0.24, M.camo); th.position.y = -0.43; l.add(th);
    const knee = G.sphere(0.13, M.vest); knee.scale.set(0.13, 0.11, 0.09); knee.position.set(0, -0.5, 0.1); l.add(knee);
    const boot = G.box(0.24, 0.16, 0.34, M.boot); boot.position.set(0, -0.86, 0.05); l.add(boot); return l; }
  rig.legL = leg(-1); rig.legR = leg(1); g.add(rig.legL); g.add(rig.legR);
  const torso = G.box(0.6, 0.78, 0.34, M.camo); torso.position.y = 1.25; g.add(torso);
  const vest = G.box(0.62, 0.52, 0.4, M.vest); vest.position.y = 1.32; g.add(vest);
  for (let i = -1; i <= 1; i++) { const p = G.box(0.14, 0.16, 0.1, M.vest); p.position.set(i * 0.17, 1.2, 0.24); g.add(p); }
  const belt = G.box(0.64, 0.1, 0.36, M.boot); belt.position.y = 0.9; g.add(belt);
  const radio = G.box(0.16, 0.22, 0.1, M.gun); radio.position.set(-0.18, 1.35, -0.22); g.add(radio);
  const ant = G.cyl(0.012, 0.012, 0.5, M.gun, 5); ant.position.set(-0.18, 1.7, -0.24); g.add(ant);
  const neck = G.cyl(0.05, 0.06, 0.16, M.mask, 8); neck.position.y = 1.7; g.add(neck);
  const head = G.sphere(0.21, M.mask); head.position.y = 1.92; head.scale.set(0.2, 0.22, 0.2); g.add(head);
  for (const h of [[-0.07, 1.96], [0.07, 1.96], [0, 1.85]]) { const hole = G.sphere(0.04, M.hole); hole.scale.set(0.045, 0.05, 0.02); hole.position.set(h[0], h[1], 0.185); g.add(hole); }
  const helm = G.sphere(0.26, M.helmet); helm.scale.set(0.26, 0.2, 0.27); helm.position.y = 2.02; g.add(helm);
  const brim = G.cyl(0.28, 0.28, 0.04, M.helmet, 14); brim.position.y = 1.96; g.add(brim);
  const mount = G.box(0.08, 0.06, 0.06, M.gun); mount.position.set(0, 2.1, 0.22); g.add(mount);
  const armL = G.box(0.15, 0.62, 0.15, M.camo); armL.position.set(-0.4, 1.3, 0.02); g.add(armL);
  const gloveL = G.sphere(0.07, M.vest); gloveL.position.set(-0.4, 0.95, 0.02); g.add(gloveL);
  const armR = new THREE.Group(); armR.position.set(0.36, 1.5, 0.08); g.add(armR);
  const upperR = G.box(0.15, 0.15, 0.62, M.camo); upperR.position.z = 0.31; armR.add(upperR);
  const glove = G.sphere(0.08, M.vest); glove.position.set(0, 0, 0.66); armR.add(glove);
  const pistol = G.box(0.06, 0.13, 0.26, M.gun); pistol.position.set(0, 0.06, 0.8); armR.add(pistol);
  const grip = G.box(0.05, 0.14, 0.07, M.gun); grip.position.set(0, -0.05, 0.7); grip.rotation.x = 0.3; armR.add(grip);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.08, 0.95); armR.add(muzzle);
  rig.armR = armR; rig.muzzle = muzzle;
  g.add(G.contactShadow(1.8));
  return { group: g, rig };
};

/* =========================================================================
   HOUSE HEAD — ~9 m tall, much wider. Weathered wooden house (shingles,
   planks, brick chimney, glowing window-eyes) on a mass of roots, eight
   3-segment spider legs with claws, a hanging claw cluster, teeth beneath.
   ========================================================================= */
G.makeHouseHead = function () {
  const g = new THREE.Group(), rig = {};
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, idx = i % 4;
    const base = new THREE.Group(); base.position.set(side * 1.5, 4.8, (idx - 1.5) * 1.1); base.rotation.y = (idx - 1.5) * 0.32;
    const coxa = new THREE.Group(); base.add(coxa);
    coxa.add(G.sphere(0.42, M.root));
    const seg1 = G.cyl(0.3, 0.42, 4.6, M.root, 8); seg1.position.set(side * 1.7, 1.3, 0); seg1.rotation.z = side * 0.95; coxa.add(seg1);
    const knee = new THREE.Group(); knee.position.set(side * 3.3, 2.5, 0); coxa.add(knee);
    knee.add(G.sphere(0.4, M.claw));
    const seg2 = G.cyl(0.18, 0.3, 4.2, M.root, 8); seg2.position.set(side * 1.3, -1.6, 0); seg2.rotation.z = side * 0.75; knee.add(seg2);
    const ankle = new THREE.Group(); ankle.position.set(side * 2.5, -3.2, 0); knee.add(ankle);
    ankle.add(G.sphere(0.28, M.claw));
    const seg3 = G.cyl(0.08, 0.18, 3.6, M.root, 7); seg3.position.set(side * 0.55, -1.7, 0); seg3.rotation.z = side * 0.32; ankle.add(seg3);
    const tip = claw(1.3, 0.16, M.claw); tip.position.set(side * 1.1, -3.4, 0); tip.rotation.z = side * 0.4; ankle.add(tip);
    for (let k = 0; k < 4; k++) { const th = claw(0.5, 0.05, M.claw); th.position.set(side * (0.6 + k * 0.5), 0.3 - k * 0.9, (rnd() - 0.5) * 0.3); th.rotation.z = side * 1.6 + (rnd() - 0.5) * 0.5; seg2.add(th); }
    g.add(base); legs.push({ base, coxa, knee, phase: (i % 2) * Math.PI + idx * 0.7, side });
  }
  rig.legs = legs;
  const mass = new THREE.Group(); mass.position.y = 5.0; g.add(mass);
  for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, r0 = 0.6 + rnd() * 1.3;
    mass.add(tube([[Math.cos(a) * r0 * 0.4, 2.6, Math.sin(a) * r0 * 0.4], [Math.cos(a) * r0, 1.6, Math.sin(a) * r0], [Math.cos(a + 0.5) * r0 * 1.1, 0.4, Math.sin(a + 0.5) * r0 * 1.1], [Math.cos(a + 0.9) * r0 * 0.7, -0.9 - rnd() * 1.2, Math.sin(a + 0.9) * r0 * 0.7]], 0.09 + rnd() * 0.12, M.root, 10)); }
  const core = G.cyl(0.9, 1.5, 3.2, M.root, 10); core.position.y = 1.4; mass.add(core);
  const clawGrp = new THREE.Group(); clawGrp.position.y = 4.4; g.add(clawGrp); rig.claw = clawGrp;
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const c = claw(2.8, 0.22, M.claw); c.position.set(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55); c.rotation.x = Math.sin(a) * -0.45; c.rotation.z = Math.cos(a) * 0.45; clawGrp.add(c); }
  const house = new THREE.Group(); house.position.y = 9.6; g.add(house); rig.house = house;
  const body = G.box(5.4, 4.2, 4.6, M.wood); house.add(body);
  const rL = G.box(3.7, 0.35, 5.2, M.roof); rL.position.set(-1.45, 2.65, 0); rL.rotation.z = 0.72; house.add(rL);
  const rR = G.box(3.7, 0.35, 5.2, M.roof); rR.position.set(1.45, 2.65, 0); rR.rotation.z = -0.72; house.add(rR);
  const ridge = G.box(0.4, 0.3, 5.3, M.roof); ridge.position.y = 3.72; house.add(ridge);
  const gableF = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 0.3, 3), M.wood); gableF.rotation.x = Math.PI / 2; gableF.position.set(0, 3.0, 2.3); gableF.scale.set(1.0, 0.72, 1); house.add(gableF);
  const chimney = G.box(0.9, 2.2, 0.9, M.brick); chimney.position.set(1.7, 3.6, -1.0); house.add(chimney);
  for (let i = 0; i < 9; i++) { const b = G.box(0.28, 0.8 + rnd() * 1.4, 0.18, M.wood); b.position.set(-2.4 + i * 0.6, -2.4 - (b.scale.y / 2), 2.2 + (rnd() - 0.5) * 0.4); house.add(b); }
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xffa81f, emissiveIntensity: 2.6, roughness: 0.3 });
  const eL = G.box(1.3, 1.4, 0.2, eyeMat, false); eL.position.set(-1.3, 0.3, 2.35); house.add(eL);
  const eR = eL.clone(); eR.position.x = 1.3; house.add(eR);
  [eL, eR].forEach(e => { const cv = G.box(0.1, 1.42, 0.26, M.roof, false); cv.position.copy(e.position); cv.position.z += 0.02; house.add(cv);
    const ch = G.box(1.32, 0.1, 0.26, M.roof, false); ch.position.copy(e.position); ch.position.z += 0.02; house.add(ch);
    const fr = G.box(1.5, 1.6, 0.12, M.roof, false); fr.position.copy(e.position); fr.position.z -= 0.06; house.add(fr); });
  rig.eyes = [eL, eR];
  const eyeLight = new THREE.PointLight(0xffb733, 2.4, 42); eyeLight.position.set(0, 9.8, 3.2); g.add(eyeLight); rig.eyeLight = eyeLight;
  for (let i = 0; i < 9; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.7, 6), M.teeth); t.position.set(-2.1 + i * 0.52, 7.05, 2.3); t.rotation.x = Math.PI; g.add(t); }
  g.add(G.contactShadow(16));
  return { group: g, rig };
};
})();
