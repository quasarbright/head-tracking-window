# Head-Tracked Perspective Window

Turn your monitor into a window into a 3D world. Using your phone's camera to track your head position, the 3D scene updates in real time so the screen looks exactly like a physical window — moving your head reveals parallax and depth correctly.

This is sometimes called the "Johnny Lee effect" or off-axis perspective projection.

## How It Works

1. **PC page** (`index.html`) renders a 3D scene and displays a QR code with a unique session ID.
2. **Phone page** (`camera.html`) — scan the QR code to open on your phone. It uses your camera to detect ArUco markers on the PC screen, computes your head's 3D position via `solvePnP`, and streams it to the PC over WebRTC.
3. The PC adjusts the camera frustum in real time based on your head position, producing correct parallax.

No backend required — everything runs as static pages. WebRTC signaling uses PeerJS's free hosted server; data flows peer-to-peer over your local network.

## Setup

### Physical

- Open `index.html` on your PC in a browser.
- Mount your phone on a headband or tape it to glasses, camera facing the screen.
- Sit roughly 40–80 cm from the screen for best tracking accuracy.
- Make sure the room is reasonably lit for marker detection.

### Running

Since this is static HTML, you can serve it with any local HTTP server:

```bash
npx serve .
# or
python3 -m http.server
```

Then open `http://localhost:PORT` on your PC.

### Connecting

1. The PC page shows a QR code — scan it with your phone.
2. The phone page opens and requests camera permission.
3. Point the phone camera at the screen. Once the ArUco markers are detected, tracking begins automatically.
4. The QR code disappears and head tracking goes live.

## Tech Stack

- **Three.js** — 3D rendering
- **PeerJS** — serverless WebRTC data channel
- **OpenCV.js** — ArUco marker detection and `solvePnP` pose estimation (self-hosted)
- **qrcode.js** — QR code generation

## Coordinate System

Origin at screen center, X right, Y up, Z toward viewer. Units are in ArUco marker units (pixel ratios — no physical measurement needed).

## File Structure

```
index.html        PC page — 3D scene, QR code, PeerJS host
camera.html       Phone page — camera, ArUco tracking, PeerJS client
js/
  scene.js        Three.js setup + off-axis projection math
  peer-host.js    PeerJS session + QR generation
  peer-client.js  PeerJS connection + position sending
  aruco.js        ArUco detection + solvePnP wrapper
  opencv.js       Self-hosted OpenCV.js build
```
