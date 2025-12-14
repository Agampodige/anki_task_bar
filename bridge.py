from aqt.qt import QObject, pyqtSlot
from aqt import mw
import json
import traceback
from pathlib import Path
from typing import Dict, Any, List

# -----------------------------
# Logic Helpers (Private)
# -----------------------------

def _build_deck_tree_helper() -> Dict[str, Any]:
    # Using Anki's scheduler to get the full tree with counts
    root = mw.col.sched.deck_due_tree()

    def convert(node):
        return {
            "name": node.name,
            "id": node.deck_id,
            "review": node.review_count,
            "learn": node.learn_count,
            "new": node.new_count,
            "children": [convert(c) for c in node.children],
        }

    return convert(root)

def _get_deck_counts_map() -> Dict[int, int]:
    """
    Returns a dictionary mapping Deck ID -> Total Due (New + Learn + Review).
    Traverses the full tree to ensure we get accurate counts that respect limits.
    """
    root = mw.col.sched.deck_due_tree()
    counts = {}

    def traverse(node):
        # Sum of all types of work
        total = node.review_count + node.learn_count + node.new_count
        counts[node.deck_id] = total
        for child in node.children:
            traverse(child)

    traverse(root)
    return counts

def _is_new_anki_day() -> bool:
    return mw.col.conf.get("anki_task_bar_day") != mw.col.sched.today

def _ensure_today_snapshot(selected_dids: List[int], current_counts: Dict[int, int]) -> Dict[str, int]:
    # If it's a new day, update the snapshot
    if _is_new_anki_day():
        snapshot = {}
        for did in selected_dids:
            snapshot[str(did)] = current_counts.get(did, 0)

        mw.col.conf["anki_task_bar_day"] = mw.col.sched.today
        mw.col.conf["anki_task_bar_snapshot"] = snapshot
        mw.col.setMod() # Mark collection as modified to save config

    return mw.col.conf.get("anki_task_bar_snapshot", {})

def _load_selected_decks(data_file: Path) -> List[int]:
    if not data_file.exists():
        return []

    try:
        data = json.loads(data_file.read_text(encoding="utf-8"))
        return [int(d) for d in data.get("selected_decks", [])]
    except Exception:
        traceback.print_exc()
        return []

def _build_taskbar_tasks_helper(data_file: Path) -> List[dict]:
    selected = _load_selected_decks(data_file)
    
    # improved efficiency: get all counts in one pass
    current_counts = _get_deck_counts_map()
    
    snapshot = _ensure_today_snapshot(selected, current_counts)
    
    # Make a mutable copy if needed, or modify directly. 
    # Since we might update it, let's track if we need to save.
    snapshot_updated = False
    tasks = []

    for did in selected:
        name = mw.col.decks.name(did)
        due_now = current_counts.get(did, 0)
        
        stored_start = snapshot.get(str(did), 0)
        
        # If user added cards (Custom Study) or modified limits, 
        # actual due might exceed our morning snapshot.
        # We track the "peak" due as the start point.
        if due_now > stored_start:
            due_start = due_now
            snapshot[str(did)] = due_now
            snapshot_updated = True
        else:
            due_start = stored_start

        done = max(due_start - due_now, 0)
        
        # Avoid division by zero
        progress = 1.0 if due_start == 0 else round(done / due_start, 3)

        tasks.append(
            {
                "deckId": did,
                "name": name,
                "dueStart": due_start,
                "dueNow": due_now,
                "done": done,
                "progress": progress,
                "completed": due_now == 0,
            }
        )
        
    if snapshot_updated:
        mw.col.conf["anki_task_bar_snapshot"] = snapshot
        mw.col.setMod()

    return tasks

# -----------------------------
# Bridge Class
# -----------------------------

class Bridge(QObject):
    def __init__(self, data_file: Path, parent=None):
        super().__init__(parent)
        self.data_file = data_file

    @pyqtSlot(result=str)
    def get_taskbar_tasks(self):
        try:
            data = _build_taskbar_tasks_helper(self.data_file)
            return json.dumps(data)
        except Exception as e:
            print(f"Error in get_taskbar_tasks: {e}")
            traceback.print_exc()
            return "[]"

    @pyqtSlot(result=str)
    def get_deck_tree(self):
        try:
            tree = _build_deck_tree_helper()
            return json.dumps(tree)
        except Exception as e:
            print(f"Error in get_deck_tree: {e}")
            traceback.print_exc()
            return "{}"

    @pyqtSlot(result=str)
    def get_selected_decks(self):
        try:
            dids = _load_selected_decks(self.data_file)
            return json.dumps({"selected_decks": dids})
        except Exception as e:
            print(f"Error in get_selected_decks: {e}")
            traceback.print_exc()
            return "{}"

    @pyqtSlot(str, result=str)
    def save_selected_decks(self, json_dids):
        try:
            dids = json.loads(json_dids)
            data = {"selected_decks": dids}
            # Update the snapshot immediately when saving new selection
            # so progress starts from 'now' for newly added decks
            current_counts = _get_deck_counts_map()
            snapshot = mw.col.conf.get("anki_task_bar_snapshot", {})
            for did in dids:
                if str(did) not in snapshot:
                    snapshot[str(did)] = current_counts.get(did, 0)
            mw.col.conf["anki_task_bar_snapshot"] = snapshot
            
            self.data_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
            return json.dumps({"ok": True, "path": str(self.data_file)})
        except Exception as e:
            print(f"Error in save_selected_decks: {e}")
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(str)
    def start_review(self, did_str):
        from aqt.utils import tooltip  # Lazy import to avoid circular dependency issues
        try:
            did = int(did_str)
            mw.col.decks.select(did)
            mw.moveToState("overview")
            mw.activateWindow()
            tooltip(f"Opening {mw.col.decks.name(did)}...", period=1500)
        except Exception as e:
            print(f"Error in start_review: {e}")
            traceback.print_exc()
