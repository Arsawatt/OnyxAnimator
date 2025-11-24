// brushes.js
// Texture brush library & palette for Onyx Animator.
//
// - Uses BRUSH_DEFINITIONS from brushes_definitions.js
// - Builds a scrollable palette in #brushPalette
// - Exposes getCurrentBrush() used by tools.js / stampBrush()
// - Keeps brushType / brushTypeSelect in sync with brush.baseType
// - Safe if definitions or DOM elements are missing

// Fallback if definitions file failed to load for some reason.
if (typeof BRUSH_DEFINITIONS === "undefined") {
  var BRUSH_DEFINITIONS = [];
}

var BrushLibrary = [];
var currentBrush = null;
var brushPaletteElement = null;

/**
 * Initialize the brush library and build the palette UI.
 * Called from main.js once the DOM is ready.
 */
function initBrushLibrary() {
  brushPaletteElement = document.getElementById("brushPalette");
  if (!brushPaletteElement) {
    // No palette in DOM – nothing else to do.
    return;
  }

  // Build BrushLibrary from BRUSH_DEFINITIONS
  BrushLibrary = [];
  for (var i = 0; i < BRUSH_DEFINITIONS.length; i++) {
    var def = BRUSH_DEFINITIONS[i];
    if (!def || !def.file) continue;

    var brush = {
      id: def.id || ("brush_" + i),
      name: def.name || def.id || ("Brush " + (i + 1)),
      file: def.file,
      baseType: def.baseType || "soft",
      image: null,
      isTexture: true
    };

    // Preload the image so stampBrush() can use its alpha.
    var img = new Image();
    img.src = brush.file;
    brush.image = img;

    BrushLibrary.push(brush);
  }

  // If no brushes defined, just clear palette and bail.
  if (!BrushLibrary.length) {
    brushPaletteElement.innerHTML = "";
    currentBrush = null;
    return;
  }

  // Default selection = first brush.
  currentBrush = BrushLibrary[0];

  rebuildBrushPalette();
  applyBrushSelectionToUI();
}

/**
 * Rebuild the palette DOM from BrushLibrary.
 */
function rebuildBrushPalette() {
  if (!brushPaletteElement) {
    brushPaletteElement = document.getElementById("brushPalette");
  }
  if (!brushPaletteElement) return;

  // Clear existing items
  while (brushPaletteElement.firstChild) {
    brushPaletteElement.removeChild(brushPaletteElement.firstChild);
  }

  for (var i = 0; i < BrushLibrary.length; i++) {
    (function(index) {
      var brush = BrushLibrary[index];
      var item = document.createElement("button");
      item.type = "button";
      item.className = "brush-item";
      item.title = brush.name;
      item.dataset.index = index.toString();

      // Simple visual: use the PNG as background if available
      item.style.backgroundImage = "url('" + brush.file + "')";
      item.style.backgroundSize = "cover";
      item.style.backgroundPosition = "center center";

      if (currentBrush === brush) {
        item.classList.add("selected");
      }

      item.addEventListener("click", function () {
        selectBrush(index);
      });

      brushPaletteElement.appendChild(item);
    })(i);
  }

  // Optional: simple drag & drop support for extra PNG brushes.
  enableBrushPaletteDragAndDrop();
}

/**
 * Select brush by index.
 */
function selectBrush(index) {
  if (index < 0 || index >= BrushLibrary.length) return;
  currentBrush = BrushLibrary[index];

  // Update palette visual selection
  if (brushPaletteElement) {
    var items = brushPaletteElement.querySelectorAll(".brush-item");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("selected", i === index);
    }
  }

  // Sync underlying baseType with brushTypeSelect if present
  applyBrushSelectionToUI();
}

/**
 * Sync selected brush with the existing base brush UI
 * (soft / hard / pencil) so spacing & hardness behaviour stay consistent.
 */
function applyBrushSelectionToUI() {
  if (!currentBrush) return;

  // brushTypeSelect & brushType are defined in properties.js + main.js
  if (typeof brushTypeSelect !== "undefined" && brushTypeSelect) {
    var base = currentBrush.baseType || "soft";

    // Check if such an option exists before assigning
    var found = false;
    for (var i = 0; i < brushTypeSelect.options.length; i++) {
      if (brushTypeSelect.options[i].value === base) {
        found = true;
        break;
      }
    }

    if (found) {
      brushTypeSelect.value = base;
      // Also update the global variable used by tools.js
      if (typeof brushType !== "undefined") {
        brushType = base;
      }
    }
  }
}

/**
 * Exposed helper used by tools.js / stampBrush().
 */
function getCurrentBrush() {
  return currentBrush;
}

/**
 * Basic drag & drop: allow dropping PNGs into the palette to create
 * temporary session brushes. This is optional sugar – if it fails,
 * nothing critical breaks.
 */
function enableBrushPaletteDragAndDrop() {
  if (!brushPaletteElement) return;

  // Only init once
  if (brushPaletteElement._brushDnDInitialized) return;
  brushPaletteElement._brushDnDInitialized = true;

  brushPaletteElement.addEventListener("dragover", function (e) {
    e.preventDefault();
    brushPaletteElement.classList.add("drag-over");
  });

  brushPaletteElement.addEventListener("dragleave", function (e) {
    e.preventDefault();
    brushPaletteElement.classList.remove("drag-over");
  });

  brushPaletteElement.addEventListener("drop", function (e) {
    e.preventDefault();
    brushPaletteElement.classList.remove("drag-over");
    if (!e.dataTransfer || !e.dataTransfer.files) return;

    var files = e.dataTransfer.files;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!file.type || file.type.indexOf("image/") === -1) continue;
      addBrushFromFile(file);
    }
  });
}

/**
 * Create a new brush from a dropped PNG file (session-only).
 */
function addBrushFromFile(file) {
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function (evt) {
    var img = new Image();
    img.onload = function () {
      var brush = {
        id: file.name,
        name: file.name.replace(/\.[^.]+$/, ""),
        file: evt.target.result, // data URL
        baseType: "soft",
        image: img,
        isTexture: true
      };

      BrushLibrary.push(brush);
      rebuildBrushPalette();

      // Auto-select the newly added brush
      var idx = BrushLibrary.length - 1;
      selectBrush(idx);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}
