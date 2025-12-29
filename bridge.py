
from aqt.qt import QObject, pyqtSlot, QFileDialog
from aqt import mw
import json
import traceback
from pathlib import Path
from typing import Dict, Any, List
from datetime import date
from .daily_stats import DailyStatsDB

from aqt.utils import tooltip, showWarning
import time

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

def _anki_day_start_end_ms() -> tuple[int, int]:
    # Try multiple ways to get the cutoff, defaulting to current time if all fail
    cutoff = getattr(mw.col.sched, "day_cutoff", None)
    if cutoff is None:
        cutoff = getattr(mw.col.sched, "dayCutoff", None)
    
    # If still None (modern Anki versions), use the timing API
    if cutoff is None:
        try:
            # Modern Anki (2.1.50+) method
            cutoff = mw.col.db.scalar("select nextDay from col") 
        except:
            cutoff = int(time.time())

    end_ms = int(cutoff) * 1000
    start_ms = end_ms - (86400 * 1000)
    return start_ms, end_ms

def _is_new_anki_day() -> bool:
    """Check if it's a new Anki day."""
    return mw.col.conf.get("anki_task_bar_day") != mw.col.sched.today

def _reset_selected_decks_for_today(data_file: Path) -> None:
    """Reset daily progress snapshot once per Anki day."""
    try:
        if mw.col.conf.get("anki_task_bar_selection_reset_day") == mw.col.sched.today:
            return

        data_file.write_text(json.dumps({"selected_decks": []}, indent=2), encoding="utf-8")

        mw.col.conf["anki_task_bar_selection_reset_day"] = mw.col.sched.today
        mw.col.conf["anki_task_bar_day"] = mw.col.sched.today
        mw.col.conf["anki_task_bar_snapshot"] = {}
        mw.col.setMod()
    except Exception:
        traceback.print_exc()

def _ensure_today_snapshot(selected_dids: List[int], current_counts: Dict[int, int], stats_db=None) -> Dict[str, int]:
    """
    Ensure we have a snapshot for today.
    On a new day, capture the morning counts and save to database.
    
    Args:
        selected_dids: List of selected deck IDs
        current_counts: Current card counts for all decks
        stats_db: DailyStatsDB instance for persistence
    
    Returns:
        Dictionary of deck_id -> starting count for today
    """
    # If it's a new day, create morning snapshot
    if _is_new_anki_day():
        snapshot = {}
        today_str = date.today().isoformat()
        
        for did in selected_dids:
            morning_count = current_counts.get(did, 0)
            snapshot[str(did)] = morning_count
            
            # Save to database for persistence
            if stats_db:
                try:
                    deck_name = mw.col.decks.name(did)
                    stats_db.save_deck_history(
                        date_str=today_str,
                        deck_id=did,
                        deck_name=deck_name,
                        cards_due_start=morning_count,
                        cards_done=0,  # Nothing done yet
                        progress=0.0,
                        completed=False
                    )
                except Exception as e:
                    print(f"Error saving morning snapshot to DB: {e}")

        mw.col.conf["anki_task_bar_day"] = mw.col.sched.today
        mw.col.conf["anki_task_bar_snapshot"] = snapshot
        mw.col.setMod()  # Mark collection as modified to save config
        
        print(f"Morning snapshot created for {len(snapshot)} decks")

    return mw.col.conf.get("anki_task_bar_snapshot", {})

def _load_selected_decks(data_file: Path) -> List[int]:
    _reset_selected_decks_for_today(data_file)
    if not data_file.exists():
        return []

    try:
        data = json.loads(data_file.read_text(encoding="utf-8"))
        dids = [int(d) for d in data.get("selected_decks", [])]
        dids = list(dict.fromkeys(dids))

        try:
            names = {}
            for did in dids:
                try:
                    names[did] = mw.col.decks.name(did)
                except Exception:
                    names[did] = ""

            selected_set = set(dids)
            to_remove: set[int] = set()
            for child in dids:
                child_name = names.get(child) or ""
                if not child_name:
                    continue
                for parent in selected_set:
                    if parent == child:
                        continue
                    parent_name = names.get(parent) or ""
                    if parent_name and child_name.startswith(parent_name + "::"):
                        to_remove.add(child)
                        break

            if to_remove:
                dids = [d for d in dids if d not in to_remove]
        except Exception:
            pass

        return dids
    except Exception:
        traceback.print_exc()
        return []

