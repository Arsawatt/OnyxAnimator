
// Offscreen canvas used to tint and stamp texture brushes.
var textureBrushCanvas = document.createElement('canvas');
var textureBrushCtx = textureBrushCanvas.getContext('2d');

function stampBrush(ctx, x, y, size, color, hardness, erase, opacity, flow) {
  var r = size / 2;
  if (r <= 0) return;

  ctx.save();
  if (erase) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  var rgb = hexToRgb(color);
  var a = Math.max(0, Math.min(1, opacity * flow));

  // Try to use a texture brush (PNG alpha).
  var texBrush = null;
  if (typeof getCurrentBrush === 'function') {
    texBrush = getCurrentBrush();
  }

  var mask = null;
  if (texBrush && typeof BRUSH_MASKS !== 'undefined') {
    mask = BRUSH_MASKS[texBrush.id] || BRUSH_MASKS[texBrush.maskId || texBrush.id];
  }

  var useTexture = mask && mask.data && mask.width && mask.height;

  if (useTexture) {
    // Size as integer for cleaner sampling.
    var sizeInt = Math.max(1, Math.round(size));
    if (textureBrushCanvas.width !== sizeInt || textureBrushCanvas.height !== sizeInt) {
      textureBrushCanvas.width = sizeInt;
      textureBrushCanvas.height = sizeInt;
    }

    var tctx = textureBrushCtx;
    var w0 = mask.width;
    var h0 = mask.height;
    var srcData = mask.data;
    var imgData = tctx.createImageData(sizeInt, sizeInt);
    var dst = imgData.data;

    // Build tinted brush from alpha mask using bilinear interpolation.
    for (var iy = 0; iy < sizeInt; iy++) {
      var v = (sizeInt <= 1) ? 0 : iy / (sizeInt - 1);
      var my = v * (h0 - 1);
      var y0 = Math.floor(my);
      var y1 = Math.min(y0 + 1, h0 - 1);
      var ty = my - y0;

      for (var ix = 0; ix < sizeInt; ix++) {
        var u = (sizeInt <= 1) ? 0 : ix / (sizeInt - 1);
        var mx = u * (w0 - 1);
        var x0 = Math.floor(mx);
        var x1 = Math.min(x0 + 1, w0 - 1);
        var tx = mx - x0;

        var idx00 = y0 * w0 + x0;
        var idx10 = y0 * w0 + x1;
        var idx01 = y1 * w0 + x0;
        var idx11 = y1 * w0 + x1;

        var a00 = srcData[idx00];
        var a10 = srcData[idx10];
        var a01 = srcData[idx01];
        var a11 = srcData[idx11];

        var a0x = a00 * (1 - tx) + a10 * tx;
        var a1x = a01 * (1 - tx) + a11 * tx;
        var alphaMask = a0x * (1 - ty) + a1x * ty; // 0..255

        // Combine mask with brush opacity/flow.
        var outA = alphaMask * a; // a is 0..1
        var di = (iy * sizeInt + ix) * 4;
        dst[di    ] = rgb.r;
        dst[di + 1] = rgb.g;
        dst[di + 2] = rgb.b;
        dst[di + 3] = Math.max(0, Math.min(255, outA));
      }
    }

    tctx.putImageData(imgData, 0, 0);

    // Stamp onto destination.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.drawImage(textureBrushCanvas, x - sizeInt / 2, y - sizeInt / 2);
  } else {
    // Fallback to the original procedural brushes (soft/hard/pencil).
    var t = brushType;
    if (t === 'hard') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'pencil') {
      r *= 0.7;
      var jit = r * 0.3;
      x += (Math.random() * 2 - 1) * jit;
      y += (Math.random() * 2 - 1) * jit;
      var pa = 0.4 * a;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + pa + ')';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      var inner = Math.max(0, Math.min(1, hardness));
      g.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')');
      g.addColorStop(inner, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')');
      g.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

var accumulatedDistance = 0;
var lastStampX = null;
var lastStampY = null;

function stampLine(ctx, x0, y0, x1, y1, pressure) {
  var baseSize = parseFloat(brushSizeInput.value) || 1;
  baseSize = Math.max(0.1, baseSize);
  if (brushType === 'pencil') baseSize *= 0.6;
  var hardness = parseFloat(hardnessRange.value);
  var col = colorPicker.value;
  var erase = isEraser;

  // clamp incoming pressure
  var raw = (pressure != null ? pressure : 1);
  var p = Math.max(0, Math.min(1, raw));

  // size follows pressure as before
  var sizePressure = 0.25 + 0.75 * p;
  var size = baseSize * sizePressure;
  var localOpacity = brushOpacity * (usePressureOpacity ? p : 1);
  var localFlow = brushFlow * (usePressureFlow ? p : 1);

  var dx = x1 - x0;
  var dy = y1 - y0;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;

  // --- NEW: spacing reacts to simulated pressure ---
  var spacingScale = 1;
  if (simulatePressure && pressure != null) {
    // map from our 0.2..1.0 ramp (~mouse fake) back to 0..1
    var p01 = (p - 0.2) / 0.8;
    p01 = Math.max(0, Math.min(1, p01));
    // at the very start: ~35% of normal spacing (denser stamps)
    // at full pressure: 100% spacing
    spacingScale = 0.15 + 0.65 * p01;
  }

  var spacing = Math.max(0.1, baseSize * spacingFactor * spacingScale);

  // first stamp in stroke
  if (lastStampX === null) {
    stampBrush(ctx, x0, y0, size, col, hardness, erase, localOpacity, localFlow);
    lastStampX = x0;
    lastStampY = y0;
    accumulatedDistance = 0;
  }

  accumulatedDistance += dist;

  // place stamps at regular intervals along the segment
  while (accumulatedDistance >= spacing) {
    var ratio = (accumulatedDistance - spacing) / dist;
    var tx = x1 - dx * ratio;
    var ty = y1 - dy * ratio;

    stampBrush(ctx, tx, ty, size, col, hardness, erase, localOpacity, localFlow);

    lastStampX = tx;
    lastStampY = ty;
    accumulatedDistance -= spacing;
  }
}


// Reset these when starting a new stroke (in your mousedown/pointerdown handler)
function startNewStroke() {
  accumulatedDistance = 0;
  lastStampX = null;
  lastStampY = null;
}

// LASSO & TRANSFORM

function createSelectionFromLasso() {
  if (lassoPoints.length < 3) return;
  if (selectedRow < 0 || selectedLayer < 0) return;

  var row = selectedRow;
  var layer = selectedLayer;

  var cell = xsheet[row][layer];
  if (!cell || !cell.drawing) return;

  var srcCanvas = cell.drawing;
  var srcCtx = srcCanvas.getContext('2d');

  // --- history: snapshot BEFORE cut ---
  var beforeImg = captureCellImage(row, layer);

  // --- compute bounds of lasso ---
  var minX = Infinity, minY = Infinity;
  var maxX = -Infinity, maxY = -Infinity;

  lassoPoints.forEach(function (p) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  minX = Math.floor(minX);
  minY = Math.floor(minY);
  maxX = Math.ceil(maxX);
  maxY = Math.ceil(maxY);

  var w = maxX - minX;
  var h = maxY - minY;
  if (w <= 0 || h <= 0) return;

  // --- selection canvas ---
  var selCanvas = document.createElement('canvas');
  selCanvas.width = w;
  selCanvas.height = h;
  var selCtx = selCanvas.getContext('2d');

  // copy pixels from source
  selCtx.drawImage(srcCanvas, minX, minY, w, h, 0, 0, w, h);

  // --- mask selection using lasso ---
  selCtx.save();
  selCtx.globalCompositeOperation = 'destination-in';
  selCtx.beginPath();
  selCtx.moveTo(lassoPoints[0].x - minX, lassoPoints[0].y - minY);
  for (var i = 1; i < lassoPoints.length; i++) {
    var p = lassoPoints[i];
    selCtx.lineTo(p.x - minX, p.y - minY);
  }
  selCtx.closePath();
  selCtx.fill();
  selCtx.restore();

  // --- remove pixels from source (cut) ---
  srcCtx.save();
  srcCtx.globalCompositeOperation = 'destination-out';
  srcCtx.beginPath();
  srcCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
  for (var j = 1; j < lassoPoints.length; j++) {
    var p2 = lassoPoints[j];
    srcCtx.lineTo(p2.x, p2.y);
  }
  srcCtx.closePath();
  srcCtx.fill();
  srcCtx.restore();

  // --- history: snapshot AFTER cut & push entry ---
  var afterImg = captureCellImage(row, layer);
  pushHistoryCellChange(row, layer, beforeImg, afterImg, 'Lasso Cut');

  // --- store lasso path relative to selection center ---
  var centerX = minX + w / 2;
  var centerY = minY + h / 2;
  var path = lassoPoints.map(function (pt) {
    return {
      x: pt.x - centerX,
      y: pt.y - centerY
    };
  });

  // --- activate selection object ---
  activeSelection = {
    canvas: selCanvas,
    x: minX,
    y: minY,
    width: w,
    height: h,
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    row: row,
    layer: layer,
    path: path           // lasso outline for drawing
  };

  // cleanup
  lassoPoints = [];
  isLassoDrawing = false;
  toolMode = 'transform';

  redrawDisplay();
}
function createSelectionFromFullLayer() {
  if (selectedRow < 0 || selectedLayer < 0) return;

  var row = selectedRow;
  var layer = selectedLayer;

  var cell = xsheet[row][layer];
  if (!cell || !cell.drawing) return;

  var srcCanvas = cell.drawing;
  var srcCtx = srcCanvas.getContext('2d');

  var w = srcCanvas.width;
  var h = srcCanvas.height;
  if (w <= 0 || h <= 0) return;

  // --- history: BEFORE we cut the layer into a selection ---
  var beforeImg = captureCellImage(row, layer);

  // selection canvas
  var selCanvas = document.createElement('canvas');
  selCanvas.width = w;
  selCanvas.height = h;
  var selCtx = selCanvas.getContext('2d');

  // copy the full layer into the selection
  selCtx.drawImage(srcCanvas, 0, 0);

  // clear the original layer (so we don't see double when we draw the selection)
  srcCtx.clearRect(0, 0, w, h);

  // --- history: AFTER the cut ---
  var afterImg = captureCellImage(row, layer);
  pushHistoryCellChange(row, layer, beforeImg, afterImg, 'Select Layer');

  // activate selection object (no lasso path needed)
  activeSelection = {
    canvas: selCanvas,
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
    width: w,
    height: h,
    row: row,
    layer: layer,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    path: null
  };

  // Make sure we’re in transform mode
  toolMode = 'transform';

  redrawDisplay();
}


function commitActiveSelection() {
  if (!activeSelection) return;

  var sel = activeSelection;
  var row = sel.row;
  var layer = sel.layer;

  if (row < 0 || row >= xsheet.length) {
    activeSelection = null;
    redrawDisplay();
    return;
  }
  var cell = xsheet[row][layer];
  if (!cell) {
    activeSelection = null;
    redrawDisplay();
    return;
  }

  // --- history: snapshot BEFORE transform ---
  var beforeImg = captureCellImage(row, layer);

  // ensure canvas exists
  var canvas = ensureCellDrawing(row, layer, true);
  var ctx = canvas.getContext('2d');

  var cx = sel.x + sel.offsetX + sel.width / 2;
  var cy = sel.y + sel.offsetY + sel.height / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sel.angle);
  ctx.scale(sel.scaleX, sel.scaleY);
  ctx.drawImage(sel.canvas, -sel.width / 2, -sel.height / 2);
  ctx.restore();

  // --- history: snapshot AFTER transform & push entry ---
  var afterImg = captureCellImage(row, layer);
  pushHistoryCellChange(row, layer, beforeImg, afterImg, 'Transform');

  activeSelection = null;
  redrawDisplay();
}


function getSelectionHit(x, y) {
  if (!activeSelection) return { mode: null };

  var sel = activeSelection;
  var cx = sel.x + sel.offsetX + sel.width / 2;
  var cy = sel.y + sel.offsetY + sel.height / 2;
  var dx = x - cx;
  var dy = y - cy;
  var cosA = Math.cos(-sel.angle);
  var sinA = Math.sin(-sel.angle);
  var rx = dx * cosA - dy * sinA;
  var ry = dx * sinA + dy * cosA;
  rx /= sel.scaleX;
  ry /= sel.scaleY;

  var w = sel.width, h = sel.height;
  var halfW = w / 2;
  var halfH = h / 2;
  var handle = 10;

  var rotX = 0, rotY = -halfH - 20;
  var rdx = rx - rotX;
  var rdy = ry - rotY;
  if (Math.sqrt(rdx * rdx + rdy * rdy) <= handle) {
    return { mode: 'rotate' };
  }

  var corners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH }
  ];
  for (var i = 0; i < corners.length; i++) {
    var c = corners[i];
    if (Math.abs(rx - c.x) <= handle && Math.abs(ry - c.y) <= handle) {
      return { mode: 'scale', cornerIndex: i };
    }
  }

  if (Math.abs(rx) <= halfW && Math.abs(ry) <= halfH) {
    return { mode: 'move' };
  }
  return { mode: null };
}

