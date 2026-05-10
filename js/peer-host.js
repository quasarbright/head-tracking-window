const qrView = document.getElementById('qr-view');
const markerView = document.getElementById('marker-view');
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
  markerView.classList.add('active');

  conn.on('open', () => {
    conn.send({ type: 'config', screenW: window.innerWidth, screenH: window.innerHeight });
  });

  conn.on('data', data => {
    if (data.type === 'pose') {
      const { x, y, z } = data;
      debug.textContent = `x: ${x.toFixed(2)}  y: ${y.toFixed(2)}  z: ${z.toFixed(2)}`;
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
