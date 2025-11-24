// xsheet.js

// --- Selection state (rectangular) + drag state ---

var selectionStartRow = null;
var selectionStartLayer = null;
var selectionEndRow = null;
var selectionEndLayer = null;

// Dragging a selection
var isDraggingXsheetSelection = false;
var dragOriginRow = null;
var dragOriginLayer = null;
var dragStartClientX = 0;
var dragStartClientY = 0;
var dragCurrentTargetRow = null;
var dragCurrentTargetLayer = null;
var dragPreviewStartRow = null;
var dragPreviewStartLayer = null;
var suppressNextCellClick = false;
var XSHEET_DRAG_THRESHOLD = 4;

// Reusable offscreen canvas for onion silhouettes
var onionMaskCanvas = null;
var onionMaskCtx = null;

// --- Hold logic helpers -----------------------------------------------------

function applyDefaultHoldTo(startRow, layer, canvas) {
  var count = Math.max(1, defaultHold);
  for (var i = 1; i < count; i++) {
    var rowIndex = startRow + i;
    if (rowIndex >= xsheet.length) {
      var newRow = [];
      for (var c = 0; c < layerCount; c++) newRow.push({ drawing: null });
      xsheet.push(newRow);
    }
    var cell = xsheet[rowIndex][layer];
    if (!cell.drawing) cell.drawing = canvas;
    else break;
  }
}

function ensureCellDrawing(row, layer, applyDefault) {
  if (applyDefault === undefined) applyDefault = true;
  var cell = xsheet[row][layer];
  if (!cell.drawing) {
    cell.drawing = createDrawingCanvas();
    if (applyDefault) applyDefaultHoldTo(row, layer, cell.drawing);
  }
  return cell.drawing;
}

// --- Selection helpers ------------------------------------------------------

function resetSelectionToCurrent() {
  selectionStartRow = selectedRow;
  selectionStartLayer = selectedLayer;
  selectionEndRow = selectedRow;
  selectionEndLayer = selectedLayer;
}

function getSelectionBounds() {
  if (
    selectionStartRow == null || selectionStartLayer == null ||
    selectionEndRow == null || selectionEndLayer == null
  ) {
    if (typeof selectedRow === 'number' && typeof selectedLayer === 'number') {
      return {
        startRow: selectedRow,
        endRow: selectedRow,
        startLayer: selectedLayer,
        endLayer: selectedLayer
      };
    }
    return null;
  }
  var sr = Math.min(selectionStartRow, selectionEndRow);
  var er = Math.max(selectionStartRow, selectionEndRow);
  var sl = Math.min(selectionStartLayer, selectionEndLayer);
  var el = Math.max(selectionStartLayer, selectionEndLayer);
  return { startRow: sr, endRow: er, startLayer: sl, endLayer: el };
}

function isCellInSelection(r, c) {
  var b = getSelectionBounds();
  if (!b) return (r === selectedRow && c === selectedLayer);
  return (
    r >= b.startRow && r <= b.endRow &&
    c >= b.startLayer && c <= b.endLayer
  );
}

function hasMultiSelection() {
  var b = getSelectionBounds();
  if (!b) return false;
  return (b.startRow !== b.endRow) || (b.startLayer !== b.endLayer);
}

// --- X-sheet init / structure ----------------------------------------------

function initXsheet(rows, layers) {
  if (rows === undefined) rows = 16;
  if (layers === undefined) layers = 1;
  layerCount = layers;

  // Initialize xsheet grid
  xsheet = [];
  for (var r = 0; r < rows; r++) {
    var row = [];
    for (var c = 0; c < layerCount; c++) row.push({ drawing: null });
    xsheet.push(row);
  }

  // Initialize per-layer properties
  layerOpacity = [];
  layerBlendMode = [];
  for (var lc = 0; lc < layerCount; lc++) {
    layerOpacity[lc] = 1;
    layerBlendMode[lc] = 'normal';
  }

  selectedRow = 0;
  selectedLayer = 0;
  resetSelectionToCurrent();
  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}


function addLayer() {
  commitActiveSelection();

  // Add a new layer at the end
  layerCount++;
  for (var r = 0; r < xsheet.length; r++) {
    xsheet[r].push({ drawing: null });
  }

  // Default properties for the new layer
  if (!layerOpacity) layerOpacity = [];
  if (!layerBlendMode) layerBlendMode = [];
  layerOpacity.push(1);
  layerBlendMode.push('normal');

  if (selectedLayer === -1) selectedLayer = 0;
  resetSelectionToCurrent();
  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}