function drawActiveSelectionOverlay() {
  if (!activeSelection || activeSelection.row !== selectedRow) return;
  var sel = activeSelection;
  var cx = sel.x + sel.offsetX + sel.width / 2;
  var cy = sel.y + sel.offsetY + sel.height / 2;

  // draw the selected pixels
  displayCtx.save();
  displayCtx.translate(cx, cy);
  displayCtx.rotate(sel.angle);
  displayCtx.scale(sel.scaleX, sel.scaleY);
  displayCtx.drawImage(sel.canvas, -sel.width / 2, -sel.height / 2);
  displayCtx.restore();

  // draw overlay (lasso + transform box + handles)
  displayCtx.save();
  displayCtx.translate(cx, cy);
  displayCtx.rotate(sel.angle);
  displayCtx.scale(sel.scaleX, sel.scaleY);

  var w = sel.width, h = sel.height;
  var halfW = w / 2, halfH = h / 2;

  // --- 1) lasso outline (stored polygon) ---
  if (sel.path && sel.path.length > 1) {
    displayCtx.strokeStyle = 'rgba(0,0,0,0.8)';
    displayCtx.lineWidth = 2;
    displayCtx.setLineDash([8, 2]);    // dashed marching-ants style

    displayCtx.beginPath();
    var p0 = sel.path[0];
    displayCtx.moveTo(p0.x, p0.y);
    for (var i = 1; i < sel.path.length; i++) {
      var p = sel.path[i];
      displayCtx.lineTo(p.x, p.y);
    }
    displayCtx.closePath();
    displayCtx.stroke();
  }

  // --- 2) transform box on top ---
  displayCtx.setLineDash([]);          // solid for box
  displayCtx.strokeStyle = 'rgba(0,0,0,0.5)';
  displayCtx.lineWidth = 2;
  displayCtx.strokeRect(-halfW, -halfH, w, h);

  // --- 3) resize handles ---
  var handle = 6;
  var corners = [
    { x: -halfW, y: -halfH },
    { x:  halfW, y: -halfH },
    { x:  halfW, y:  halfH },
    { x: -halfW, y:  halfH }
  ];
  displayCtx.fillStyle = '#fbbf24';
  corners.forEach(function(p) {
    displayCtx.fillRect(p.x - handle / 2, p.y - handle / 2, handle, handle);
  });

  // --- 4) rotation handle ---
  var rotY = -halfH - 20;
  displayCtx.beginPath();
  displayCtx.arc(0, rotY, 5, 0, Math.PI * 2);
  displayCtx.fillStyle = '#38bdf8';
  displayCtx.fill();

  displayCtx.restore();
}


