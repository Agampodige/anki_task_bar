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

        # Floating, Frameless, Transparent
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setAttribute(Qt.WidgetAttribute.WA_NoSystemBackground)
        self.setAttribute(Qt.WidgetAttribute.WA_OpaquePaintEvent, False)
        
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

        # Dragging and Resizing state
        self._dragging = False
        self._resizing = False
        self._resize_edge = None
        self._drag_start_pos = QPoint()
        self._expanded = False
        self._normal_size = self.size()
        self._margin = 15 # Resize margin
        self._start_geometry = None

        self.setMouseTracking(True)
        self.web_view.setMouseTracking(True)
        self.web_view.installEventFilter(self)

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
            # Handle Mouse Movement for Cursor and Resizing
            if event.type() == QEvent.Type.MouseMove:
                # Map global position to window local coordinates
                pos = self.mapFromGlobal(event.globalPosition().toPoint())
                edge = self._get_edge(pos)
                self._update_cursor(edge)

                # Forward mouse move event for resizing/dragging
                if self._resizing or self._dragging:
                    self.mouseMoveEvent(event)
                    return True
                
            # Handle Mouse Press to start Resize/Drag
            elif event.type() == QEvent.Type.MouseButtonPress:
                # Get position in window coordinates
                pos = self.mapFromGlobal(event.globalPosition().toPoint())
                edge = self._get_edge(pos)
                
                # Only forward if we're on an edge (for resize) or if we're not on an edge (for drag)
                # We'll let mousePressEvent decide based on position
                self.mousePressEvent(event)
                return True
                    
            # Handle Mouse Release
            elif event.type() == QEvent.Type.MouseButtonRelease:
                if self._resizing or self._dragging:
                    self.mouseReleaseEvent(event)
                    return True
                    
        return super().eventFilter(obj, event)

    def _get_edge(self, pos: QPoint):
        """Determine which edge the mouse is over using bitwise flags."""
        rect = self.rect()
        x, y = pos.x(), pos.y()
        edge = Qt.Edge(0) # Initialize with no edge

        if x < self._margin:
            edge |= Qt.Edge.LeftEdge
        elif x > rect.width() - self._margin:
            edge |= Qt.Edge.RightEdge

        if y < self._margin:
            edge |= Qt.Edge.TopEdge
        elif y > rect.height() - self._margin:
            edge |= Qt.Edge.BottomEdge

        return edge if edge != Qt.Edge(0) else None


    def _update_cursor(self, edge):
        """ONE consolidated method for cursor updates."""
        if not edge:
            # Only reset to arrow if we aren't currently dragging/resizing
            if not self._resizing and not self._dragging:
                self.setCursor(Qt.CursorShape.ArrowCursor)
            return

        is_left = edge & Qt.Edge.LeftEdge
        is_right = edge & Qt.Edge.RightEdge
        is_top = edge & Qt.Edge.TopEdge
        is_bottom = edge & Qt.Edge.BottomEdge

        # Corner logic
        if (is_left and is_top) or (is_right and is_bottom):
            self.setCursor(Qt.CursorShape.SizeFDiagCursor)
        elif (is_right and is_top) or (is_left and is_bottom):
            self.setCursor(Qt.CursorShape.SizeBDiagCursor)
        # Side logic
        elif is_left or is_right:
            self.setCursor(Qt.CursorShape.SizeHorCursor)
        elif is_top or is_bottom:
            self.setCursor(Qt.CursorShape.SizeVerCursor)

    def paintEvent(self, event):
        pass

    def mousePressEvent(self, event: QMouseEvent):
        # Get position in window coordinates
        pos = self.mapFromGlobal(event.globalPosition().toPoint())
        edge = self._get_edge(pos)
        
        # Load settings from bridge
        movable = True
        resizable = True
        try:
            cfg = self.bridge._read_settings()
            movable = cfg.get("movable", True)
            resizable = cfg.get("resizable", True)
        except: 
            pass

        # 1. Handle Resizing
        if edge and resizable:
            # Use System Native Resize (smoother on Windows/Linux)
            if self.windowHandle() and hasattr(self.windowHandle(), "startSystemResize"):
                self.windowHandle().startSystemResize(edge)
            else:
                # Manual Resize Fallback
                self._resizing = True
                self._resize_edge = edge
                self._drag_start_pos = event.globalPosition().toPoint()
                self._start_geometry = self.geometry()
            event.accept()
            return

        # 2. Handle Dragging/Moving
        if event.button() == Qt.MouseButton.LeftButton and movable:
            # Use System Native Move
            if self.windowHandle() and hasattr(self.windowHandle(), "startSystemMove"):
                self.windowHandle().startSystemMove()
            else:
                # Manual Move Fallback
                self._dragging = True
                self._drag_start_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event: QMouseEvent):
        global_pos = event.globalPosition().toPoint()

        if self._resizing and self._start_geometry:
            rect = self._start_geometry
            diff = global_pos - self._drag_start_pos
            
            # Calculate new dimensions
            new_x, new_y, new_w, new_h = rect.getRect()
            
            if self._resize_edge & Qt.Edge.LeftEdge:
                new_x += diff.x()
                new_w -= diff.x()
            elif self._resize_edge & Qt.Edge.RightEdge:
                new_w += diff.x()
                
            if self._resize_edge & Qt.Edge.TopEdge:
                new_y += diff.y()
                new_h -= diff.y()
            elif self._resize_edge & Qt.Edge.BottomEdge:
                new_h += diff.y()
            
            # Apply Constraints (Min Width: 300, Min Height: 200)
            if new_w >= 300 and new_h >= 200:
                self.setGeometry(new_x, new_y, new_w, new_h)
            event.accept()

        elif self._dragging:
            self.move(global_pos - self._drag_start_pos)
            event.accept()

    def mouseReleaseEvent(self, event: QMouseEvent):
        self._dragging = False
        self._resizing = False
        self._resize_edge = None
        self._start_geometry = None

    def on_context_menu(self, pos):
        # Optional: Keep context menu logic if needed
        menu = QMenu()
        reload_action = menu.addAction("Reload")
        reload_action.triggered.connect(self.web_view.reload)
        # inspect_action = menu.addAction("Inspect") # Uncomment for debug
        # inspect_action.triggered.connect(lambda: self.web_view.page().triggerAction(self.web_view.page().WebAction.InspectElement))
        menu.exec(self.web_view.mapToGlobal(pos))