function removeLayer() {
  if (layerCount <= 1) return;
  commitActiveSelection();
  if (selectedLayer < 0 || selectedLayer >= layerCount) selectedLayer = 0;

  var hasContent = false;
  for (var r = 0; r < xsheet.length; r++) {
    var cell = xsheet[r][selectedLayer];
    if (cell && cell.drawing) { hasContent = true; break; }
  }
  if (hasContent) {
    var ok = window.confirm('This layer contains drawings. Delete it?');
    if (!ok) return;
  }

  // Remove the column from all rows
  for (var r2 = 0; r2 < xsheet.length; r2++) {
    xsheet[r2].splice(selectedLayer, 1);
  }

  // Remove stored properties for that layer
  if (Array.isArray(layerOpacity)) {
    layerOpacity.splice(selectedLayer, 1);
  }
  if (Array.isArray(layerBlendMode)) {
    layerBlendMode.splice(selectedLayer, 1);
  }

  layerCount--;
  if (selectedLayer >= layerCount) selectedLayer = layerCount - 1;
  resetSelectionToCurrent();
  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}


function addRow() {
  commitActiveSelection();

  var insertIndex;
  if (typeof selectedRow === 'number' &&
      selectedRow >= 0 && selectedRow < xsheet.length) {
    // Insert just AFTER the selected row
    insertIndex = selectedRow + 1;
  } else {
    // No valid selection → add at the end
    insertIndex = xsheet.length;
  }

  var row = [];
  for (var c = 0; c < layerCount; c++) row.push({ drawing: null });
  xsheet.splice(insertIndex, 0, row);

  // If nothing was selected, select the new row
  if (selectedRow == null || selectedRow < 0 || selectedRow >= xsheet.length) {
    selectedRow = insertIndex;
    selectedLayer = 0;
  }

  refreshXsheetUI();
  updateInfos();
}

function removeRow() {
  if (xsheet.length <= 1) return;
  commitActiveSelection();

  var targetIndex;
  if (typeof selectedRow === 'number' &&
      selectedRow >= 0 && selectedRow < xsheet.length) {
    targetIndex = selectedRow;
  } else {
    // No valid selection → remove from the end
    targetIndex = xsheet.length - 1;
  }

  var row = xsheet[targetIndex];
  var hasContent = false;
  for (var c = 0; c < layerCount; c++) {
    var cell = row[c];
    if (cell && cell.drawing) { hasContent = true; break; }
  }
  if (hasContent) {
    var ok = window.confirm('This row contains drawings. Delete it?');
    if (!ok) return;
  }

  xsheet.splice(targetIndex, 1);

  if (selectedRow >= xsheet.length) selectedRow = xsheet.length - 1;
  if (selectedRow < 0) selectedRow = 0;
  resetSelectionToCurrent();
  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}

function selectCell(row, layer, extend) {
  commitActiveSelection();
  selectedRow = row;
  selectedLayer = layer;

  if (extend && selectionStartRow != null && selectionStartLayer != null) {
    selectionEndRow = row;
    selectionEndLayer = layer;
  } else {
    selectionStartRow = row;
    selectionStartLayer = layer;
    selectionEndRow = row;
    selectionEndLayer = layer;
  }

  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}

// --- Frame labels (exposure numbers) ---------------------------------------

function makeFrameLabelsForLayer(layerIndex) {
  var labels = new Array(xsheet.length);
  for (var i = 0; i < labels.length; i++) labels[i] = '';
  var frameNumber = 0;
  var lastCanvas = null;
  for (var r = 0; r < xsheet.length; r++) {
    var cell = xsheet[r][layerIndex];
    if (!cell.drawing) { lastCanvas = null; continue; }
    if (cell.drawing !== lastCanvas) {
      frameNumber++;
      lastCanvas = cell.drawing;
      labels[r] = String(frameNumber).padStart(3, '0');
    } else {
      labels[r] = '↓';
    }
  }
  return labels;
}

// --- UI render --------------------------------------------------------------