function drawLassoPreview() {
  if (!isLassoDrawing || lassoPoints.length < 2) return;
  displayCtx.save();
  displayCtx.strokeStyle = 'rgba(0,0,0,0.8)';
  displayCtx.lineWidth = 2;
  displayCtx.setLineDash([8, 2]);
  displayCtx.lineDashOffset = -performance.now() / 30;
  displayCtx.beginPath();
  var p0 = lassoPoints[0];
  displayCtx.moveTo(p0.x, p0.y);
  for (var i = 1; i < lassoPoints.length; i++) {
    var p = lassoPoints[i];
    displayCtx.lineTo(p.x, p.y);
  }
  displayCtx.stroke();
  displayCtx.restore();
}

function redrawDisplay() {
  displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

  // --- Onion skin ---
  if (onionSkinChk && onionSkinChk.checked) {
    var range = Math.max(1, Math.min(5, parseInt(onionRangeInput.value, 10) || 1));

    // Bright colours (alpha is controlled separately)
    var prevCol = 'rgba(255, 64, 64, 1)';   // previous = red
    var nextCol = 'rgba(64, 160, 255, 1)';  // next = blue

    for (var o = range; o >= 1; o--) {
      var pr = selectedRow - o;
      var nr = selectedRow + o;

      // Closer frames more opaque, but all fairly visible
      var a = 0.75 / o;

      if (pr >= 0) compositeRowTinted(pr, prevCol, a);
      if (nr < xsheet.length) compositeRowTinted(nr, nextCol, a);
    }
  }

  compositeRowToDisplay(selectedRow, 1);
  drawActiveSelectionOverlay();
  drawLassoPreview();
}

