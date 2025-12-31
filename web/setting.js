document.addEventListener("DOMContentLoaded", () => {
    // Disable Ctrl+Scroll Zoom
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) e.preventDefault();
    }, { passive: false });

    // Window size presets
    const WINDOW_SIZE_PRESETS = {
        custom: { width: 0, height: 0, name: 'Custom' },
        small: { width: 400, height: 300, name: 'Small (400x300)' },
        medium: { width: 600, height: 450, name: 'Medium (600x450)' },
        large: { width: 800, height: 600, name: 'Large (800x600)' },
        xlarge: { width: 1000, height: 750, name: 'Extra Large (1000x750)' },
        compact: { width: 350, height: 500, name: 'Compact (350x500)' },
        wide: { width: 1200, height: 400, name: 'Wide (1200x400)' },
        tall: { width: 500, height: 800, name: 'Tall (500x800)' }
    };

    const hideToggle = document.getElementById("hideDecksToggle");
    const sessionToggle = document.getElementById("sessionToggle");
    const sessionsEnabledToggle = document.getElementById("sessionsEnabledToggle");
    const showStatsBarToggle = document.getElementById("showStatsBarToggle");
    const alwaysOnTopToggle = document.getElementById("alwaysOnTopToggle");
    const startTourBtn = document.getElementById("start-tour");
    const hideSearchBarToggle = document.getElementById("hideSearchBarToggle");
    const compactModeToggle = document.getElementById("compactModeToggle");
    const appearanceToggle = document.getElementById("appearanceToggle");
    const confettiToggle = document.getElementById("confettiToggle");
    const hideCompletedSessionsToggle = document.getElementById("hideCompletedSessionsToggle");
    const movableToggle = document.getElementById("movableToggle");
    const windowSizePreset = document.getElementById("windowSizePreset");
    const colorBtns = document.querySelectorAll('.color-btn');

    // Zoom controls
    const zoomInBtn = document.getElementById("zoom-in");
    const zoomOutBtn = document.getElementById("zoom-out");
    const zoomValueEl = document.getElementById("zoom-value");
    let currentZoom = 1.0;

    const statusEl = document.getElementById("settings-status");
    const openAddonFolderBtn = document.getElementById("open-addon-folder");
    const openProjectBtn = document.getElementById("open-project-page");
    const exportSessionsBtn = document.getElementById("export-sessions");
    const importSessionsBtn = document.getElementById("import-sessions");
    const copySessionsTodoBtn = document.getElementById("copy-sessions-todo");

    let currentSettings = {};

    function isSessionCompleted(session) {
        // Check if session is completed based on progress or card counts
        const progress = session.progress || 0;
        const doneCards = session.done_cards || 0;
        const totalCards = session.total_cards || 0;

        // If it has card counts, use them for accuracy
        if (totalCards > 0) return doneCards >= totalCards;
        // Fallback to progress float (0.999 to account for floating point precision)
        return progress >= 0.999;
    }

    function generateTodoList(sessions) {
        return sessions.map(session => {
            const isCompleted = isSessionCompleted(session);
            const prefix = isCompleted ? '✅ ' : '';
            return `${prefix}${session.name || 'Untitled Session'}`;
        }).join('\n');
    }

    function copyToClipboard(text) {
        // Create a temporary textarea element
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed'; // Prevent scrolling to bottom
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        try {
            textarea.select();
            const successful = document.execCommand('copy');
            if (!successful) {
                throw new Error('Copy command failed');
            }
        } catch (err) {
            console.error('Failed to copy text: ', err);
            // Fallback for modern browsers
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).catch(err => {
                    console.error('Clipboard API failed: ', err);
                    throw err;
                });
            } else {
                throw err;
            }
        } finally {
            document.body.removeChild(textarea);
        }
    }

    function setStatus(text, kind) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.dataset.kind = kind || '';
        if (!text) return;
        window.clearTimeout(window._settingsStatusTimer);
        window._settingsStatusTimer = window.setTimeout(() => {
            statusEl.textContent = '';
            statusEl.dataset.kind = '';
        }, 1500);
    }

    const defaultSettings = {
        hideCompleted: false,
        enableSessions: true,
        sessionsEnabled: true,
        showStatsBar: true,
        hideSearchBar: false,
        compactMode: false,
        confettiEnabled: true,
        alwaysOnTop: true,
        theme: 'green',
        appearance: 'dark',
        zoomLevel: 1.0,
        movable: true,
        windowSizePreset: 'custom',
        hideCompletedSessions: false
    };

    function updateZoomDisplay() {
        if (zoomValueEl) zoomValueEl.textContent = `${Math.round(currentZoom * 100)}%`;
    }

    function getSettingsFromUI() {
        const selectedBtn = document.querySelector('.color-btn.selected');
        const theme = selectedBtn ? selectedBtn.dataset.color : 'green';
        
        const selectedPreset = windowSizePreset ? windowSizePreset.value : 'custom';

        return {
            hideCompleted: !!hideToggle?.checked,
            enableSessions: !!sessionToggle?.checked,
            sessionsEnabled: !!sessionsEnabledToggle?.checked,
            showStatsBar: !!showStatsBarToggle?.checked,
            hideSearchBar: !!hideSearchBarToggle?.checked,
            compactMode: !!compactModeToggle?.checked,
            confettiEnabled: !!confettiToggle?.checked,
            alwaysOnTop: !!alwaysOnTopToggle?.checked,
            theme: theme,
            appearance: appearanceToggle?.checked ? 'light' : 'dark',
            zoomLevel: currentZoom,
            movable: !!movableToggle?.checked,
            windowSizePreset: selectedPreset,
            hideCompletedSessions: !!hideCompletedSessionsToggle?.checked
        };
    }

    function applyWindowSizePreset(preset) {
        if (!window.py || !window.py.apply_window_size_preset) return;
        
        const size = WINDOW_SIZE_PRESETS[preset];
        if (size && size.width > 0 && size.height > 0) {
            window.py.apply_window_size_preset(size.width, size.height);
            console.log(`Applied window size preset: ${size.name} (${size.width}x${size.height})`);
        }
    }

    function saveAllSettings() {
        const settings = getSettingsFromUI();
        document.body.classList.toggle('locked', settings.movable === false);
        
        const jsonString = JSON.stringify(settings);

        document.documentElement.setAttribute('data-theme', settings.theme);
        document.documentElement.setAttribute('data-appearance', settings.appearance);
        document.body.style.zoom = settings.zoomLevel;

        if (window.py && typeof window.py.set_always_on_top === 'function') {
            window.py.set_always_on_top(settings.alwaysOnTop);
        }

        // Apply window size preset if changed
        if (settings.windowSizePreset !== 'custom') {
            applyWindowSizePreset(settings.windowSizePreset);
        }

        if (window.py && typeof window.py.save_settings_to_file === 'function') {
            try {
                window.py.save_settings_to_file(jsonString);
                setStatus('Saved', 'ok');
            } catch (e) {
                setStatus('Error', 'error');
            }
        } else {
            setStatus('Saved (local)', 'ok');
        }
    }

    function applySettingsToUI(settings) {
        const merged = { ...defaultSettings, ...(settings || {}) };
        currentSettings = merged

        if (hideToggle) hideToggle.checked = !!merged.hideCompleted;
        if (sessionToggle) sessionToggle.checked = !!merged.enableSessions;
        if (sessionsEnabledToggle) sessionsEnabledToggle.checked = !!merged.sessionsEnabled;
        if (showStatsBarToggle) showStatsBarToggle.checked = !!merged.showStatsBar;
        if (hideSearchBarToggle) hideSearchBarToggle.checked = !!merged.hideSearchBar;
        if (compactModeToggle) compactModeToggle.checked = !!merged.compactMode;
        if (confettiToggle) confettiToggle.checked = !!merged.confettiEnabled;
        if (alwaysOnTopToggle) alwaysOnTopToggle.checked = !!merged.alwaysOnTop;
        if (appearanceToggle) appearanceToggle.checked = merged.appearance === 'light';
        if (movableToggle) movableToggle.checked = merged.movable !== false;
        if (hideCompletedSessionsToggle) hideCompletedSessionsToggle.checked = !!merged.hideCompletedSessions;
        if (windowSizePreset) windowSizePreset.value = merged.windowSizePreset || 'custom';

        document.body.classList.toggle('locked', merged.movable === false);

        currentZoom = merged.zoomLevel !== undefined ? merged.zoomLevel : 1.0;
        updateZoomDisplay();

        colorBtns.forEach(btn => {
            if (btn.dataset.color === merged.theme) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        document.documentElement.setAttribute('data-theme', merged.theme);
        document.documentElement.setAttribute('data-appearance', merged.appearance);
        document.body.style.zoom = currentZoom;
    }

    function loadInitialSettings() {
        if (window.py && typeof window.py.load_settings_from_file === 'function') {
            window.py.load_settings_from_file((data) => {
                try {
                    const cfg = data ? JSON.parse(data) : {};
                    applySettingsToUI(cfg);
                } catch (e) {
                    applySettingsToUI(defaultSettings);
                }
            });
        } else {
            applySettingsToUI(defaultSettings);
        }
    }

    function bindUI() {
        // Bind all toggle switches
        [hideToggle, sessionToggle, sessionsEnabledToggle, showStatsBarToggle, 
         hideSearchBarToggle, compactModeToggle, confettiToggle, alwaysOnTopToggle,
         appearanceToggle, movableToggle, hideCompletedSessionsToggle].forEach(toggle => {
            if (toggle) {
                toggle.addEventListener('change', saveAllSettings);
            }
        });

        // Bind window size preset
        if (windowSizePreset) {
            windowSizePreset.addEventListener('change', saveAllSettings);
        }

        // Bind zoom controls
        zoomInBtn?.addEventListener('click', () => {
            currentZoom = Math.min(Math.round((currentZoom + 0.1) * 10) / 10, 2.0);
            updateZoomDisplay();
            saveAllSettings();
        });

        zoomOutBtn?.addEventListener('click', () => {
            currentZoom = Math.max(Math.round((currentZoom - 0.1) * 10) / 10, 0.5);
            updateZoomDisplay();
            saveAllSettings();
        });

        // Bind color buttons
        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                saveAllSettings();
            });
        });

        // Bind action buttons
        openAddonFolderBtn?.addEventListener('click', () => {
            if (window.py && typeof window.py.open_addon_folder === 'function') window.py.open_addon_folder();
        });

        openProjectBtn?.addEventListener('click', () => {
            const url = 'https://github.com/Agampodige/anki_task_bar';
            if (window.py && typeof window.py.open_link === 'function') window.py.open_link(url);
        });

        exportSessionsBtn?.addEventListener('click', () => {
            if (window.py && typeof window.py.export_sessions === 'function') {
                window.py.export_sessions((res) => {
                    try {
                        const data = JSON.parse(res);
                        if (data.ok) setStatus('Exported', 'ok');
                    } catch (e) { }
                });
            }
        });

        importSessionsBtn?.addEventListener('click', () => {
            if (window.py && typeof window.py.import_sessions === 'function') {
                window.py.import_sessions((res) => {
                    try {
                        const data = JSON.parse(res);
                        if (data.ok) setStatus('Imported', 'ok');
                    } catch (e) { }
                });
            }
        });

        copySessionsTodoBtn?.addEventListener('click', () => {
            if (window.py && typeof window.py.get_sessions === 'function') {
                window.py.get_sessions((response) => {
                    try {
                        const data = JSON.parse(response);
                        if (data && data.sessions) {
                            const todoList = generateTodoList(data.sessions);
                            copyToClipboard(todoList);
                            setStatus('Session list copied to clipboard', 'ok');
                        } else {
                            setStatus('No sessions found', 'error');
                        }
                    } catch (e) {
                        setStatus('Error fetching sessions', 'error');
                    }
                });
            } else {
                setStatus('Backend not available', 'error');
            }
        });

        startTourBtn?.addEventListener('click', () => {
            window.location.href = 'index.html?startTour=true';
        });
        
        // Add drag functionality for settings page
        const dragRegion = document.querySelector('.drag-region');
        if (dragRegion) {
            dragRegion.addEventListener('mousedown', (e) => {
                if (window.py && typeof window.py.drag_window === 'function') {
                    window.py.drag_window();
                }
            });
        }
        
        // Add resizable functionality to all pages
        function addResizableFunctionality() {
            // Make window resizable by default
            if (window.py && typeof window.py.make_window_resizable === 'function') {
                window.py.make_window_resizable();
            }
        }
        
        // Initialize resizable functionality
        addResizableFunctionality();
        
        // Add keyboard shortcuts for navigation
        function addKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + S: Go to Sessions page
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    if (window.py && typeof window.py.load_sessions_page === 'function') {
                        window.py.load_sessions_page();
                    }
                }
                // Ctrl/Cmd + H: Go to Home (main page)
                else if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                    e.preventDefault();
                    if (window.py && typeof window.py.load_home_page === 'function') {
                        window.py.load_home_page();
                    }
                }
                // Escape: Return to main page
                else if (e.key === 'Escape') {
                    if (window.py && typeof window.py.load_home_page === 'function') {
                        window.py.load_home_page();
                    }
                }
            });
        }
        
        // Initialize keyboard shortcuts
        addKeyboardShortcuts();
    }

    bindUI();

    if (typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined' && qt.webChannelTransport) {
        new QWebChannel(qt.webChannelTransport, function (channel) {
            window.py = channel.objects.py;
            document.getElementById('win-min')?.addEventListener('click', () => window.py.minimize_window());
            document.getElementById('win-expand')?.addEventListener('click', () => window.py.toggle_expand());
            document.getElementById('win-close')?.addEventListener('click', () => window.py.close_window());
            loadInitialSettings();
        });
    } else {
        loadInitialSettings();
    }
});
