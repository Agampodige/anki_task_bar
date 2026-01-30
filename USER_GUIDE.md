# 🦎 Anki Taskbar User Guide

Welcome to **Anki Taskbar**, a futuristic, floating interface designed to keep your study goals front and center. This guide will help you master all the features and settings to optimize your spaced repetition workflow.

---

## � Table of Contents
- [Getting Started](#-getting-started)
- [Core Interface](#-core-interface)
- [Deck Selection & Management](#-deck-selection--management)
- [The Sessions System](#-the-sessions-system)
- [Settings & Customization](#-settings--customization)
- [Shortcuts](#-shortcuts)
- [Pro Tips](#-pro-tips)

---

## �🚀 Getting Started
<a name="-getting-started"></a>

### Installation
1.  **From `.ankiaddon` file**:
    - Open Anki → **Tools** → **Add-ons** → **Install from file...**
    - Select the downloaded file and restart Anki.
2.  **Manual Installation**:
    - Download/Clone the repository.
    - Copy the folder to your Anki addons directory (usually `~/.local/share/Anki2/addons21/` on Linux).
    - Restart Anki.

### First Run
When you first open Anki Taskbar, a **Quick Tour** will automatically start to guide you through the main interface. You can restart this tour anytime from the **Settings** menu.

---

## 🖥️ Core Interface
<a name="-core-interface"></a>

The Taskbar is designed to be a minimal, floating widget.

### The Dashboard
-   **Toggle Visibility**: Use `Alt + Q` to instantly show or hide the widget.
-   **Progress Bars**:
    -   **Blue**: New cards remaining.
    -   **Red**: Learning cards remaining.
    -   **Green**: Review cards remaining.
-   **Deck List**: Click on any deck name to start studying it immediately.
-   **Stats Bar**: Displays an overview of your total decks, cards, and estimated time remaining (must be enabled in Settings).

---

## 🎴 Deck Selection & Management
<a name="-deck-selection--management"></a>

Choose exactly which decks you want to focus on using the **Select Decks** page.

### Selection Tools
-   **Search**: Use the search bar to quickly find specific decks by name.
-   **Bulk Actions**: Use the **All**, **None**, or **Invert** buttons to quickly manage large lists.
-   **Tree Navigation**: Expand or collapse deck hierarchies to see sub-decks. Use **Expand All** or **Collapse All** for quick viewing.
-   **Direct Session Creation**: You can name your selection and click **Create Session** to instantly save it as a new session in your library.

### Saving
-   **Save Selection**: After picking your decks, click **Save Selection** to update the main dashboard. The widget will now only track progress for these specific decks.

---

## 🗃️ The Sessions System
<a name="-the-sessions-system"></a>

Sessions allow you to group multiple decks into custom "study units."

### Managing Sessions
1.  Open the **Sessions Library** from the dashboard.
2.  **Create Folders**: Organize your sessions into folders for easier navigation.
3.  **New Session**: Add a new session and select the decks you want to include.
4.  **Activate**: Right-click a session (or use the menu) to **Activate** it. Once active, ONLY the cards from that session will be tracked in the main dashboard.
5.  **Study**: Click the "Study" button on a session card to instantly load those decks in Anki.

### Data Portability
-   **Export/Import**: Move your session configurations between devices using the buttons in the **Settings** menu.
-   **Todo List**: Export your current session list as a text-based Todo list to your clipboard.

---

## ⚙️ Settings & Customization
<a name="-settings--customization"></a>

Anki Taskbar is highly customizable to fit your screen and style.

### Window & Behavior
-   **Always on Top**: Keep the widget visible even while working in other apps.
-   **Window Presets**: Choose from predefined sizes like *Compact*, *Wide*, *Tall*, or *Medium*.
-   **Movable**: Toggle whether the window can be dragged to a new position.
-   **Auto Hide on Review**: Automatically hide the widget when you start an Anki review session.

### Appearance
-   **Themes**: Toggle between **Light** and **Dark** modes.
-   **Accent Colors**: Personalize the UI with colors like Green, Blue, Purple, or Orange.
-   **UI Scaling**: Use the **Zoom** controls to make the interface larger or smaller.
-   **Compact Mode**: Enable this for a tighter layout with smaller icons, perfect for small screens.

### Content
-   **Hide Completed Decks**: Keep your dashboard clean by hiding decks that are already "done" for the day.
-   **Confetti Effects**: Enable a celebratory burst when you finish all your tasks!

---

## ⌨️ Shortcuts
<a name="-shortcuts"></a>

| Shortcut | Action |
| :--- | :--- |
| `Alt + Q` | Toggle Taskbar Widget |
| `F12` | Open Web Developer Tools (for debugging) |
| `Arrow Keys` | Navigate deck lists (when focused) |

---

## 💡 Pro Tips
<a name="-pro-tips"></a>

-   **Controller Support**: Use tools like **AntiMicroX** or **JoyToKey** to map `Alt + Q` and navigation keys to a gaming controller for a console-like study experience.
-   **Global Progress**: Watch the progress bar at the very top of the widget to see how close you are to finishing your ENTIRE daily goal.

---

*Enjoy your studies! If you find this tool helpful, consider supporting development via the **Buy Me a Coffee** link in Settings.*