function clearSelectedCell() {
  // First, bake any active selection back into the layer (and record its history).
  commitActiveSelection();

  if (selectedRow < 0 || selectedLayer < 0) return;
  var row = selectedRow;
  var layer = selectedLayer;

  // History: BEFORE clear
  var beforeImg = captureCellImage(row, layer);

  var cell = xsheet[row][layer];
  if (cell && cell.drawing) {
    var ctx = cell.drawing.getContext('2d');
    ctx.clearRect(0, 0, cell.drawing.width, cell.drawing.height);
    cell.drawing = null;
  }

  // AFTER clear → null image
  pushHistoryCellChange(row, layer, beforeImg, null, 'Clear Cell');

  refreshXsheetUI();
  redrawDisplay();
}


function exportRowToPNG(rowIndex) {
  var off = document.createElement('canvas');
  off.width = displayCanvas.width;
  off.height = displayCanvas.height;
  var ctx = off.getContext('2d');
  ctx.clearRect(0, 0, off.width, off.height);
  compositeRowToContext(rowIndex, ctx, 1);
  var link = document.createElement('a');
  link.href = off.toDataURL('image/png');
  link.download = 'frame_' + String(rowIndex + 1).padStart(3, '0') + '.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// POINTER HANDLERS

function onPointerDown(evt) {
  evt.preventDefault();
  if (selectedRow < 0 || selectedLayer < 0) return;

  if (toolMode === 'brush' && shouldIgnorePointer(evt)) {
    return;
  }

  var pid = (evt.pointerId !== undefined ? evt.pointerId : 'mouse');
  activePointerId = pid;

  var pos = getPointerPos(evt);

  if (displayCanvas.setPointerCapture && evt.pointerId !== undefined) {
    displayCanvas.setPointerCapture(evt.pointerId);
  }

  if (toolMode === 'brush') {
    commitActiveSelection();
    isDrawing = true;
    hasStrokeStarted = false;

	//new line
	hasLazyPos = false;
    hasStrokeStarted = false;

	// NEW: reset simulated pressure distance
	totalStrokeDistance = 0;

    var rawP = (evt.pressure !== undefined ? evt.pressure : 0);
    var isPen = (evt.pointerType === 'pen');
    var hasP = !isPen || rawP > PRESSURE_THRESHOLD;
    lastPressure = hasP ? rawP : 1;

    if (lazyEnabled) {
      lazyX = pos.x;
      lazyY = pos.y;
      hasLazyPos = true;
      lastX = lazyX;
      lastY = lazyY;
    } else {
      lastX = pos.x;
      lastY = pos.y;
      hasLazyPos = false;
    }

    ensureCellDrawing(selectedRow, selectedLayer, true);
    // Start history capture for this stroke
    strokeRow = selectedRow;
    strokeLayer = selectedLayer;
    strokePrevImage = captureCellImage(strokeRow, strokeLayer);
    refreshXsheetUI();
    redrawDisplay();
  } else if (toolMode === 'lasso') {
    commitActiveSelection();
    isLassoDrawing = true;
    lassoPoints = [pos];
    redrawDisplay();
} else if (toolMode === 'transform') {
  // If there is no active selection for this row, create one for the whole layer
  if (!activeSelection || activeSelection.row !== selectedRow) {
    createSelectionFromFullLayer();
  }

  // Still nothing? Then there's nothing to transform
  if (!activeSelection || activeSelection.row !== selectedRow) return;

  var hit = getSelectionHit(pos.x, pos.y);
  if (!hit.mode) return;

  isTransformDragging = true;
  transformDragMode = hit.mode;
  dragStartPointer = pos;
  dragInitial = {
    offsetX: activeSelection.offsetX,
    offsetY: activeSelection.offsetY,
    scaleX: activeSelection.scaleX,
    scaleY: activeSelection.scaleY,
    angle: activeSelection.angle,
    startLocalDist: 0,
    startAngle: 0
  };

  var sel = activeSelection;
  var cx = sel.x + sel.offsetX + sel.width / 2;
  var cy = sel.y + sel.offsetY + sel.height / 2;
  var dx = pos.x - cx;
  var dy = pos.y - cy;
  var cosA = Math.cos(-sel.angle);
  var sinA = Math.sin(-sel.angle);
  var rx = dx * cosA - dy * sinA;
  var ry = dx * sinA + dy * cosA;
  rx /= sel.scaleX;
  ry /= sel.scaleY;

  if (hit.mode === 'scale') {
    dragInitial.startLocalDist = Math.sqrt(rx * rx + ry * ry);
  } else if (hit.mode === 'rotate') {
    dragInitial.startAngle = Math.atan2(ry, rx);
  }
}
 else if (toolMode === 'zoom') {
    var factor = evt.shiftKey ? 1 / 1.25 : 1.25;
    zoomAt(pos.x, pos.y, factor);
  } else if (toolMode === 'pan') {
    isPanning = true;
    lastPanClientX = evt.clientX;
    lastPanClientY = evt.clientY;
  }
}

function onPointerMove(evt) {
  var pid = (evt.pointerId !== undefined ? evt.pointerId : 'mouse');
  if (activePointerId !== null && pid !== activePointerId) return;

  if (toolMode === 'brush') {
    if (!isDrawing) return;
    if (!(evt.buttons & 1)) return;
    if (shouldIgnorePointer(evt)) return;

    evt.preventDefault();
    var pos = getPointerPos(evt);

    // Pen / mouse pressure handling:
    // - Mouse: always use pressure = 1
    // - Pen: use evt.pressure while it is above a small threshold.
    //   When pressure falls below the threshold *after the stroke started*,
    //   we stop drawing instead of treating it as a full-pressure mouse click.
    var rawPressure = evt.pressure;
    var isPen = (evt.pointerType === 'pen');
    var pressure;

    if (!isPen || rawPressure == null) {
  // --- Mouse or non-pen input ---
  if (simulatePressure) {
    // Fake a pressure ramp based on stroke distance.
    // 1) On very first move (before stroke started) just seed a low pressure
    if (!hasStrokeStarted) {
      pressure = 0.2;
      totalStrokeDistance = 0;
    } else {
      // 2) Accumulate distance from last point
      var dxp = pos.x - lastX;
      var dyp = pos.y - lastY;
      var stepDist = Math.sqrt(dxp * dxp + dyp * dyp) || 0;
      totalStrokeDistance += stepDist;

      // Ramp distance: how far before we hit full pressure (in pixels)
      var baseSize = parseFloat(brushSizeInput.value) || 10;
      baseSize = Math.max(1, baseSize);
      var rampDist = Math.max(60, baseSize * 12);

var t = Math.max(0, Math.min(1, totalStrokeDistance / rampDist));

// smoothstep curve
t = t * t * (3 - 2 * t);

pressure = 0.2 + 0.8 * t;
    }
  } else {
    // Normal mouse behavior: constant full pressure
    pressure = 1;
  }
    } else {
      // Pen input
      if (hasStrokeStarted && rawPressure <= PRESSURE_THRESHOLD) {
        // Stylus is lifting off: don't stamp a last "blob"
        // with pressure = 1, just end the stroke visually.
        return;
      }
      // Use the raw pen pressure (0..1)
      pressure = rawPressure;
    }

    var c = ensureCellDrawing(selectedRow, selectedLayer, true);
    var ctx = c.getContext('2d');

    if (!hasStrokeStarted) {
      if (lazyEnabled) {
        lazyX = pos.x;
        lazyY = pos.y;
        hasLazyPos = true;
        lastX = lazyX;
        lastY = lazyY;
      } else {
        lastX = pos.x;
        lastY = pos.y;
      }
      lastPressure = pressure;
      hasStrokeStarted = true;
      return;
    }

    if (!lazyEnabled || !hasLazyPos) {
      stampLine(ctx, lastX, lastY, pos.x, pos.y, pressure);
      lastX = pos.x;
      lastY = pos.y;
    } else {
      var a = Math.max(0.05, 1 - lazyStrength);
      lazyX += (pos.x - lazyX) * a;
      lazyY += (pos.y - lazyY) * a;
      stampLine(ctx, lastX, lastY, lazyX, lazyY, pressure);
      lastX = lazyX;
      lastY = lazyY;
    }

    lastPressure = pressure;
    refreshXsheetUI();
    redrawDisplay();
  } else if (toolMode === 'lasso') {
    if (!isLassoDrawing) return;
    evt.preventDefault();
    var p = getPointerPos(evt);
    lassoPoints.push(p);
    redrawDisplay();
  } else if (toolMode === 'transform') {
    if (!isTransformDragging || !activeSelection) return;
    evt.preventDefault();
    var pos2 = getPointerPos(evt);
    var sel = activeSelection;
    if (transformDragMode === 'move') {
      var dx = pos2.x - dragStartPointer.x;
      var dy = pos2.y - dragStartPointer.y;
      sel.offsetX = dragInitial.offsetX + dx;
      sel.offsetY = dragInitial.offsetY + dy;
    } else if (transformDragMode === 'scale') {
      var cx = sel.x + sel.offsetX + sel.width / 2;
      var cy = sel.y + sel.offsetY + sel.height / 2;
      var ddx = pos2.x - cx;
      var ddy = pos2.y - cy;
      var cosA = Math.cos(-sel.angle);
      var sinA = Math.sin(-sel.angle);
      var rx = ddx * cosA - ddy * sinA;
      var ry = ddx * sinA + ddy * cosA;
      rx /= sel.scaleX;
      ry /= sel.scaleY;
      var dist = Math.sqrt(rx * rx + ry * ry) || 1;
      var f = dist / (dragInitial.startLocalDist || 1);
      sel.scaleX = Math.max(0.1, dragInitial.scaleX * f);
      sel.scaleY = Math.max(0.1, dragInitial.scaleY * f);
    } else if (transformDragMode === 'rotate') {
      var cx2 = sel.x + sel.offsetX + sel.width / 2;
      var cy2 = sel.y + sel.offsetY + sel.height / 2;
      var ddx2 = pos2.x - cx2;
      var ddy2 = pos2.y - cy2;
      var cosA2 = Math.cos(-sel.angle);
      var sinA2 = Math.sin(-sel.angle);
      var rx2 = ddx2 * cosA2 - ddy2 * sinA2;
      var ry2 = ddx2 * sinA2 + ddy2 * cosA2;
      rx2 /= sel.scaleX;
      ry2 /= sel.scaleY;
      var ang = Math.atan2(ry2, rx2);
      sel.angle = dragInitial.angle + (ang - dragInitial.startAngle);
    }
    redrawDisplay();
  } else if (toolMode === 'pan') {
    if (!isPanning) return;
    evt.preventDefault();
    var dxp = evt.clientX - lastPanClientX;
    var dyp = evt.clientY - lastPanClientY;
    lastPanClientX = evt.clientX;
    lastPanClientY = evt.clientY;
    panX += dxp;
    panY += dyp;
    updateCanvasTransform();
  }
}

function onPointerUp(evt) {
  var pid = (evt.pointerId !== undefined ? evt.pointerId : 'mouse');
  if (activePointerId !== null && pid !== activePointerId) return;

  if (toolMode === 'brush') {
    if (!isDrawing) return;
    isDrawing = false;
    hasLazyPos = false;
    hasStrokeStarted = false;

	// NEW: reset simulated pressure distance at end of stroke
	totalStrokeDistance = 0;

    // End of brush stroke: push history entry if any
    if (strokeRow >= 0 && strokeLayer >= 0) {
      var nextImg = captureCellImage(strokeRow, strokeLayer);
      pushHistoryCellChange(strokeRow, strokeLayer, strokePrevImage, nextImg);
      strokePrevImage = null;
      strokeRow = -1;
      strokeLayer = -1;
    }
  } else if (toolMode === 'lasso') {
    if (isLassoDrawing) {
      isLassoDrawing = false;
      createSelectionFromLasso();
    }
  } else if (toolMode === 'transform') {
    if (!isTransformDragging) return;
    isTransformDragging = false;
    transformDragMode = null;
  } else if (toolMode === 'pan') {
    isPanning = false;
  }

  activePointerId = null;

  if (displayCanvas.releasePointerCapture && evt && evt.pointerId !== undefined) {
    displayCanvas.releasePointerCapture(evt.pointerId);
  }
}


// --- HISTORY SYSTEM (global per-cell image snapshots) ---

function captureCellImage(row, layer) {
  if (!xsheet[row] || !xsheet[row][layer]) return null;
  var cell = xsheet[row][layer];
  if (!cell.drawing) return null;
  var c = cell.drawing;
  var ctx = c.getContext('2d');
  try {
    return ctx.getImageData(0, 0, c.width, c.height);
  } catch (e) {
    return null;
  }
}

function restoreCellImage(row, layer, imgData) {
  if (!xsheet[row]) return;
  var cell = xsheet[row][layer];
  if (!imgData) {
    // clear drawing
    if (cell && cell.drawing) {
      var c = cell.drawing;
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
    }
    if (cell) cell.drawing = null;
    return;
  }
  // ensure canvas exists
  ensureCellDrawing(row, layer, true);
  cell = xsheet[row][layer];
  var c = cell.drawing;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.putImageData(imgData, 0, 0);
}

function pushHistoryCellsChange(cellsArray, label) {
  if (!cellsArray || cellsArray.length === 0) return;
  if (!historyStack) historyStack = [];
  if (typeof MAX_HISTORY === 'undefined' || !MAX_HISTORY) MAX_HISTORY = 60;
  if (typeof label === 'undefined') label = 'Edit';

  // If we undid some steps, drop everything after the current index.
  if (historyIndex < historyStack.length - 1) {
    historyStack = historyStack.slice(0, historyIndex + 1);
  }

  historyStack.push({
    type: 'cells',
    label: label,
    cells: cellsArray.slice()
  });

  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
    if (historyIndex > -1) historyIndex--;
  }
  historyIndex = historyStack.length - 1;
  updateHistoryStrip();
}

