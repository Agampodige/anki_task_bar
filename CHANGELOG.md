# Changelog

All notable changes to Anki Taskbar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [v1.3.1] - 2026-01-30

### Added
- Comprehensive User Guide (`USER_GUIDE.md`)
- User Guide link integration in Settings page
- "Select Deck" features documentation
- Multi-language localization for User Guide link

### Changed
- Improved all language translations
- Updated manifest and addon packaging

### Removed
- Defunct `daily_stats.py` file

## [v1.3.0] - 2026-01-30

### Added
- Multi-language support (English, Sinhala, Spanish, French, German, Chinese, Japanese)
- Support Link (Buy me a coffee) to settings

### Fixed
- Improved Session page stability and performance
- Optimized frontend communications and bridge logic
- Fixed various UI and internationalization issues

## [v1.2.1] - 2026-01-30

### Removed
- 



## [v1.2.0] -2026-01-01

### Added
- Enhanced mouse event tracking with detailed coordinate logging
- System move and resize fallback detection
- drag option to main window title
- copy sessions as todolist to clipboard item to setting page
- Keyboard shortcuts for session page:
  - Ctrl+H: Go to home page
  - Ctrl+S: Go to sessions page
  - Escape: Go back to home page
  - Arrow keys: Navigate between sessions and folders
  - Enter/Space: Activate selected session
  - Tab: Switch between folders and sessions
  - Ctrl+N: Create new session
  - Ctrl+F: Add new folder
  - Delete: Delete selected session or folder 

### Fixed
- Window dragging functionality in title bar area
- Drag window not working
- setting window dropown meneu Ui fixed
- session page folder not selecting
- folder cannot delete


### Changed
- Improved event filtering for mouse press events

### Removed
- conflicting css and js with drag window.

## [1.0.0] - 2025-12-31

### Added
- Initial release of Anki Taskbar
- Frameless, transparent window with drag functionality
- Web-based UI with Qt integration
- Task management for Anki decks
- Window controls (minimize, expand, close)
- Resizable window edges
- Settings management (movable, resizable, always on top)
- Dark/light theme support
- Multiple accent color themes
- Search functionality
- Statistics display
- Session management
- Compact mode
- Progress tracking
- Context menu integration

### Features
- **Window Management**: Frameless window with native drag/resize support
- **Task Display**: Shows selected Anki decks with card counts and progress
- **Interactive UI**: Web-based interface with Qt backend integration
- **Customization**: Multiple themes and appearance options
- **Productivity Tools**: Search, statistics, and session tracking
- **Settings**: Configurable window behavior and visual preferences

### Technical
- Built with Qt/QWebEngine for cross-platform compatibility
- JavaScript-Python bridge for UI-backend communication
- CSS-based styling with theme system
- File-based configuration and data storage
