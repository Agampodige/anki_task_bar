from aqt import mw
from aqt.qt import QAction
from aqt import gui_hooks
from aqt.utils import qconnect  
from .taskui import Taskbar




def open_taskbar():
    mw.taskbar = Taskbar()
    mw.taskbar.show()

def init_taskbar_menu():
    mw.form.menuTools.addSeparator()
    action = QAction("Open Taskbar", mw)
    qconnect(action.triggered, open_taskbar)
    mw.form.menuTools.addAction(action)

gui_hooks.main_window_did_init.append(init_taskbar_menu)
