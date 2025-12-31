from aqt.qt import (
    QWidget,
    QVBoxLayout,
    QUrl,
    QWebEngineView,
    QWebChannel,
    Qt,
    QMenu,
    QWebEngineSettings,
    QMouseEvent,
    QPoint,
    QPalette,
    QEvent
)
from pathlib import Path
from aqt import mw
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
# Draggable Frameless Window
# -----------------------------

class Taskbar(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Taskbar")
        self.resize(500, 600) # Smaller default size for a widget

        # Floating, Frameless, Transparent, Resizable
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setAttribute(Qt.WidgetAttribute.WA_NoSystemBackground)
        self.setAttribute(Qt.WidgetAttribute.WA_OpaquePaintEvent, False)
        
        # Make window resizable
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowMaximizeButtonHint)
        
        # Ensure palette is transparent
        pal = self.palette()
        pal.setColor(QPalette.ColorRole.Base, Qt.GlobalColor.transparent)
        pal.setColor(QPalette.ColorRole.Window, Qt.GlobalColor.transparent)
        self.setPalette(pal)

        addon_dir = Path(__file__).parent
        self.data_file = addon_dir / "selected_decks.json"
        
        # Initialize Bridge
        self.bridge = Bridge(self.data_file, parent=self)
        
        self.channel = QWebChannel()
        self.channel.registerObject("py", self.bridge)

        self.web_view = QWebEngineView()
        # Aggressive transparency settings
        self.web_view.setStyleSheet("background: transparent; border: none;")
        self.web_view.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.web_view.page().setBackgroundColor(Qt.GlobalColor.transparent)
        
        # Transparent palette for web view
        wpal = self.web_view.palette()
        wpal.setColor(QPalette.ColorRole.Base, Qt.GlobalColor.transparent)
        wpal.setColor(QPalette.ColorRole.Window, Qt.GlobalColor.transparent)
        self.web_view.setPalette(wpal)
        
        self.web_view.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.web_view.customContextMenuRequested.connect(self.on_context_menu)

        # Settings
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
        layout.setContentsMargins(0, 0, 0, 0) # No margin, CSS handles it
        layout.addWidget(self.web_view)
        self.setLayout(layout)

        # Dragging state
        self._dragging = False
        self._drag_start_pos = QPoint()
        self._resizing = False
        self._resize_start_pos = QPoint()
        self._resize_start_geometry = self.geometry()
        self._expanded = False
        self._normal_size = self.size()
        
        # Load settings
        self.load_settings()

    def load_settings(self):
        """Load window settings from bridge."""
        try:
            cfg = self.bridge._read_settings()
            self.movable = cfg.get("movable", True)
        except:
            # Default settings
            self.movable = True

        # Enable mouse tracking for dragging
        self.setMouseTracking(True)
        self.web_view.setMouseTracking(True)

    def set_always_on_top(self, enabled: bool):
        """Update window flags to toggle always on top status."""
        flags = self.windowFlags()
        if enabled:
            flags |= Qt.WindowType.WindowStaysOnTopHint
        else:
            flags &= ~Qt.WindowType.WindowStaysOnTopHint
        
        # We must re-enable FramelessWindowHint and Tool as well since flag replacement can reset them
        flags |= Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool
        
        self.setWindowFlags(flags)
        self.show() # Necessary to make the window reappear with new flags

    def toggle_expand(self):
        """Toggle between normal and expanded size."""
        if not self._expanded:
            self._normal_size = self.size()
            self.resize(800, 800)
            self._expanded = True
        else:
            self.resize(self._normal_size)
            self._expanded = False


    # -----------------------------
    # Drag & Resize Handling
    # -----------------------------
    def eventFilter(self, obj, event):
        if obj == self.web_view:
            # Handle Mouse Press to start Drag
            if event.type() == QEvent.Type.MouseButtonPress:
                self.mousePressEvent(event)
                return True
                    
            # Handle Mouse Move for Resize
            elif event.type() == QEvent.Type.MouseMove:
                self.mouseMoveEvent(event)
                return True
                    
            # Handle Mouse Release
            elif event.type() == QEvent.Type.MouseButtonRelease:
                if self._dragging or self._resizing:
                    self.mouseReleaseEvent(event)
                    return True
                    
        return super().eventFilter(obj, event)

    def paintEvent(self, event):
        pass

    def mousePressEvent(self, event: QMouseEvent):
        # Load settings from bridge
        movable = self.movable
        try:
            cfg = self.bridge._read_settings()
            movable = cfg.get("movable", True)
            self.movable = movable
        except: 
            pass

        # Handle Dragging/Moving
        if event.button() == Qt.MouseButton.LeftButton and movable:
            # Use System Native Move
            if self.windowHandle() and hasattr(self.windowHandle(), "startSystemMove"):
                self.windowHandle().startSystemMove()
            else:
                # Manual Move Fallback
                self._dragging = True
                self._drag_start_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()
        
        # Handle Resizing
        elif event.button() == Qt.MouseButton.RightButton and movable:
            # Start resize operation
            self._resizing = True
            self._resize_start_pos = event.globalPosition().toPoint()
            self._resize_start_geometry = self.geometry()
            event.accept()

    def mouseMoveEvent(self, event: QMouseEvent):
        global_pos = event.globalPosition().toPoint()

        if self._dragging:
            self.move(global_pos - self._drag_start_pos)
            event.accept()
        elif self._resizing and self._resize_start_geometry:
            # Handle window resizing
            diff = global_pos - self._resize_start_pos
            new_geometry = self._resize_start_geometry
            
            # Calculate new geometry based on mouse movement
            if diff.x() != 0:
                new_width = new_geometry.width() + diff.x()
                if new_width >= 300:  # Minimum width constraint
                    new_geometry.setWidth(new_width)
            
            if diff.y() != 0:
                new_height = new_geometry.height() + diff.y()
                if new_height >= 200:  # Minimum height constraint
                    new_geometry.setHeight(new_height)
            
            self.setGeometry(new_geometry)
            event.accept()

    def mouseReleaseEvent(self, event: QMouseEvent):
        self._dragging = False
        self._resizing = False

    def on_context_menu(self, pos):
        # Optional: Keep context menu logic if needed
        menu = QMenu()
        reload_action = menu.addAction("Reload")
        reload_action.triggered.connect(self.web_view.reload)
        # inspect_action = menu.addAction("Inspect") # Uncomment for debug
        # inspect_action.triggered.connect(lambda: self.web_view.page().triggerAction(self.web_view.page().WebAction.InspectElement))
        menu.exec(self.web_view.mapToGlobal(pos))