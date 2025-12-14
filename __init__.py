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

def init_taskbar_menu():
    # Tools Menu
    mw.form.menuTools.addSeparator()
    action = QAction("Open Taskbar Widget", mw)
    action.setShortcut(QKeySequence("Ctrl+1")) # Shortcut
    action.setShortcutContext(Qt.ShortcutContext.ApplicationShortcut)
    qconnect(action.triggered, toggle_taskbar)
    mw.form.menuTools.addAction(action)
    
    # Register action with main window to ensure it catches events
    mw.addAction(action)

gui_hooks.main_window_did_init.append(init_taskbar_menu)
