document.addEventListener("DOMContentLoaded", () => {
    // Disable Ctrl+Scroll Zoom
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) e.preventDefault();
    }, { passive: false });

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
    const movableToggle = document.getElementById("movableToggle");
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

    let currentSettings = {};

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
        movable: true
    };

    function updateZoomDisplay() {
        if (zoomValueEl) zoomValueEl.textContent = `${Math.round(currentZoom * 100)}%`;
    }

    function getSettingsFromUI() {
        const selectedBtn = document.querySelector('.color-btn.selected');
        const theme = selectedBtn ? selectedBtn.dataset.color : 'green';

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
            movable: !!movableToggle?.checked
        };
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
        currentSettings = merged;

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
        }
    }

    function bindUI() {
        const toggles = [hideToggle, sessionToggle, sessionsEnabledToggle, showStatsBarToggle,
            hideSearchBarToggle, compactModeToggle, appearanceToggle, confettiToggle,
            movableToggle, alwaysOnTopToggle];
        toggles.forEach(t => t?.addEventListener("change", saveAllSettings));

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

        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                saveAllSettings();
            });
        });

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

        startTourBtn?.addEventListener('click', () => {
            window.location.href = 'index.html?startTour=true';
        });
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
