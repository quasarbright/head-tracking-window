const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js';
let detector = null;

function loadOpenCV(onReady, onStatus) {
  function update(msg) {
    onStatus(msg);
    const el = document.getElementById('debug-overlay');
    if (el) el.textContent = msg;
  }
  update('Loading OpenCV.js…');
  const script = document.createElement('script');
  script.src = OPENCV_URL;
  script.async = true;
  script.onload = () => {
    update('Initializing…');
    cv['onRuntimeInitialized'] = () => {
      try {
        const dictId = cv.aruco_DICT_4X4_50 !== undefined ? cv.aruco_DICT_4X4_50 : 0;
        update(`1 dictId=${dictId}`);
        const dict = cv.getPredefinedDictionary(dictId);
        update('2 dict ok');
        const params = new cv.aruco_DetectorParameters();
        update('3 params ok');
        const refine = new cv.aruco_RefineParameters(10, 3, true);
        update('4 refine ok');
        detector = new cv.aruco_ArucoDetector(dict, params, refine);
        update('5 detector ok');
        onReady();
      } catch (e) {
        update(`FAIL: ${e.message}`);
      }
    };
  };
  script.onerror = () => update('Failed to load OpenCV.js');
  document.head.appendChild(script);
}

const PROCESS_WIDTH = 640;

// Returns [{id, corners: [[x,y], ...]}] — corners in native video pixel space
function detectMarkers(video, processingCanvas) {
  if (!detector || !video.videoWidth) return [];

  const scale = PROCESS_WIDTH / video.videoWidth;
  processingCanvas.width = PROCESS_WIDTH;
  processingCanvas.height = Math.round(video.videoHeight * scale);
  processingCanvas.getContext('2d').drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);

  const src = cv.imread(processingCanvas);
  const blurred = new cv.Mat();
  cv.GaussianBlur(src, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
  const corners = new cv.MatVector();
  const ids = new cv.Mat();

  try {
    detector.detectMarkers(blurred, corners, ids);
    const results = [];
    for (let i = 0; i < ids.rows; i++) {
      const corner = corners.get(i);
      const pts = [];
      for (let j = 0; j < 4; j++) {
        pts.push([corner.data32F[j * 2] / scale, corner.data32F[j * 2 + 1] / scale]);
      }
      results.push({ id: ids.data32S[i], corners: pts });
      corner.delete();
    }
    return results;
  } finally {
    src.delete();
    blurred.delete();
    corners.delete();
    ids.delete();
  }
}

function drawDetections(overlayCanvas, detections, videoWidth, videoHeight) {
  overlayCanvas.width = videoWidth;
  overlayCanvas.height = videoHeight;
  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, videoWidth, videoHeight);

  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#00ff00';
  ctx.font = `${Math.round(videoHeight * 0.04)}px monospace`;

  for (const { id, corners } of detections) {
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.fillText(`ID ${id}`, corners[0][0] + 8, corners[0][1] - 8);
  }
}

// Marker canvas: 150px image + 20px CSS padding on each side.
// IDs and positions on PC screen (origin top-left, y down):
//   0=TL, 1=TR, 2=BL, 3=BR, 4=TM, 5=BM
const MARKER_PX = 150;
const MARKER_PADDING = 20;

function _markerImageOrigin(id, screenW, screenH) {
  const p = MARKER_PADDING, m = MARKER_PX;
  switch (id) {
    case 0: return [p, p];
    case 1: return [screenW - p - m, p];
    case 2: return [p, screenH - p - m];
    case 3: return [screenW - p - m, screenH - p - m];
    case 4: return [screenW / 2 - m / 2, p];
    case 5: return [screenW / 2 - m / 2, screenH - p - m];
    default: return null;
  }
}

// Returns 4 corners [[x,y],...] in screen px (tl,tr,br,bl order)
function getMarkerScreenCorners(id, screenW, screenH) {
  const origin = _markerImageOrigin(id, screenW, screenH);
  if (!origin) return null;
  const [x, y] = origin, m = MARKER_PX;
  return [[x, y], [x + m, y], [x + m, y + m], [x, y + m]];
}

// Convert screen px → 3D screen space (origin center, Y up, units = MARKER_PX)
function _pxTo3D(px, py, screenW, screenH) {
  return [(px - screenW / 2) / MARKER_PX, -(py - screenH / 2) / MARKER_PX, 0];
}

// markers: [{id, corners: [[x,y],...]}] with corners in video px
// screenW/H: PC viewport dimensions (sent via PeerJS config message)
// Returns {x, y, z} in marker units, origin at screen center, Z toward viewer
// or null if not enough data
function estimateHeadPosition(markers, videoWidth, videoHeight, screenW, screenH) {
  const objFlat = [], imgFlat = [];

  for (const { id, corners } of markers) {
    const sc = getMarkerScreenCorners(id, screenW, screenH);
    if (!sc) continue;
    for (let i = 0; i < 4; i++) {
      objFlat.push(..._pxTo3D(sc[i][0], sc[i][1], screenW, screenH));
      imgFlat.push(...corners[i]);
    }
  }

  if (objFlat.length < 12) return null; // need at least 1 full marker (4 pts)

  const focalLength = Math.max(videoWidth, videoHeight);
  const objectPoints = cv.matFromArray(objFlat.length / 3, 1, cv.CV_32FC3, objFlat);
  const imagePoints  = cv.matFromArray(imgFlat.length / 2, 1, cv.CV_32FC2, imgFlat);
  const cameraMatrix = cv.matFromArray(3, 3, cv.CV_64F, [
    focalLength, 0, videoWidth / 2,
    0, focalLength, videoHeight / 2,
    0, 0, 1,
  ]);
  const distCoeffs = cv.Mat.zeros(4, 1, cv.CV_64F);
  const rvec = new cv.Mat(), tvec = new cv.Mat();

  try {
    cv.solvePnP(objectPoints, imagePoints, cameraMatrix, distCoeffs, rvec, tvec, false, cv.SOLVEPNP_ITERATIVE);
    // Camera origin in screen space: -R^T * tvec
    const rmat = new cv.Mat();
    cv.Rodrigues(rvec, rmat);
    const r = rmat.data64F, tx = tvec.data64F[0], ty = tvec.data64F[1], tz = tvec.data64F[2];
    const x = -(r[0] * tx + r[3] * ty + r[6] * tz);
    const y = -(r[1] * tx + r[4] * ty + r[7] * tz);
    const z = -(r[2] * tx + r[5] * ty + r[8] * tz);
    rmat.delete();
    return { x, y, z };
  } catch (e) {
    return null;
  } finally {
    objectPoints.delete(); imagePoints.delete();
    cameraMatrix.delete(); distCoeffs.delete();
    rvec.delete(); tvec.delete();
  }
}

// DICT_4X4_50 marker ID 0 (verified by cv.generateImageMarker)
function drawArucoMarker(canvas, size) {
  const grid = [
    [0, 0, 0, 0, 0, 0],
    [0, 1, 0, 1, 1, 0],
    [0, 0, 1, 0, 1, 0],
    [0, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ];
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cell = size / 6;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      ctx.fillStyle = grid[r][c] ? '#fff' : '#000';
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }
}
