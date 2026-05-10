// Off-axis perspective projection (Johnny Lee effect).
// head: {x, y, z} in marker units, origin at screen center, Z toward viewer.
// screenW, screenH: PC viewport px. markerPx: 150.
function updateCamera(camera, head, screenW, screenH, markerPx) {
  const W = screenW / markerPx;
  const H = screenH / markerPx;
  const n = 0.1, f = 1000;
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
  camera.matrix.makeTranslation(hx, hy, hz);
  camera.updateMatrixWorld(true);
}

async function loadSkyboxList() {
  try {
    const res = await fetch('https://api.github.com/repos/quasarbright/head-tracking-window/contents/skyboxes');
    const files = await res.json();
    return files.filter(f => f.name.match(/\.(hdr|exr)$/i)).map(f => f.name);
  } catch (e) {
    console.warn('Could not fetch skybox list:', e);
    return [];
  }
}

function loadSkybox(scene, renderer, filename) {
  const loader = new THREE.RGBELoader();
  loader.load(`skyboxes/${filename}`, texture => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
  });
}

function buildSkyboxDropdown(scene, renderer, files) {
  const sel = document.getElementById('skybox-select');
  sel.innerHTML = '';
  for (const f of files) {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f.replace(/\.(hdr|exr)$/i, '');
    sel.appendChild(opt);
  }
  sel.onchange = () => loadSkybox(scene, renderer, sel.value);
  if (files.length > 0) {
    loadSkybox(scene, renderer, files[0]);
  }
}

function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera();
  camera.near = 0.1;
  camera.far = 1000;
  camera.matrixAutoUpdate = false;

  const scene = buildScene();

  loadSkyboxList().then(files => buildSkyboxDropdown(scene, renderer, files));

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, camera, scene };
}
