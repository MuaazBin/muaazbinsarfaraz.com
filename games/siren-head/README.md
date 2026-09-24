# SIREN HEAD: TORONTO NIGHT — Playable Prototype (v2 · graphics overhaul)

> **Unofficial fan project:** Siren Head was created by artist Trevor Henderson. This free,
> non-commercial family learning prototype is independent and is not affiliated with, sponsored
> by, or endorsed by the character's creator.

A **3D third-person action/horror** prototype that runs entirely in the browser (WebGL via
Three.js). You are **Siren Head**, five storeys of weathered flesh and screaming steel, tearing
through a storm-lit downtown Toronto toward the **CN Tower**, where the boss **House Head** waits.

v2 keeps the gameplay you liked and pushes the visuals hard: real reflections in the wet streets,
bloom-lit skyline, shadows, a stormy sky with a moon breaking through the clouds, the **full CN
Tower** always in view down the avenue, trees, and a big **thunder + white-flash** lightning event
on a random 1–5 minute cadence.

---

## ▶ How to play

**Easiest (recommended — full sound):** double-click **`Play Siren Head.bat`**. It starts a tiny
local server and opens the game in your browser. Click **Enter the Storm**.
*(Uses Python, already on this machine. If the browser opens before the server is ready, refresh once.)*

**Alternative:** open **`index.html`** directly. Works in most browsers; some block local audio over
`file://`, in which case use the launcher.

Play **fullscreen (F11)** with **sound on**. The 3D engine loads from a CDN, so the first launch
needs an internet connection.

### Graphics quality
Pick **Low / Medium / High** on the start screen (remembered between sessions; the page reloads).

| | Low | Medium (default) | High |
|---|---|---|---|
| Post-processing (bloom, FXAA, vignette, grain, chromatic punch) | – | ✓ | ✓ |
| Real-time shadows | – | 1024 | 2048 |
| Mirror-wet street reflections | – | 512 | 1024 |
| Rain streaks / splashes | 1800 / – | 3600 / 110 | 5600 / 220 |
| Streetlight light-cones | – | ✓ | ✓ |

If it stutters on a laptop, use **Low** — it still has the full world, sky, tower and gameplay.

---

## 🎮 Controls

| Input | Action |
|---|---|
| **W A S D** | Move |
| **↑ / ↓ arrows** | Move forward / back |
| **← / → arrows** | Turn the view (keyboard-only steering) |
| **Mouse** | Look / aim |
| **Shift** | Run (giant strides) |
| **Space** | Step / jump |
| **Left Click** | Hand strike — wide sweep, knockback |
| **Right Click** | Bite — slower, heavy damage |
| **E** or **F** | Siren Blast — AoE stun + damage around you (cooldown) |
| **Esc** | Pause |

You aim melee with the mouse — face the enemies, then strike/bite. The Siren Blast hits everything
around you regardless of facing. You start **facing north, toward the CN Tower**.

---

## 🎯 The run (≈5–10 min)

