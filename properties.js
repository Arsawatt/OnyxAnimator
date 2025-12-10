var displayCanvas = null, displayCtx = null;
var colorWheelCanvas = null, colorWheelCtx = null;

var brushSizeInput, hardnessRange, spacingRange, opacityRange, flowRange;
var brushSizeValueLabel, hardnessValueLabel, spacingValueLabel, opacityValueLabel, flowValueLabel, lazyStrengthValueLabel;
var brushTypeSelect, colorPicker, secondaryColorPicker, eraserBtn, swapColorsBtn;
var onionSkinChk, onionRangeInput, clearCellBtn;
var lazyMouseChk, lazyStrengthRange;
var fpsRange, fpsLabel, playBtn;
var prevRowBtn, nextRowBtn, rowInfo;
var addLayerBtn, removeLayerBtn, addRowBtn, removeRowBtn;
var increaseHoldBtn, decreaseHoldBtn, defaultHoldInput;
var exportCurrentBtn, exportAllBtn, layerInfo, xsheetTable;
var docWidthInput, docHeightInput, applyDocSizeBtn;
var saveProjectBtn, loadProjectBtn, loadProjectInput;
var valueRange, pressureOpacityChk, pressureFlowChk;
var fitBtn, fitBottomBtn, inputModeBtn;
var toolGrid;
var moveLayerLeftBtn, moveLayerRightBtn;

var wheelRadius = 0, wheelCenterX = 0, wheelCenterY = 0;
var currentHue = 0, currentSat = 0, currentVal = 0;

var xsheet = [], layerCount = 0, selectedRow = 0, selectedLayer = 0;
var layerOpacity = [];
var layerBlendMode = [];
var historyStack = [], historyIndex = -1, MAX_HISTORY = 128;
var historyStrip = null;

var isDrawing = false, lastX = 0, lastY = 0;
var strokeRow = -1, strokeLayer = -1, strokePrevImage = null;
var lastPressure = 1, isEraser = false, brushType = 'soft';
var spacingFactor = 0.35, brushOpacity = 1, brushFlow = 1;
var usePressureOpacity = false, usePressureFlow = false;
var toolMode = 'brush';

var lazyEnabled = false, lazyStrength = 0.5;
var lazyX = 0, lazyY = 0, hasLazyPos = false;

var PRESSURE_THRESHOLD = 0.05;
var hasStrokeStarted = false;

// Simulated pressure for non-pen input
var simulatePressure = false;       // controlled from UI
var totalStrokeDistance = 0;        // distance travelled in current stroke (for fake pressure ramp)

// End-of-stroke fade control (0..1, from slider)
var simulatePressureEnd = 0.0;      // 0 = shrink immediately, 1 = longer body before shrink
var simPressureEndRange = null;
var simPressureEndValueLabel = null;

// NEW: mark when the simulated pressure stroke has fully faded-out
var simPressureStrokeDone = false;

var defaultHold = 1;

var isLassoDrawing = false, lassoPoints = [];
var activeSelection = null;
var isTransformDragging = false, transformDragMode = null;
var dragStartPointer = { x: 0, y: 0 };
var dragInitial = null;

var isPlaying = false, playHandle = null;

var zoomLevel = 1, panX = 0, panY = 0;
var isPanning = false, lastPanClientX = 0, lastPanClientY = 0;

var activePointerId = null;

// X-sheet multi-cell selection
var selectionStartRow = null, selectionStartLayer = null;
var selectionEndRow = null, selectionEndLayer = null;

// inputMode: 'tablet' (prefer pen, ignore mouse once pen used) or 'mouse' (allow mouse drawing)
var inputMode = 'tablet';
var preferPen = false;

function hsvToRgb(h, s, v) {
  var r, g, b;
  var i = Math.floor(h * 6);
  var f = h * 6 - i;
  var p = v * (1 - s);
  var q = v * (1 - f * s);
  var t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function rgbToHex(r, g, b) {
  function h(x) { return x.toString(16).padStart(2, '0'); }
  return '#' + h(r) + h(g) + h(b);
}
function hexToRgb(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, v = max;
  var d = max - min;

  s = max === 0 ? 0 : d / max;

  if (d === 0) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h, s: s, v: v };
}

function swapPrimarySecondaryColors() {
  if (!colorPicker || !secondaryColorPicker) return;

  // Swap the hex values
  var tmp = colorPicker.value;
  colorPicker.value = secondaryColorPicker.value;
  secondaryColorPicker.value = tmp;

  // Update HSV / value slider / wheel from the *new* primary color
  var rgb = hexToRgb(colorPicker.value);
  var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  currentHue = hsv.h;
  currentSat = hsv.s;
  currentVal = hsv.v;

  if (valueRange) {
    valueRange.value = currentVal.toFixed(2);
  }

  if (typeof renderColorWheel === 'function') {
    renderColorWheel();
  }
}

function getPointerPos(evt) {
  var rect = displayCanvas.getBoundingClientRect();
  var cx = evt.clientX !== undefined ? evt.clientX : (evt.touches && evt.touches[0].clientX);
  var cy = evt.clientY !== undefined ? evt.clientY : (evt.touches && evt.touches[0].clientY);
  return {
    x: (cx - rect.left) * (displayCanvas.width / rect.width),
    y: (cy - rect.top) * (displayCanvas.height / rect.height)
  };
}

function createDrawingCanvas() {
  var c = document.createElement('canvas');
  c.width = displayCanvas.width;
  c.height = displayCanvas.height;
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
  return c;
}

function updateCanvasTransform() {
  if (!displayCanvas) return;
  displayCanvas.style.transformOrigin = '0 0';
  displayCanvas.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoomLevel + ')';
}

function zoomAt(imageX, imageY, factor) {
  var old = zoomLevel;
  var newZ = old * factor;
  if (newZ < 0.25) newZ = 0.25;
  if (newZ > 8) newZ = 8;

  panX += imageX * (old - newZ);
  panY += imageY * (old - newZ);
  zoomLevel = newZ;
  updateCanvasTransform();
}

// Prefer pen input: ignore mouse events once a pen stroke has been seen (unless in mouse mode)
function shouldIgnorePointer(evt) {
  if (toolMode !== 'brush') return false;

  if (inputMode === 'mouse') {
    // Mouse mode: do not prefer pen, allow everything
    return false;
  }

  var type = evt.pointerType || 'mouse';

  if (type === 'pen') {
    preferPen = true;
    return false;
  }

  // If we've seen pen input, ignore non-pen events (e.g., ghost mouse events)
  if (preferPen && type !== 'pen') {
    return true;
  }

  return false;
}
