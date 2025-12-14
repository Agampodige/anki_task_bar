from aqt.qt import QMainWindow, QVBoxLayout, QWidget, QUrl, QWebEngineView, QWebChannel, pyqtSlot, QObject, Qt, QMenu
from pathlib import Path
from aqt import mw
import json
import traceback
from typing import List, Dict, Any


        
def find_web_file(start_dir: Path, filename: str, max_up: int = 10) -> Path | None:
    """
    Finds a file within the 'web' directory by searching up the directory tree.

    Starting from `start_dir`, it looks for a `web/<filename>` file.
    If not found, it traverses up `max_up` parent directories. This accommodates
    both development (addon folder is sibling to 'web') and production (addon
    folder contains 'web') layouts.
    """
    current_path = start_dir.resolve()
    # Loop through the current directory and its parents
    for _ in range(max_up + 1):
        candidate = current_path / "web" / filename
        if candidate.is_file():
            return candidate
        if current_path.parent == current_path:  # Reached the root
            break
        current_path = current_path.parent
    return None

def _build_deck_tree() -> Dict[str, Any]:
    """
    Fetches the deck hierarchy from Anki, including card counts, and builds a tree.

    The tree structure is a nested dictionary, where each node has 'name', 'id',
    'review', 'learn', 'new', and a 'children' list.
    """
    # deck_due_tree() returns a tree of tuples: (name, did, rev, lrn, new, children)
    root_node_tuple = mw.col.sched.deck_due_tree()

    def _convert_node(node) -> Dict[str, Any]:
        """Recursively converts the DeckTreeNode object tree to a dictionary-based one."""
        # In modern Anki versions, deck_due_tree returns DeckTreeNode objects, not tuples.
        # We access data via attributes like node.name, node.deck_id, etc.
        return {
            "name": node.name,
            "id": node.deck_id,
            "review": node.review_count,
            "learn": node.learn_count,
            "new": node.new_count,
            "children": [_convert_node(child) for child in node.children],
        }

    return _convert_node(root_node_tuple)

class Bridge(QObject):
    """A bridge to facilitate communication between Python and JavaScript."""
    def __init__(self, parent=None):
        super().__init__(parent)
        # Keep a reference to the main window if needed for callbacks
        self.window = parent

    @pyqtSlot(result='QVariant')
    def get_deck_tree(self):
        """
        Returns the entire deck tree as a JSON-like dictionary.
        This method is exposed to the JavaScript front-end.
        """
        if not mw.col:
            # Return an empty structure if the collection is not available
            return {"name": "Decks", "id": 0, "children": []}
        return _build_deck_tree()

class Taskbar(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Taskbar")
        self.resize(1000, 700)

        # Set up the Python-JS bridge
        self.bridge = Bridge(self) # Pass parent to bridge
        self.channel = QWebChannel()
        self.channel.registerObject("py", self.bridge)

        self.web_view = QWebEngineView()
        # Enable the web inspector via right-click context menu
        self.web_view.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.web_view.customContextMenuRequested.connect(self.on_context_menu)

        
        # Resolve symlinks to get the true source directory for development
        addon_package_dir = Path(__file__).parent
        html_path = find_web_file(addon_package_dir, "index.html")

        if html_path:
            self.web_view.page().setWebChannel(self.channel)
            self.web_view.page().loadFinished.connect(
                lambda ok: self.web_view.page().setWebChannel(self.channel))
            self.web_view.load(QUrl.fromLocalFile(str(html_path)))
        else:
            # Display a clear error message if the file is not found
            error_html = f"""
                <h1>Web UI Not Found</h1>
                <p>The add-on could not find <code>index.html</code>.</p>
                <p>Please ensure your <code>web</code> folder is located correctly relative to the add-on files.</p>
                <hr>
                <p><b>Search started from:</b> <code>{addon_package_dir}</code></p>
                <p>The add-on searches for a <code>web/index.html</code> file starting from the add-on's directory
                and moving up the parent directories.
                </p>
            """
            self.web_view.setHtml(error_html)

        layout = QVBoxLayout()
        layout.addWidget(self.web_view)

        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

    def on_context_menu(self, pos):
        """Create and show a custom context menu."""
        menu = QMenu()
        # Add a reload action
        reload_action = menu.addAction("Reload")
        reload_action.triggered.connect(self.web_view.reload)
        # Add an inspect action that opens the web inspector
        inspect_action = menu.addAction("Inspect")
        inspect_action.triggered.connect(lambda: self.web_view.page().triggerAction(self.web_view.page().WebAction.InspectElement))
        menu.exec(self.web_view.mapToGlobal(pos))