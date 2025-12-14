from aqt.qt import (
    QMainWindow,
    QVBoxLayout,
    QWidget,
    QUrl,
    QWebEngineView,
    QWebChannel,
    Qt,
    QMenu,
    QWebEngineSettings,
)
from pathlib import Path
from aqt import mw
from typing import Dict, Any

from .bridge import Bridge

# -----------------------------
# Utility: find web/index.html
# -----------------------------

def find_web_file(start_dir: Path, filename: str, max_up: int = 10) -> Path | None:
    current_path = start_dir.resolve()
    for _ in range(max_up + 1):
        candidate = current_path / "web" / filename
        if candidate.is_file():
            return candidate
        if current_path.parent == current_path:
            break
        current_path = current_path.parent
    return None


# -----------------------------
# Main Window
# -----------------------------

class Taskbar(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Taskbar")
        self.resize(1000, 700)

        addon_dir = Path(__file__).parent
        self.data_file = addon_dir / "selected_decks.json"
        
        # Initialize Bridge with data file path and parent
        self.bridge = Bridge(self.data_file, parent=self)
        
        self.channel = QWebChannel()
        self.channel.registerObject("py", self.bridge)

        self.web_view = QWebEngineView()
        self.web_view.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.web_view.customContextMenuRequested.connect(self.on_context_menu)
        
        # Explicitly enable JS and local access
        settings = self.web_view.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)

        html_path = find_web_file(addon_dir, "index.html")

        self.web_view.page().setWebChannel(self.channel)

        if html_path:
            self.web_view.load(QUrl.fromLocalFile(str(html_path)))
        else:
            self.web_view.setHtml("<h1>index.html not found</h1>")

        layout = QVBoxLayout()
        layout.addWidget(self.web_view)

        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

    def on_context_menu(self, pos):
        menu = QMenu()
        reload_action = menu.addAction("Reload")
        reload_action.triggered.connect(self.web_view.reload)

        inspect_action = menu.addAction("Inspect")
        inspect_action.triggered.connect(
            lambda: self.web_view.page().triggerAction(
                self.web_view.page().WebAction.InspectElement
            )
        )

        menu.exec(self.web_view.mapToGlobal(pos))
