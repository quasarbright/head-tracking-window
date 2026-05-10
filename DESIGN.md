# Technical Design

## System Overview

```
Phone (camera.html)                    PC (index.html)
┌─────────────────────┐               ┌─────────────────────┐
│ getUserMedia        │               │ Three.js scene      │
│ → video frame       │               │                     │
│ → OpenCV.js         │   PeerJS      │ receives {x,y,z}    │
│   → ArUco detect    │ ──────────►   │ → off-axis frustum  │
│   → solvePnP        │  DataChannel  │ → camera.position   │
│   → {x,y,z}        │               │ → render            │
└─────────────────────┘               └─────────────────────┘
```

Data flows one direction: phone computes head pose, sends to PC every frame.

---

## PC Page (`index.html`)

### Startup sequence
1. Generate random peer ID, init PeerJS host
2. Render QR code pointing to `camera.html#peer=<id>`
3. Display placeholder scene
4. On peer connect: hide QR, activate tracking

### Off-axis projection (`js/scene.js`)
The camera's projection matrix is rebuilt every frame from the received head position. See CLAUDE.md for the math. Key points:
- `camera.position` is set to `(hx, hy, hz)` — the camera physically moves in world space
- The projection matrix encodes the asymmetric frustum — it is NOT a standard `PerspectiveCamera` matrix
- `camera.updateMatrixWorld()` must be called after setting position, before render
- Screen physical dimensions (W, H in cm) are constants — hardcoded for now, configurable later

### Scene units
1 unit = 1 cm. Screen is centered at world origin. Scene objects should be placed accordingly (e.g. a box 50cm in front of the screen is at z = -50).

---

## Phone Page (`camera.html`)

### OpenCV.js initialization
OpenCV.js loads asynchronously and takes time to compile on mobile. Gate all processing behind `cv['onRuntimeInitialized']`. Show a loading indicator until ready.

### Camera preview
The video element is displayed fullscreen as a live viewfinder so the user can aim the phone at the screen. An overlay canvas (same dimensions, positioned on top via CSS) is used to draw detected marker outlines for visual feedback that tracking is active.

### Camera pipeline
```
video element (live feed, visible to user)
  → drawImage() onto offscreen processing canvas each frame
  → cv.imread() → Mat
  → ArUco detectMarkers()
  → if markers found:
      → draw outlines on overlay canvas
      → solvePnP()
      → transform to screen coordinate system
      → send {x,y,z} via PeerJS DataChannel
```

Run loop via `requestAnimationFrame`. Skip solvePnP frames where no markers are detected (send nothing, PC holds last position).

### ArUco marker display (PC side)
The PC page renders ArUco markers as `<img>` or `<canvas>` elements overlaid on the screen at known pixel positions. Their physical positions in cm (relative to screen center) are the 3D object points fed into solvePnP.

Use a single marker to start. Multiple markers improve robustness and accuracy but complicate the setup.

### solvePnP inputs
- **3D object points**: corners of the displayed ArUco marker in screen-space cm coordinates. Derived from: marker's pixel position on screen → convert to cm using screen DPI or known physical dimensions.
- **2D image points**: corner pixels detected by ArUco in the phone camera frame.
- **Camera intrinsics**: estimated from phone FOV. For a phone with ~70° horizontal FOV and resolution W×H:
  ```
  fx = fy ≈ W / (2 * tan(FOV/2))
  cx = W/2, cy = H/2
  ```
  No distortion coefficients for now (assume zero).
- **Output**: `rvec` (rotation) + `tvec` (translation) — tvec is the head position in screen space.

### Coordinate transform
OpenCV's solvePnP output is in camera-relative coordinates with Z forward, Y down. Convert to our convention (Z toward viewer, Y up, origin at screen center):
```js
x_out =  tvec[0]
y_out = -tvec[1]
z_out = -tvec[2]
```

---

## PeerJS Connection (`js/peer-host.js`, `js/peer-client.js`)

- PC creates `new Peer(generatedId)` and waits for `peer.on('connection')`
- Phone extracts peer ID from URL hash and calls `peer.connect(id)`
- Both sides use the DataChannel's `send()`/`on('data')` for JSON messages
- On disconnect: PC shows QR code again, phone attempts reconnect

Message format: `{"x": float, "y": float, "z": float}` — send as JSON string, parse on receipt.

---

## Key Design Decisions

**Why one-way data flow?** The phone does all the compute (computer vision is expensive). The PC just renders. Keeps the PC page simple and the latency budget clear.

**Why hardcode screen dimensions?** Calibrating physical screen size is annoying UX for a demo. Hardcode a common monitor size (e.g. 60cm × 34cm for a 27" 16:9) and note it as a constant to change.

**Why ArUco on the PC screen rather than a printed marker?** No printing required — the demo works entirely with the existing hardware. The downside is screen glare can reduce detection reliability.

---

## Open Questions / Later Work

- Camera intrinsic estimation is rough — may need per-device tuning if tracking feels off
- Single marker gives noisier pose than multiple markers; a 4-marker layout would improve robustness but doesn't help with physical units — physical units aren't needed since the frustum math only depends on ratios (everything divides by hz). Screen dimensions can be expressed in marker units via pixel ratios at render time, no user input required. Not worth the complexity for now.
- `requestAnimationFrame` on phone may throttle in background tab — document that phone screen must stay on and tab active
- PeerJS free signaling server has rate limits; fine for personal use, document the constraint
