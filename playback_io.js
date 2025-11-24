// playback_io.js
function updatePlayButton() {
  playBtn.textContent = isPlaying ? '■ Stop' : '▶ Play';
}

function startPlayback() {
  if (isPlaying) return;
  commitActiveSelection();
  isPlaying = true;
  updatePlayButton();
  var fps = parseInt(fpsRange.value, 10) || 8;
  var interval = 1000 / fps;
  var last = performance.now();
  var acc = 0;
  function loop(now) {
    if (!isPlaying) return;
    var d = now - last;
    last = now;
    acc += d;
    while (acc >= interval) {
      acc -= interval;
      var n = (selectedRow + 1) % xsheet.length;
      goToRow(n);
    }
    playHandle = requestAnimationFrame(loop);
  }
  playHandle = requestAnimationFrame(loop);
}

function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  updatePlayButton();
  if (playHandle !== null) {
    cancelAnimationFrame(playHandle);
    playHandle = null;
  }
}

function applyDocumentSize() {
  commitActiveSelection();
  var newW = parseInt(docWidthInput.value, 10) || displayCanvas.width;
  var newH = parseInt(docHeightInput.value, 10) || displayCanvas.height;
  newW = Math.max(16, Math.min(4096, newW));
  newH = Math.max(16, Math.min(4096, newH));
  docWidthInput.value = newW;
  docHeightInput.value = newH;
  if (newW === displayCanvas.width && newH === displayCanvas.height) return;

  var oldW = displayCanvas.width, oldH = displayCanvas.height;
  displayCanvas.width = newW;
  displayCanvas.height = newH;

  for (var r = 0; r < xsheet.length; r++) {
    for (var c = 0; c < layerCount; c++) {
      var cell = xsheet[r][c];
      if (cell.drawing) {
        var old = cell.drawing;
        var nc = document.createElement('canvas');
        nc.width = newW;
        nc.height = newH;
        var nctx = nc.getContext('2d');
        nctx.drawImage(old, 0, 0, oldW, oldH, 0, 0, newW, newH);
        cell.drawing = nc;
      }
    }
  }

  activeSelection = null;
  redrawDisplay();
}

function saveProject() {
  commitActiveSelection();
  var project = {
    docWidth: displayCanvas.width,
    docHeight: displayCanvas.height,
    fps: parseInt(fpsRange.value, 10) || 8,
    defaultHold: defaultHold,
    rows: xsheet.length,
    layers: layerCount,
    frames: {},
    cells: []
  };

  for (var layer = 0; layer < layerCount; layer++) {
    var map = new Map();
    var id = 0;
    for (var r = 0; r < xsheet.length; r++) {
      var cell = xsheet[r][layer];
      if (!cell.drawing) continue;
      var canvas = cell.drawing;
      var frameId = map.get(canvas);
      if (!frameId) {
        frameId = 'L' + layer + 'F' + (id++);
        map.set(canvas, frameId);
        project.frames[frameId] = canvas.toDataURL('image/png');
      }
      project.cells.push({ row: r, layer: layer, frameId: frameId });
    }
  }

  var json = JSON.stringify(project);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'animation_project.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadProjectFromJSON(json) {
  var project;
  try {
    project = JSON.parse(json);
  } catch (e) {
    alert('Invalid project file.');
    return;
  }
  if (!project || !project.rows || !project.layers || !project.frames) {
    alert('Invalid project structure.');
    return;
  }

  displayCanvas.width = project.docWidth || 512;
  displayCanvas.height = project.docHeight || 512;
  docWidthInput.value = displayCanvas.width;
  docHeightInput.value = displayCanvas.height;
  fpsRange.value = project.fps || 8;
  defaultHold = project.defaultHold || 1;
  defaultHoldInput.value = defaultHold;

  initXsheet(project.rows, project.layers);

  var frameCanvases = {};
  for (var id in project.frames) {
    if (!project.frames.hasOwnProperty(id)) continue;
    var dataUrl = project.frames[id];
    var c = document.createElement('canvas');
    c.width = displayCanvas.width;
    c.height = displayCanvas.height;
    frameCanvases[id] = c;
    (function(canvas, url) {
      var img = new Image();
      img.onload = function() {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        redrawDisplay();
        refreshXsheetUI();
      };
      img.src = url;
    })(c, dataUrl);
  }

  project.cells.forEach(function(cd) {
    var r = cd.row, l = cd.layer, fid = cd.frameId;
    if (r < 0 || r >= xsheet.length) return;
    if (l < 0 || l >= layerCount) return;
    var canvas = frameCanvases[fid];
    if (canvas) xsheet[r][l].drawing = canvas;
  });

  selectedRow = 0;
  selectedLayer = 0;
  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}
