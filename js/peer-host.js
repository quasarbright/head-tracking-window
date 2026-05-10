const qrView = document.getElementById('qr-view');
const sceneView = document.getElementById('scene-view');
const connStatus = document.getElementById('conn-status');
const debug = document.getElementById('debug');

const peer = new Peer();

peer.on('open', id => {
  const localBase = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
  const prodBase = 'https://quasarbright.github.io/head-tracking-window/';
  const base = window.location.hostname === 'localhost' ? prodBase : localBase;
  const phoneUrl = `${base}camera.html?peer=${id}`;
  new QRCode(document.getElementById('qr'), { text: phoneUrl, width: 200, height: 200 });
  connStatus.textContent = `Peer ID: ${id}`;

  const localUrl = `${localBase}camera.html?peer=${id}`;
  const copyBtn = document.getElementById('copy-btn');
  copyBtn.style.display = 'block';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(localUrl).then(() => {
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = 'Copy link'; copyBtn.classList.remove('copied'); }, 2000);
    });
  };
});

peer.on('connection', conn => {
  qrView.style.display = 'none';
  sceneView.classList.add('active');
  // Show markers now that we're in scene mode
  document.querySelectorAll('.marker-canvas').forEach(c => c.style.visibility = 'visible');

  conn.on('open', () => {
    conn.send({ type: 'config', screenW: window.innerWidth, screenH: window.innerHeight });
  });

  conn.on('data', data => {
    if (data.type === 'pose') {
      const { x, y, z } = data;
      const LERP = 0.2;
      head.x += ( x - head.x) * LERP;
      head.y += ( y - head.y) * LERP;
      head.z += (-z - head.z) * LERP;
      debug.textContent = `x: ${head.x.toFixed(2)}  y: ${head.y.toFixed(2)}  z: ${head.z.toFixed(2)}`;
    }
  });

  conn.on('close', () => {
    sceneView.classList.remove('active');
    document.querySelectorAll('.marker-canvas').forEach(c => c.style.visibility = 'hidden');
    qrView.style.display = 'flex';
    connStatus.textContent = 'Phone disconnected — rescan to reconnect';
  });
});

peer.on('error', err => {
  connStatus.textContent = `Error: ${err.message}`;
});
