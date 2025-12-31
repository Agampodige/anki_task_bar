"""
Anki Taskbar - A modern task management interface for Anki

Version: 1.0.1
Author: Agampodige
License: MIT
"""

from aqt import mw
from aqt.qt import QAction, QShortcut, QKeySequence, Qt
from aqt import gui_hooks
from aqt.utils import qconnect
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEngineSettings

from .taskui import Taskbar
from .__version__ import __version__, get_version_info

# Global instance to manage state
mw.taskbar_widget = None
mw.taskbar_devtools = None

# Package metadata
__author__ = "Agampodige"
__license__ = "MIT"
__description__ = "A modern task management interface for Anki"
__url__ = "https://github.com/Agampodige/anki_task_bar"


import json
from pathlib import Path

def toggle_taskbar():
    print(f"Toggle Taskbar Triggered! (v{__version__})")
    
    if mw.taskbar_widget is None:
        mw.taskbar_widget = Taskbar()

        # Center on parent window
        mw_geom = mw.geometry()
        tb_geom = mw.taskbar_widget.frameGeometry()
        center_point = mw_geom.center()
        tb_geom.moveCenter(center_point)
        mw.taskbar_widget.move(tb_geom.topLeft())

    if mw.taskbar_widget.isVisible():
        mw.taskbar_widget.hide()
    else:
        mw.taskbar_widget.show()
        mw.taskbar_widget.activateWindow()

        # Soft refresh via JS to preserve scroll position
        mw.taskbar_widget.web_view.page().runJavaScript(
            "if(window.refreshData) window.refreshData();"
        )


def open_taskbar_devtools():
    """Open Chrome DevTools for Taskbar webview."""
    if not mw.taskbar_widget:
        print("Taskbar not initialized")
        return

    web = mw.taskbar_widget.web_view
    page = web.page()


    # Create DevTools window
    devtools = QWebEngineView(mw)
    page.setDevToolsPage(devtools.page())
    devtools.setWindowTitle("Taskbar DevTools")
    devtools.resize(1200, 800)
    devtools.show()

    # Prevent garbage collection crash
    mw.taskbar_devtools = devtools


def save_daily_snapshot_on_close():
    """Save daily snapshot when Anki profile is closing."""
    try:
        if mw.taskbar_widget and hasattr(mw.taskbar_widget, 'bridge'):
            print("Saving daily snapshot on profile close...")
            mw.taskbar_widget.bridge.save_daily_snapshot()
    except Exception as e:
        print(f"Error saving snapshot on close: {e}")


def init_taskbar_menu():
    # Tools Menu
    mw.form.menuTools.addSeparator()
    action = QAction("Open Taskbar Widget", mw)
    action.setShortcut("Alt+Q")
    qconnect(action.triggered, toggle_taskbar)
    mw.form.menuTools.addAction(action)

    # Toggle Taskbar shortcut (Alt+Q)
    toggle_shortcut = QShortcut(QKeySequence("Alt+Q"), mw)
    toggle_shortcut.setContext(Qt.ShortcutContext.ApplicationShortcut)
    qconnect(toggle_shortcut.activated, toggle_taskbar)
    mw.taskbar_shortcut = toggle_shortcut

    # DevTools shortcut (F12)
    inspect_shortcut = QShortcut(QKeySequence("F12"), mw)
    inspect_shortcut.setContext(Qt.ShortcutContext.ApplicationShortcut)
    qconnect(inspect_shortcut.activated, open_taskbar_devtools)
    mw.taskbar_inspect_shortcut = inspect_shortcut


gui_hooks.main_window_did_init.append(init_taskbar_menu)
gui_hooks.profile_will_close.append(save_daily_snapshot_on_close)
