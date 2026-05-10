// Off-axis perspective projection (Johnny Lee effect).
// head: {x, y, z} in marker units, origin at screen center, Z toward viewer.
// screenW, screenH: PC viewport px. markerPx: 150.
// near/far in marker units.
function updateCamera(camera, head, screenW, screenH, markerPx) {
  const W = screenW / markerPx;
  const H = screenH / markerPx;
  const n = 0.1, f = 200;
  const { x: hx, y: hy, z: hz } = head;

  if (hz <= 0) return;

  const left   = n * (-W / 2 - hx) / hz;
  const right  = n * ( W / 2 - hx) / hz;
  const bottom = n * (-H / 2 - hy) / hz;
  const top    = n * ( H / 2 - hy) / hz;

  camera.projectionMatrix.set(
    2*n/(right-left), 0, (right+left)/(right-left), 0,
    0, 2*n/(top-bottom), (top+bottom)/(top-bottom), 0,
    0, 0, -(f+n)/(f-n), -2*f*n/(f-n),
    0, 0, -1, 0
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.position.set(hx, hy, hz);
  camera.updateMatrixWorld();
}

function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  // Grid floor
  const grid = new THREE.GridHelper(40, 40, 0x444444, 0x444444);
  grid.position.y = -3;
  scene.add(grid);

  // Boxes at various depths
  const boxes = [
    { pos: [0,  0, -5],  color: 0xff4444, size: [1.5, 1.5, 1.5] },
    { pos: [3,  0, -10], color: 0x44aaff, size: [2, 2, 2] },
    { pos: [-3, 0, -10], color: 0x44ff88, size: [2, 2, 2] },
    { pos: [5,  0, -20], color: 0xffaa00, size: [3, 3, 3] },
    { pos: [-5, 0, -20], color: 0xcc44ff, size: [3, 3, 3] },
    { pos: [0,  0, -20], color: 0xffffff, size: [3, 6, 3] },
  ];

  for (const { pos, color, size } of boxes) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshLambertMaterial({ color })
    );
    mesh.position.set(...pos);
    scene.add(mesh);
  }

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  scene.add(dir);

  return scene;
}

function initScene(container) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    container.innerHTML = `
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#111;color:#eee;font-family:monospace;padding:40px;">
        <div style="max-width:480px;text-align:center;line-height:1.6">
          <div style="font-size:2em;margin-bottom:16px">⚠️</div>
          <strong>WebGL is not available</strong>
          <p style="color:#aaa;margin:16px 0">The 3D scene requires WebGL, which your browser has disabled.</p>
          <p style="color:#888;font-size:13px">To fix this in Chrome:<br>
            1. Go to <code>chrome://settings/system</code><br>
            2. Enable <em>Use graphics acceleration when available</em><br>
            3. Relaunch the browser<br><br>
            If that doesn't help, try <code>chrome://flags/#use-angle</code><br>
            and switch the ANGLE backend to <strong>OpenGL</strong> or <strong>Vulkan</strong>.
          </p>
        </div>
      </div>`;
    return null;
  }
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera();
  camera.near = 0.1;
  camera.far = 200;
  camera.matrixAutoUpdate = false;

  const scene = buildScene();

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, camera, scene };
}
