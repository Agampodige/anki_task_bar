"""
Daily Statistics Database Module

Handles persistent storage of daily progress data for the Anki Task Bar addon.
Stores daily summaries and per-deck history in a SQLite database.
"""

import sqlite3
from pathlib import Path
from datetime import datetime, date
from typing import List, Dict, Any, Optional
import json


class DailyStatsDB:
    """Manages persistent storage of daily statistics."""
    
    def __init__(self, db_path: Path):
        """
        Initialize database connection and create tables if needed.
        
        Args:
            db_path: Path to the SQLite database file
        """
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_database()
    
    def _init_database(self):
        """Create database tables if they don't exist."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS daily_summary (
                    date TEXT PRIMARY KEY,
                    total_cards_reviewed INTEGER NOT NULL DEFAULT 0,
                    total_time_seconds INTEGER DEFAULT 0,
                    decks_completed INTEGER NOT NULL DEFAULT 0,
                    streak_days INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS deck_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    deck_id INTEGER NOT NULL,
                    deck_name TEXT NOT NULL,
                    cards_due_start INTEGER NOT NULL DEFAULT 0,
                    cards_done INTEGER NOT NULL DEFAULT 0,
                    progress_percent REAL NOT NULL DEFAULT 0.0,
                    completed BOOLEAN NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(date, deck_id)
                )
            """)
            
            # Create indexes for better query performance
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_deck_history_date 
                ON deck_history(date DESC)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_deck_history_deck_id 
                ON deck_history(deck_id, date DESC)
            """)
            
            conn.commit()
    
    def save_daily_summary(self, date_str: str, total_cards: int, 
                          decks_completed: int, time_seconds: int = 0):
        """
        Save or update daily summary statistics.
        
        Args:
            date_str: Date in YYYY-MM-DD format
            total_cards: Total cards reviewed today
            decks_completed: Number of decks completed
            time_seconds: Total study time in seconds (optional)
        """
        with sqlite3.connect(self.db_path) as conn:
            # Calculate streak
            streak = self._calculate_streak(conn, date_str)
            
            conn.execute("""
                INSERT INTO daily_summary 
                (date, total_cards_reviewed, total_time_seconds, decks_completed, streak_days, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(date) DO UPDATE SET
                    total_cards_reviewed = excluded.total_cards_reviewed,
                    total_time_seconds = excluded.total_time_seconds,
                    decks_completed = excluded.decks_completed,
                    streak_days = excluded.streak_days,
                    updated_at = CURRENT_TIMESTAMP
            """, (date_str, total_cards, time_seconds, decks_completed, streak))
            
            conn.commit()
    
    def save_deck_history(self, date_str: str, deck_id: int, deck_name: str,
                         cards_due_start: int, cards_done: int, 
                         progress: float, completed: bool):
        """
        Save or update deck-specific history.
        
        Args:
            date_str: Date in YYYY-MM-DD format
            deck_id: Anki deck ID
            deck_name: Name of the deck
            cards_due_start: Cards due at start of day
            cards_done: Cards completed
            progress: Progress as decimal (0.0 to 1.0)
            completed: Whether deck was completed
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO deck_history 
                (date, deck_id, deck_name, cards_due_start, cards_done, 
                 progress_percent, completed)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(date, deck_id) DO UPDATE SET
                    deck_name = excluded.deck_name,
                    cards_due_start = excluded.cards_due_start,
                    cards_done = excluded.cards_done,
                    progress_percent = excluded.progress_percent,
                    completed = excluded.completed
            """, (date_str, deck_id, deck_name, cards_due_start, 
                  cards_done, progress * 100, completed))
            
            conn.commit()
    
    def get_daily_stats(self, days: int = 7) -> List[Dict[str, Any]]:
        """
        Retrieve daily summary statistics for the last N days.
        
        Args:
            days: Number of days to retrieve
            
        Returns:
            List of daily summary dictionaries
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT date, total_cards_reviewed, total_time_seconds,
                       decks_completed, streak_days, created_at
                FROM daily_summary
                WHERE date >= date('now', '-{} days')
                ORDER BY date DESC
            """.format(days))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def get_deck_history(self, deck_id: int, days: int = 30) -> List[Dict[str, Any]]:
        """
        Retrieve history for a specific deck.
        
        Args:
            deck_id: Anki deck ID
            days: Number of days to retrieve
            
        Returns:
            List of deck history dictionaries
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT date, deck_name, cards_due_start, cards_done,
                       progress_percent, completed, created_at
                FROM deck_history
                WHERE deck_id = ? AND date >= date('now', '-{} days')
                ORDER BY date DESC
            """.format(days), (deck_id,))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def get_current_streak(self) -> int:
        """
        Get the current study streak in days.
        
        Returns:
            Number of consecutive days with activity
        """
        today = date.today().isoformat()
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT streak_days FROM daily_summary
                WHERE date = ?
            """, (today,))
            
            row = cursor.fetchone()
            return row[0] if row else 0
    
    def export_to_csv(self, output_path: Path, days: int = 365):
        """
        Export data to CSV file.
        
        Args:
            output_path: Path for the output CSV file
            days: Number of days to export
        """
        import csv
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Export daily summaries
            cursor = conn.execute("""
                SELECT * FROM daily_summary
                WHERE date >= date('now', '-{} days')
                ORDER BY date DESC
            """.format(days))
            
            rows = cursor.fetchall()
            if rows:
                with open(output_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                    writer.writeheader()
                    writer.writerows([dict(row) for row in rows])
    
    def _calculate_streak(self, conn: sqlite3.Connection, current_date: str) -> int:
        """
        Calculate the current streak of consecutive study days.
        
        Args:
            conn: Database connection
            current_date: Current date in YYYY-MM-DD format
            
        Returns:
            Streak count in days
        """
        cursor = conn.execute("""
            SELECT date FROM daily_summary
            WHERE date <= ?
            ORDER BY date DESC
            LIMIT 365
        """, (current_date,))
        
        dates = [row[0] for row in cursor.fetchall()]
        if not dates:
            return 1
        
        # Convert to date objects
        date_objs = [datetime.strptime(d, '%Y-%m-%d').date() for d in dates]
        current = datetime.strptime(current_date, '%Y-%m-%d').date()
        
        streak = 1
        for i, d in enumerate(date_objs):
            if i == 0:
                continue
            expected_prev = date_objs[i-1]
            actual_prev = d
            # Check if consecutive
            if (expected_prev - actual_prev).days == 1:
                streak += 1
            else:
                break
        
        return streak
    
    def get_total_stats(self) -> Dict[str, Any]:
        """
        Get aggregate statistics across all time.
        
        Returns:
            Dictionary with total stats
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT 
                    COUNT(*) as total_days,
                    SUM(total_cards_reviewed) as total_cards,
                    SUM(decks_completed) as total_decks_completed,
                    AVG(total_cards_reviewed) as avg_cards_per_day,
                    MAX(streak_days) as longest_streak
                FROM daily_summary
            """)
            
            row = cursor.fetchone()
            return {
                'total_days': row[0] or 0,
                'total_cards': row[1] or 0,
                'total_decks_completed': row[2] or 0,
                'avg_cards_per_day': round(row[3], 1) if row[3] else 0,
                'longest_streak': row[4] or 0
            }
