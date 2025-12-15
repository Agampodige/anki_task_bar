# Anki Task Bar Widget

A futuristic, floating task bar for Anki that keeps your spaced repetition goals front and center without being intrusive.

![Anki Task Bar Widget](https://placeholder-image-url.com) *<!-- You can add a screenshot here later -->*

## ✨ Features

- **Floating Widget**: A frameless, draggable window that floats above your Anki session.
- **Focus Mode**: Toggle the widget instantly with a global shortcut (**Ctrl+1**).
- **Visual Progress**: Tracks your "New", "Learn", and "Review" cards with sleek, animated progress bars.
- **Deck Selection**: Choose exactly which decks you want to track using the "Manage Decks" interface.
- **Bulk Actions**: Quickly "Select All", "Deselect All", or "Invert" your tracking list.
- **Seamless Integration**: Click any specific deck bar to immediately jump into reviewing that deck.

## 🚀 Usage

1.  **Open Anki**.
2.  Press **`Ctrl+1`** to toggle the widget.
3.  **Drag** the widget anywhere on your screen by clicking and holding the background.
4.  Click **"Manage Decks"** to select which decks to track.
5.  Click **"Back to Grinding"** to hide the widget and focus on your work.

## 🛠️ Configuration

The widget is designed to be zero-config for the most part, but you can customize deck monitoring via the internal menu.

## 📦 Installation

*(If this were distributed as an .ankiaddon file)*
1.  Download the latest release.
2.  Open Anki -> Tools -> Add-ons -> Install from file...
3.  Select the file and restart Anki.

## 💻 functionality
- **Bridge**: Uses a robust Python-to-JavaScript bridge (`QWebChannel`) for high-performance UI rendering.
- **Tech Stack**: Python (PyQt6/PySide6) + HTML/CSS/JS (WebEngine).
