<img width="827" height="815" alt="image" src="https://github.com/user-attachments/assets/bf31e45e-04ab-439e-8d3e-5a4cca321044" /># Anki Task by Sene🦎

A futuristic, floating task bar for Anki that keeps your spaced repetition goals front and center without being intrusive.
<img width="1647" height="2246" alt="123123" src="https://github.com/user-attachments/assets/3a61ed43-288b-4549-84a3-03d9201e6357" />


## 💡 How to make it work for you

- **Quick Open:** Press `Alt + Q` to instantly show or hide the widget.
- **Fast Navigation:** Use arrow keys or your mouse to browse decks and start studying immediately.
- **Pro Tip:** Map `Alt + Q` and arrow keys to a controller using **JoyToKey** (Windows) or **AntiMicroX** (Linux) to make reviews feel game-like.

---

## ✨ Key Features

- **Floating Widget** – Borderless, minimal UI that stays on top
- **Instant Toggle** – Open or hide the dashboard with `Alt + Q`
- **Visual Progress** – Animated bars for **New**, **Learn**, and **Review** cards
- **Priority System** – Mark decks as **High**, **Medium**, or **Low** priority  
  *(Sessions must be disabled to use deck-level priorities)*
- **Sessions System** – Group decks into sessions and load them instantly
- **Session Summary** – View progress for each session at a glance
- **Built-in Analytics** – Daily stats and trends without leaving Anki
- **One-Click Study** – Click any deck or progress bar to start studying
- **Theme Support** – Dark and Light themes
- **Accent Colors** – Customize the UI accent color
- **UI Scaling** – Zoom the interface for comfort
- **Compact Mode** – Optimized for small screens
- **Window Presets** – Multiple predefined window sizes *(new)*
- **Always on Top** – Keep the widget visible at all times
- **Import / Export Sessions** – Backup or share session presets
- **Export Sessions as Todo Lists**
- **Keyboard & Mouse Friendly** – Efficient browsing with keys or mouse

> New to the interface? Enable the **Quick Tour** from Settings for a guided walkthrough.

---

## 🛠 How to Use

1. **Open:** Press `Alt + Q` or go to **Tools → Open Taskbar Widget**
2. **Sessions:** Press `Ctrl + S` or click **Sessions** to create and organize deck groups
3. **Study:** Progress updates in real time as you complete cards
4. **Analytics:** Open **Analytics** to track your daily performance

---



> use a Gamming Controller with keybindings.
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
