const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const processingCanvas = document.createElement('canvas');

function setStatus(msg) { statusEl.textContent = msg; }
function setLog(msg) { logEl.textContent = msg; }

navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
  .then(stream => {
    video.srcObject = stream;
    video.onloadedmetadata = () => startAruco();
  })
  .catch(err => setStatus(`Camera error: ${err.message}`));

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
  function loop() {
    frameCount++;
    let detections = [];
    try {
      detections = detectMarkers(video, processingCanvas);
    } catch (e) {
      console.error('detectMarkers error:', e);
      setStatus(`Detection error: ${e.message}`);
    }

    drawDetections(overlay, detections, video.videoWidth, video.videoHeight);

    if (detections.length > 0) {
      const { id, corners } = detections[0];
      setStatus(`Marker detected: ID ${id}`);
      setLog(corners.map(([x, y]) => `(${x.toFixed(0)},${y.toFixed(0)})`).join('  '));
      conn && conn.send({ type: 'detection', markers: detections });
    } else {
      setStatus('Searching for marker…');
      if (frameCount % 60 === 0) console.log(`Frame ${frameCount}, no detection. Video: ${video.videoWidth}x${video.videoHeight}`);
    }

    requestAnimationFrame(loop);
  }
  loop();
}
