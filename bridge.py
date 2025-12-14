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

def _is_new_anki_day() -> bool:
    return mw.col.conf.get("anki_task_bar_day") != mw.col.sched.today

def _due_count_for_deck(did: int) -> int:
    # queue 2 = review, 3 = relearn
    return (
        mw.col.db.scalar(
            """
            SELECT count()
            FROM cards
            WHERE did = ?
              AND queue IN (2,3)
              AND due <= ?
            """,
            did,
            mw.col.sched.today,
        )
        or 0
    )

def _ensure_today_snapshot(selected_dids: List[int]) -> Dict[str, int]:
    if _is_new_anki_day():
        snapshot = {}
        for did in selected_dids:
            snapshot[str(did)] = _due_count_for_deck(did)

        mw.col.conf["anki_task_bar_day"] = mw.col.sched.today
        mw.col.conf["anki_task_bar_snapshot"] = snapshot
        mw.col.setMod()

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
    snapshot = _ensure_today_snapshot(selected)

    tasks = []

    for did in selected:
        name = mw.col.decks.name(did)
        due_now = _due_count_for_deck(did)
        due_start = snapshot.get(str(did), due_now)

        done = max(due_start - due_now, 0)
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

    # Keeping this if you need deck tree in the future or for other JS parts
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
            self.data_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
            return json.dumps({"ok": True, "path": str(self.data_file)})
        except Exception as e:
            print(f"Error in save_selected_decks: {e}")
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})
