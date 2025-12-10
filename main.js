// MODIFIED: Wired simple color picker (SV + Hue) and picker mode toggle
window.addEventListener('DOMContentLoaded', function() {
  displayCanvas = document.getElementById('drawCanvas');
  displayCtx = displayCanvas.getContext('2d');

  colorWheelCanvas = document.getElementById('colorWheel');
  colorWheelCtx = colorWheelCanvas.getContext('2d');
  valueRange = document.getElementById('valueRange');
  simpleSVCanvas = document.getElementById('simpleColorSV');
  simpleSVCtx = simpleSVCanvas ? simpleSVCanvas.getContext('2d') : null;
  simpleHueRange = document.getElementById('simpleHueRange');

  brushSizeInput = document.getElementById('brushSize');
  hardnessRange = document.getElementById('hardnessRange');
  spacingRange = document.getElementById('spacingRange');
  opacityRange = document.getElementById('opacityRange');
  flowRange = document.getElementById('flowRange');
  brushSizeValueLabel = document.getElementById('brushSizeValue');
  hardnessValueLabel = document.getElementById('hardnessValue');
  spacingValueLabel = document.getElementById('spacingValue');
  opacityValueLabel = document.getElementById('opacityValue');
  flowValueLabel = document.getElementById('flowValue');
  lazyStrengthValueLabel = document.getElementById('lazyStrengthValue');
  brushTypeSelect = document.getElementById('brushType');
  if (typeof initBrushLibrary === 'function') { initBrushLibrary(); }
  colorPicker = document.getElementById('colorPicker');
  secondaryColorPicker = document.getElementById('secondaryColor');
  swapColorsBtn = document.getElementById('swapColorsBtn');
  eraserBtn = document.getElementById('eraserBtn');
  
  onionSkinChk = document.getElementById('onionSkinChk');
  onionRangeInput = document.getElementById('onionRange');
    // === Onion skin UI ===
  if (onionSkinChk) {
    onionSkinChk.addEventListener('change', function () {
      redrawDisplay();
    });
  }
  if (onionRangeInput) {
    onionRangeInput.addEventListener('input', function () {
      redrawDisplay();
    });
  }
    // Keep HSV in sync when user tweaks the primary color directly
  if (colorPicker) {
    colorPicker.addEventListener('input', function () {
      if (typeof rgbToHsv === 'function') {
        var rgb = hexToRgb(colorPicker.value);
        var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        currentHue = hsv.h;
        currentSat = hsv.s;
        currentVal = hsv.v;
        if (valueRange) valueRange.value = currentVal.toFixed(2);
        if (typeof refreshColorPickers === 'function') {
          refreshColorPickers();
        } else if (typeof renderColorWheel === 'function') {
          renderColorWheel();
        }
      }
    });
  }

  // Swap button ⇄
  if (swapColorsBtn) {
    swapColorsBtn.addEventListener('click', function () {
      if (typeof swapPrimarySecondaryColors === 'function') {
        swapPrimarySecondaryColors();
      }
    });
  }
  
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
  simulatePressureChk = document.getElementById('simulatePressureChk'); // NEW
// NEW: end-fade slider for simulated pressure
simPressureEndRange = document.getElementById('simPressureEndRange');
simPressureEndValueLabel = document.getElementById('simPressureEndValue');

if (simPressureEndRange && simPressureEndValueLabel) {
  simulatePressureEnd = parseFloat(simPressureEndRange.value) || 0.0;
  simPressureEndValueLabel.textContent = simulatePressureEnd.toFixed(2);

  simPressureEndRange.addEventListener('input', function() {
    simulatePressureEnd = parseFloat(simPressureEndRange.value) || 0.0;
    simPressureEndValueLabel.textContent = simulatePressureEnd.toFixed(2);
  });
}
// Checkerboard background toggle – two canvas states: white vs checkerboard
const drawCanvasEl = document.getElementById("drawCanvas");
const toggleGridBtn = document.getElementById("toggleGridBtn");

let showCheckerboard = false;

toggleGridBtn.addEventListener("click", () => {
  showCheckerboard = !showCheckerboard;

  // Toggle classes on the canvas itself
  if (showCheckerboard) {
    drawCanvasEl.classList.remove("default-bg");
    drawCanvasEl.classList.add("checkerboard-bg");
  } else {
    drawCanvasEl.classList.remove("checkerboard-bg");
    drawCanvasEl.classList.add("default-bg");
  }

  // Button visual state
  toggleGridBtn.classList.toggle("active", showCheckerboard);
});


  fitBtn = document.getElementById('fitBtn');
  fitBottomBtn = document.getElementById('fitBottomBtn');
  inputModeBtn = document.getElementById('inputModeBtn');
  toolGrid = document.getElementById('toolGrid');
  historyStrip = document.getElementById('historyStrip');
  moveLayerLeftBtn = document.getElementById('moveLayerLeftBtn');
  moveLayerRightBtn = document.getElementById('moveLayerRightBtn');

  wheelRadius = colorWheelCanvas.width / 2;
  wheelCenterX = wheelRadius;
  wheelCenterY = wheelRadius;

  brushType = brushTypeSelect.value;
  spacingFactor = parseFloat(spacingRange.value) || 0.35;
  brushOpacity = parseFloat(opacityRange.value) || 1;
  brushFlow = parseFloat(flowRange.value) || 1;
  if (brushSizeValueLabel) brushSizeValueLabel.textContent = (parseFloat(brushSizeInput.value) || 0).toFixed(1);
  if (hardnessValueLabel) hardnessValueLabel.textContent = (parseFloat(hardnessRange.value) || 0).toFixed(2);
  if (spacingValueLabel) spacingValueLabel.textContent = spacingFactor.toFixed(2);
  if (opacityValueLabel) opacityValueLabel.textContent = brushOpacity.toFixed(2);
  if (flowValueLabel) flowValueLabel.textContent = brushFlow.toFixed(2);
  if (lazyStrengthValueLabel) lazyStrengthValueLabel.textContent = (parseFloat(lazyStrengthRange.value) || 0).toFixed(2);
  toolMode = 'brush';
  lazyEnabled = false;
  lazyStrength = parseFloat(lazyStrengthRange.value) || 0.5;
  defaultHold = parseInt(defaultHoldInput.value, 10) || 1;
  usePressureOpacity = false;
  usePressureFlow = false;
    simulatePressure = false; // NEW default
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
    if (typeof refreshColorPickers === 'function') {
      refreshColorPickers();
    } else if (typeof renderColorWheel === 'function') {
      renderColorWheel();
    }
  });

  // Simple (SV square + hue) picker
  if (typeof simpleSVCanvas !== 'undefined' && simpleSVCanvas) {
    simpleSVCanvas.addEventListener('pointerdown', function(e) {
      if (typeof pickColorFromSimple === 'function') pickColorFromSimple(e);
    });
    simpleSVCanvas.addEventListener('pointermove', function(e) {
      if (e.buttons && typeof pickColorFromSimple === 'function') pickColorFromSimple(e);
    });
  }
  if (typeof simpleHueRange !== 'undefined' && simpleHueRange) {
    simpleHueRange.addEventListener('input', function() {
      currentHue = parseFloat(simpleHueRange.value) || 0;
      updateBrushColorFromHSV();
      if (typeof refreshColorPickers === 'function') {
        refreshColorPickers();
      }
    });
  }

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
  
  brushSizeInput.addEventListener('input', function() {
    if (brushSizeValueLabel) brushSizeValueLabel.textContent = (parseFloat(brushSizeInput.value) || 0).toFixed(1);
  });
  hardnessRange.addEventListener('input', function() {
    if (hardnessValueLabel) hardnessValueLabel.textContent = (parseFloat(hardnessRange.value) || 0).toFixed(2);
  });
  spacingRange.addEventListener('input', function() {
    spacingFactor = parseFloat(spacingRange.value) || 0.35;
    if (spacingValueLabel) spacingValueLabel.textContent = spacingFactor.toFixed(2);
  });
  opacityRange.addEventListener('input', function() {
    brushOpacity = parseFloat(opacityRange.value) || 1;
    if (opacityValueLabel) opacityValueLabel.textContent = brushOpacity.toFixed(2);
  });
  flowRange.addEventListener('input', function() {
    brushFlow = parseFloat(flowRange.value) || 1;
    if (flowValueLabel) flowValueLabel.textContent = brushFlow.toFixed(2);
  });
  lazyMouseChk.addEventListener('change', function() {
    lazyEnabled = lazyMouseChk.checked;
  });
  lazyStrengthRange.addEventListener('input', function() {
    lazyStrength = parseFloat(lazyStrengthRange.value) || 0;
    if (lazyStrengthValueLabel) lazyStrengthValueLabel.textContent = lazyStrength.toFixed(2);
  });
  pressureOpacityChk.addEventListener('change', function() {
    usePressureOpacity = pressureOpacityChk.checked;
  });
  pressureFlowChk.addEventListener('change', function() {
    usePressureFlow = pressureFlowChk.checked;
  });
    // NEW: simulate pressure checkbox
