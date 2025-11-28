// brushes.js
// Brush library & UI palette with:
// - Texture brushes using external brushes_definitions.js
// - Scrollable palette
// - Right-click context menu (Rename / Duplicate / Delete)
// - Drag & drop PNG support
// - Safe fallback if definitions file not loaded

// If definitions file didn't load, fall back to empty list
if (typeof BRUSH_DEFINITIONS === 'undefined') {
    var BRUSH_DEFINITIONS = [];
}

var BrushLibrary = [];
var currentBrush = null;
var brushPaletteElement = null;
var brushContextMenuElement = null;

// -----------------------------------------------------
// INIT
// -----------------------------------------------------

function initBrushLibrary() {
    brushPaletteElement = document.getElementById('brushPalette');
    if (!brushPaletteElement) return;

    BrushLibrary = [];
    currentBrush = null;

    // Load from external file
    BRUSH_DEFINITIONS.forEach(function (def) {
        if (!def || !def.file) return;

        const img = new Image();
        img.onload = function () {
            const brush = {
                id: def.id,
                name: def.name,
                file: def.file,
                baseType: def.baseType || "soft",
                image: img,
                isTexture: true,
                isCustom: false,
                domElement: null,
            };

            BrushLibrary.push(brush);
            rebuildBrushPalette();

            // Select first brush automatically
            if (!currentBrush) {
                const idx = BrushLibrary.indexOf(brush);
                if (idx >= 0) selectBrush(idx);
            }
        };

        img.onerror = function () {
            console.warn("Failed to load brush:", def.file);
        };

        img.src = def.file;
    });

    setupBrushPaletteDnD();
    setupGlobalBrushContextMenuClose();
}

// -----------------------------------------------------
// BUILD PALETTE
// -----------------------------------------------------

function rebuildBrushPalette() {
    if (!brushPaletteElement) return;
    brushPaletteElement.innerHTML = "";

    BrushLibrary.forEach((brush, i) => {
        if (!brush || !brush.image) return;

        const item = document.createElement("div");
        item.className = "brush-item";
        item.dataset.index = i;

        const img = document.createElement("img");
        img.src = brush.image.src;
        img.alt = brush.name || "";
        item.title = brush.name || "";
        item.appendChild(img);

        // Left click: select
        item.addEventListener("click", (evt) => {
            evt.preventDefault();
            selectBrush(i);
        });

        // Right click: context menu
        item.addEventListener("contextmenu", (evt) => {
            evt.preventDefault();
            showBrushContextMenu(i, evt.clientX, evt.clientY);
        });

        brush.domElement = item;

        if (brush === currentBrush) item.classList.add("active");

        brushPaletteElement.appendChild(item);
    });
}

// -----------------------------------------------------
// SELECTION
// -----------------------------------------------------

function selectBrush(index) {
    if (index < 0 || index >= BrushLibrary.length) return;

    currentBrush = BrushLibrary[index];

    BrushLibrary.forEach((b, i) => {
        if (!b.domElement) return;
        b.domElement.classList.toggle("active", i === index);
    });

    // Sync with old engine
    const base = currentBrush.baseType || "soft";
    if (typeof brushType !== "undefined") brushType = base;
    if (typeof brushTypeSelect !== "undefined" && brushTypeSelect)
        brushTypeSelect.value = base;
}

function getCurrentBrush() {
    return currentBrush;
}

// -----------------------------------------------------
// CONTEXT MENU
// -----------------------------------------------------

function ensureBrushContextMenu() {
    if (brushContextMenuElement) return brushContextMenuElement;

    const menu = document.createElement("div");
    menu.className = "brush-context-menu";
    menu.style.display = "none";

    function makeButton(label, action) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.addEventListener("click", (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            const index = parseInt(menu.dataset.index, 10);
            hideBrushContextMenu();
            action(index);
        });
        return btn;
    }

    menu.appendChild(makeButton("Rename", renameBrushAt));
    menu.appendChild(makeButton("Duplicate", duplicateBrushAt));
    menu.appendChild(makeButton("Delete", deleteBrushAt));

    document.body.appendChild(menu);
    brushContextMenuElement = menu;

    return menu;
}

function showBrushContextMenu(index, x, y) {
    const menu = ensureBrushContextMenu();
    menu.dataset.index = index;
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.style.display = "block";
}

function hideBrushContextMenu() {
    if (brushContextMenuElement) brushContextMenuElement.style.display = "none";
}

function setupGlobalBrushContextMenuClose() {
    document.addEventListener("click", hideBrushContextMenu);
    window.addEventListener("blur", hideBrushContextMenu);
}

// -----------------------------------------------------
// CONTEXT MENU ACTIONS
// -----------------------------------------------------

function renameBrushAt(index) {
    if (index < 0 || index >= BrushLibrary.length) return;

    const brush = BrushLibrary[index];
    const newName = window.prompt("Rename brush:", brush.name || "");
    if (!newName) return;

    brush.name = newName;
    rebuildBrushPalette();
}

function duplicateBrushAt(index) {
    if (index < 0 || index >= BrushLibrary.length) return;

    const src = BrushLibrary[index];
    const dup = {
        id: src.id + "_copy_" + Date.now(),
        name: (src.name || "Brush") + " Copy",
        file: src.file,
        baseType: src.baseType,
        image: src.image,
        isTexture: true,
        isCustom: true,
        domElement: null,
    };

    BrushLibrary.splice(index + 1, 0, dup);
    rebuildBrushPalette();
    selectBrush(index + 1);
}

function deleteBrushAt(index) {
    if (index < 0 || index >= BrushLibrary.length) return;
    if (BrushLibrary.length <= 1) return;

    const deleted = BrushLibrary[index];
    BrushLibrary.splice(index, 1);

    rebuildBrushPalette();

    // Fix selection
    if (currentBrush === deleted) selectBrush(0);
}

// -----------------------------------------------------
// DRAG & DROP (CUSTOM PNG BRUSHES)
// -----------------------------------------------------

function setupBrushPaletteDnD() {
    if (!brushPaletteElement) return;

    brushPaletteElement.addEventListener("dragover", (evt) => {
        evt.preventDefault();
        brushPaletteElement.classList.add("drag-over");
    });

    brushPaletteElement.addEventListener("dragleave", (evt) => {
        evt.preventDefault();
        brushPaletteElement.classList.remove("drag-over");
    });

    brushPaletteElement.addEventListener("drop", (evt) => {
        evt.preventDefault();
        brushPaletteElement.classList.remove("drag-over");

        const files = evt.dataTransfer?.files || [];
        for (let f of files) {
            if (f.type === "image/png" || f.name.toLowerCase().endsWith(".png"))
                addCustomBrushFromFile(f);
        }
    });
}

function addCustomBrushFromFile(file) {
    const reader = new FileReader();

    reader.onload = function (evt) {
        const img = new Image();

        img.onload = function () {
            const brush = {
                id: "custom_" + Date.now(),
                name: file.name.replace(/\.png$/i, ""),
                file: null,
                baseType: "soft",
                image: img,
                isTexture: true,
                isCustom: true,
                domElement: null,
            };

            BrushLibrary.push(brush);
            rebuildBrushPalette();

            const idx = BrushLibrary.indexOf(brush);
            if (idx >= 0) selectBrush(idx);
        };

        img.src = evt.target.result;
    };

    reader.readAsDataURL(file);
}