1. Start on a Toronto avenue at night — objective: **Reach the CN Tower** (it's right there, dead ahead).
2. **Zone B** — first army patrol. Learn hand strike + bite.
3. **Zone C** — military checkpoint (trucks, barricades, sandbags). You're prompted to use the **Siren Blast**.
4. **Zone D** — open plaza with a small park beneath the skyline.
5. **Zone E** — **House Head** boss fight (claw swipe + heavy stomp, boss health bar, cinematic intro).
6. Defeat it → **PROTOTYPE COMPLETE**.

Health regenerates slowly out of fire. Soldiers are easy 1-on-1, dangerous in groups.

### ⚡ The storm event
Every so often the whole sky **flashes white**, a lightning bolt forks over the skyline, the CN
Tower flares, and **thunder** rolls in. Timing is random: the first strike lands **30–75 s** into
the run, then **every 1–5 minutes**. Between strikes there's only faint, silent far-off flicker in
the clouds. Tune it in `js/core.js` → `CFG.stormFirst` / `CFG.stormEvery` (seconds).

---

## 🔧 v2.1 tweaks
- **Mouse-look without pointer-lock** (embedded browser panes) now uses relative mouse motion — the
  view only moves while the mouse moves, so nothing drifts when your hand is still. Parking the
  cursor in the outer 4% of the screen width keeps turning (for up to 3 s), or use **← →**.
  Clicks always attack. In a normal browser (via the launcher) pointer-lock mouse-look is used.
- **Siren Head rebuilt for realism:** gaunt lathe-shaped anatomy (narrow waist, flat flared ribcage,
  sternum, spine, sinew), long knuckled fingers with claws hanging to the ankles, riveted rusted bell
  horns with motor housings, gums and varied teeth pointing into the throat, neck coil + cables, and
  rain-slick skin (clearcoat physical material). Feet now stand on the road (the earlier build's
  legs sat below it, which made them look stubby).
- **Siren Head visibility:** a cool character key light follows the player on the camera side, plus
  a faint warm skin emissive so shadow sides never go black; footstep camera shake reduced.

## 🧩 What's new in v2 (graphics)

- **Rendering:** ACES tone mapping, **UnrealBloom**, FXAA, film pass (vignette, grain, chromatic
  aberration that punches on the siren blast / boss hits), camera shake, quality tiers.
- **Lighting & shadows:** soft PCF shadow maps from the moon that follow the player; emissive +
  bloom on windows, lamps, sirens, tower and House Head's eyes; volumetric light-cones under lamps.
- **Wet streets:** a real planar **Reflector** under a patchy translucent asphalt layer (puddles are
  the clearer patches) plus a shadow-catching layer — buildings, lights and the monsters mirror in
  the road.
- **Sky:** procedural gradient dome with two drifting cloud layers, stars, a **moon** with halo in a
  break in the clouds, warm city glow at the horizon, and a lightning flash uniform.
- **CN Tower:** rebuilt at true landmark scale (485 m), centred at the far end of the avenue so the
  **whole tower is visible** from the street — shaft, glowing SkyPod bands, upper deck, red/white
  LED antenna, red beacon, red light strip — fog-exempt and self-lit; flares on lightning. A
  distant lit **city skyline** wraps the horizon.
- **Materials:** procedural (canvas) textures everywhere — lit-window facades per building, camo,
  rusted metal, striated flesh, planks, shingles, brick, asphalt bump.
- **Characters:** Siren Head with rusted outward-facing megaphone horns (teeth + red throat), neck
  cables, ribs, spine, elbow/knee joints, long claws, horn vibration on the blast; **soldiers**
  rebuilt to the new concept (pale mask face with three holes, helmet, camo + tactical vest, knee
  pads, boots, **pistol**, radio); House Head with shingle roof, plank walls, brick chimney, ragged
  boards, tendril roots, 3-segment stepping spider legs with claws.
- **World:** trees (leafy + dead) along the sidewalks and a plaza park, more vehicles with lit
  head/tail lights, lit streetcar and bus windows.
- **Weather/VFX:** wind-blown rain, ground splash rings, footstep dust, muzzle flashes, siren
  shockwave rings, impact sparks, boss stomp dust, cinematic letterbox on the boss intro.
- **Audio:** your mp3s (rain loop, thunder, House Head breath, siren) + procedural gunfire /
  footsteps / impacts with **distance attenuation and stereo panning** relative to the camera.
- **Controls/camera:** arrow keys (move + turn), camera reframed to keep the skyline in view, you
  start facing the tower.

## 📁 Files
```
Siren Head Toronto Night/
├── index.html               ← the page (HUD, screens, loads the engine + js/ in order)
├── js/core.js               ← renderer, quality tiers, lights/shadows, post FX, textures, materials
├── js/world.js              ← sky, ground/reflections, buildings, skyline, CN Tower, props, trees, particles
├── js/models.js             ← Siren Head / Soldier / House Head builders
├── js/game.js               ← audio, entities, input, combat, AI, storm scheduler, camera, HUD, loop
├── audio/                   ← rain / thunder / househead / siren (your supplied mp3s)
├── Play Siren Head.bat      ← one-click launcher (local server + browser)
├── CREDITS.txt              ← fan-project attribution and credits
└── README.md
```

## 🛠 Dev console (F12 while playing)
```js
SH.info()        // state, phase, position, soldiers alive, HP, boss HP, seconds to next storm, quality flags
SH.tp(x, z)      // teleport   e.g. SH.tp(0,150) checkpoint · SH.tp(8,228) boss arena
SH.face(x, z)    // face a point (SH.face(0,1400) = look at the tower)
SH.pitch(0.1)    // camera pitch (lower = look up)
SH.storm()       // fire the thunder + white-flash event now
SH.boss()        // spawn House Head now
SH.blast()       // fire the siren blast
SH.godmode()     // heavy health regen
```
Gameplay numbers live in `js/core.js` → `CFG` (speeds, damage, cooldowns, health, storm timing);
quality presets in `G.PRESETS`.

### Notes / known limits
- Tanks/aircraft are background-only (per the brief); no building destruction; the giants stride
  over the city (soldiers/props collide, giants don't).
- The follow camera can clip into a wall if you hug a building — step back toward the road.
- Reflections render the scene a second time; Medium is the intended balance. High is for a
  proper GPU.