simulatePressureChk.addEventListener('change', function() {
  simulatePressure = simulatePressureChk.checked;

  // Show / hide the end-fade slider
  var block = document.getElementById('simPressureEndBlock');
  if (block) {
    block.style.display = simulatePressure ? 'flex' : 'none';
  }
});


//clear button
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

  if (moveLayerLeftBtn) {
    moveLayerLeftBtn.addEventListener('click', function() {
      if (typeof moveSelectedLayer === 'function') moveSelectedLayer(-1);
    });
  }
  if (moveLayerRightBtn) {
    moveLayerRightBtn.addEventListener('click', function() {
      if (typeof moveSelectedLayer === 'function') moveSelectedLayer(1);
    });
  }

// Initialize HSV from color picker instead of forcing white
//var rgb = hexToRgb(colorPicker.value);
//var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
currentHue = 0;
currentSat = 0;
currentVal = 0;
updateBrushColorFromHSV();
if (typeof refreshColorPickers === 'function') {
  refreshColorPickers();
} else if (typeof renderColorWheel === 'function') {
  renderColorWheel();
}

  docWidthInput.value = displayCanvas.width;
  docHeightInput.value = displayCanvas.height;

  initXsheet(16, 1);
});

function setToolMode(mode) {
  // Only auto-commit when we are *leaving* transform mode,
  // not when entering it.
  if (toolMode === 'transform' && mode !== 'transform') {
    commitActiveSelection();
  }

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

  var scale = Math.min(w / displayCanvas.width, h / displayCanvas.height);
  scale = Math.max(0.1, Math.min(8, scale));

  zoomLevel = scale;
  var canvasPixelW = displayCanvas.width * zoomLevel;
  var canvasPixelH = displayCanvas.height * zoomLevel;
  panX = (w - canvasPixelW) / 2;
  panY = (h - canvasPixelH) / 2;
  updateCanvasTransform();
}