function refreshXsheetUI() {
  var rows = xsheet.length;
  var cols = layerCount;
  var layerLabels = [];
  for (var c = 0; c < cols; c++) {
    layerLabels[c] = makeFrameLabelsForLayer(c);
  }

  var bounds = getSelectionBounds();
  var selHeight = 1, selWidth = 1;
  if (bounds) {
    selHeight = bounds.endRow - bounds.startRow + 1;
    selWidth = bounds.endLayer - bounds.startLayer + 1;
  }

  var html = '<thead><tr><th class="row-header">#</th>';

  // Build per-layer header with opacity + blend mode controls
  var blendOptions = [
    { value: 'normal',   label: 'Normal'   },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen',   label: 'Screen'   },
    { value: 'overlay',  label: 'Overlay'  },
    { value: 'add',      label: 'Additive' }
  ];

  for (var cc = 0; cc < cols; cc++) {
    var op = (layerOpacity && typeof layerOpacity[cc] === 'number') ? layerOpacity[cc] : 1;
    var opPct = Math.round(op * 100);
    var blend = (layerBlendMode && layerBlendMode[cc]) ? layerBlendMode[cc] : 'normal';

    var selectHtml = '<select class="layer-blend-select" data-layer="' + cc + '">';
    for (var bo = 0; bo < blendOptions.length; bo++) {
      var opt = blendOptions[bo];
      selectHtml += '<option value="' + opt.value + '"' +
        (blend === opt.value ? ' selected' : '') + '>' + opt.label + '</option>';
    }
    selectHtml += '</select>';

    html += '<th class="layer-header"><div class="layer-header-inner">' +
      '<div class="layer-header-title">L' + (cc + 1) + '</div>' +
      '<div class="layer-opacity-row">' +
        '<input type="range" min="0" max="100" value="' + opPct + '" ' +
          'class="layer-opacity-slider" data-layer="' + cc + '">' +
        '<span class="layer-opacity-value" id="layerOpacityValue-' + cc + '">' + opPct + '</span>' +
      '</div>' +
      selectHtml +
    '</div></th>';
  }
  html += '</tr></thead><tbody>';


  for (var r = 0; r < rows; r++) {
    html += '<tr><td class="row-header">' + (r + 1) + '</td>';
    for (var c2 = 0; c2 < cols; c2++) {
      var cell = xsheet[r][c2];
      var has = !!cell.drawing;
      var label = layerLabels[c2][r];

      var inSel = isCellInSelection(r, c2);

      var inDragPreview = false;
      if (dragPreviewStartRow != null && bounds) {
        var pr = dragPreviewStartRow;
        var pl = dragPreviewStartLayer;
        if (
          r >= pr && r < pr + selHeight &&
          c2 >= pl && c2 < pl + selWidth
        ) {
          inDragPreview = true;
        }
      }

      var classes = ['cell'];
      if (has) classes.push('has-drawing');
      if (inSel) classes.push('selected');
      if (inDragPreview) classes.push('drag-preview');
      html += '<td class="' + classes.join(' ') + '" data-row="' + r + '" data-layer="' + c2 + '">' + label + '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody>';
  xsheetTable.innerHTML = html;

  // Wire per-layer opacity sliders
  var opacitySliders = xsheetTable.querySelectorAll('.layer-opacity-slider');
  opacitySliders.forEach(function(sl) {
    sl.addEventListener('input', function() {
      var layer = parseInt(sl.getAttribute('data-layer'), 10);
      var v = parseInt(sl.value, 10);
      if (isNaN(layer) || isNaN(v)) return;
      if (!layerOpacity) layerOpacity = [];
      layerOpacity[layer] = Math.max(0, Math.min(1, v / 100));

      var lbl = document.getElementById('layerOpacityValue-' + layer);
      if (lbl) lbl.textContent = v;

      redrawDisplay();
    });
  });

  // Wire per-layer blend mode selects
  var blendSelects = xsheetTable.querySelectorAll('.layer-blend-select');
  blendSelects.forEach(function(sel) {
    sel.addEventListener('change', function() {
      var layer = parseInt(sel.getAttribute('data-layer'), 10);
      var val = sel.value || 'normal';
      if (!layerBlendMode) layerBlendMode = [];
      layerBlendMode[layer] = val;
      redrawDisplay();
    });
  });

  xsheetTable.querySelectorAll('td.cell').forEach(function(td) {

    td.addEventListener('click', function(ev) {
      if (suppressNextCellClick) {
        suppressNextCellClick = false;
        return;
      }
      var r = parseInt(td.getAttribute('data-row'), 10);
      var c = parseInt(td.getAttribute('data-layer'), 10);
      selectCell(r, c, !!ev.shiftKey);
    });

    // Drag start
    td.addEventListener('mousedown', function(ev) {
      if (ev.button !== 0) return; // left only
      var r = parseInt(td.getAttribute('data-row'), 10);
      var c = parseInt(td.getAttribute('data-layer'), 10);

      // If not inside current selection or Shift pressed -> normal selection behaviour
      if (!isCellInSelection(r, c) || ev.shiftKey) {
        dragOriginRow = null;
        dragOriginLayer = null;
        return;
      }

      dragOriginRow = r;
      dragOriginLayer = c;
      dragStartClientX = ev.clientX;
      dragStartClientY = ev.clientY;
      dragCurrentTargetRow = null;
      dragCurrentTargetLayer = null;
      isDraggingXsheetSelection = false;
      dragPreviewStartRow = null;
      dragPreviewStartLayer = null;
      suppressNextCellClick = false;
      ev.preventDefault();
    });

    // Right-click context menu
    td.addEventListener('contextmenu', function(ev) {
      ev.preventDefault();
      var r = parseInt(td.getAttribute('data-row'), 10);
      var c = parseInt(td.getAttribute('data-layer'), 10);
      selectCell(r, c, false);
      showCellContextMenu(ev.clientX, ev.clientY);
    });
  });
}

function updateInfos() {
  rowInfo.textContent = 'Row ' + (selectedRow + 1) + ' / ' + xsheet.length;
  layerInfo.textContent = 'Layer ' + (selectedLayer + 1) + ' selected';
  fpsLabel.textContent = fpsRange.value;
}

// --- Composite helpers (used by drawing / onion skin) ----------------------

function compositeRowToContext(rowIndex, ctx, alpha) {
  if (alpha === undefined) alpha = 1;
  if (rowIndex < 0 || rowIndex >= xsheet.length) return;

  ctx.save();

  var baseAlpha = alpha;
  for (var c = 0; c < layerCount; c++) {
    var cell = xsheet[rowIndex][c];
    if (!cell.drawing) continue;

    // Per-layer opacity
    var la = (layerOpacity && typeof layerOpacity[c] === 'number') ? layerOpacity[c] : 1;
    if (la <= 0) continue;

    // Per-layer blend mode
    var mode = (layerBlendMode && layerBlendMode[c]) ? layerBlendMode[c] : 'normal';
    switch (mode) {
      case 'multiply': ctx.globalCompositeOperation = 'multiply'; break;
      case 'screen':   ctx.globalCompositeOperation = 'screen';   break;
      case 'overlay':  ctx.globalCompositeOperation = 'overlay';  break;
      case 'add':
      case 'additive':
        ctx.globalCompositeOperation = 'lighter'; break;  // additive
      default:
        ctx.globalCompositeOperation = 'source-over';    // normal
        break;
    }

    ctx.globalAlpha = baseAlpha * la;
    ctx.drawImage(cell.drawing, 0, 0);
  }

  ctx.restore();
}

function compositeRowToDisplay(rowIndex, alpha) {
  if (alpha === undefined) alpha = 1;
  compositeRowToContext(rowIndex, displayCtx, alpha);
}

function compositeRowTinted(rowIndex, color, alpha) {
  if (rowIndex < 0 || rowIndex >= xsheet.length) return;
  if (!displayCanvas || !displayCtx) return;

  var w = displayCanvas.width;
  var h = displayCanvas.height;

  // Create / resize offscreen canvas
  if (!onionMaskCanvas) {
    onionMaskCanvas = document.createElement('canvas');
    onionMaskCtx = onionMaskCanvas.getContext('2d');
  }
  if (onionMaskCanvas.width !== w || onionMaskCanvas.height !== h) {
    onionMaskCanvas.width = w;
    onionMaskCanvas.height = h;
  }

  // Clear mask
  onionMaskCtx.clearRect(0, 0, w, h);

  // 1) Draw the row into the mask with full opacity – we only care about its alpha
  onionMaskCtx.globalCompositeOperation = 'source-over';
  compositeRowToContext(rowIndex, onionMaskCtx, 1);

  // 2) Turn that into a flat-colour silhouette using the row's alpha as mask
  onionMaskCtx.globalCompositeOperation = 'source-in';
  onionMaskCtx.fillStyle = color;   // solid red/blue
  onionMaskCtx.globalAlpha = alpha; // overall opacity control
  onionMaskCtx.fillRect(0, 0, w, h);

  // 3) Draw the silhouette onto the main display
  onionMaskCtx.globalCompositeOperation = 'source-over';
  onionMaskCtx.globalAlpha = 1;
  displayCtx.drawImage(onionMaskCanvas, 0, 0);
}

// --- Holds / exposure blocks -----------------------------------------------

function getExposureBlock(row, layer) {
  var cell = xsheet[row][layer];
  var canvas = cell.drawing;
  if (!canvas) return null;
  var start = row, end = row;
  while (start - 1 >= 0 && xsheet[start - 1][layer].drawing === canvas) start--;
  while (end + 1 < xsheet.length && xsheet[end + 1][layer].drawing === canvas) end++;
  return { canvas: canvas, start: start, end: end };
}

function collectExposureBlocksInSelection() {
  var b = getSelectionBounds();
  if (!b) return [];

  var blocksByKey = Object.create(null);

  for (var r = b.startRow; r <= b.endRow; r++) {
    for (var c = b.startLayer; c <= b.endLayer; c++) {
      var cell = xsheet[r][c];
      if (!cell.drawing) continue;
      var block = getExposureBlock(r, c);
      if (!block) continue;
      var key = c + ':' + block.start + ':' + block.end;
      if (!blocksByKey[key]) {
        blocksByKey[key] = {
          layer: c,
          start: block.start,
          end: block.end,
          canvas: block.canvas
        };
      }
    }
  }

  return Object.values(blocksByKey);
}

// Increase hold on ALL selected exposure blocks
function increaseHoldForSelection() {
  commitActiveSelection();
  var blocks = collectExposureBlocksInSelection();

  if (!blocks || blocks.length === 0) {
    // Fallback: behave like old single-cell version
    if (selectedRow < 0 || selectedLayer < 0) return;
    var block = getExposureBlock(selectedRow, selectedLayer);
    if (!block) {
      var baseCanvas = ensureCellDrawing(selectedRow, selectedLayer, false);
      block = { canvas: baseCanvas, start: selectedRow, end: selectedRow, layer: selectedLayer };
    }
    blocks = [{
      layer: selectedLayer,
      start: block.start,
      end: block.end,
      canvas: block.canvas
    }];
  }

  // Process from bottom up so row indices above aren't affected
  blocks.sort(function(a, b) {
    return b.end - a.end;
  });

  for (var i = 0; i < blocks.length; i++) {
    var blk = blocks[i];
    var insertIndex = blk.end + 1;

    var newRow = [];
    for (var c = 0; c < layerCount; c++) newRow.push({ drawing: null });

    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > xsheet.length) insertIndex = xsheet.length;
    xsheet.splice(insertIndex, 0, newRow);
    xsheet[insertIndex][blk.layer].drawing = blk.canvas;
  }

  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}

// Decrease hold on ALL selected exposure blocks
function decreaseHoldForSelection() {
  commitActiveSelection();
  var blocks = collectExposureBlocksInSelection();

  if (!blocks || blocks.length === 0) {
    if (selectedRow < 0 || selectedLayer < 0) return;
    var block = getExposureBlock(selectedRow, selectedLayer);
    if (!block) return;
    blocks = [{
      layer: selectedLayer,
      start: block.start,
      end: block.end,
      canvas: block.canvas
    }];
  }

  // Remove row at the END of each block, bottom-up
  blocks.sort(function(a, b) {
    return b.end - a.end;
  });

  for (var i = 0; i < blocks.length; i++) {
    var blk = blocks[i];
    var length = blk.end - blk.start + 1;
    if (length <= 1) continue; // don't remove the only frame

    var removeIndex = blk.end;
    if (removeIndex < 0 || removeIndex >= xsheet.length) continue;
    xsheet.splice(removeIndex, 1);
  }

  if (selectedRow >= xsheet.length) selectedRow = xsheet.length - 1;
  if (selectedRow < 0) selectedRow = 0;
  resetSelectionToCurrent();

  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}

function goToRow(i) {
  if (i < 0 || i >= xsheet.length) return;
  selectCell(i, selectedLayer, false);
}

// --- Cell clipboard & context menu -----------------------------------------

// Clipboard holds ImageData snapshots so paste creates independent copies
var cellClipboard = null; // { width, height, data: [][] of ImageData or null }

// Deep copy ImageData (defensive)
function cloneImageData(img) {
  if (!img) return null;
  var copy = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  return copy;
}

function copySelection() {
  var bounds = getSelectionBounds();
  if (!bounds) return;
  var w = bounds.endLayer - bounds.startLayer + 1;
  var h = bounds.endRow - bounds.startRow + 1;

  var data = [];
  for (var rr = 0; rr < h; rr++) {
    data[rr] = [];
    for (var cc = 0; cc < w; cc++) {
      var r = bounds.startRow + rr;
      var c = bounds.startLayer + cc;
      var img = captureCellImage(r, c); // ImageData or null
      data[rr][cc] = img ? cloneImageData(img) : null;
    }
  }
  cellClipboard = { width: w, height: h, data: data };
}

function cutSelection() {
  var bounds = getSelectionBounds();
  if (!bounds) return;
  var w = bounds.endLayer - bounds.startLayer + 1;
  var h = bounds.endRow - bounds.startRow + 1;

  var data = [];
  var cellsHistory = [];

  for (var rr = 0; rr < h; rr++) {
    data[rr] = [];
    for (var cc = 0; cc < w; cc++) {
      var r = bounds.startRow + rr;
      var c = bounds.startLayer + cc;
      var cell = xsheet[r][c];

      var before = captureCellImage(r, c);
      data[rr][cc] = before ? cloneImageData(before) : null;

      if (!cell) continue;

      // clear cell
      if (cell.drawing) {
        var clearCanvas = cell.drawing;
        var ctx = clearCanvas.getContext('2d');
        ctx.clearRect(0, 0, clearCanvas.width, clearCanvas.height);
      }
      cell.drawing = null;
      var after = captureCellImage(r, c); // null

      cellsHistory.push({
        row: r,
        layer: c,
        before: before,
        after: after
      });
    }
  }

  cellClipboard = { width: w, height: h, data: data };
  if (cellsHistory.length > 0 && typeof pushHistoryCellsChange === 'function') {
    pushHistoryCellsChange(cellsHistory, 'Cut selection');
  }

  refreshXsheetUI();
  redrawDisplay();
}

function pasteSelection() {
  if (!cellClipboard) return;
  if (selectedRow < 0 || selectedLayer < 0) return;

  var w = cellClipboard.width;
  var h = cellClipboard.height;
  var data = cellClipboard.data;

  var cellsHistory = [];

  for (var rr = 0; rr < h; rr++) {
    for (var cc = 0; cc < w; cc++) {
      var dr = selectedRow + rr;
      var dc = selectedLayer + cc;
      if (dr < 0 || dr >= xsheet.length) continue;
      if (dc < 0 || dc >= layerCount) continue;

      var img = data[rr][cc]; // ImageData or null
      var before = captureCellImage(dr, dc);

      var cell = xsheet[dr][dc];
      if (!cell) continue;

      if (img) {
        // ensure canvas, but don't auto-extend holds
        ensureCellDrawing(dr, dc, false);
        cell = xsheet[dr][dc];
        var canvas = cell.drawing;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(cloneImageData(img), 0, 0);
      } else {
        // paste empty → clear this cell
        if (cell.drawing) {
          var cCanvas = cell.drawing;
          var cCtx = cCanvas.getContext('2d');
          cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
        }
        cell.drawing = null;
      }

      var after = captureCellImage(dr, dc);
      if (before !== after) {
        cellsHistory.push({
          row: dr,
          layer: dc,
          before: before,
          after: after
        });
      }
    }
  }

  if (cellsHistory.length > 0 && typeof pushHistoryCellsChange === 'function') {
    pushHistoryCellsChange(cellsHistory, 'Paste selection');
  }

  refreshXsheetUI();
  redrawDisplay();
}

function copyCurrentCell() {
  if (selectedRow < 0 || selectedLayer < 0) return;
  var img = captureCellImage(selectedRow, selectedLayer);
  cellClipboard = {
    width: 1,
    height: 1,
    data: [[img ? cloneImageData(img) : null]]
  };
}

function cutCurrentCell() {
  if (selectedRow < 0 || selectedLayer < 0) return;
  var img = captureCellImage(selectedRow, selectedLayer);
  cellClipboard = {
    width: 1,
    height: 1,
    data: [[img ? cloneImageData(img) : null]]
  };

  var cell = xsheet[selectedRow][selectedLayer];
  if (!cell) return;

  var before = img;
  if (cell.drawing) {
    var c = cell.drawing;
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
  }
  cell.drawing = null;
  var after = captureCellImage(selectedRow, selectedLayer);

  pushHistoryCellChange(selectedRow, selectedLayer, before, after, 'Cut cell');

  refreshXsheetUI();
  redrawDisplay();
}

function pasteCurrentCell() {
  if (selectedRow < 0 || selectedLayer < 0) return;
  if (!cellClipboard) return;

  var img = cellClipboard.data &&
            cellClipboard.data[0] &&
            cellClipboard.data[0][0] || null;

  var before = captureCellImage(selectedRow, selectedLayer);
  var cell = xsheet[selectedRow][selectedLayer];
  if (!cell) return;

  if (img) {
    ensureCellDrawing(selectedRow, selectedLayer, false);
    cell = xsheet[selectedRow][selectedLayer];
    var canvas = cell.drawing;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(cloneImageData(img), 0, 0);
  } else {
    if (cell.drawing) {
      var c = cell.drawing;
      var cctx = c.getContext('2d');
      cctx.clearRect(0, 0, c.width, c.height);
    }
    cell.drawing = null;
  }

  var after = captureCellImage(selectedRow, selectedLayer);
  pushHistoryCellChange(selectedRow, selectedLayer, before, after, 'Paste cell');

  refreshXsheetUI();
  redrawDisplay();
}

function duplicateCurrentCellToNextRow() {
  if (selectedRow < 0 || selectedLayer < 0) return;
  var img = captureCellImage(selectedRow, selectedLayer);
  if (!img) return;

  var destRow = selectedRow + 1;
  if (destRow >= xsheet.length) {
    addRow();
  }

  var before = captureCellImage(destRow, selectedLayer);
  var cell = xsheet[destRow][selectedLayer];

  ensureCellDrawing(destRow, selectedLayer, false);
  cell = xsheet[destRow][selectedLayer];
  var canvas = cell.drawing;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(cloneImageData(img), 0, 0);

  var after = captureCellImage(destRow, selectedLayer);
  pushHistoryCellChange(destRow, selectedLayer, before, after, 'Duplicate cell');

  refreshXsheetUI();
  redrawDisplay();
}

function copySelectionOrCell() {
  if (hasMultiSelection()) copySelection();
  else copyCurrentCell();
}

function cutSelectionOrCell() {
  if (hasMultiSelection()) cutSelection();
  else cutCurrentCell();
}

function pasteSelectionOrCell() {
  if (cellClipboard && (cellClipboard.width > 1 || cellClipboard.height > 1)) {
    pasteSelection();
  } else {
    pasteCurrentCell();
  }
}

// --- Cell context menu ------------------------------------------------------

var cellContextMenu = null;

function initCellContextMenu() {
  cellContextMenu = document.getElementById('cellContextMenu');
  if (!cellContextMenu) return;

  cellContextMenu.addEventListener('click', function(ev) {
    var btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    hideCellContextMenu();
    if (action === 'cut') cutSelectionOrCell();
    else if (action === 'copy') copySelectionOrCell();
    else if (action === 'paste') pasteSelectionOrCell();
    else if (action === 'duplicate') duplicateCurrentCellToNextRow();
  });

  document.addEventListener('click', function(ev) {
    if (!cellContextMenu) return;
    if (ev.button !== 0) return;
    if (cellContextMenu.style.display === 'none') return;
    if (!cellContextMenu.contains(ev.target)) {
      hideCellContextMenu();
    }
  });

  window.addEventListener('blur', hideCellContextMenu);
}

function showCellContextMenu(x, y) {
  if (!cellContextMenu) return;
  cellContextMenu.style.display = 'block';
  cellContextMenu.style.left = x + 'px';
  cellContextMenu.style.top = y + 'px';
}

function hideCellContextMenu() {
  if (!cellContextMenu) return;
  cellContextMenu.style.display = 'none';
}

// Initialize context menu once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCellContextMenu);
} else {
  initCellContextMenu();
}

