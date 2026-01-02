"""
Version information for Anki Taskbar
"""

__version__ = "1.2.1"
__version_info__ = (1, 2, 1)

# Version history
VERSION_HISTORY = {
    "1.2.1": {
        "date": "2026-01-01",
        "changes": [
            "Added Random Session Arrangement feature",
            "Added Session shuffle Feature", 
            "Added Quick tour to introduce session page",
            "Added First-time automatic tour activation",
            "Fixed Small button light theme issue",
            "Fixed deck select status issue",
            "Fixed deck UI overlap issue"
        ]
    },
    "1.2.0": {
        "date": "2026-01-01",
        "changes": [
            "Enhanced mouse event tracking with detailed coordinate logging",
            "System move and resize fallback detection",
            "Drag option to main window title",
            "Copy sessions as todolist to clipboard item to setting page",
            "Keyboard shortcuts for session page",
            "Window dragging functionality in title bar area",
            "Drag window not working",
            "Setting window dropdown menu UI fixed",
            "Session page folder not selecting",
            "Folder cannot delete",
            "Improved event filtering for mouse press events"
        ]
    },
    "1.0.0": {
        "date": "2025-12-31", 
        "changes": [
            "Initial release of Anki Taskbar",
            "Frameless, transparent window with drag functionality",
            "Web-based UI with Qt integration",
            "Task management for Anki decks",
            "Window controls (minimize, expand, close)",
            "Resizable window edges",
            "Settings management (movable, resizable, always on top)",
            "Dark/light theme support",
            "Multiple accent color themes",
            "Search functionality",
            "Statistics display",
            "Session management",
            "Compact mode",
            "Progress tracking",
            "Context menu integration"
        ]
    }
}

def get_version():
    """Get the current version string"""
    return __version__

def get_version_info():
    """Get the current version as a tuple"""
    return __version_info__

def get_version_history():
    """Get the complete version history"""
    return VERSION_HISTORY
