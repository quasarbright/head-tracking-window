# Head-Tracked Perspective Window — Project Brief

## Concept

Turn a monitor into a "window" into a 3D world using head tracking. By knowing where the user's head is relative to the screen, we adjust the 3D perspective projection in real time so the scene always looks exactly as it would if the screen were a physical window — moving your head reveals different parts of the scene, with correct parallax.

This is sometimes called "off-axis perspective projection" or the "Johnny Lee effect".

## Architecture

Two pages, both static (GitHub Pages compatible, no backend required):

### 1. PC page (`index.html`)
- Renders the 3D scene using Three.js
- On load, generates a unique PeerJS session ID
- Displays a QR code encoding the phone page URL with that session ID embedded (e.g. `https://yoursite.com/camera.html#peer=abc123`)
- Waits for phone to connect via PeerJS
- Receives head position data from phone and updates the Three.js camera accordingly
- Uses **off-axis perspective projection** (not standard Three.js camera — see math section below)

### 2. Phone page (`camera.html`)
- User scans QR code and opens this page on their phone browser
- Accesses phone camera via `getUserMedia`
- Detects ArUco markers displayed on the PC screen using OpenCV.js
- Runs `solvePnP` to compute the camera's 6DOF pose relative to the screen
- Sends head position (x, y, z) to PC page via PeerJS DataChannel
- Runs at highest available frame rate (request 60fps, accept 30fps)

## Key Libraries

- **Three.js** — 3D rendering on PC
- **PeerJS** — serverless WebRTC peer-to-peer data channel (uses PeerJS free hosted signaling, data flows P2P over local network once connected)
- **OpenCV.js** — ArUco marker detection and `solvePnP` in the browser (handles the full pipeline: detection + pose estimation)
- **qrcode.js** — generate QR code on PC page

## Off-Axis Perspective Projection

This is the critical math. Standard Three.js `PerspectiveCamera` won't work correctly — you need an asymmetric frustum based on the physical relationship between the viewer and the screen.

Given:
- Physical screen width `W` and height `H` (measured in real units, e.g. cm)
- Head position `(hx, hy, hz)` relative to screen center (derived from ArUco solvePnP)
- Near plane distance `n`, far plane `f`

Compute the frustum bounds:

```
left   = n * (-W/2 - hx) / hz
right  = n * ( W/2 - hx) / hz
bottom = n * (-H/2 - hy) / hz
top    = n * ( H/2 - hy) / hz
```

Apply with:
```js
camera.projectionMatrix.makeFrustum(left, right, bottom, top, near, far);
camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
// Also translate the camera to head position
camera.position.set(hx, hy, hz);
camera.updateMatrixWorld();
```

Reference: Robert Kooima's "Generalized Perspective Projection" (widely cited, easy to find).

## ArUco Marker Setup

- PC page renders one or more ArUco markers at known positions on screen (e.g. corners or center)
- Phone camera detects these markers and extracts their corner pixel coordinates
- `solvePnP` takes:
  - 3D object points: the known physical positions of the marker corners in screen space (derived from screen physical dimensions)
  - 2D image points: detected pixel coordinates from camera frame
  - Camera intrinsics: focal length + principal point (can be estimated from phone FOV, or calibrated)
- Output: rotation vector + translation vector = head pose relative to screen

## Coordinate System Convention

- Origin at screen center
- X right, Y up, Z toward viewer (out of screen)
- Units: centimeters (screen physical size as reference)
- ArUco solvePnP output is in this coordinate system

## Data Protocol (Phone → PC over PeerJS)

Send JSON at every frame:
```json
{
  "x": 12.3,
  "y": 5.1,
  "z": 45.0
}
```
(rotation can be added later if needed for advanced effects)

## Initial Demo Scene

Start simple to validate the effect:
- A grid floor extending into the distance
- A few colored boxes at different depths
- A skybox or background color

This makes parallax immediately obvious when moving your head.

## Setup Flow (User Experience)

1. User opens PC page → sees QR code + placeholder scene
2. User scans QR with phone → phone page opens, requests camera permission
3. Phone detects ArUco marker on PC screen → tracking begins
4. QR code disappears, scene activates, head tracking is live

## Physical Setup Notes (for README)

- User should measure their monitor's physical width and height in cm and enter it (or hardcode for now)
- Phone should be mounted on a headband or taped to glasses, pointing at the screen
- Recommend sitting ~40–80cm from screen for best tracking accuracy
- Room should be reasonably lit for marker detection

## File Structure

```
/
├── index.html          # PC page (Three.js scene + PeerJS host + QR code)
├── camera.html         # Phone page (camera + ArUco + PeerJS client)
├── js/
│   ├── scene.js        # Three.js setup + off-axis projection math
│   ├── peer-host.js    # PeerJS session + QR generation
│   ├── peer-client.js  # PeerJS connection + position sending
│   └── aruco.js        # ArUco detection + solvePnP wrapper
└── README.md
```

## Out of Scope for Now

- Rotation tracking (head tilt) — position only first
- Multiple users
- Mobile rendering of 3D scene
- Camera intrinsic calibration UI (use estimated values first)