// --- Drag-move selection block ---------------------------------------------

function clearDragPreview() {
  dragPreviewStartRow = null;
  dragPreviewStartLayer = null;
}

function moveSelectionBlock(targetStartRow, targetStartLayer) {
  var bounds = getSelectionBounds();
  if (!bounds) return;

  var height = bounds.endRow - bounds.startRow + 1;
  var width = bounds.endLayer - bounds.startLayer + 1;

  if (targetStartRow === bounds.startRow && targetStartLayer === bounds.startLayer) {
    return;
  }

  if (targetStartRow < 0 ||
      targetStartRow + height > xsheet.length ||
      targetStartLayer < 0 ||
      targetStartLayer + width > layerCount) {
    return;
  }

  var cellKeys = {};
  function key(r, c) { return r + '_' + c; }

  for (var r = bounds.startRow; r <= bounds.endRow; r++) {
    for (var c = bounds.startLayer; c <= bounds.endLayer; c++) {
      cellKeys[key(r, c)] = { row: r, layer: c };
    }
  }
  for (var rr = 0; rr < height; rr++) {
    for (var cc = 0; cc < width; cc++) {
      var dr = targetStartRow + rr;
      var dc = targetStartLayer + cc;
      cellKeys[key(dr, dc)] = { row: dr, layer: dc };
    }
  }

  var beforeMap = {};
  Object.keys(cellKeys).forEach(function(k) {
    var info = cellKeys[k];
    beforeMap[k] = captureCellImage(info.row, info.layer);
  });

  var temp = [];
  for (var r2 = 0; r2 < height; r2++) {
    temp[r2] = [];
    for (var c2 = 0; c2 < width; c2++) {
      var sr = bounds.startRow + r2;
      var sl = bounds.startLayer + c2;
      temp[r2][c2] = xsheet[sr][sl].drawing || null;
    }
  }

  for (var r3 = bounds.startRow; r3 <= bounds.endRow; r3++) {
    for (var c3 = bounds.startLayer; c3 <= bounds.endLayer; c3++) {
      xsheet[r3][c3].drawing = null;
    }
  }

  for (var rr2 = 0; rr2 < height; rr2++) {
    for (var cc2 = 0; cc2 < width; cc2++) {
      var dr2 = targetStartRow + rr2;
      var dc2 = targetStartLayer + cc2;
      xsheet[dr2][dc2].drawing = temp[rr2][cc2];
    }
  }

  var cellsHistory = [];
  Object.keys(cellKeys).forEach(function(k) {
    var info = cellKeys[k];
    var beforeImg = beforeMap[k] || null;
    var afterImg = captureCellImage(info.row, info.layer);
    if (beforeImg !== afterImg) {
      cellsHistory.push({
        row: info.row,
        layer: info.layer,
        before: beforeImg,
        after: afterImg
      });
    }
  });

  if (cellsHistory.length > 0 && typeof pushHistoryCellsChange === 'function') {
    pushHistoryCellsChange(cellsHistory, 'Move selection');
  }

  selectionStartRow = targetStartRow;
  selectionStartLayer = targetStartLayer;
  selectionEndRow = targetStartRow + height - 1;
  selectionEndLayer = targetStartLayer + width - 1;
  selectedRow = selectionStartRow;
  selectedLayer = selectionStartLayer;

  clearDragPreview();
  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}