function pushHistoryCellChange(row, layer, beforeImg, afterImg, label) {
  if (beforeImg == null && afterImg == null) return;
  var entryCell = {
    row: row,
    layer: layer,
    before: beforeImg,
    after: afterImg
  };
  pushHistoryCellsChange([entryCell], label || 'Stroke');
}

function applyHistoryEntry(entry, direction) {
  if (!entry || entry.type !== 'cells') return;
  var forward = (direction > 0);
  for (var i = 0; i < entry.cells.length; i++) {
    var c = entry.cells[i];
    var img = forward ? c.after : c.before;
    restoreCellImage(c.row, c.layer, img);
  }
}

function undoHistory() {
  if (!historyStack || historyIndex < 0) return;
  var entry = historyStack[historyIndex];
  applyHistoryEntry(entry, -1);
  historyIndex--;

  // Clear any active selection when history changes
  activeSelection = null;
  isTransformDragging = false;
  isLassoDrawing = false;

  updateHistoryStrip();
  refreshXsheetUI();
  redrawDisplay();
}


function redoHistory() {
  if (!historyStack || historyIndex >= historyStack.length - 1) return;
  var entry = historyStack[historyIndex + 1];
  applyHistoryEntry(entry, +1);
  historyIndex++;

  // Clear any active selection when history changes
  activeSelection = null;
  isTransformDragging = false;
  isLassoDrawing = false;

  updateHistoryStrip();
  refreshXsheetUI();
  redrawDisplay();
}


