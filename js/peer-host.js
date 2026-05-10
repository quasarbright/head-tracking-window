const log = document.getElementById('log');
const status = document.getElementById('status');

function appendLog(msg) {
  log.textContent += msg + '\n';
}

const peer = new Peer();

peer.on('open', id => {
  const phoneUrl = `https://quasarbright.github.io/head-tracking-window/camera.html?peer=${id}`;
  new QRCode(document.getElementById('qr'), { text: phoneUrl, width: 200, height: 200 });
  appendLog(`Peer ID: ${id}`);
});

peer.on('connection', conn => {
  status.textContent = 'Phone connected';
  conn.on('data', data => {
    appendLog(JSON.stringify(data));
  });
  conn.on('close', () => {
    status.textContent = 'Phone disconnected';
  });
});

peer.on('error', err => {
  appendLog(`Error: ${err.message}`);
});