def _build_taskbar_tasks_helper(data_file: Path, stats_db=None) -> List[dict]:
    selected = _load_selected_decks(data_file)
    current_counts = _get_deck_counts_map()
    snapshot = _ensure_today_snapshot(selected, current_counts, stats_db)
    
    snapshot_updated = False
    tasks = []

    for did in selected:
        try:
            name = mw.col.decks.name(did)
        except:
            continue # Skip if deck was deleted

        due_now = current_counts.get(did, 0)
        stored_start = snapshot.get(str(did), 0)
        
        # If new cards were added, update the start point so progress 
        # is calculated against the new total, but never let due_start be less than due_now
        due_start = max(stored_start, due_now)
        
        if due_start > stored_start:
            snapshot[str(did)] = due_start
            snapshot_updated = True

        done = max(due_start - due_now, 0)
        # Avoid division by zero and cap progress at 1.0
        progress = 1.0 if due_start == 0 else min(1.0, round(done / due_start, 3))

        tasks.append({
            "deckId": did,
            "name": name,
            "dueStart": due_start,
            "dueNow": due_now,
            "done": done,
            "progress": progress,
            "completed": due_now == 0,
        })

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
        # Initialize database
        self.settings_path = data_file.parent / "config.json"
        self.sessions_path = data_file.parent / "sessions.json"
        
        # Cache for sessions to improve performance
        self._sessions_cache = None
        self._sessions_mtime = 0
        
        db_path = data_file.parent / "daily_stats.db"

        # First-run initialization (new computer / fresh profile)
        try:
            if not data_file.parent.exists():
                data_file.parent.mkdir(parents=True, exist_ok=True)

            marker_path = data_file.parent / ".anki_task_bar_initialized"
            if not marker_path.exists():
                data_file.write_text(json.dumps({"selected_decks": []}, indent=2), encoding="utf-8")

                if not self.sessions_path.exists():
                    self.sessions_path.write_text(
                        json.dumps({"sessions": [], "active_session_id": None, "folders": []}, indent=2),
                        encoding="utf-8",
                    )

                if db_path.exists():
                    db_path.unlink()

                marker_path.write_text("1", encoding="utf-8")
        except Exception:
            traceback.print_exc()

        self.stats_db = DailyStatsDB(db_path)

        try:
            if not self.sessions_path.exists():
                self.sessions_path.write_text(
                    json.dumps({"sessions": [], "active_session_id": None, "folders": []}, indent=2),
                    encoding="utf-8",
                )
        except Exception:
            traceback.print_exc()

    def _read_settings(self) -> Dict[str, Any]:
        try:
            if not self.settings_path.exists():
                return {}

            raw = self.settings_path.read_text(encoding="utf-8")
            if not raw or not raw.strip():
                return {}

            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _read_sessions(self) -> Dict[str, Any]:
        try:
            if not self.sessions_path.exists():
                return {"sessions": [], "active_session_id": None, "folders": []}

            # Check if file has changed
            try:
                current_mtime = self.sessions_path.stat().st_mtime
            except Exception:
                current_mtime = 0

            if self._sessions_cache is not None and current_mtime == self._sessions_mtime:
                return self._sessions_cache

            raw = self.sessions_path.read_text(encoding="utf-8")
            if not raw or not raw.strip():
                data = {"sessions": [], "active_session_id": None, "folders": []}
            else:
                data = json.loads(raw)
                if not isinstance(data, dict):
                    data = {"sessions": [], "active_session_id": None, "folders": []}

            # Ensure required fields exist
            if "sessions" not in data or not isinstance(data.get("sessions"), list):
                data["sessions"] = []
            if "active_session_id" not in data:
                data["active_session_id"] = None
            if "folders" not in data or not isinstance(data.get("folders"), list):
                data["folders"] = []
            
            # Ensure each session has a folder field
            for session in data["sessions"]:
                if isinstance(session, dict) and "folder" not in session:
                    session["folder"] = ""
            
            self._update_cache(data)
            return data
        except Exception as e:
            print(f"Error reading sessions: {e}")
            return {"sessions": [], "active_session_id": None, "folders": []}

    def _update_cache(self, data):
        """Update internal cache and mtime."""
        self._sessions_cache = data
        try:
            self._sessions_mtime = self.sessions_path.stat().st_mtime
        except:
            self._sessions_mtime = 0

    def _write_sessions(self, data: Dict[str, Any]) -> None:
        try:
            self.sessions_path.parent.mkdir(parents=True, exist_ok=True)
            self.sessions_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
            self._update_cache(data)
        except Exception:
            traceback.print_exc()

    def _save_selected_decks_list(self, dids: List[int]) -> None:
        dids = [int(d) for d in dids]
        dids = list(dict.fromkeys(dids))

        try:
            names = {}
            for did in dids:
                try:
                    names[did] = mw.col.decks.name(did)
                except Exception:
                    names[did] = ""

            selected_set = set(dids)
            to_remove: set[int] = set()
            for child in dids:
                child_name = names.get(child) or ""
                if not child_name:
                    continue
                for parent in selected_set:
                    if parent == child:
                        continue
                    parent_name = names.get(parent) or ""
                    if parent_name and child_name.startswith(parent_name + "::"):
                        to_remove.add(child)
                        break

            if to_remove:
                dids = [d for d in dids if d not in to_remove]
        except Exception:
            pass

        data = {"selected_decks": dids}

        current_counts = _get_deck_counts_map()
        snapshot = mw.col.conf.get("anki_task_bar_snapshot", {})
        for did in dids:
            if str(did) not in snapshot:
                snapshot[str(did)] = current_counts.get(did, 0)
        mw.col.conf["anki_task_bar_snapshot"] = snapshot

        self.data_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

    @pyqtSlot(result=str)
    def get_taskbar_tasks(self):
        try:
            data = _build_taskbar_tasks_helper(self.data_file, self.stats_db)
            return json.dumps(data)
        except Exception as e:
            print(f"Error in get_taskbar_tasks: {e}")
            traceback.print_exc()
            return "[]"

    @pyqtSlot(result=str)
    def get_today_review_totals(self):
        try:
            start_ms, end_ms = _anki_day_start_end_ms()
            db = mw.col.db

            def _scalar(query, *args):
                if hasattr(db, "scalar"):
                    return db.scalar(query, *args)
                row = db.first(query, *args)
                return row[0] if row else 0

            total_reviews = int(_scalar(
                "SELECT COUNT(*) FROM revlog WHERE id >= ? AND id < ?",
                start_ms,
                end_ms,
            ))
            total_cards = int(_scalar(
                "SELECT COUNT(DISTINCT cid) FROM revlog WHERE id >= ? AND id < ?",
                start_ms,
                end_ms,
            ))

            return json.dumps({"total_cards": total_cards, "total_reviews": total_reviews})
        except Exception as e:
            print(f"Error in get_today_review_totals: {e}")
            traceback.print_exc()
            return json.dumps({"total_cards": 0, "total_reviews": 0})

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
            self._save_selected_decks_list(dids)
            return json.dumps({"ok": True, "path": str(self.data_file)})
        except Exception as e:
            print(f"Error in save_selected_decks: {e}")
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(result=str)
    def get_sessions(self):
        try:
            data = self._read_sessions()
            # Calculate progress for each session
            sessions = data.get("sessions", [])
            for session in sessions:
                if isinstance(session, dict):
                    stats = self._calculate_session_progress_stats(session.get("deck_ids", []))
                    session.update(stats)
            return json.dumps(data)
        except Exception:
            traceback.print_exc()
            return json.dumps({"sessions": [], "active_session_id": None, "folders": []})

    def _calculate_session_progress_stats(self, deck_ids: List[int]) -> Dict[str, Any]:
        """Calculate detailed progress stats for a list of decks."""
        if not deck_ids:
            return {"progress": 0.0, "total_cards": 0, "done_cards": 0}
        
        try:
            current_counts = _get_deck_counts_map()
            snapshot = mw.col.conf.get("anki_task_bar_snapshot", {})
            
            total_due_start = 0
            total_done = 0
            
            # Debug
            # print(f"Calc stats for {deck_ids}, Snapshot keys: {list(snapshot.keys())}")

            for did in deck_ids:
                try:
                    if not mw.col.decks.name(did): continue
                except:
                    continue

                due_now = current_counts.get(did, 0)
                stored_start_raw = snapshot.get(str(did))
                
                # If we have no snapshot for this deck, assume we start NOW.
                # If due_now > 0, then start = due_now (0% done).
                # If due_now == 0, then start = 0 (100% done or nothing to do? Let's say nothing).
                if stored_start_raw is None:
                     stored_start = due_now
                else:
                     stored_start = int(stored_start_raw)

                # Logic:
                # Total Goal = Max(SnapshotDue, CurrentDue) 
                # Why Max? If I add cards today, due increases. Goal should increase.
                # If I review cards, due decreases. Goal stays high.
                
                due_start = max(stored_start, due_now)
                done = max(due_start - due_now, 0)
                
                total_due_start += due_start
                total_done += done
            
            progress = 0.0
            if total_due_start > 0:
                progress = min(1.0, round(total_done / total_due_start, 3))
            elif total_due_start == 0 and total_done == 0:
                # Nothing to do
                progress = 0.0 # Or 1.0? 0.0 feels safer for "empty" state.
                
            return {
                "progress": progress,
                "total_cards": total_due_start,
                "done_cards": total_done
            }
        except Exception as e:
            print(f"Error calculating session stats: {e}")
            return {"progress": 0.0, "total_cards": 0, "done_cards": 0}

    @pyqtSlot(str, result=str)
    def upsert_session(self, json_session):
        try:
            sess = json.loads(json_session) if json_session else {}
            if not isinstance(sess, dict):
                return json.dumps({"ok": False, "error": "invalid session"})

            sid = str(sess.get("id") or "").strip()
            name = str(sess.get("name") or "").strip()
            deck_ids = sess.get("deck_ids") or sess.get("deckIds") or []
            folder = str(sess.get("folder") or "").strip()
            if not isinstance(deck_ids, list):
                deck_ids = []
            deck_ids = [int(d) for d in deck_ids]
            deck_ids = list(dict.fromkeys(deck_ids))

            if not name:
                return json.dumps({"ok": False, "error": "name required"})

            if not sid:
                sid = str(int(time.time() * 1000))

            data = self._read_sessions()
            sessions = data.get("sessions", [])

            now_ms = int(time.time() * 1000)
            found = False
            for s in sessions:
                if isinstance(s, dict) and str(s.get("id")) == sid:
                    s["name"] = name
                    s["deck_ids"] = deck_ids
                    s["folder"] = folder
                    s["updated_at_ms"] = now_ms
                    found = True
                    break

            if not found:
                sessions.append({
                    "id": sid,
                    "name": name,
                    "deck_ids": deck_ids,
                    "folder": folder,
                    "created_at_ms": now_ms,
                    "updated_at_ms": now_ms,
                })

            # Ensure folder exists in folders list if it's not empty
            if folder and folder not in data.get("folders", []):
                data["folders"].append(folder)

            data["sessions"] = sessions
            self._write_sessions(data)
            return json.dumps({"ok": True, "id": sid})
        except Exception as e:
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(str, result=str)
    def delete_session(self, session_id):
        try:
            sid = str(session_id or "").strip()
            data = self._read_sessions()
            sessions = data.get("sessions", [])
            sessions = [s for s in sessions if not (isinstance(s, dict) and str(s.get("id")) == sid)]
            data["sessions"] = sessions
            if str(data.get("active_session_id")) == sid:
                data["active_session_id"] = None
            self._write_sessions(data)
            return json.dumps({"ok": True})
        except Exception as e:
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(str, result=str)
    def activate_session(self, session_id):
        try:
            sid = str(session_id or "").strip()
            data = self._read_sessions()
            sessions = data.get("sessions", [])
            session = None
            for s in sessions:
                if isinstance(s, dict) and str(s.get("id")) == sid:
                    session = s
                    break
            if not session:
                return json.dumps({"ok": False, "error": "not found"})

            deck_ids = session.get("deck_ids") or []
            if not isinstance(deck_ids, list):
                deck_ids = []

            self._save_selected_decks_list(deck_ids)
            data["active_session_id"] = sid
            self._write_sessions(data)
            return json.dumps({"ok": True})
        except Exception as e:
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(str)
    def start_review(self, did_str):
        try:
            did = int(did_str)
            if not mw.col.decks.get(did):
                showWarning("This deck no longer exists.")
                return
            mw.col.decks.select(did)
            mw.moveToState("overview")
            mw.activateWindow()
            tooltip(f"Opening {mw.col.decks.name(did)}...", period=1500)
            
            settings = self._read_settings()
            auto_hide = settings.get("enableSessions", True)

            # Auto-close the widget when review starts (if enabled)
            if auto_hide and self.parent():
                self.parent().hide()

        except Exception as e:
            print(f"Error in start_review: {e}")
            traceback.print_exc()

    @pyqtSlot()
    def close_window(self):
        if self.parent():
            self.parent().hide()

    @pyqtSlot()
    def drag_window(self):
        # Trigger native window drag
        if self.parent() and self.parent().windowHandle():
            self.parent().windowHandle().startSystemMove()
    
    @pyqtSlot()
    def save_daily_snapshot(self):
        """
        Save current day's progress to database.
        Called when closing Anki or manually.
        """
        try:
            tasks = _build_taskbar_tasks_helper(self.data_file, self.stats_db)
            today_str = date.today().isoformat()
            
            # Calculate totals
            total_done = sum(t['done'] for t in tasks)
            completed_count = sum(1 for t in tasks if t['completed'])
            
            # Save daily summary
            self.stats_db.save_daily_summary(
                date_str=today_str,
                total_cards=total_done,
                decks_completed=completed_count
            )
            
            # Save per-deck history (update with current progress)
            for task in tasks:
                self.stats_db.save_deck_history(
                    date_str=today_str,
                    deck_id=task['deckId'],
                    deck_name=task['name'],
                    cards_due_start=task['dueStart'],
                    cards_done=task['done'],
                    progress=task['progress'],
                    completed=task['completed']
                )
            
            print(f"Daily snapshot saved: {total_done} cards, {completed_count} decks completed")
            
        except Exception as e:
            print(f"Error saving daily snapshot: {e}")
            traceback.print_exc()
    
    @pyqtSlot(int, result=str)
    def get_daily_stats(self, days=7):
        """
        Get daily statistics for the last N days.
        
        Args:
            days: Number of days to retrieve (default 7)
            
        Returns:
            JSON string with daily stats
        """
        try:
            stats = self.stats_db.get_daily_stats(days)
            return json.dumps(stats)
        except Exception as e:
            print(f"Error getting daily stats: {e}")
            traceback.print_exc()
            return "[]"
    
    @pyqtSlot(int, int, result=str)
    def get_deck_history(self, deck_id, days=30):
        """
        Get history for a specific deck.
        
        Args:
            deck_id: Deck ID
            days: Number of days to retrieve (default 30)
            
        Returns:
            JSON string with deck history
        """
        try:
            history = self.stats_db.get_deck_history(deck_id, days)
            return json.dumps(history)
        except Exception as e:
            print(f"Error getting deck history: {e}")
            traceback.print_exc()
            return "[]"
    
    @pyqtSlot(result=str)
    def get_total_stats(self):
        """
        Get aggregate statistics across all time.
        
        Returns:
            JSON string with total stats including streak
        """
        try:
            stats = self.stats_db.get_total_stats()
            stats['current_streak'] = self.stats_db.get_current_streak()
            return json.dumps(stats)
        except Exception as e:
            print(f"Error getting total stats: {e}")
            traceback.print_exc()
            return "{}"
    
    @pyqtSlot(str, result=str)
    def export_data_csv(self, file_path):
        """
        Export data to CSV file.
        
        Args:
            file_path: Path where CSV should be saved
            
        Returns:
            JSON with success status
        """
        try:
            output_path = Path(file_path)
            self.stats_db.export_to_csv(output_path, days=365)
            return json.dumps({"ok": True, "path": str(output_path)})
        except Exception as e:
            print(f"Error exporting CSV: {e}")
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(result=str)
    def export_sessions(self):
        try:
            filename, _ = QFileDialog.getSaveFileName(
                mw, 
                "Export Sessions", 
                "anki_task_sessions.json", 
                "JSON Files (*.json)"
            )
            if not filename:
                return json.dumps({"ok": False, "error": "cancelled"})

            data = self._read_sessions()
            Path(filename).write_text(json.dumps(data, indent=2), encoding="utf-8")
            return json.dumps({"ok": True, "path": filename})
        except Exception as e:
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(result=str)
    def import_sessions(self):
        try:
            filename, _ = QFileDialog.getOpenFileName(
                mw, 
                "Import Sessions", 
                "", 
                "JSON Files (*.json)"
            )
            if not filename:
                return json.dumps({"ok": False, "error": "cancelled"})

            raw = Path(filename).read_text(encoding="utf-8")
            data = json.loads(raw)

            # Basic validation
            if not isinstance(data, dict) or "sessions" not in data:
                return json.dumps({"ok": False, "error": "Invalid sessions file"})

            # Merge or replace? Overwrite is simpler and usually what's expected for 'Import'
            self._write_sessions(data)
            return json.dumps({"ok": True})
        except Exception as e:
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(str)
    def save_settings_to_file(self, json_data):
        try:
            settings = json.loads(json_data)
            self.settings_path.parent.mkdir(parents=True, exist_ok=True)
            self.settings_path.write_text(json.dumps(settings, indent=4), encoding="utf-8")
            print(f"Successfully saved to {self.settings_path}")
        except Exception as e:
            print(f"Error saving settings: {e}")
            traceback.print_exc()

    @pyqtSlot(result=str)
    def load_settings_from_file(self):
        try:
            if self.settings_path.exists():
                raw = self.settings_path.read_text(encoding="utf-8")
                if not raw or not raw.strip():
                    return "{}"
                return raw
            return "{}" 
        except Exception as e:
            print(f"Error loading settings: {e}")
            return "{}"

    @pyqtSlot()
    def open_addon_folder(self):
        from aqt.utils import openFolder
        openFolder(str(self.data_file.parent))

    @pyqtSlot(str)
    def open_link(self, url):
        from aqt.qt import QDesktopServices, QUrl
        QDesktopServices.openUrl(QUrl(url))

    # Folder management methods
    @pyqtSlot(str, result=str)
    def create_folder(self, folder_name):
        """Create a new folder."""
        try:
            print(f"create_folder called with: '{folder_name}'")
            folder_name = str(folder_name or "").strip()
            if not folder_name:
                return json.dumps({"ok": False, "error": "Folder name required"})
            
            data = self._read_sessions()
            folders = data.get("folders", [])
            
            if folder_name in folders:
                print(f"Folder '{folder_name}' already exists in {folders}")
                return json.dumps({"ok": False, "error": "Folder already exists"})
            
            folders.append(folder_name)
            data["folders"] = folders
            self._write_sessions(data)
            
            print(f"Folder '{folder_name}' created successfully")
            return json.dumps({"ok": True})
        except Exception as e:
            print(f"Error in create_folder: {e}")
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})
    @pyqtSlot(str, str, result=str)
    def rename_folder(self, old_name, new_name):
        """Rename a folder."""
        try:
            old_name = str(old_name or "").strip()
            new_name = str(new_name or "").strip()
            
            if not old_name or not new_name:
                return json.dumps({"ok": False, "error": "Folder names required"})
            
            if old_name == new_name:
                return json.dumps({"ok": True})
            
            data = self._read_sessions()
            folders = data.get("folders", [])
            
            # Check if old name exists
            if old_name not in folders:
                return json.dumps({"ok": False, "error": "Folder not found"})
            
            # Check if new name already exists
            if new_name in folders:
                return json.dumps({"ok": False, "error": "New folder name already exists"})
            
            # Update in folders list
            folders[folders.index(old_name)] = new_name
            
            # Update folder name in sessions
            sessions = data.get("sessions", [])
            for session in sessions:
                if isinstance(session, dict) and session.get("folder") == old_name:
                    session["folder"] = new_name
            
            data["folders"] = folders
            data["sessions"] = sessions
            self._write_sessions(data)
            
            return json.dumps({"ok": True})
        except Exception as e:
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(str, result=str)
    def delete_folder(self, folder_name):
        """Delete a folder and move its sessions to uncategorized."""
        try:
            folder_name = str(folder_name or "").strip()
            
            data = self._read_sessions()
            folders = data.get("folders", [])
            sessions = data.get("sessions", [])
            
            # Move sessions to uncategorized (empty string)
            moved_count = 0
            for session in sessions:
                if isinstance(session, dict) and session.get("folder") == folder_name:
                    session["folder"] = ""
                    moved_count += 1
            
            # Remove from folders list
            if folder_name in folders:
                folders.remove(folder_name)
            
            data["folders"] = folders
            data["sessions"] = sessions
            self._write_sessions(data)
            
            return json.dumps({"ok": True, "moved_sessions": moved_count})
        except Exception as e:
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})

    @pyqtSlot(str, str, result=str)
    def move_session_to_folder(self, session_id, folder_name):
        """Move a session to a different folder."""
        try:
            print(f"move_session_to_folder called with session_id='{session_id}', folder_name='{folder_name}'")
            session_id = str(session_id or "").strip()
            folder_name = str(folder_name or "").strip()
            
            data = self._read_sessions()
            sessions = data.get("sessions", [])
            folders = data.get("folders", [])
            
            session_found = False
            for session in sessions:
                if isinstance(session, dict) and str(session.get("id")) == session_id:
                    session["folder"] = folder_name
                    session_found = True
                    break
            
            if not session_found:
                print(f"Session {session_id} not found")
                return json.dumps({"ok": False, "error": "Session not found"})
            
            # If folder doesn't exist in folders list and it's not empty, add it
            if folder_name and folder_name not in folders:
                folders.append(folder_name)
                data["folders"] = folders
            
            data["sessions"] = sessions
            self._write_sessions(data)
            
            print(f"Session {session_id} moved to folder '{folder_name}'")
            return json.dumps({"ok": True})
        except Exception as e:
            print(f"Error in move_session_to_folder: {e}")
            traceback.print_exc()
            return json.dumps({"ok": False, "error": str(e)})