from aqt import mw
from aqt.qt import QAction, QShortcut, QKeySequence, Qt
from aqt import gui_hooks
from aqt.utils import qconnect  
from .taskui import Taskbar

# Global instance to manage state
mw.taskbar_widget = None

def toggle_taskbar():
    print("Toggle Taskbar Triggered!")
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
        mw.taskbar_widget.web_view.page().runJavaScript("if(window.refreshData) window.refreshData();")

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
    qconnect(action.triggered, toggle_taskbar)
    mw.form.menuTools.addAction(action)
    
    # Global Shortcut for Reviewer support
    # Using a global shortcut on main window often bypasses context issues
    shortcut = QShortcut(QKeySequence("Alt+Q"), mw)
    shortcut.setContext(Qt.ShortcutContext.WindowShortcut) # Or ApplicationShortcut
    qconnect(shortcut.activated, toggle_taskbar)
    
    # Keep reference to avoid GC
    mw.taskbar_shortcut = shortcut

gui_hooks.main_window_did_init.append(init_taskbar_menu)
gui_hooks.profile_will_close.append(save_daily_snapshot_on_close)
