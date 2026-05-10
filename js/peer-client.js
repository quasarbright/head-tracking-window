const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const processingCanvas = document.createElement('canvas');

function setStatus(msg) { statusEl.textContent = msg; }
function setLog(msg) { logEl.textContent = msg; }

const debugLines = {};
function dbg(key, val) {
  debugLines[key] = `${key}: ${val}`;
  const el = document.getElementById('debug-overlay');
  if (el) el.textContent = Object.values(debugLines).join('\n');
}

let videoTrack = null;

navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
  .then(stream => {
    video.srcObject = stream;
    videoTrack = stream.getVideoTracks()[0];
    video.onloadedmetadata = () => startAruco();
  })
  .catch(err => setStatus(`Camera error: ${err.message}`));

// Tap to focus
document.addEventListener('touchend', e => {
  if (!videoTrack) return;
  const touch = e.changedTouches[0];
  const x = touch.clientX / window.innerWidth;
  const y = touch.clientY / window.innerHeight;
  videoTrack.applyConstraints({ advanced: [{ focusMode: 'manual', pointsOfInterest: [{ x, y }] }] })
    .catch(() => {});
});

function startAruco() {
  loadOpenCV(() => {
    setStatus('Searching for marker…');
    const params = new URLSearchParams(window.location.search);
    const hostId = params.get('peer');
    const conn = hostId ? connectPeer(hostId) : null;
    if (!hostId) setLog('No peer ID — running detection only');
    startLoop(conn);
  }, setStatus);
}

function connectPeer(hostId) {
  const peer = new Peer();
  let conn = null;

  peer.on('open', () => {
    conn = peer.connect(hostId);
    conn.on('open', () => setLog('Connected to PC'));
    conn.on('close', () => setLog('Disconnected'));
    conn.on('error', err => setLog(`Conn error: ${err.message}`));
  });

  peer.on('error', err => setLog(`Peer error: ${err.message}`));
  return { send: data => conn && conn.open && conn.send(data) };
}

function startLoop(conn) {
  let frameCount = 0;
  let lastDetections = [];
  let lastDetectTime = 0;
  const PERSIST_MS = 500;

  function loop() {
    frameCount++;
    let detections = [];
    try {
      detections = detectMarkers(video, processingCanvas);
    } catch (e) {
      setStatus(`Detection error: ${e.message}`);
      dbg('error', e.message);
    }

    if (detections.length > 0) {
      lastDetections = detections;
      lastDetectTime = Date.now();
    }
    const showDetections = Date.now() - lastDetectTime < PERSIST_MS ? lastDetections : [];

    // Preview thumbnail
    const preview = document.getElementById('preview');
    if (preview && processingCanvas.width) {
      preview.width = processingCanvas.width;
      preview.height = processingCanvas.height;
      preview.getContext('2d').drawImage(processingCanvas, 0, 0);
    }

    dbg('frame', frameCount);
    dbg('video', `${video.videoWidth}x${video.videoHeight}`);
    dbg('detected', detections.length);

    drawDetections(overlay, showDetections, video.videoWidth, video.videoHeight);

    if (detections.length > 0) {
      const { id, corners } = detections[0];
      setStatus(`Marker detected: ID ${id}`);
      setLog(corners.map(([x, y]) => `(${x.toFixed(0)},${y.toFixed(0)})`).join('  '));
      conn && conn.send({ type: 'detection', markers: detections });
    } else {
      setStatus('Searching for marker…');
    }

    requestAnimationFrame(loop);
  }
  loop();
}
