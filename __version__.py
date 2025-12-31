"""
Version information for Anki Taskbar
"""

__version__ = "1.0.3"
__version_info__ = (1, 0, 3)

# Version history
VERSION_HISTORY = {
    "1.0.2": {
        "date": "2025-12-31",
        "changes": [
            "Added window size presets",
            "removed resizable setting from CSS",
            "remove resize logic from widget",
            "fix drag issue in setting page",
            "add drag fix to other ones"
        ]
    },
    "1.0.1": {
        "date": "2025-12-31",
        "changes": [
            "Added file-based logging system for debugging",
            "Enhanced mouse event tracking and logging",
            "Resolved CSS conflicts with Qt event handling"
        ]
    },
    "1.0.0": {
        "date": "2025-12-31", 
        "changes": [
            "Initial release",
            "Frameless window with drag/resize support",
            "Web-based UI with Qt integration",
            "Task management for Anki decks",
            "Theme system and customization options"
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
