# Color Deck Manager 

`ColorDeckManager.jsx` is a dockable ScriptUI panel for Adobe After Effects that helps you store, manage, and apply reusable color decks.

## Features

- Dockable panel (opens from the AE `Window` menu)
- Create and manage multiple colors in one deck
- Add, edit, and delete colors
- Optional color name per entry
- Shows color preview, HEX, and RGB values
- Save deck to local JSON file
- Load deck from local JSON file
- Apply selected deck color to compatible selected properties:
  - Fill Color
  - Stroke Color
  - Effect color properties
  - Text color via Source Text (`TextDocument`)
- Clear validation and alert messages for unsupported selections
- JSON fallback included for older ExtendScript engines without native `JSON.parse` / `JSON.stringify`

## Requirements

- Adobe After Effects with ExtendScript support
- ScriptUI Panels support (standard in AE)
- Preference enabled: `Allow Scripts to Write Files and Access Network`

## Installation

1. Copy `ColorDeckManager.jsx` to your After Effects ScriptUI Panels folder.

Windows:
`C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`

macOS:
`/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`

2. In After Effects, enable:
   - `Edit > Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network`
3. Restart After Effects.
4. Open the panel from:
   - `Window > Color Deck Manager`

## How to Use

1. Click **New Deck** to start a fresh deck.
2. Set the deck name.
3. Click **Add Color** to create color slots.
   - Use HEX input (`#RRGGBB`) or the color picker.
   - Optionally set a name.
4. Select a color from the list or swatch grid.
5. Click **Apply to Selected Property** to apply the color.
6. Click **Save Deck** to save your deck as a JSON file.
7. Click **Load Deck** to load an existing deck JSON file.

## Color Application Behavior

- If one or more properties are selected, the script attempts to apply to all compatible targets.
- Compatible property types:
  - `PropertyValueType.COLOR`
  - `PropertyValueType.TEXT_DOCUMENT` (text fill color)
- If no properties are selected, it tries selected text layers by targeting Source Text.
- If nothing compatible is found, you get a clear alert with guidance.

## Deck Storage

- Decks are saved as JSON files chosen by the user via save dialog.
- The script also uses a local user-data folder for default deck location:
  - `Folder.userData/AE_ColorDecks`

## Customize Quickly

You can edit these constants near the top of `ColorDeckManager.jsx`:

- `DEFAULT_DECK_NAME`
- `SWATCH_COLUMNS`
- `STORAGE_FOLDER_NAME`

You can also customize:

- UI labels and layout in `buildUI()`
- Save/load schema in `getSerializableDeck()` and `normalizeDeck()`
- Color compatibility logic in `ColorApplier.applyToProperty()`

## Troubleshooting

- Panel not visible in `Window` menu:
  - Confirm the `.jsx` file is in `Scripts/ScriptUI Panels` and restart AE.
- Save/load errors:
  - Make sure scripting file access is enabled in AE preferences.
- Apply does nothing:
  - Select a compatible color property (or text layer/Source Text) before applying.

## License

Use and modify freely for your own workflow.
