// MODIFIED: Added simple SV picker rendering + sync helpers
// colorwheel.js
function drawWheelMarker() {
  var ctx = colorWheelCtx;
  var r = currentSat * wheelRadius;
  var angle = (currentHue - 0.5) * 2 * Math.PI;
  var x = wheelCenterX + Math.cos(angle) * r;
  var y = wheelCenterY + Math.sin(angle) * r;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderColorWheel() {
  var img = colorWheelCtx.createImageData(colorWheelCanvas.width, colorWheelCanvas.height);
  var d = img.data;
  for (var y = 0; y < colorWheelCanvas.height; y++) {
    for (var x = 0; x < colorWheelCanvas.width; x++) {
      var dx = x - wheelCenterX;
      var dy = y - wheelCenterY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var idx = (y * colorWheelCanvas.width + x) * 4;
      if (dist > wheelRadius) {
        d[idx + 3] = 0;
        continue;
      }
      var sat = dist / wheelRadius;
      var angle = Math.atan2(dy, dx);
      var hue = angle / (2 * Math.PI) + 0.5;
      var rgb = hsvToRgb(hue, sat, currentVal);
      d[idx] = rgb.r;
      d[idx + 1] = rgb.g;
      d[idx + 2] = rgb.b;
      d[idx + 3] = 255;
    }
  }
  colorWheelCtx.putImageData(img, 0, 0);
  drawWheelMarker();
}

function updateBrushColorFromHSV() {
  var rgb = hsvToRgb(currentHue, currentSat, currentVal);
  colorPicker.value = rgbToHex(rgb.r, rgb.g, rgb.b);
}

function pickColorFromWheel(evt) {
  var rect = colorWheelCanvas.getBoundingClientRect();
  var x = (evt.clientX - rect.left) * (colorWheelCanvas.width / rect.width);
  var y = (evt.clientY - rect.top) * (colorWheelCanvas.height / rect.height);

  var dx = x - wheelCenterX;
  var dy = y - wheelCenterY;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > wheelRadius) return;

  currentSat = Math.min(1, dist / wheelRadius);
  var angle = Math.atan2(dy, dx);
  currentHue = angle / (2 * Math.PI) + 0.5;
  currentVal = parseFloat(valueRange.value) || 1;

  updateBrushColorFromHSV();
  renderColorWheel();
}


/* ==== Simple color picker: SV square + hue slider ==== */
function renderSimplePicker() {
  if (typeof simpleSVCtx === 'undefined' || !simpleSVCtx || !simpleSVCanvas) return;

  var canvas = simpleSVCanvas;
  var ctx = simpleSVCtx;
  var w = canvas.width;
  var h = canvas.height;

  var img = ctx.createImageData(w, h);
  var d = img.data;

  for (var y = 0; y < h; y++) {
    var v = 1 - (y / (h - 1)); // top bright, bottom dark
    for (var x = 0; x < w; x++) {
      var s = x / (w - 1);     // left grey, right saturated
      var rgb = hsvToRgb(currentHue, s, v);
      var idx = (y * w + x) * 4;
      d[idx]     = rgb.r;
      d[idx + 1] = rgb.g;
      d[idx + 2] = rgb.b;
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  // marker
  var mx = currentSat * (w - 1);
  var my = (1 - currentVal) * (h - 1);
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx, my, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#000000';
  ctx.beginPath();
  ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (typeof simpleHueRange !== 'undefined' && simpleHueRange) {
    simpleHueRange.value = currentHue.toFixed(2);
  }
}

function pickColorFromSimple(evt) {
  if (!simpleSVCanvas || !simpleSVCtx) return;
  var rect = simpleSVCanvas.getBoundingClientRect();
  var x = (evt.clientX - rect.left) * (simpleSVCanvas.width / rect.width);
  var y = (evt.clientY - rect.top) * (simpleSVCanvas.height / rect.height);

  x = Math.max(0, Math.min(simpleSVCanvas.width - 1, x));
  y = Math.max(0, Math.min(simpleSVCanvas.height - 1, y));

  currentSat = x / (simpleSVCanvas.width - 1);
  currentVal = 1 - (y / (simpleSVCanvas.height - 1));

  updateBrushColorFromHSV();
  renderSimplePicker();
}

/** Redraw whichever picker(s) we have */
function refreshColorPickers() {
  if (typeof renderColorWheel === 'function') renderColorWheel();
  if (typeof renderSimplePicker === 'function') renderSimplePicker();
}

