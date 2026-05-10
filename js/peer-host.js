const qrView = document.getElementById('qr-view');
const sceneView = document.getElementById('scene-view');
const connStatus = document.getElementById('conn-status');
const debug = document.getElementById('debug');

// Show scene immediately so keyboard mode works before phone connects
sceneView.classList.add('active');
qrView.style.display = 'flex';
qrView.style.position = 'fixed';
qrView.style.zIndex = '20';
qrView.style.background = 'rgba(0,0,0,0.7)';
qrView.style.padding = '24px';
qrView.style.borderRadius = '12px';

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

  conn.on('open', () => {
    conn.send({ type: 'config', screenW: window.innerWidth, screenH: window.innerHeight });
  });

  conn.on('data', data => {
    if (data.type === 'pose') {
      const { x, y, z } = data;
      // Update the shared head object defined in index.html
      head.x = x;
      head.y = y;
      head.z = z;
      debug.textContent = `x: ${x.toFixed(2)}  y: ${y.toFixed(2)}  z: ${z.toFixed(2)}`;
    }
  });

  conn.on('close', () => {
    qrView.style.display = 'flex';
    connStatus.textContent = 'Phone disconnected — rescan to reconnect';
  });
});

peer.on('error', err => {
  connStatus.textContent = `Error: ${err.message}`;
});