document.addEventListener('mousemove', function(ev) {
  if (dragOriginRow == null || dragOriginLayer == null) return;

  var dx = ev.clientX - dragStartClientX;
  var dy = ev.clientY - dragStartClientY;
  var distSq = dx * dx + dy * dy;

  if (!isDraggingXsheetSelection) {
    if (distSq < XSHEET_DRAG_THRESHOLD * XSHEET_DRAG_THRESHOLD) return;
    isDraggingXsheetSelection = true;
    suppressNextCellClick = true;
  }

  var el = document.elementFromPoint(ev.clientX, ev.clientY);
  if (!el) {
    dragCurrentTargetRow = null;
    dragCurrentTargetLayer = null;
    clearDragPreview();
    refreshXsheetUI();
    return;
  }
  var td = el.closest && el.closest('td.cell');
  if (!td) {
    dragCurrentTargetRow = null;
    dragCurrentTargetLayer = null;
    clearDragPreview();
    refreshXsheetUI();
    return;
  }

  var overRow = parseInt(td.getAttribute('data-row'), 10);
  var overLayer = parseInt(td.getAttribute('data-layer'), 10);

  var bounds = getSelectionBounds();
  if (!bounds) return;

  var anchorRowOffset = dragOriginRow - bounds.startRow;
  var anchorLayerOffset = dragOriginLayer - bounds.startLayer;

  var targetStartRow = overRow - anchorRowOffset;
  var targetStartLayer = overLayer - anchorLayerOffset;

  var height = bounds.endRow - bounds.startRow + 1;
  var width = bounds.endLayer - bounds.startLayer + 1;

  if (
    targetStartRow < 0 ||
    targetStartRow + height > xsheet.length ||
    targetStartLayer < 0 ||
    targetStartLayer + width > layerCount
  ) {
    dragCurrentTargetRow = null;
    dragCurrentTargetLayer = null;
    clearDragPreview();
    refreshXsheetUI();
    return;
  }

  dragCurrentTargetRow = targetStartRow;
  dragCurrentTargetLayer = targetStartLayer;
  dragPreviewStartRow = targetStartRow;
  dragPreviewStartLayer = targetStartLayer;
  refreshXsheetUI();
});

document.addEventListener('mouseup', function(ev) {
  if (dragOriginRow == null || dragOriginLayer == null) return;

  if (isDraggingXsheetSelection && dragCurrentTargetRow != null) {
    moveSelectionBlock(dragCurrentTargetRow, dragCurrentTargetLayer);
  }

  dragOriginRow = null;
  dragOriginLayer = null;
  dragCurrentTargetRow = null;
  dragCurrentTargetLayer = null;
  isDraggingXsheetSelection = false;
  clearDragPreview();
  refreshXsheetUI();
});

// --- Move selected layer (column) left/right -------------------------------

function moveSelectedLayer(offset) {
  commitActiveSelection();
  if (selectedLayer < 0 || selectedLayer >= layerCount) return;
  var target = selectedLayer + offset;
  if (target < 0 || target >= layerCount) return;

  for (var r = 0; r < xsheet.length; r++) {
    var row = xsheet[r];
    var tmp = row[selectedLayer];
    row[selectedLayer] = row[target];
    row[target] = tmp;
  }

  selectedLayer = target;
  resetSelectionToCurrent();
  refreshXsheetUI();
  updateInfos();
  redrawDisplay();
}
