const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js';
let detector = null;

function loadOpenCV(onReady, onStatus) {
  onStatus('Loading OpenCV.js…');
  const script = document.createElement('script');
  script.src = OPENCV_URL;
  script.async = true;
  script.onload = () => {
    onStatus('Initializing…');
    cv['onRuntimeInitialized'] = () => {
      try {
        const dictId = cv.aruco_DICT_4X4_50 !== undefined ? cv.aruco_DICT_4X4_50 : 0;
        const dict = cv.getPredefinedDictionary(dictId);

        // Tuned for screen display: lower adaptive threshold, looser corner accuracy
        const params = new cv.aruco_DetectorParameters();
        params.adaptiveThreshConstant = 3;
        params.minMarkerPerimeterRate = 0.02;
        params.polygonalApproxAccuracyRate = 0.08;
        params.cornerRefinementMethod = 1; // CORNER_REFINE_SUBPIX

        const refine = new cv.aruco_RefineParameters(10, 3, true);
        detector = new cv.aruco_ArucoDetector(dict, params, refine);
        onReady();
      } catch (e) {
        onStatus(`ArUco init error: ${e.message}`);
      }
    };
  };
  script.onerror = () => onStatus('Failed to load OpenCV.js');
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
  const corners = new cv.MatVector();
  const ids = new cv.Mat();

  try {
    detector.detectMarkers(src, corners, ids);
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

// DICT_4X4_50 marker ID 37 (verified by detector)
function drawArucoMarker(canvas, size) {
  const grid = [
    [0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 1, 0],
    [0, 0, 1, 1, 0, 0],
    [0, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0],
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