// GLOBAL keyboard shortcuts – only added once
document.addEventListener('keydown', function(e) {
  const key = e.key || e.keyCode;
  const ctrl = e.ctrlKey || e.metaKey;

document.addEventListener('keydown', function(e) {
  var key = e.key || e.keyCode;

  // Only plain X (no Ctrl/Meta) → swap colors
  if (key === 'x' || key === 'X' || key === 88) {
    if (e.ctrlKey || e.metaKey) return; // let the other handler handle Ctrl+X (Cut)

    // Don't hijack typing in inputs/textareas
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }

    e.preventDefault();
    if (typeof swapPrimarySecondaryColors === 'function') {
      swapPrimarySecondaryColors();
    }
  }
});

  
  if (!ctrl) return;

  // Undo / Redo
  if (key === 'z' || key === 'Z' || key === 90) {
    e.preventDefault();
    if (!e.shiftKey) {
      if (typeof undoHistory === 'function') undoHistory();
    } else {
      if (typeof redoHistory === 'function') redoHistory();
    }
  } else if (key === 'y' || key === 'Y' || key === 89) {
    e.preventDefault();
    if (typeof redoHistory === 'function') redoHistory();
  }
  // Copy
  else if (key === 'c' || key === 'C' || key === 67) {
    e.preventDefault();
    if (typeof copySelectionOrCell === 'function') copySelectionOrCell();
  }
  // Cut
  else if (key === 'x' || key === 'X' || key === 88) {
    e.preventDefault();
    if (typeof cutSelectionOrCell === 'function') cutSelectionOrCell();
  }
  // Paste
  else if (key === 'v' || key === 'V' || key === 86) {
    e.preventDefault();
    if (typeof pasteSelectionOrCell === 'function') pasteSelectionOrCell();
  }
});
