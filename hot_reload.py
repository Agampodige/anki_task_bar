import os
import time
from pathlib import Path
from aqt.qt import QTimer, pyqtSignal, QObject
from aqt import mw

class HotReloadManager(QObject):
    """
    Hot reload manager for web development.
    Watches for file changes in the web directory and triggers reloads.
    """
    file_changed = pyqtSignal(str)  # Signal emitted when a file changes
    
    def __init__(self, web_dir: Path, parent=None):
        super().__init__(parent)
        self.web_dir = Path(web_dir)
        self.last_modified = {}
        self.watched_extensions = {'.html', '.js', '.css', '.json'}
        self.reload_timer = QTimer()
        self.reload_timer.setSingleShot(True)
        self.reload_timer.timeout.connect(self.check_file_changes)
        self.is_enabled = False
        
        # Initialize file modification times
        self._scan_files()
        
    def _scan_files(self):
        """Scan web directory for files and store their modification times."""
        self.last_modified.clear()
        if not self.web_dir.exists():
            return
            
        for file_path in self.web_dir.rglob('*'):
            if file_path.is_file() and file_path.suffix in self.watched_extensions:
                try:
                    self.last_modified[str(file_path)] = file_path.stat().st_mtime
                except (OSError, IOError):
                    continue
    
    def enable(self, interval_ms=500):
        """Enable hot reload with specified check interval."""
        if not self.web_dir.exists():
            print(f"Hot reload: Web directory {self.web_dir} does not exist")
            return
            
        self.is_enabled = True
        self.reload_timer.start(interval_ms)
        print(f"Hot reload enabled for {self.web_dir}")
    
    def disable(self):
        """Disable hot reload."""
        self.is_enabled = False
        self.reload_timer.stop()
        print("Hot reload disabled")
    
    def check_file_changes(self):
        """Check for file changes and emit signal if found."""
        if not self.is_enabled:
            return
            
        changed_files = []
        
        # Rescan and compare
        current_modified = {}
        if self.web_dir.exists():
            for file_path in self.web_dir.rglob('*'):
                if file_path.is_file() and file_path.suffix in self.watched_extensions:
                    try:
                        mtime = file_path.stat().st_mtime
                        current_modified[str(file_path)] = mtime
                        
                        # Check if file is new or modified
                        if (str(file_path) not in self.last_modified or 
                            mtime > self.last_modified[str(file_path)]):
                            changed_files.append(str(file_path))
                            
                    except (OSError, IOError):
                        continue
        
        # Update stored times
        self.last_modified = current_modified
        
        # Emit signal for each changed file
        for file_path in changed_files:
            self.file_changed.emit(file_path)
            print(f"Hot reload: File changed - {Path(file_path).name}")
        
        # Restart timer
        if self.is_enabled:
            self.reload_timer.start(500)
