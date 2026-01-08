# Hot Reload Feature

This document explains the hot reload functionality added to the Anki Taskbar addon for development purposes.

## Overview

The hot reload feature automatically refreshes the web interface when files are modified during development, making it easier to iterate on UI changes quickly.

## How It Works

### Python Backend (hot_reload.py)
- **HotReloadManager**: Monitors the `web/` directory for file changes
- **File Watching**: Checks file modification times every 500ms
- **Supported Files**: `.html`, `.js`, `.css`, `.json`
- **Signal System**: Emits signals when files change

### Bridge Integration (bridge.py)
- **Auto-detection**: Enables automatically in development mode
- **Manual Control**: Provides `enable_hot_reload()` and `disable_hot_reload()` methods
- **Page Reloading**: Detects current page and reloads appropriately

### JavaScript Frontend (hot-reload.js)
- **Development Detection**: Automatically detects development environment
- **Visual Indicator**: Shows a 🔥 indicator when hot reload is active
- **Keyboard Shortcuts**: `Ctrl+Shift+H` to toggle hot reload
- **Console API**: `hotReload.enable()`, `hotReload.disable()`, `hotReload.toggle()`

## Usage

### Automatic Activation
Hot reload automatically enables when:
- Anki is in debug mode (`mw.isDev`)
- Environment variable `ANKI_TASKBAR_DEV` is set

### Manual Control
```javascript
// Enable hot reload
window.py.enable_hot_reload();

// Disable hot reload  
window.py.disable_hot_reload();

// Toggle hot reload
window.hotReload.toggle();

// Force reload
window.hotReload.reload();
```

### Keyboard Shortcuts
- `Ctrl+Shift+H`: Toggle hot reload on/off

## File Structure

```
web/
├── hot-reload.js          # Hot reload utility
├── index.html             # Main page (includes hot-reload.js)
├── sessions.html          # Sessions page (includes hot-reload.js)
├── setting.html           # Settings page (includes hot-reload.js)
└── select-deck.html       # Deck selection page (includes hot-reload.js)
```

## Development Mode Detection

Hot reload considers the following as development mode:
- `localhost` or `127.0.0.1` hostname
- `file://` protocol
- `window.ankiTaskBarSettings.development === true`

## Configuration

### Environment Variables
Set `ANKI_TASKBAR_DEV=1` to force development mode.

### Settings
You can add development mode detection in settings:
```javascript
window.ankiTaskBarSettings = {
    development: true
};
```

## Troubleshooting

### Hot Reload Not Working
1. Check if development mode is detected
2. Verify Python bridge is available
3. Check console for errors

### Performance Issues
- Hot reload checks files every 500ms
- Only monitors supported file types
- Automatically disables in production

### Manual Override
If auto-detection fails, you can manually enable:
```javascript
window.hotReload.enable();
```

## Implementation Details

### File Monitoring
The Python backend uses file modification times (`st_mtime`) to detect changes. This is more efficient than content hashing and works well for local development.

### Page Reloading
When a file change is detected:
1. Python backend determines current page from URL
2. Reloads the appropriate HTML file
3. JavaScript automatically refreshes the page

### Error Handling
- File system errors are logged but don't crash the application
- Network errors in fallback HTTP method are ignored
- Missing files are handled gracefully

## Security Considerations

- Hot reload only works in development mode
- No external network requests in production
- File monitoring is limited to the addon's web directory
- All file operations are read-only
