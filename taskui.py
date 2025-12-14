from aqt.qt import QMainWindow, QVBoxLayout, QWidget, QUrl, QWebEngineView, QWebChannel, pyqtSlot, QObject, Qt, QMenu
from pathlib import Path
from aqt import mw
import json
import traceback
from typing import List, Dict, Any
import tempfile


        
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
        # file used to persist selected decks
        # resolve to an absolute path so writing works even when __file__ is relative
        self._data_file = Path(__file__).resolve().parent / "selected_decks.json"

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

    @pyqtSlot('QVariant', result='QVariant')
    def save_selected_decks(self, selected_ids):
        """Persist a list of selected deck ids to disk."""
        try:
            # ensure list of ints
            selected = [int(x) for x in selected_ids]
        except Exception:
            selected = list(selected_ids)

        data = {"selected_decks": selected}
        # Try a list of candidate locations and pick the first writable one
        candidates = []
        # 1) addon folder (next to this file)
        candidates.append(self._data_file)
        # 2) profile addons folder
        try:
            candidates.append(Path(mw.profilesFolder()) / "addons21" / "anki_task_bar" / "selected_decks.json")
        except Exception:
            pass
        # 3) user's home
        try:
            candidates.append(Path.home() / ".anki_task_bar_selected_decks.json")
        except Exception:
            pass
        # 4) temp directory
        try:
            candidates.append(Path(tempfile.gettempdir()) / "anki_task_bar_selected_decks.json")
        except Exception:
            pass

        errors = []
        for candidate in candidates:
            if not candidate:
                continue
            try:
                # ensure parent exists where possible
                try:
                    candidate.parent.mkdir(parents=True, exist_ok=True)
                except Exception:
                    pass
                candidate.write_text(json.dumps(data))
                # remember where we saved
                self._data_file = candidate
                return {"ok": True, "saved": selected, "path": str(candidate)}
            except Exception as e:
                errors.append({"path": str(candidate), "error": str(e)})
                traceback.print_exc()

        # if we get here, none succeeded
        return {"ok": False, "error": "could not write to candidate locations", "attempts": errors}

    @pyqtSlot(result='QVariant')
    def get_task_list_data(self):
        """Return the persisted selected decks and their details for the UI."""
        # load persisted selection
        selected = []

        # Try a set of candidate locations in order and use the first one that exists
        candidates = [self._data_file]
        try:
            candidates.append(Path(mw.profilesFolder()) / "addons21" / "anki_task_bar" / "selected_decks.json")
        except Exception:
            pass
        try:
            candidates.append(Path.home() / ".anki_task_bar_selected_decks.json")
        except Exception:
            pass
        try:
            candidates.append(Path(tempfile.gettempdir()) / "anki_task_bar_selected_decks.json")
        except Exception:
            pass

        for candidate in candidates:
            if candidate and candidate.is_file():
                try:
                    payload = json.loads(candidate.read_text())
                    selected = payload.get("selected_decks", [])
                    # keep track of which file we loaded from for debugging
                    self._last_loaded = str(candidate)
                    break
                except Exception:
                    traceback.print_exc()

        # Build a lookup of deck details from the live deck tree
        def _flatten(node, acc):
            acc[str(node["id"])] = {
                "name": node.get("name", ""),
                "new": node.get("new", 0),
                "learn": node.get("learn", 0),
                "review": node.get("review", 0),
            }
            for child in node.get("children", []):
                _flatten(child, acc)

        deck_tree = _build_deck_tree() if mw.col else {"name": "Decks", "id": 0, "children": []}
        details = {}
        _flatten(deck_tree, details)

        # filter selected to only include ones present in details
        filtered_selected = [int(d) for d in selected if str(d) in details]

        # compute missing ids for debugging
        missing = [d for d in selected if str(d) not in details]

        result = {
            "selected_decks": filtered_selected,
            "deck_details": details,
            "raw_selected": selected,
            "missing": missing,
            "loaded_from": getattr(self, '_last_loaded', None),
            "details_count": len(details),
        }

        return result

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