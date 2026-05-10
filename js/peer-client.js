const status = document.getElementById('status');
const log = document.getElementById('log');
const video = document.getElementById('video');

// Start rear camera
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
  .then(stream => {
    video.srcObject = stream;
    startPeer();
  })
  .catch(err => {
    status.textContent = `Camera error: ${err.message}`;
  });

function startPeer() {
  const params = new URLSearchParams(window.location.search);
  const hostId = params.get('peer');

  if (!hostId) {
    status.textContent = 'No peer ID in URL.';
    return;
  }

  const peer = new Peer();

  peer.on('open', () => {
    status.textContent = 'Connecting to PC…';
    const conn = peer.connect(hostId);

    conn.on('open', () => {
      status.textContent = 'Connected';
      let count = 0;
      setInterval(() => {
        conn.send({ hello: true, count: count++ });
        log.textContent = `Sent ${count} messages`;
      }, 1000);
    });

    conn.on('error', err => {
      status.textContent = `Connection error: ${err.message}`;
    });

    conn.on('close', () => {
      status.textContent = 'Disconnected';
    });
  });

  peer.on('error', err => {
    status.textContent = `Peer error: ${err.message}`;
  });
}
