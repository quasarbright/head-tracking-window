const qrView = document.getElementById('qr-view');
const markerView = document.getElementById('marker-view');
const connStatus = document.getElementById('conn-status');
const debug = document.getElementById('debug');

// Draw ArUco marker on the canvas (300px — large enough to detect at ~60cm)
const markerCanvas = document.getElementById('marker-canvas');
drawArucoMarker(markerCanvas, 500);

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
  markerView.classList.add('active');

  conn.on('data', data => {
    if (data.type === 'detection' && data.markers.length > 0) {
      const { id, corners } = data.markers[0];
      debug.textContent = `ID ${id}  |  corners: ${corners.map(([x, y]) => `(${x.toFixed(0)},${y.toFixed(0)})`).join('  ')}`;
    }
  });

  conn.on('close', () => {
    markerView.classList.remove('active');
    qrView.style.display = 'flex';
    connStatus.textContent = 'Phone disconnected — rescan to reconnect';
  });
});

peer.on('error', err => {
  connStatus.textContent = `Error: ${err.message}`;
});