function jumpToHistory(targetIndex) {
  if (!historyStack) return;
  if (targetIndex < 0 || targetIndex >= historyStack.length) return;
  if (targetIndex === historyIndex) return;

  // Move step by step so we correctly apply intermediate undo/redo operations.
  if (targetIndex < historyIndex) {
    for (var i = historyIndex; i >= targetIndex + 0; i--) {
      applyHistoryEntry(historyStack[i], -1);
    }
  } else {
    for (var j = historyIndex + 1; j <= targetIndex; j++) {
      applyHistoryEntry(historyStack[j], +1);
    }
  }
  historyIndex = targetIndex;
  updateHistoryStrip();
  refreshXsheetUI();
  redrawDisplay();
}

function updateHistoryStrip() {
  if (!historyStrip) return;
  while (historyStrip.firstChild) historyStrip.removeChild(historyStrip.firstChild);
  if (!historyStack || historyStack.length === 0) return;
  for (var i = 0; i < historyStack.length; i++) {
    var entry = historyStack[i];
    var box = document.createElement('div');
    box.className = 'history-item filled';
    if (i === historyIndex) {
      box.className += ' current';
    }
    box.title = entry.label || ('Step ' + (i + 1));
    (function(index) {
      box.addEventListener('click', function() {
        jumpToHistory(index);
      });
    })(i);
    historyStrip.appendChild(box);
  }
}
