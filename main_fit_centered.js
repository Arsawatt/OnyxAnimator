// main.js
window.addEventListener('DOMContentLoaded', function() {
  displayCanvas = document.getElementById('drawCanvas');
  displayCtx = displayCanvas.getContext('2d');

  colorWheelCanvas = document.getElementById('colorWheel');
  colorWheelCtx = colorWheelCanvas.getContext('2d');
  valueRange = document.getElementById('valueRange');

  brushSizeInput = document.getElementById('brushSize');
  hardnessRange = document.getElementById('hardnessRange');
  spacingRange = document.getElementById('spacingRange');
  opacityRange = document.getElementById('opacityRange');
  flowRange = document.getElementById('flowRange');
  brushTypeSelect = document.getElementById('brushType');
  colorPicker = document.getElementById('colorPicker');
  eraserBtn = document.getElementById('eraserBtn');
  onionSkinChk = document.getElementById('onionSkinChk');
  onionRangeInput = document.getElementById('onionRange');
  clearCellBtn = document.getElementById('clearCellBtn');
  lazyMouseChk = document.getElementById('lazyMouseChk');
  lazyStrengthRange = document.getElementById('lazyStrengthRange');
  fpsRange = document.getElementById('fpsRange');
  fpsLabel = document.getElementById('fpsLabel');
  playBtn = document.getElementById('playBtn');
  prevRowBtn = document.getElementById('prevRowBtn');
  nextRowBtn = document.getElementById('nextRowBtn');
  rowInfo = document.getElementById('rowInfo');
  addLayerBtn = document.getElementById('addLayerBtn');
  removeLayerBtn = document.getElementById('removeLayerBtn');
  addRowBtn = document.getElementById('addRowBtn');
  removeRowBtn = document.getElementById('removeRowBtn');
  increaseHoldBtn = document.getElementById('increaseHoldBtn');
  decreaseHoldBtn = document.getElementById('decreaseHoldBtn');
  defaultHoldInput = document.getElementById('defaultHoldInput');
  exportCurrentBtn = document.getElementById('exportCurrentBtn');
  exportAllBtn = document.getElementById('exportAllBtn');
  layerInfo = document.getElementById('layerInfo');
  xsheetTable = document.getElementById('xsheetTable');
  docWidthInput = document.getElementById('docWidth');
  docHeightInput = document.getElementById('docHeight');
  applyDocSizeBtn = document.getElementById('applyDocSizeBtn');
  saveProjectBtn = document.getElementById('saveProjectBtn');
  loadProjectBtn = document.getElementById('loadProjectBtn');
  loadProjectInput = document.getElementById('loadProjectInput');
  pressureOpacityChk = document.getElementById('pressureOpacityChk');
  pressureFlowChk = document.getElementById('pressureFlowChk');
  fitBtn = document.getElementById('fitBtn');
  fitBottomBtn = document.getElementById('fitBottomBtn');
  inputModeBtn = document.getElementById('inputModeBtn');
  toolGrid = document.getElementById('toolGrid');

  wheelRadius = colorWheelCanvas.width / 2;
  wheelCenterX = wheelRadius;
  wheelCenterY = wheelRadius;

  brushType = brushTypeSelect.value;
  spacingFactor = parseFloat(spacingRange.value) || 0.35;
  brushOpacity = parseFloat(opacityRange.value) || 1;
  brushFlow = parseFloat(flowRange.value) || 1;
  toolMode = 'brush';
  lazyEnabled = false;
  lazyStrength = parseFloat(lazyStrengthRange.value) || 0.5;
  defaultHold = parseInt(defaultHoldInput.value, 10) || 1;
  usePressureOpacity = false;
  usePressureFlow = false;
  zoomLevel = 1;
  panX = 0;
  panY = 0;
  updateCanvasTransform();

  displayCanvas.addEventListener('pointerdown', onPointerDown);
  displayCanvas.addEventListener('pointermove', onPointerMove);
  displayCanvas.addEventListener('pointerup', onPointerUp);
  displayCanvas.addEventListener('pointerleave', onPointerUp);

  colorWheelCanvas.addEventListener('pointerdown', function(e) {
    pickColorFromWheel(e);
  });
  colorWheelCanvas.addEventListener('pointermove', function(e) {
    if (e.buttons) pickColorFromWheel(e);
  });
  valueRange.addEventListener('input', function() {
    currentVal = parseFloat(valueRange.value) || 1;
    updateBrushColorFromHSV();
    renderColorWheel();
  });

  eraserBtn.addEventListener('click', function() {
    isEraser = !isEraser;
    eraserBtn.textContent = 'Eraser: ' + (isEraser ? 'On' : 'Off');
    if (isEraser) {
      eraserBtn.classList.add('primary');
      if (toolMode !== 'brush') setToolMode('brush');
    } else {
      eraserBtn.classList.remove('primary');
    }
  });

  brushTypeSelect.addEventListener('change', function() {
    brushType = brushTypeSelect.value;
  });
  spacingRange.addEventListener('input', function() {
    spacingFactor = parseFloat(spacingRange.value) || 0.35;
  });
  opacityRange.addEventListener('input', function() {
    brushOpacity = parseFloat(opacityRange.value) || 1;
  });
  flowRange.addEventListener('input', function() {
    brushFlow = parseFloat(flowRange.value) || 1;
  });
  lazyMouseChk.addEventListener('change', function() {
    lazyEnabled = lazyMouseChk.checked;
  });
  lazyStrengthRange.addEventListener('input', function() {
    lazyStrength = parseFloat(lazyStrengthRange.value) || 0;
  });
  pressureOpacityChk.addEventListener('change', function() {
    usePressureOpacity = pressureOpacityChk.checked;
  });
  pressureFlowChk.addEventListener('change', function() {
    usePressureFlow = pressureFlowChk.checked;
  });

  clearCellBtn.addEventListener('click', clearSelectedCell);

  fpsRange.addEventListener('input', updateInfos);
  playBtn.addEventListener('click', function() {
    if (isPlaying) stopPlayback();
    else startPlayback();
  });

  addLayerBtn.addEventListener('click', addLayer);
  removeLayerBtn.addEventListener('click', removeLayer);
  addRowBtn.addEventListener('click', addRow);
  removeRowBtn.addEventListener('click', removeRow);
  increaseHoldBtn.addEventListener('click', increaseHoldForSelection);
  decreaseHoldBtn.addEventListener('click', decreaseHoldForSelection);
  exportCurrentBtn.addEventListener('click', function() {
    exportRowToPNG(selectedRow);
  });
  exportAllBtn.addEventListener('click', function() {
    for (var i = 0; i < xsheet.length; i++) exportRowToPNG(i);
  });
  prevRowBtn.addEventListener('click', function() {
    var t = (selectedRow - 1 + xsheet.length) % xsheet.length;
    goToRow(t);
  });
  nextRowBtn.addEventListener('click', function() {
    var t = (selectedRow + 1) % xsheet.length;
    goToRow(t);
  });
  applyDocSizeBtn.addEventListener('click', applyDocumentSize);
  fitBtn.addEventListener('click', fitDocumentToWindow);
  fitBottomBtn.addEventListener('click', fitDocumentToWindow);

  saveProjectBtn.addEventListener('click', saveProject);
  loadProjectBtn.addEventListener('click', function() {
    loadProjectInput.click();
  });
  loadProjectInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      loadProjectFromJSON(ev.target.result);
    };
    reader.readAsText(file);
    loadProjectInput.value = '';
  });

  toolGrid.querySelectorAll('.tool-button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var mode = btn.getAttribute('data-tool');
      setToolMode(mode);
    });
  });

  inputModeBtn.addEventListener('click', function() {
    if (inputMode === 'tablet') {
      inputMode = 'mouse';
      preferPen = false;
      inputModeBtn.textContent = 'Input: Mouse';
    } else {
      inputMode = 'tablet';
      preferPen = false;
      inputModeBtn.textContent = 'Input: Tablet';
    }
  });

  currentHue = 0;
  currentSat = 0;
  currentVal = 1;
  updateBrushColorFromHSV();
  renderColorWheel();

  docWidthInput.value = displayCanvas.width;
  docHeightInput.value = displayCanvas.height;

  initXsheet(16, 1);
});

function setToolMode(mode) {
  commitActiveSelection();
  toolMode = mode;
  isLassoDrawing = false;
  isTransformDragging = false;
  isPanning = false;
  if (toolGrid) {
    toolGrid.querySelectorAll('.tool-button').forEach(function(btn) {
      var m = btn.getAttribute('data-tool');
      if (m === mode) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }
  redrawDisplay();
}


function fitDocumentToWindow() {
  var wrapper = document.getElementById('canvas-wrapper');
  var w = wrapper.clientWidth;
  var h = wrapper.clientHeight;
  if (!w || !h) return;

  // Best-fit uniform scale so the whole document fits inside the wrapper
  var scale = Math.min(w / displayCanvas.width, h / displayCanvas.height);
  scale = Math.max(0.1, Math.min(8, scale));

  zoomLevel = scale;

  // Let flexbox centering + transformOrigin center the canvas;
  // start with no extra pan offset.
  panX = 0;
  panY = 0;

  updateCanvasTransform();
}

