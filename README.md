# Anki Task Bar Widget

A futuristic, floating task bar for Anki that keeps your spaced repetition goals front and center without being intrusive.

![Anki Task Bar Widget](https://placeholder-image-url.com) *<!-- You can add a screenshot here later -->*

## ✨ Features

- **Floating Widget**: A frameless, draggable window that floats above your Anki session
- **Quick Toggle**: Toggle the widget instantly with **Alt+Q** keyboard shortcut
- **Visual Progress**: Tracks your "New", "Learn", and "Review" cards with sleek, animated progress bars
- **Priority Sorting**: Decks are automatically sorted by priority (High → Medium → Low) with visual indicators
- **Deck Selection**: Choose exactly which decks you want to track using the "Manage Decks" interface
- **Bulk Actions**: Quickly "Select All", "Deselect All", or "Invert" your tracking list
- **Search & Filter**: Quickly find decks with the built-in search functionality
- **Analytics Dashboard**: View daily statistics, completion trends, and study patterns
- **Seamless Integration**: Click any deck bar to immediately jump into reviewing that deck
- **Persistent State**: Your deck selections and window position are saved automatically

## 🚀 Usage

1. **Open Anki**
2. Press **Alt+Q** to toggle the widget (or use Tools → Open Taskbar Widget)
3. **Drag** the widget anywhere on your screen by clicking and holding the background
4. Click **"Manage Decks"** to select which decks to track
5. Set deck priorities (High/Medium/Low) to organize your study workflow
6. Click **"Analytics"** to view your study statistics and trends
7. Press **Escape** or click **"Back to Grinding"** to hide the widget and focus on your work

## 🛠️ Configuration

The widget is designed to be zero-config for the most part. Customization options include:

- **Deck Selection**: Choose which decks to monitor via the "Manage Decks" interface
- **Priority Levels**: Assign High, Medium, or Low priority to each deck
- **Window Position**: Drag the widget to your preferred screen location (position is saved)

## 📦 Installation

### From File
1. Download the latest release or clone this repository
2. Open Anki → Tools → Add-ons → Install from file...
3. Select the `.ankiaddon` file or the `anki_task_bar` folder
4. Restart Anki

### Manual Installation
1. Clone or download this repository
2. Copy the `anki_task_bar` folder to your Anki addons directory:
   - **Windows**: `%APPDATA%\Anki2\addons21\`
   - **Mac**: `~/Library/Application Support/Anki2/addons21/`
   - **Linux**: `~/.local/share/Anki2/addons21/`
3. Restart Anki

## 💻 Technical Details

- **Bridge**: Uses a robust Python-to-JavaScript bridge (`QWebChannel`) for high-performance UI rendering
- **Tech Stack**: Python (PyQt6/PySide6) + HTML/CSS/JS (WebEngine)
- **Database**: SQLite for storing daily statistics and analytics
- **Persistence**: JSON-based storage for deck selections and preferences

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

You are free to use, modify, and distribute this software under the terms of the AGPL-3.0 license. If you run a modified version of this software on a server or provide it as a service, you must make the source code available to users.

See the [LICENSE](LICENSE) file for full details.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs and issues
- Suggest new features
- Submit pull requests

## 👤 Author

**Sene**

## 🙏 Acknowledgments

Built for the Anki community to make spaced repetition more engaging and productive.
