# Implementation Plan

Ordered to validate the riskiest unknowns first. Each phase is independently runnable and manually verifiable.

---

## Phase 1 — PeerJS PoC: phone connects to PC, messages flow

**Goal:** prove the connection works end-to-end before building anything real.

**What to build:**
- `index.html`: generate peer ID, show QR code, display incoming messages in a `<pre>`
- `camera.html`: read peer ID from URL hash, connect, send `{hello: true}` every second

**Manual demo:** open `index.html`, scan QR with phone, watch messages appear on screen.

---

## Phase 2 — Camera feed PoC: phone camera displays in phone browser

**Goal:** prove `getUserMedia` works on the phone browser and the live feed is visible and usable.

**What to build:**
- `camera.html`: request rear camera via `getUserMedia`, display in a fullscreen `<video>` element

**Manual demo:** open `camera.html` on the phone, see the live camera feed. Check that it's smooth and rear-facing. This is the go/no-go for whether phone camera access works in the target browser environment.

---

## Phase 3 — ArUco detection on phone

**Goal:** detect a marker displayed on the PC screen from the phone camera.

**What to build:**
- Load OpenCV.js on `camera.html`, show loading indicator until ready
- Display an ArUco marker on `index.html` (static image, known ID)
- Detect marker in each camera frame, draw corner outlines on overlay canvas
- Show detected marker ID and corner coordinates in a debug panel

**Manual demo:** point phone at the PC screen, watch the marker get outlined in real time.

---

## Phase 4 — solvePnP: compute head position from marker

**Goal:** turn corner pixel coordinates into a 3D head position.

**What to build:**
- `js/aruco.js`: given detected corner pixels + marker size in px + screen dimensions in px, compute `{x, y, z}` in marker units using solvePnP
- Display the live `{x, y, z}` values on both the phone screen and the PC screen as you move the phone around

**Manual demo:** move the phone toward/away from the screen and side to side, watch the numbers change plausibly. z should increase as phone moves closer.

---

## Phase 5 — Three.js scene with off-axis projection

**Goal:** prove the projection math is correct, independent of tracking.

**What to build:**
- `index.html`: basic scene (grid floor + a few colored boxes at different depths)
- `js/scene.js`: off-axis projection matrix from a head position
- Drive the camera with keyboard controls (WASD or arrow keys) so it's testable without a phone

**Manual demo:** use keyboard to move the virtual head around. Parallax should look correct — moving left should reveal more of the right side of the scene, closer movement should make near objects loom.

---

## Phase 6 — Integration: wire tracking into scene

**Goal:** the full system working end-to-end.

**What to build:**
- Wire Phase 4 output into Phase 5 camera
- Remove keyboard controls (or keep as fallback)
- Polish: connection status indicator, reconnect on drop, hide QR on connect

**Manual demo:** the full experience — scan QR, point phone at screen, move head, see parallax.

---

## Testing Infrastructure

Automated tests cover pure math only — no browser automation. Test runner: Node's built-in `node --test` (no extra dependencies).

- `tests/projection-math.test.js` — off-axis frustum matrix, synthetic head positions in, expected matrix values out. No external data needed.
- `tests/solvepnp.test.js` — synthesize known head position → project marker corners → run solvePnP → assert recovered position matches. No external data needed.
- `tests/aruco-detection.test.js` — run ArUco detection against a real camera frame and assert the correct marker ID and corner coordinates are returned. **Requires a test image from you:** a photo taken with your phone of the ArUco marker displayed on the PC screen. Capture this once Phase 3 is running and the marker is on screen.

Everything else is verified manually after each phase.

Local dev server: `npx serve .` or Python's `http.server` — no build step.

**Deployment:** deploy to GitHub Pages early (before Phase 1 testing) to avoid HTTPS issues with PeerJS and `getUserMedia` on the phone. The live URL also makes the QR code flow work naturally.
