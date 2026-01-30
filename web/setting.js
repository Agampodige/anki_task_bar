document.addEventListener("DOMContentLoaded", function () {
    // Initialize common utilities and bridge
    AnkiTaskbar.init(function (py) {
        if (!py) return;
        AnkiTaskbar.loadAndApplySettings(applySettingsToUI);
    });

    var statusEl = document.getElementById("settings-status");
    var currentSettings = {};

    function setStatus(text, kind) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.setAttribute('data-kind', kind || '');
        if (!text) return;
        clearTimeout(window._statusTimer);
        window._statusTimer = setTimeout(function () {
            statusEl.textContent = '';
            statusEl.setAttribute('data-kind', '');
        }, 1500);
    }

    var toggles = [
        "hideDecksToggle", "sessionToggle", "sessionsEnabledToggle", "showStatsBarToggle",
        "alwaysOnTopToggle", "hideSearchBarToggle", "compactModeToggle",
        "confettiToggle", "hideCompletedSessionsToggle", "randomSessionsToggle", "movableToggle"
    ];

    function getSettingsFromUI() {
        var theme = 'green';
        var selectedColorBtn = document.querySelector('.color-btn.selected');
        if (selectedColorBtn) {
            theme = selectedColorBtn.getAttribute('data-color') || 'green';
        }

        var preset = 'custom';
        var presetEl = document.getElementById("windowSizePreset");
        if (presetEl) preset = presetEl.value || 'custom';

        var zoom = 1.0;
        var zoomValEl = document.getElementById("zoom-value");
        if (zoomValEl) {
            zoom = parseFloat(zoomValEl.textContent) / 100 || 1.0;
        }

        var appearanceToggle = document.getElementById("appearanceToggle");
        var langSelector = document.getElementById("languageSelector");

        // Clone current settings
        var settings = JSON.parse(JSON.stringify(currentSettings));

        settings.theme = theme;
        settings.windowSizePreset = preset;
        settings.zoomLevel = zoom;
        settings.appearance = (appearanceToggle && appearanceToggle.checked) ? 'light' : 'dark';
        settings.language = langSelector ? langSelector.value : 'en';

        for (var i = 0; i < toggles.length; i++) {
            var id = toggles[i];
            var el = document.getElementById(id);
            if (el) {
                var settingsKey = id.replace('Toggle', '');
                if (id === "hideDecksToggle") settingsKey = "hideCompleted";
                if (id === "sessionToggle") settingsKey = "enableSessions";
                settings[settingsKey] = el.checked;
            }
        }

        return settings;
    }

    function saveAllSettings(applyPreset) {
        var settings = getSettingsFromUI();
        currentSettings = settings;
        AnkiTaskbar.applyTheme(settings);

        AnkiTaskbar.callBackend('save_settings_to_file', [JSON.stringify(settings)]).then(function (res) {
            if (res && res.ok) setStatus(AnkiTaskbar.t('saved_status'), 'ok');
            else setStatus(AnkiTaskbar.t('error_status'), 'error');
        });

        if (applyPreset && settings.windowSizePreset !== 'custom' && window.py && window.py.apply_window_size_preset) {
            var presets = {
                small: [400, 300], medium: [600, 450], large: [800, 600],
                xlarge: [1000, 750], compact: [350, 500], wide: [1200, 400], tall: [500, 800]
            };
            var presetValues = presets[settings.windowSizePreset];
            if (presetValues) {
                window.py.apply_window_size_preset(presetValues[0], presetValues[1]);
            }
        }
    }

    function applySettingsToUI(settings) {
        currentSettings = settings || {};

        for (var i = 0; i < toggles.length; i++) {
            var id = toggles[i];
            var el = document.getElementById(id);
            if (el) {
                var settingsKey = id.replace('Toggle', '');
                if (id === "hideDecksToggle") settingsKey = "hideCompleted";
                if (id === "sessionToggle") settingsKey = "enableSessions";
                el.checked = !!currentSettings[settingsKey];
            }
        }

        var appToggle = document.getElementById("appearanceToggle");
        if (appToggle) {
            appToggle.checked = currentSettings.appearance === 'light';
        }

        var langSelector = document.getElementById("languageSelector");
        if (langSelector) {
            langSelector.value = currentSettings.language || 'en';
        }

        var presetEl = document.getElementById("windowSizePreset");
        if (presetEl) presetEl.value = currentSettings.windowSizePreset || 'custom';

        var zoomVal = document.getElementById("zoom-value");
        if (zoomVal) {
            zoomVal.textContent = Math.round((currentSettings.zoomLevel || 1.0) * 100) + '%';
        }

        var colorBtns = document.querySelectorAll('.color-btn');
        for (var i = 0; i < colorBtns.length; i++) {
            var btn = colorBtns[i];
            var color = btn.getAttribute('data-color');
            if (color === currentSettings.theme) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        }
    }

    var appearanceToggle = document.getElementById("appearanceToggle");
    if (appearanceToggle) {
        appearanceToggle.addEventListener('change', function () { saveAllSettings(false); });
    }

    var langSelector = document.getElementById("languageSelector");
    if (langSelector) {
        langSelector.addEventListener('change', function () {
            var lang = langSelector.value;
            AnkiTaskbar.loadTranslations(lang, function () {
                saveAllSettings(false);
            });
        });
    }

    // --- UI Listeners ---
    for (var i = 0; i < toggles.length; i++) {
        (function () {
            var id = toggles[i];
            var el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', function () {
                    saveAllSettings(false);
                });
            }
        })();
    }

    var presetEl = document.getElementById("windowSizePreset");
    if (presetEl) presetEl.addEventListener('change', function () { saveAllSettings(true); });

    var colorBtns = document.querySelectorAll('.color-btn');
    for (var i = 0; i < colorBtns.length; i++) {
        (function () {
            var btn = colorBtns[i];
            btn.addEventListener('click', function () {
                var allBtns = document.querySelectorAll('.color-btn');
                for (var j = 0; j < allBtns.length; j++) {
                    allBtns[j].classList.remove('selected');
                }
                btn.classList.add('selected');
                saveAllSettings(false);
            });
        })();
    }

    // Zoom
    var zoomInBtn = document.getElementById("zoom-in");
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', function () {
            var val = document.getElementById("zoom-value");
            var zoom = (parseFloat(val.textContent) + 10) / 100;
            if (zoom <= 2.0) {
                val.textContent = Math.round(zoom * 100) + '%';
                saveAllSettings(false);
            }
        });
    }

    var zoomOutBtn = document.getElementById("zoom-out");
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', function () {
            var val = document.getElementById("zoom-value");
            var zoom = (parseFloat(val.textContent) - 10) / 100;
            if (zoom >= 0.5) {
                val.textContent = Math.round(zoom * 100) + '%';
                saveAllSettings(false);
            }
        });
    }

    // Action Buttons
    var addonFolderBtn = document.getElementById("open-addon-folder");
    if (addonFolderBtn) {
        addonFolderBtn.addEventListener('click', function () { if (window.py) window.py.open_addon_folder(); });
    }

    var projectPageBtn = document.getElementById("open-project-page");
    if (projectPageBtn) {
        projectPageBtn.addEventListener('click', function () { if (window.py) window.py.open_link('https://github.com/Agampodige/anki_task_bar'); });
    }

    var coffeeBtn = document.getElementById("buy-me-coffee");
    if (coffeeBtn) {
        coffeeBtn.addEventListener('click', function () { if (window.py) window.py.open_link('https://ko-fi.com/senee'); });
    }

    var tourBtn = document.getElementById("start-tour");
    if (tourBtn) {
        tourBtn.addEventListener('click', function () { window.location.href = 'index.html?startTour=true'; });
    }

    var exportSessionsBtn = document.getElementById("export-sessions");
    if (exportSessionsBtn) {
        exportSessionsBtn.addEventListener('click', function () {
            AnkiTaskbar.callBackend('export_sessions').then(function (res) { if (res && res.ok) setStatus(AnkiTaskbar.t('saved_status'), 'ok'); });
        });
    }

    var importSessionsBtn = document.getElementById("import-sessions");
    if (importSessionsBtn) {
        importSessionsBtn.addEventListener('click', function () {
            AnkiTaskbar.callBackend('import_sessions').then(function (res) { if (res && res.ok) setStatus(AnkiTaskbar.t('saved_status'), 'ok'); });
        });
    }

    var copyBtn = document.getElementById("copy-sessions-todo");
    if (copyBtn) {
        copyBtn.addEventListener('click', function () {
            AnkiTaskbar.callBackend('get_sessions').then(function (data) {
                var sessions = data.sessions || [];
                var lines = [];
                for (var i = 0; i < sessions.length; i++) {
                    var s = sessions[i];
                    lines.push((s.progress >= 0.999 ? '\u2705 ' : '') + s.name);
                }
                var list = lines.join('\n');
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(list).then(function () { setStatus('Copied to clipboard', 'ok'); });
                }
            });
        });
    }
});
