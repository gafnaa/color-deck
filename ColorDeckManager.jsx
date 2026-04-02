/*
Color Deck Manager - ScriptUI Panel for Adobe After Effects
------------------------------------------------------------
Features:
- Create/manage color decks (add, edit, delete colors)
- Save/load decks as local JSON files
- Apply selected deck color to selected color-compatible AE properties

Install this file in:
  Adobe After Effects/Scripts/ScriptUI Panels/
Then restart AE and open from Window menu.
*/
(function colorDeckManager(thisObj) {
    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------
    var SCRIPT_NAME = "Color Deck Manager";
    var DECK_VERSION = 1;
    var DEFAULT_DECK_NAME = "Untitled Deck";
    var SWATCH_COLUMNS = 8;
    var STORAGE_FOLDER_NAME = "AE_ColorDecks";

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    var state = {
        deck: createEmptyDeck(DEFAULT_DECK_NAME),
        selectedIndex: -1,
        currentFilePath: "",
        isDirty: false
    };

    var ui = {
        window: null,
        deckNameInput: null,

        newDeckBtn: null,
        saveDeckBtn: null,
        loadDeckBtn: null,

        colorList: null,
        swatchGrid: null,

        addColorBtn: null,
        editColorBtn: null,
        deleteColorBtn: null,
        applyBtn: null,

        previewBox: null,
        selectedNameText: null,
        selectedHexText: null,
        selectedRgbText: null,

        statusText: null
    };

    var suppressListEvent = false;

    // -------------------------------------------------------------------------
    // Basic utilities
    // -------------------------------------------------------------------------
    function trimString(value) {
        if (value === null || value === undefined) {
            return "";
        }
        return String(value).replace(/^\s+|\s+$/g, "");
    }

    function isArray(value) {
        return value !== null && value !== undefined && value.constructor === Array;
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
    }

    function clampInt(value, minValue, maxValue) {
        var n = Number(value);
        if (isNaN(n)) {
            n = minValue;
        }
        n = Math.round(n);
        if (n < minValue) {
            return minValue;
        }
        if (n > maxValue) {
            return maxValue;
        }
        return n;
    }

    function repeatString(chunk, count) {
        var out = "";
        var i;
        for (i = 0; i < count; i += 1) {
            out += chunk;
        }
        return out;
    }

    function escapeJSONString(str) {
        return String(str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t");
    }

    function sanitizeFileName(fileName) {
        var safe = trimString(fileName);
        if (safe === "") {
            safe = DEFAULT_DECK_NAME;
        }
        safe = safe.replace(/[\\\/:\*\?"<>\|]/g, "_");
        return safe;
    }

    function createEmptyDeck(name) {
        return {
            version: DECK_VERSION,
            deckName: trimString(name) === "" ? DEFAULT_DECK_NAME : trimString(name),
            colors: []
        };
    }

    function cloneColor(colorObj) {
        return {
            name: trimString(colorObj.name),
            r: clampInt(colorObj.r, 0, 255),
            g: clampInt(colorObj.g, 0, 255),
            b: clampInt(colorObj.b, 0, 255)
        };
    }

    function rgbToHex(r, g, b) {
        function one(v) {
            var s = clampInt(v, 0, 255).toString(16).toUpperCase();
            return s.length === 1 ? "0" + s : s;
        }
        return "#" + one(r) + one(g) + one(b);
    }

    function hexToRgb(hexValue) {
        var cleaned = trimString(hexValue).replace(/^#/, "");
        var valid = /^[0-9A-Fa-f]{6}$/;
        if (!valid.test(cleaned)) {
            return null;
        }
        return {
            r: parseInt(cleaned.substr(0, 2), 16),
            g: parseInt(cleaned.substr(2, 2), 16),
            b: parseInt(cleaned.substr(4, 2), 16)
        };
    }

    function colorToRGB01(colorObj) {
        return [
            clampInt(colorObj.r, 0, 255) / 255,
            clampInt(colorObj.g, 0, 255) / 255,
            clampInt(colorObj.b, 0, 255) / 255
        ];
    }

    function getSelectedColor() {
        if (state.selectedIndex < 0 || state.selectedIndex >= state.deck.colors.length) {
            return null;
        }
        return state.deck.colors[state.selectedIndex];
    }

    function buildColorLabel(colorObj) {
        var name = trimString(colorObj.name);
        if (name === "") {
            name = "(unnamed)";
        }
        return name;
    }

    function setStatus(message) {
        if (ui.statusText) {
            ui.statusText.text = message;
        }
    }

    function markDirty(flag) {
        state.isDirty = flag;
    }

    function confirmDiscardIfDirty(actionLabel) {
        if (!state.isDirty) {
            return true;
        }
        return confirm("You have unsaved changes.\n\n" + actionLabel + " and discard current changes?");
    }

    // -------------------------------------------------------------------------
    // JSON helper with fallback for older ExtendScript versions
    // -------------------------------------------------------------------------
    var JSONHelper = {
        hasNative: (typeof JSON !== "undefined" && JSON && JSON.stringify && JSON.parse),

        stringify: function (obj) {
            if (this.hasNative) {
                return JSON.stringify(obj, null, 2);
            }
            return fallbackStringify(obj, 0);
        },

        parse: function (jsonText) {
            if (this.hasNative) {
                return JSON.parse(jsonText);
            }
            return fallbackParse(jsonText);
        }
    };

    function fallbackStringify(value, depth) {
        var valueType = typeof value;
        var indent = repeatString("  ", depth);
        var nextIndent = repeatString("  ", depth + 1);
        var i;
        var items;
        var key;
        var hasOwn = Object.prototype.hasOwnProperty;

        if (value === null) {
            return "null";
        }

        if (valueType === "number") {
            return isFinite(value) ? String(value) : "null";
        }

        if (valueType === "boolean") {
            return value ? "true" : "false";
        }

        if (valueType === "string") {
            return "\"" + escapeJSONString(value) + "\"";
        }

        if (isArray(value)) {
            if (value.length === 0) {
                return "[]";
            }
            items = [];
            for (i = 0; i < value.length; i += 1) {
                items.push(nextIndent + fallbackStringify(value[i], depth + 1));
            }
            return "[\n" + items.join(",\n") + "\n" + indent + "]";
        }

        if (valueType === "object") {
            items = [];
            for (key in value) {
                if (hasOwn.call(value, key)) {
                    items.push(nextIndent + "\"" + escapeJSONString(key) + "\": " + fallbackStringify(value[key], depth + 1));
                }
            }
            if (items.length === 0) {
                return "{}";
            }
            return "{\n" + items.join(",\n") + "\n" + indent + "}";
        }

        return "null";
    }

    function fallbackParse(jsonText) {
        var safeText = trimString(jsonText);
        if (safeText === "") {
            throw new Error("Deck file is empty.");
        }
        // NOTE: Fallback for old ExtendScript engines without JSON.parse.
        // Parse only trusted/local files.
        return eval("(" + safeText + ")");
    }

    // -------------------------------------------------------------------------
    // Deck storage (file I/O)
    // -------------------------------------------------------------------------
    var DeckStorage = {
        folder: new Folder(Folder.userData.fsName + "/" + STORAGE_FOLDER_NAME),

        ensureFolder: function () {
            if (!this.folder.exists) {
                if (!this.folder.create()) {
                    throw new Error("Could not create storage folder:\n" + this.folder.fsName);
                }
            }
        },

        saveDeck: function (deckObj, fileObj) {
            var payload;
            var writableFile = fileObj;

            this.ensureFolder();

            if (!writableFile) {
                throw new Error("No file selected for saving.");
            }

            if (!/\.json$/i.test(writableFile.name)) {
                writableFile = new File(writableFile.fsName + ".json");
            }

            payload = JSONHelper.stringify(deckObj);
            writableFile.encoding = "UTF-8";

            if (!writableFile.open("w")) {
                throw new Error("Could not open file for writing:\n" + writableFile.fsName);
            }

            try {
                writableFile.write(payload);
            } finally {
                writableFile.close();
            }

            return writableFile;
        },

        loadDeck: function (fileObj) {
            var text = "";
            var parsed;
            var normalized;

            if (!fileObj || !fileObj.exists) {
                throw new Error("Selected file does not exist.");
            }

            fileObj.encoding = "UTF-8";
            if (!fileObj.open("r")) {
                throw new Error("Could not open file for reading:\n" + fileObj.fsName);
            }

            try {
                text = fileObj.read();
            } finally {
                fileObj.close();
            }

            parsed = JSONHelper.parse(text);
            normalized = normalizeDeck(parsed);
            return normalized;
        }
    };

    function normalizeColorEntry(raw) {
        var out = { name: "", r: 0, g: 0, b: 0 };
        var rgb = null;
        var r;
        var g;
        var b;

        if (typeof raw === "string") {
            rgb = hexToRgb(raw);
            if (!rgb) {
                return null;
            }
            out.r = rgb.r;
            out.g = rgb.g;
            out.b = rgb.b;
            return out;
        }

        if (!raw || typeof raw !== "object") {
            return null;
        }

        if (typeof raw.name === "string") {
            out.name = trimString(raw.name);
        } else if (typeof raw.label === "string") {
            out.name = trimString(raw.label);
        }

        if (typeof raw.hex === "string") {
            rgb = hexToRgb(raw.hex);
        }

        if (!rgb && isFiniteNumber(raw.r) && isFiniteNumber(raw.g) && isFiniteNumber(raw.b)) {
            r = Number(raw.r);
            g = Number(raw.g);
            b = Number(raw.b);

            // Supports files that store normalized 0..1 values.
            if (r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1) {
                r = r * 255;
                g = g * 255;
                b = b * 255;
            }

            rgb = {
                r: clampInt(r, 0, 255),
                g: clampInt(g, 0, 255),
                b: clampInt(b, 0, 255)
            };
        }

        if (!rgb) {
            return null;
        }

        out.r = rgb.r;
        out.g = rgb.g;
        out.b = rgb.b;

        return out;
    }

    function normalizeDeck(rawDeck) {
        var normalized = createEmptyDeck(DEFAULT_DECK_NAME);
        var list = null;
        var i;
        var parsedColor;

        if (!rawDeck || typeof rawDeck !== "object") {
            return normalized;
        }

        if (typeof rawDeck.deckName === "string" && trimString(rawDeck.deckName) !== "") {
            normalized.deckName = trimString(rawDeck.deckName);
        } else if (typeof rawDeck.name === "string" && trimString(rawDeck.name) !== "") {
            normalized.deckName = trimString(rawDeck.name);
        }

        if (isArray(rawDeck.colors)) {
            list = rawDeck.colors;
        } else if (isArray(rawDeck.palette)) {
            list = rawDeck.palette;
        }

        if (list) {
            for (i = 0; i < list.length; i += 1) {
                parsedColor = normalizeColorEntry(list[i]);
                if (parsedColor) {
                    normalized.colors.push(parsedColor);
                }
            }
        }

        normalized.version = DECK_VERSION;
        return normalized;
    }

    function getSerializableDeck() {
        var out = createEmptyDeck(state.deck.deckName);
        var i;
        for (i = 0; i < state.deck.colors.length; i += 1) {
            out.colors.push(cloneColor(state.deck.colors[i]));
        }
        return out;
    }

    // -------------------------------------------------------------------------
    // Color application logic (After Effects properties)
    // -------------------------------------------------------------------------
    var ColorApplier = {
        lastError: "",

        applySelectedColor: function (colorObj) {
            var project = app.project;
            var comp = project ? project.activeItem : null;
            var color01;
            var count = 0;
            var selectedProps;
            var selectedLayers;
            var i;

            this.lastError = "";

            if (!(comp && (comp instanceof CompItem))) {
                this.lastError = "No active composition.\nOpen a comp, select a compatible property, then try again.";
                return 0;
            }

            color01 = colorToRGB01(colorObj);
            selectedProps = comp.selectedProperties;

            app.beginUndoGroup("Apply Deck Color");
            try {
                if (selectedProps && selectedProps.length > 0) {
                    for (i = 0; i < selectedProps.length; i += 1) {
                        count += this.applyToTarget(selectedProps[i], color01, comp.time);
                    }
                } else {
                    // Fallback: if user selected text layer(s), apply to Source Text fill color.
                    selectedLayers = comp.selectedLayers;
                    if (selectedLayers && selectedLayers.length > 0) {
                        for (i = 0; i < selectedLayers.length; i += 1) {
                            if (this.applyToTextLayer(selectedLayers[i], color01, comp.time)) {
                                count += 1;
                            }
                        }
                    }
                }
            } catch (err) {
                this.lastError = "Could not apply color.\n" + err.toString();
            } finally {
                app.endUndoGroup();
            }

            return count;
        },

        applyToTarget: function (target, color01, compTime) {
            var count = 0;
            var numChildren;
            var i;

            if (!target) {
                return 0;
            }

            // If target behaves like a Property, try to apply directly.
            try {
                if (target.propertyValueType !== undefined) {
                    return this.applyToProperty(target, color01, compTime) ? 1 : 0;
                }
            } catch (ignore) {}

            // If target is a PropertyGroup, recurse.
            numChildren = 0;
            try {
                numChildren = target.numProperties;
            } catch (ignore2) {
                numChildren = 0;
            }

            if (numChildren > 0) {
                for (i = 1; i <= numChildren; i += 1) {
                    count += this.applyToTarget(target.property(i), color01, compTime);
                }
            }

            return count;
        },

        applyToProperty: function (prop, color01, compTime) {
            var valueType;
            try {
                valueType = prop.propertyValueType;
            } catch (err) {
                return false;
            }

            if (valueType === PropertyValueType.COLOR) {
                return this.setColorPropertyValue(prop, color01, compTime);
            }

            if (valueType === PropertyValueType.TEXT_DOCUMENT) {
                return this.setTextPropertyValue(prop, color01, compTime);
            }

            return false;
        },

        setColorPropertyValue: function (prop, color01, compTime) {
            var keyIndexes;
            var i;
            try {
                if (prop.numKeys && prop.numKeys > 0) {
                    keyIndexes = [];
                    try {
                        keyIndexes = prop.selectedKeys;
                    } catch (ignore) {
                        keyIndexes = [];
                    }

                    if (keyIndexes && keyIndexes.length > 0) {
                        for (i = 0; i < keyIndexes.length; i += 1) {
                            prop.setValueAtKey(keyIndexes[i], color01);
                        }
                    } else {
                        prop.setValueAtTime(compTime, color01);
                    }
                } else {
                    prop.setValue(color01);
                }
                return true;
            } catch (err) {
                return false;
            }
        },

        setTextPropertyValue: function (prop, color01, compTime) {
            var keyIndexes;
            var i;
            var textDoc;

            try {
                if (prop.numKeys && prop.numKeys > 0) {
                    keyIndexes = [];
                    try {
                        keyIndexes = prop.selectedKeys;
                    } catch (ignore) {
                        keyIndexes = [];
                    }

                    if (keyIndexes && keyIndexes.length > 0) {
                        for (i = 0; i < keyIndexes.length; i += 1) {
                            textDoc = prop.keyValue(keyIndexes[i]);
                            if (!(textDoc instanceof TextDocument)) {
                                return false;
                            }
                            textDoc.applyFill = true;
                            textDoc.fillColor = color01;
                            prop.setValueAtKey(keyIndexes[i], textDoc);
                        }
                    } else {
                        textDoc = prop.valueAtTime(compTime, false);
                        if (!(textDoc instanceof TextDocument)) {
                            return false;
                        }
                        textDoc.applyFill = true;
                        textDoc.fillColor = color01;
                        prop.setValueAtTime(compTime, textDoc);
                    }
                } else {
                    textDoc = prop.value;
                    if (!(textDoc instanceof TextDocument)) {
                        return false;
                    }
                    textDoc.applyFill = true;
                    textDoc.fillColor = color01;
                    prop.setValue(textDoc);
                }

                return true;
            } catch (err) {
                return false;
            }
        },

        applyToTextLayer: function (layer, color01, compTime) {
            var textGroup;
            var sourceText;
            try {
                textGroup = layer.property("ADBE Text Properties");
                if (!textGroup) {
                    return false;
                }

                sourceText = textGroup.property("ADBE Text Document");
                if (!sourceText) {
                    return false;
                }

                return this.setTextPropertyValue(sourceText, color01, compTime);
            } catch (err) {
                return false;
            }
        }
    };

    // -------------------------------------------------------------------------
    // UI creation and rendering
    // -------------------------------------------------------------------------
    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ? thisObj : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        var deckNameGroup;
        var deckButtonsGroup;
        var swatchPanel;
        var listPanel;
        var colorButtonsGroup;
        var selectedPanel;
        var selectedInfoGroup;

        if (!pal) {
            return null;
        }

        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 8;
        pal.margins = 10;

        deckNameGroup = pal.add("group");
        deckNameGroup.orientation = "row";
        deckNameGroup.alignChildren = ["left", "center"];
        deckNameGroup.add("statictext", undefined, "Deck Name:");
        ui.deckNameInput = deckNameGroup.add("edittext", undefined, state.deck.deckName);
        ui.deckNameInput.characters = 28;

        deckButtonsGroup = pal.add("group");
        deckButtonsGroup.orientation = "row";
        ui.newDeckBtn = deckButtonsGroup.add("button", undefined, "New Deck");
        ui.saveDeckBtn = deckButtonsGroup.add("button", undefined, "Save Deck");
        ui.loadDeckBtn = deckButtonsGroup.add("button", undefined, "Load Deck");

        swatchPanel = pal.add("panel", undefined, "Palette Preview");
        swatchPanel.orientation = "column";
        swatchPanel.alignChildren = ["left", "top"];
        swatchPanel.margins = 8;

        ui.swatchGrid = swatchPanel.add("group");
        ui.swatchGrid.orientation = "column";
        ui.swatchGrid.alignChildren = ["left", "top"];
        ui.swatchGrid.spacing = 4;

        listPanel = pal.add("panel", undefined, "Deck Colors");
        listPanel.orientation = "column";
        listPanel.alignChildren = ["fill", "fill"];
        listPanel.margins = 8;

        ui.colorList = listPanel.add("listbox", undefined, [], {
            numberOfColumns: 3,
            showHeaders: true,
            columnTitles: ["Name", "HEX", "RGB"],
            columnWidths: [140, 90, 130],
            multiselect: false
        });
        ui.colorList.preferredSize = [390, 180];
        ui.colorList.alignment = ["fill", "fill"];

        colorButtonsGroup = pal.add("group");
        colorButtonsGroup.orientation = "row";
        ui.addColorBtn = colorButtonsGroup.add("button", undefined, "Add Color");
        ui.editColorBtn = colorButtonsGroup.add("button", undefined, "Edit Color");
        ui.deleteColorBtn = colorButtonsGroup.add("button", undefined, "Delete Color");

        selectedPanel = pal.add("panel", undefined, "Selected Color");
        selectedPanel.orientation = "row";
        selectedPanel.alignChildren = ["left", "center"];
        selectedPanel.margins = 8;

        ui.previewBox = selectedPanel.add("panel");
        ui.previewBox.minimumSize = [54, 38];
        ui.previewBox.maximumSize = [54, 38];

        selectedInfoGroup = selectedPanel.add("group");
        selectedInfoGroup.orientation = "column";
        selectedInfoGroup.alignChildren = ["left", "top"];
        ui.selectedNameText = selectedInfoGroup.add("statictext", undefined, "Name: -");
        ui.selectedHexText = selectedInfoGroup.add("statictext", undefined, "HEX: -");
        ui.selectedRgbText = selectedInfoGroup.add("statictext", undefined, "RGB: -");

        ui.applyBtn = pal.add("button", undefined, "Apply to Selected Property");
        ui.applyBtn.alignment = ["fill", "top"];

        ui.statusText = pal.add("statictext", undefined, "Ready.");
        ui.statusText.characters = 70;

        ui.previewBox.onDraw = function () {
            drawSwatchControl(ui.previewBox, getSelectedColor(), true);
        };

        pal.onResizing = pal.onResize = function () {
            this.layout.resize();
        };

        ui.window = pal;
        return pal;
    }

    function drawSwatchControl(control, colorObj, highlight) {
        var g = control.graphics;
        var w = control.size[0];
        var h = control.size[1];
        var fillColor = [0.20, 0.20, 0.20, 1];
        var borderColor = [0.35, 0.35, 0.35, 1];
        var brush;
        var pen;

        if (colorObj) {
            fillColor = [
                clampInt(colorObj.r, 0, 255) / 255,
                clampInt(colorObj.g, 0, 255) / 255,
                clampInt(colorObj.b, 0, 255) / 255,
                1
            ];
        }

        if (highlight) {
            borderColor = [1, 1, 1, 1];
        }

        brush = g.newBrush(g.BrushType.SOLID_COLOR, fillColor);
        pen = g.newPen(g.PenType.SOLID_COLOR, borderColor, highlight ? 2 : 1);

        g.rectPath(0, 0, w, h);
        g.fillPath(brush);

        g.rectPath(0.5, 0.5, w - 1, h - 1);
        g.strokePath(pen);
    }

    function clearGroup(groupObj) {
        while (groupObj.children.length > 0) {
            groupObj.remove(groupObj.children[0]);
        }
    }

    function createSwatchDrawHandler(index) {
        return function () {
            var colorObj = state.deck.colors[index];
            var isSelected = (index === state.selectedIndex);
            drawSwatchControl(this, colorObj, isSelected);
        };
    }

    function refreshSwatchGrid() {
        var colors = state.deck.colors;
        var i;
        var rowGroup = null;
        var swatch;

        clearGroup(ui.swatchGrid);

        if (!colors || colors.length === 0) {
            ui.swatchGrid.add("statictext", undefined, "No colors yet. Use Add Color.");
            return;
        }

        for (i = 0; i < colors.length; i += 1) {
            if (i % SWATCH_COLUMNS === 0) {
                rowGroup = ui.swatchGrid.add("group");
                rowGroup.orientation = "row";
                rowGroup.spacing = 4;
            }

            swatch = rowGroup.add("panel");
            swatch.minimumSize = [22, 22];
            swatch.maximumSize = [22, 22];
            swatch.colorIndex = i;
            swatch.helpTip = buildColorLabel(colors[i]) + " | " + rgbToHex(colors[i].r, colors[i].g, colors[i].b);
            swatch.onDraw = createSwatchDrawHandler(i);

            swatch.addEventListener("mousedown", function () {
                setSelectedIndex(this.colorIndex);
            });
        }
    }

    function refreshColorList() {
        var i;
        var colorObj;
        var item;
        var nameLabel;

        suppressListEvent = true;
        ui.colorList.removeAll();

        for (i = 0; i < state.deck.colors.length; i += 1) {
            colorObj = state.deck.colors[i];
            nameLabel = buildColorLabel(colorObj);

            item = ui.colorList.add("item", nameLabel);
            item.subItems[0].text = rgbToHex(colorObj.r, colorObj.g, colorObj.b);
            item.subItems[1].text = colorObj.r + ", " + colorObj.g + ", " + colorObj.b;
        }

        if (state.selectedIndex >= 0 && state.selectedIndex < ui.colorList.items.length) {
            ui.colorList.items[state.selectedIndex].selected = true;
        } else {
            ui.colorList.selection = null;
        }

        suppressListEvent = false;
    }

    function updateSelectedInfo() {
        var colorObj = getSelectedColor();

        if (!colorObj) {
            ui.selectedNameText.text = "Name: -";
            ui.selectedHexText.text = "HEX: -";
            ui.selectedRgbText.text = "RGB: -";
        } else {
            ui.selectedNameText.text = "Name: " + buildColorLabel(colorObj);
            ui.selectedHexText.text = "HEX: " + rgbToHex(colorObj.r, colorObj.g, colorObj.b);
            ui.selectedRgbText.text = "RGB: " + colorObj.r + ", " + colorObj.g + ", " + colorObj.b;
        }

        if (ui.window && ui.window.update) {
            ui.window.update();
        }
    }

    function setSelectedIndex(index) {
        if (index < 0 || index >= state.deck.colors.length) {
            state.selectedIndex = -1;
        } else {
            state.selectedIndex = index;
        }

        if (ui.colorList) {
            suppressListEvent = true;
            if (state.selectedIndex >= 0 && state.selectedIndex < ui.colorList.items.length) {
                ui.colorList.items[state.selectedIndex].selected = true;
            } else {
                ui.colorList.selection = null;
            }
            suppressListEvent = false;
        }

        refreshSwatchGrid();
        updateSelectedInfo();

        if (ui.window) {
            ui.window.layout.layout(true);
        }
    }

    function refreshAllUI() {
        if (!ui.window) {
            return;
        }

        ui.deckNameInput.text = state.deck.deckName;
        refreshColorList();
        refreshSwatchGrid();
        updateSelectedInfo();
        ui.window.layout.layout(true);
    }

    // -------------------------------------------------------------------------
    // Dialog for Add/Edit color
    // -------------------------------------------------------------------------
    function showColorEditorDialog(initialColor) {
        var isEdit = !!initialColor;
        var working = initialColor ? cloneColor(initialColor) : { name: "", r: 255, g: 255, b: 255 };

        var dlg = new Window("dialog", isEdit ? "Edit Color" : "Add Color");
        var nameGroup;
        var hexGroup;
        var nameInput;
        var hexInput;
        var pickBtn;
        var rgbLabel;
        var preview;
        var buttonGroup;
        var okBtn;
        var cancelBtn;

        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 8;
        dlg.margins = 12;

        nameGroup = dlg.add("group");
        nameGroup.orientation = "row";
        nameGroup.add("statictext", undefined, "Name (optional):");
        nameInput = nameGroup.add("edittext", undefined, working.name);
        nameInput.characters = 24;

        hexGroup = dlg.add("group");
        hexGroup.orientation = "row";
        hexGroup.add("statictext", undefined, "HEX:");
        hexInput = hexGroup.add("edittext", undefined, rgbToHex(working.r, working.g, working.b));
        hexInput.characters = 10;
        pickBtn = hexGroup.add("button", undefined, "Pick...");

        rgbLabel = dlg.add("statictext", undefined, "RGB: " + working.r + ", " + working.g + ", " + working.b);

        preview = dlg.add("panel");
        preview.minimumSize = [200, 42];
        preview.maximumSize = [200, 42];
        preview.onDraw = function () {
            drawSwatchControl(preview, working, true);
        };

        buttonGroup = dlg.add("group");
        buttonGroup.orientation = "row";
        buttonGroup.alignment = ["right", "top"];
        okBtn = buttonGroup.add("button", undefined, "OK", { name: "ok" });
        cancelBtn = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });

        function updateFromHexInput(showAlertOnFail) {
            var rgb = hexToRgb(hexInput.text);
            if (!rgb) {
                if (showAlertOnFail) {
                    alert("Invalid HEX value.\nUse #RRGGBB (example: #FF8800).");
                }
                return false;
            }

            working.r = rgb.r;
            working.g = rgb.g;
            working.b = rgb.b;

            hexInput.text = rgbToHex(working.r, working.g, working.b);
            rgbLabel.text = "RGB: " + working.r + ", " + working.g + ", " + working.b;

            if (dlg.update) {
                dlg.update();
            }
            return true;
        }

        hexInput.onChange = function () {
            if (!updateFromHexInput(true)) {
                hexInput.text = rgbToHex(working.r, working.g, working.b);
            }
        };

        pickBtn.onClick = function () {
            var picked = $.colorPicker();
            if (picked === -1) {
                return;
            }

            working.r = (picked >> 16) & 255;
            working.g = (picked >> 8) & 255;
            working.b = picked & 255;

            hexInput.text = rgbToHex(working.r, working.g, working.b);
            rgbLabel.text = "RGB: " + working.r + ", " + working.g + ", " + working.b;

            if (dlg.update) {
                dlg.update();
            }
        };

        okBtn.onClick = function () {
            if (!updateFromHexInput(true)) {
                return;
            }

            working.name = trimString(nameInput.text);
            dlg.close(1);
        };

        cancelBtn.onClick = function () {
            dlg.close(0);
        };

        if (dlg.show() !== 1) {
            return null;
        }

        return working;
    }

    // -------------------------------------------------------------------------
    // Button actions
    // -------------------------------------------------------------------------
    function newDeckAction() {
        if (!confirmDiscardIfDirty("Create a new deck")) {
            return;
        }

        state.deck = createEmptyDeck(DEFAULT_DECK_NAME);
        state.selectedIndex = -1;
        state.currentFilePath = "";
        markDirty(false);

        refreshAllUI();
        setStatus("Created new deck.");
    }

    function saveDeckAction() {
        var deckName;
        var defaultFile;
        var selectedFile;
        var savedFile;

        try {
            DeckStorage.ensureFolder();

            deckName = trimString(ui.deckNameInput.text);
            if (deckName === "") {
                deckName = DEFAULT_DECK_NAME;
            }
            state.deck.deckName = deckName;
            ui.deckNameInput.text = deckName;

            defaultFile = new File(DeckStorage.folder.fsName + "/" + sanitizeFileName(deckName) + ".json");
            selectedFile = defaultFile.saveDlg("Save Color Deck", "JSON:*.json");

            if (!selectedFile) {
                setStatus("Save canceled.");
                return;
            }

            savedFile = DeckStorage.saveDeck(getSerializableDeck(), selectedFile);

            state.currentFilePath = savedFile.fsName;
            markDirty(false);
            setStatus("Deck saved: " + savedFile.name);
        } catch (err) {
            alert("Failed to save deck.\n" + err.toString());
        }
    }

    function loadDeckAction() {
        var selectedFile;
        var loaded;

        if (!confirmDiscardIfDirty("Load another deck")) {
            return;
        }

        try {
            DeckStorage.ensureFolder();

            selectedFile = File.openDialog("Load Color Deck", "JSON:*.json", false);

            if (!selectedFile) {
                setStatus("Load canceled.");
                return;
            }

            loaded = DeckStorage.loadDeck(selectedFile);
            state.deck = loaded;
            state.selectedIndex = loaded.colors.length > 0 ? 0 : -1;
            state.currentFilePath = selectedFile.fsName;
            markDirty(false);

            refreshAllUI();
            setStatus("Deck loaded: " + selectedFile.name);
        } catch (err) {
            alert("Failed to load deck.\n" + err.toString());
        }
    }

    function addColorAction() {
        var newColor = showColorEditorDialog(null);
        if (!newColor) {
            return;
        }

        state.deck.colors.push(newColor);
        state.selectedIndex = state.deck.colors.length - 1;
        markDirty(true);

        refreshAllUI();
        setStatus("Added color " + rgbToHex(newColor.r, newColor.g, newColor.b) + ".");
    }

    function editColorAction() {
        var selected = getSelectedColor();
        var updated;

        if (!selected) {
            alert("Select a color to edit.");
            return;
        }

        updated = showColorEditorDialog(selected);
        if (!updated) {
            return;
        }

        state.deck.colors[state.selectedIndex] = updated;
        markDirty(true);

        refreshAllUI();
        setStatus("Updated color.");
    }

    function deleteColorAction() {
        var selected = getSelectedColor();
        var removeLabel;

        if (!selected) {
            alert("Select a color to delete.");
            return;
        }

        removeLabel = buildColorLabel(selected) + " (" + rgbToHex(selected.r, selected.g, selected.b) + ")";
        if (!confirm("Delete selected color?\n\n" + removeLabel)) {
            return;
        }

        state.deck.colors.splice(state.selectedIndex, 1);

        if (state.selectedIndex >= state.deck.colors.length) {
            state.selectedIndex = state.deck.colors.length - 1;
        }

        markDirty(true);
        refreshAllUI();
        setStatus("Color deleted.");
    }

    function applyColorAction() {
        var selectedColor = getSelectedColor();
        var appliedCount;

        if (!selectedColor) {
            alert("Select a color first, then click Apply.");
            return;
        }

        appliedCount = ColorApplier.applySelectedColor(selectedColor);

        if (appliedCount > 0) {
            setStatus("Applied " + rgbToHex(selectedColor.r, selectedColor.g, selectedColor.b) + " to " + appliedCount + " target(s).");
            return;
        }

        if (ColorApplier.lastError !== "") {
            alert(ColorApplier.lastError);
        } else {
            alert(
                "No compatible target found.\n\n" +
                "Select one or more color properties (Fill Color, Stroke Color, Effect Color, etc.)\n" +
                "or select a text layer / Source Text property."
            );
        }
    }

    // -------------------------------------------------------------------------
    // Event wiring
    // -------------------------------------------------------------------------
    function wireUIEvents() {
        ui.deckNameInput.onChange = function () {
            var name = trimString(ui.deckNameInput.text);
            if (name === "") {
                name = DEFAULT_DECK_NAME;
            }
            state.deck.deckName = name;
            markDirty(true);
        };

        ui.newDeckBtn.onClick = newDeckAction;
        ui.saveDeckBtn.onClick = saveDeckAction;
        ui.loadDeckBtn.onClick = loadDeckAction;

        ui.addColorBtn.onClick = addColorAction;
        ui.editColorBtn.onClick = editColorAction;
        ui.deleteColorBtn.onClick = deleteColorAction;
        ui.applyBtn.onClick = applyColorAction;

        ui.colorList.onChange = function () {
            if (suppressListEvent) {
                return;
            }
            if (ui.colorList.selection) {
                setSelectedIndex(ui.colorList.selection.index);
            } else {
                setSelectedIndex(-1);
            }
        };

        // Quick edit shortcut.
        ui.colorList.onDoubleClick = function () {
            if (ui.colorList.selection) {
                setSelectedIndex(ui.colorList.selection.index);
                editColorAction();
            }
        };
    }

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    function init() {
        var panel = buildUI(thisObj);
        if (!panel) {
            return;
        }

        wireUIEvents();
        refreshAllUI();

        setStatus("Ready. Deck files are stored in: " + DeckStorage.folder.fsName);

        if (panel instanceof Window) {
            panel.center();
            panel.show();
        } else {
            panel.layout.layout(true);
        }
    }

    init();
})(this);
