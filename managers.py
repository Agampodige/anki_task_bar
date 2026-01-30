import json
import time
import traceback
from pathlib import Path
from typing import Dict, Any, List
from datetime import date
from aqt import mw

class SettingsManager:
    def __init__(self, settings_path: Path):
        self.settings_path = settings_path

    def load(self) -> Dict[str, Any]:
        try:
            if not self.settings_path.exists():
                return {}
            raw = self.settings_path.read_text(encoding="utf-8")
            return json.loads(raw) if raw.strip() else {}
        except Exception:
            return {}

    def save(self, settings: Dict[str, Any]):
        try:
            self.settings_path.parent.mkdir(parents=True, exist_ok=True)
            self.settings_path.write_text(json.dumps(settings, indent=4), encoding="utf-8")
        except Exception:
            traceback.print_exc()

class SessionManager:
    def __init__(self, sessions_path: Path):
        self.sessions_path = sessions_path
        self._cache = None
        self._mtime = 0

    def load(self) -> Dict[str, Any]:
        try:
            if not self.sessions_path.exists():
                return {"sessions": [], "active_session_id": None, "folders": []}

            try:
                current_mtime = self.sessions_path.stat().st_mtime
            except:
                current_mtime = 0

            if self._cache is not None and current_mtime == self._mtime:
                return self._cache

            raw = self.sessions_path.read_text(encoding="utf-8")
            data = json.loads(raw) if raw.strip() else {}
            
            # Normalize data
            data.setdefault("sessions", [])
            data.setdefault("active_session_id", None)
            data.setdefault("folders", [])
            for s in data["sessions"]:
                if isinstance(s, dict):
                    s.setdefault("folder", "")
            
            self._cache = data
            self._mtime = current_mtime
            return data
        except Exception:
            return {"sessions": [], "active_session_id": None, "folders": []}

    def save(self, data: Dict[str, Any]):
        try:
            self.sessions_path.parent.mkdir(parents=True, exist_ok=True)
            self.sessions_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
            self._cache = data
            self._mtime = self.sessions_path.stat().st_mtime
        except Exception:
            traceback.print_exc()

class DeckManager:
    @staticmethod
    def get_deck_tree() -> Dict[str, Any]:
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

    @staticmethod
    def get_deck_counts_map() -> Dict[int, int]:
        root = mw.col.sched.deck_due_tree()
        counts = {}
        def traverse(node):
            counts[node.deck_id] = node.review_count + node.learn_count + node.new_count
            for child in node.children:
                traverse(child)
        traverse(root)
        return counts

    @staticmethod
    def ensure_snapshot(selected_dids: List[int], current_counts: Dict[int, int]) -> Dict[str, int]:
        if mw.col.get_config("anki_task_bar_day") != mw.col.sched.today:
            snapshot = {str(did): current_counts.get(did, 0) for did in selected_dids}
            mw.col.set_config("anki_task_bar_day", mw.col.sched.today)
            mw.col.set_config("anki_task_bar_snapshot", snapshot)
            mw.col.setMod()
            return snapshot
        return mw.col.get_config("anki_task_bar_snapshot", {})
