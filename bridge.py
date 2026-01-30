from aqt.qt import QObject, pyqtSlot, QFileDialog, QUrl
from aqt import mw
import json
import traceback
from pathlib import Path
from typing import Dict, Any, List
from datetime import date
from .daily_stats import DailyStatsDB
from .managers import SettingsManager, SessionManager, DeckManager

from aqt.utils import tooltip, showWarning
import time

def find_web_file(start_dir: Path, filename: str, max_up: int = 10) -> Path | None:
    current_path = start_dir.resolve()
    for _ in range(max_up + 1):
        candidate = current_path / "web" / filename
        if candidate.is_file(): return candidate
        if current_path.parent == current_path: break
        current_path = current_path.parent
    return None

def _anki_day_start_end_ms() -> tuple[int, int]:
    cutoff = getattr(mw.col.sched, "day_cutoff", None) or getattr(mw.col.sched, "dayCutoff", None)
    if cutoff is None:
        try: cutoff = mw.col.db.scalar("select nextDay from col") 
        except: cutoff = int(time.time())
    end_ms = int(cutoff) * 1000
    return end_ms - (86400 * 1000), end_ms

class Bridge(QObject):
    def __init__(self, data_file: Path, parent=None):
        super().__init__(parent)
        self.data_file = data_file
        self.stats_db = DailyStatsDB(data_file.parent / "daily_stats.db")
        self.settings = SettingsManager(data_file.parent / "config.json")
        self.sessions = SessionManager(data_file.parent / "sessions.json")
        self.decks = DeckManager()
        self._deck_tree_cache = None
        self._deck_tree_time = 0

    def _get_expanded_tasks(self) -> List[dict]:
        selected = self._load_selected_ids()
        counts = self.decks.get_deck_counts_map()
        snapshot = self.decks.ensure_snapshot(selected, counts)
        tasks, updated = [], False
        for did in selected:
            try: name = mw.col.decks.name(did)
            except: continue
            now = counts.get(did, 0)
            start = max(snapshot.get(str(did), 0), now)
            if start > snapshot.get(str(did), 0):
                snapshot[str(did)] = start
                updated = True
            done = max(start - now, 0)
            tasks.append({
                "deckId": did, "name": name, "dueStart": start, "dueNow": now, "done": done,
                "progress": 1.0 if start == 0 else min(1.0, round(done / start, 3)),
                "completed": now == 0
            })
        if updated:
            mw.col.set_config("anki_task_bar_snapshot", snapshot)
            mw.col.setMod()
        return tasks

    def _load_selected_ids(self) -> List[int]:
        if not self.data_file.exists(): return []
        try:
            data = json.loads(self.data_file.read_text(encoding="utf-8"))
            return [int(d) for d in data.get("selected_decks", [])]
        except: return []

    def _save_selected_ids(self, ids: List[int]):
        ids = list(dict.fromkeys([int(i) for i in ids]))
        counts = self.decks.get_deck_counts_map()
        snapshot = mw.col.get_config("anki_task_bar_snapshot", {})
        for did in ids: snapshot.setdefault(str(did), counts.get(did, 0))
        mw.col.set_config("anki_task_bar_snapshot", snapshot)
        mw.col.setMod()
        self.data_file.write_text(json.dumps({"selected_decks": ids}, indent=2), encoding="utf-8")

    @pyqtSlot(result=str)
    def get_taskbar_tasks(self):
        try: return json.dumps(self._get_expanded_tasks())
        except: return "[]"

    @pyqtSlot(result=str)
    def get_today_review_totals(self):
        try:
            start, end = _anki_day_start_end_ms()
            reviews = mw.col.db.scalar("SELECT COUNT(*) FROM revlog WHERE id >= ? AND id < ?", start, end)
            cards = mw.col.db.scalar("SELECT COUNT(DISTINCT cid) FROM revlog WHERE id >= ? AND id < ?", start, end)
            time_ms = mw.col.db.scalar("SELECT SUM(time) FROM revlog WHERE id >= ? AND id < ?", start, end) or 0
            return json.dumps({"total_cards": int(cards), "total_reviews": int(reviews), "total_time_ms": int(time_ms)})
        except: return json.dumps({"total_cards": 0, "total_reviews": 0, "total_time_ms": 0})

    @pyqtSlot(result=str)
    def get_deck_tree(self):
        now = time.time()
        if self._deck_tree_cache and (now - self._deck_tree_time < 300): return self._deck_tree_cache
        try:
            self._deck_tree_cache = json.dumps(self.decks.get_deck_tree())
            self._deck_tree_time = now
            return self._deck_tree_cache
        except: return "{}"

    @pyqtSlot(result=str)
    def get_selected_decks(self):
        return json.dumps({"selected_decks": self._load_selected_ids()})

    @pyqtSlot(str, result=str)
    def save_selected_decks(self, json_dids):
        try:
            self._save_selected_ids(json.loads(json_dids))
            return json.dumps({"ok": True})
        except Exception as e: return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(result=str)
    def get_sessions(self):
        try:
            data = self.sessions.load()
            for s in data.get("sessions", []):
                s.update(self._calc_session_stats(s.get("deck_ids", [])))
            return json.dumps(data)
        except: return json.dumps({"sessions": [], "active_session_id": None, "folders": []})

    def _calc_session_stats(self, dids: List[int]) -> Dict[str, Any]:
        if not dids: return {"progress": 1.0, "total_cards": 0, "done_cards": 0}
        counts = self.decks.get_deck_counts_map()
        snapshot = mw.col.get_config("anki_task_bar_snapshot", {})
        total_start, total_done = 0, 0
        for did in dids:
            now = counts.get(did, 0)
            start = max(int(snapshot.get(str(did), now)), now)
            total_start += start
            total_done += (start - now)
        return {
            "progress": 1.0 if total_start == 0 else min(1.0, round(total_done / total_start, 3)),
            "total_cards": total_start, "done_cards": total_done
        }

    @pyqtSlot(str, result=str)
    def upsert_session(self, json_session):
        try:
            s = json.loads(json_session)
            data = self.sessions.load()
            sid = str(s.get("id") or int(time.time() * 1000))
            found = False
            for existing in data["sessions"]:
                if str(existing.get("id")) == sid:
                    existing.update({
                        "name": s.get("name"), "deck_ids": s.get("deck_ids", []),
                        "folder": s.get("folder", ""), "updated_at_ms": int(time.time() * 1000)
                    })
                    found = True; break
            if not found:
                data["sessions"].append({
                    "id": sid, "name": s.get("name"), "deck_ids": s.get("deck_ids", []),
                    "folder": s.get("folder", ""), "created_at_ms": int(time.time() * 1000)
                })
            self.sessions.save(data)
            return json.dumps({"ok": True, "id": sid})
        except Exception as e: return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(str, result=str)
    def delete_session(self, sid):
        data = self.sessions.load()
        data["sessions"] = [s for s in data["sessions"] if str(s.get("id")) != str(sid)]
        if str(data.get("active_session_id")) == str(sid): data["active_session_id"] = None
        self.sessions.save(data)
        return json.dumps({"ok": True})

    @pyqtSlot(str, result=str)
    def activate_session(self, sid):
        data = self.sessions.load()
        session = next((s for s in data["sessions"] if str(s.get("id")) == str(sid)), None)
        if not session: return json.dumps({"ok": False, "error": "not found"})
        self._save_selected_ids(session.get("deck_ids", []))
        data["active_session_id"] = sid
        self.sessions.save(data)
        return json.dumps({"ok": True})

    @pyqtSlot(str)
    def start_review(self, did_str):
        did = int(did_str)
        if mw.col.decks.get(did):
            mw.col.decks.select(did)
            mw.moveToState("overview")
            mw.activateWindow()
            if self.settings.load().get("enableSessions", True) and self.parent():
                self.parent().hide()

    @pyqtSlot()
    def drag_window(self):
        if self.parent() and self.parent().windowHandle():
            self.parent().windowHandle().startSystemMove()

    @pyqtSlot()
    def close_window(self):
        if self.parent(): self.parent().hide()

    @pyqtSlot()
    def minimize_window(self):
        if self.parent(): self.parent().showMinimized()

    @pyqtSlot()
    def toggle_expand(self):
        if hasattr(self.parent(), 'toggle_expand'): self.parent().toggle_expand()

    @pyqtSlot(bool)
    def set_always_on_top(self, enabled):
        if hasattr(self.parent(), 'set_always_on_top'): self.parent().set_always_on_top(enabled)

    @pyqtSlot(str)
    def save_settings_to_file(self, json_data):
        self.settings.save(json.loads(json_data))

    @pyqtSlot(result=str)
    def load_settings_from_file(self):
        return json.dumps(self.settings.load())

    @pyqtSlot()
    def open_addon_folder(self):
        from aqt.utils import openFolder
        openFolder(str(self.data_file.parent))

    @pyqtSlot(str)
    def open_link(self, url):
        from aqt.qt import QDesktopServices, QUrl
        QDesktopServices.openUrl(QUrl(url))

    @pyqtSlot(str, result=str)
    def create_folder(self, name):
        data = self.sessions.load()
        if name not in data["folders"]:
            data["folders"].append(name)
            self.sessions.save(data)
        return json.dumps({"ok": True})

    @pyqtSlot(str, str, result=str)
    def rename_folder(self, old, new):
        data = self.sessions.load()
        if old in data["folders"]:
            data["folders"][data["folders"].index(old)] = new
            for s in data["sessions"]:
                if s.get("folder") == old: s["folder"] = new
            self.sessions.save(data)
        return json.dumps({"ok": True})

    @pyqtSlot(str, result=str)
    def delete_folder(self, name):
        data = self.sessions.load()
        if name in data["folders"]:
            data["folders"].remove(name)
            for s in data["sessions"]:
                if s.get("folder") == name: s["folder"] = ""
            self.sessions.save(data)
        return json.dumps({"ok": True})

    @pyqtSlot(int, int)
    def apply_window_size_preset(self, w, h):
        if self.parent(): self.parent().resize(max(w, 300), max(h, 200))

    @pyqtSlot()
    def save_daily_snapshot(self):
        try:
            tasks = self._get_expanded_tasks()
            day = date.today().isoformat()
            self.stats_db.save_daily_summary(day, sum(t['done'] for t in tasks), sum(1 for t in tasks if t['completed']))
            for t in tasks:
                self.stats_db.save_deck_history(day, t['deckId'], t['name'], t['dueStart'], t['done'], t['progress'], t['completed'])
        except: traceback.print_exc()

    @pyqtSlot(int, result=str)
    def get_daily_stats(self, days=7):
        return json.dumps(self.stats_db.get_daily_stats(days))

    @pyqtSlot(int, int, result=str)
    def get_deck_history(self, did, days=30):
        return json.dumps(self.stats_db.get_deck_history(did, days))

    @pyqtSlot(result=str)
    def get_total_stats(self):
        s = self.stats_db.get_total_stats()
        s['current_streak'] = self.stats_db.get_current_streak()
        return json.dumps(s)

    @pyqtSlot(str, result=str)
    def export_data_csv(self, path):
        try:
            self.stats_db.export_to_csv(Path(path), 365)
            return json.dumps({"ok": True})
        except Exception as e: return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(result=str)
    def export_sessions(self):
        try:
            path, _ = QFileDialog.getSaveFileName(mw, "Export Sessions", "sessions.json", "JSON (*.json)")
            if not path: return json.dumps({"ok": False})
            Path(path).write_text(json.dumps(self.sessions.load(), indent=2), encoding="utf-8")
            return json.dumps({"ok": True, "path": path})
        except Exception as e: return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(result=str)
    def import_sessions(self):
        try:
            path, _ = QFileDialog.getOpenFileName(mw, "Import Sessions", "", "JSON (*.json)")
            if not path: return json.dumps({"ok": False})
            self.sessions.save(json.loads(Path(path).read_text(encoding="utf-8")))
            return json.dumps({"ok": True})
        except Exception as e: return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(str, str, result=str)
    def move_session_to_folder(self, sid, folder):
        data = self.sessions.load()
        for s in data["sessions"]:
            if str(s.get("id")) == str(sid):
                s["folder"] = folder
                if folder and folder not in data["folders"]: data["folders"].append(folder)
                self.sessions.save(data)
                return json.dumps({"ok": True})
        return json.dumps({"ok": False})

    @pyqtSlot(str, result=str)
    def shuffle_sessions(self, ids_json):
        import random
        ids = json.loads(ids_json)
        random.shuffle(ids)
        return json.dumps({"ok": True, "shuffled_ids": ids})

    def _load_page(self, name):
        if self.parent():
            p = find_web_file(Path(__file__).parent, name)
            if p: self.parent().web_view.load(QUrl.fromLocalFile(str(p)))

    @pyqtSlot()
    def load_home_page(self): self._load_page("index.html")
    @pyqtSlot()
    def load_sessions_page(self): self._load_page("sessions.html")
    @pyqtSlot()
    def load_settings_page(self): self._load_page("setting.html")