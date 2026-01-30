/**
 * common.js - Shared utilities for Anki Taskbar frontend
 */

window.AnkiTaskbar = {
    settings: {},
    translations: {},

    /**
     * Initialize QWebChannel and set up basic window functionality
     * @param {Function} callback - Called once the channel is established
     */
    init: function (callback) {
        var self = this;
        if (this._initPromise) {
            if (callback) this._initPromise.then(callback);
            return this._initPromise;
        }

        this._initPromise = new Promise(function (resolve) {
            // Disable Ctrl+Scroll Zoom globally
            window.addEventListener('wheel', function (e) {
                if (e.ctrlKey) e.preventDefault();
            }, { passive: false });

            if (typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined' && qt.webChannelTransport) {
                new QWebChannel(qt.webChannelTransport, function (channel) {
                    window.py = channel.objects.py;

                    self.setupWindowControls();
                    self.setupShortcuts();

                    if (callback) callback(window.py);
                    resolve(window.py);
                });
            } else {
                console.warn("QWebChannel not found, running in standalone mode");
                if (callback) callback(null);
                resolve(null);
            }
        });

        return this._initPromise;
    },

    /**
     * Bind window control buttons (min, max, close, drag)
     */
    setupWindowControls: function () {
        var winMin = document.getElementById('win-min');
        var winExpand = document.getElementById('win-expand');
        var winClose = document.getElementById('win-close');
        var dragRegion = document.querySelector('.drag-region');

        if (winMin) {
            winMin.onclick = function () { if (window.py) window.py.minimize_window(); };
        }
        if (winExpand) {
            winExpand.onclick = function () { if (window.py) window.py.toggle_expand(); };
        }
        if (winClose) {
            winClose.onclick = function () { if (window.py) window.py.close_window(); };
        }
        if (dragRegion) {
            dragRegion.onmousedown = function () { if (window.py) window.py.drag_window(); };
        }

        // Enable resizable by default if available
        if (window.py && window.py.make_window_resizable) {
            window.py.make_window_resizable();
        }
    },

    /**
     * Setup common keyboard shortcuts
     */
    setupShortcuts: function () {
        document.addEventListener('keydown', function (e) {
            var isInput = ['INPUT', 'TEXTAREA'].indexOf(e.target.tagName) !== -1 || e.target.isContentEditable;

            // Ctrl/Cmd + H: Home
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                if (window.py) window.py.load_home_page();
            }
            // Ctrl/Cmd + S: Sessions
            else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (window.py) window.py.load_sessions_page();
            }
            // Ctrl/Cmd + ,: Settings
            else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault();
                if (window.py) window.py.load_settings_page();
            }
            // Escape: Back to Home (if not in input)
            else if (e.key === 'Escape' && !isInput) {
                if (window.py) window.py.load_home_page();
            }
        });
    },

    /**
     * Load settings from backend and apply common UI changes
     * @param {Function} callback - Called with settings object
     */
    loadAndApplySettings: function (callback) {
        var self = this;
        if (!window.py || !window.py.load_settings_from_file) {
            // Fallback for standalone mode: Try to load from localStorage or just use defaults
            var saved = localStorage.getItem('anki_taskbar_settings');
            var settings = saved ? JSON.parse(saved) : {};
            self.settings = settings;
            self.loadTranslations(settings.language || 'en', function () {
                self.applyTheme(settings);
                if (callback) callback(settings);
            });
            return;
        }

        window.py.load_settings_from_file(function (data) {
            try {
                var settings = data ? JSON.parse(data) : {};
                self.settings = settings;

                // Load translations first, then apply theme and UI
                self.loadTranslations(settings.language || 'en', function () {
                    self.applyTheme(settings);
                    if (callback) callback(settings);
                });
            } catch (e) {
                console.error("Failed to parse settings:", e);
                if (callback) callback({});
            }
        });
    },

    /**
     * Load translation file
     */
    loadTranslations: function (lang, callback) {
        var self = this;
        var url = 'locales/' + lang + '.json';

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        self.translations = JSON.parse(xhr.responseText);
                        self.applyTranslations();
                    } catch (e) {
                        console.error("Failed to parse translation file:", e);
                    }
                }
                if (callback) callback();
            }
        };
        xhr.send();
    },

    /**
     * Translate a key
     */
    t: function (key) {
        return this.translations[key] || key;
    },

    /**
     * Scan document for data-i18n attributes and apply translations
     */
    applyTranslations: function () {
        var elements = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var key = el.getAttribute('data-i18n');
            var translation = this.t(key);

            if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search' || el.type === 'password')) {
                el.placeholder = translation;
            } else {
                // If it has children (icons etc), we might want to target a specific span or just use textContent carefully
                // But for now, simple replace if no children
                if (el.children.length === 0) {
                    el.textContent = translation;
                } else {
                    // Search for a span or text node to replace?
                    // Common pattern: <button> <svg> <span>Text</span> </button>
                    var span = el.querySelector('span');
                    if (span) span.textContent = translation;
                }
            }
        }

        // Also handle titles (tooltips)
        var titled = document.querySelectorAll('[data-i18n-title]');
        for (var i = 0; i < titled.length; i++) {
            var el = titled[i];
            var key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        }
    },

    /**
     * Apply theme, appearance, and zoom settings to the document
     * @param {Object} settings 
     */
    applyTheme: function (settings) {
        if (!settings) settings = {};
        var theme = settings.theme || 'green';
        var appearance = settings.appearance || 'dark';
        var zoomLevel = settings.zoomLevel !== undefined ? settings.zoomLevel : 1.0;
        var compactMode = !!settings.compactMode;
        var movable = settings.movable !== false;

        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-appearance', appearance);
        document.body.style.zoom = zoomLevel;

        if (compactMode) document.body.classList.add('compact');
        else document.body.classList.remove('compact');

        if (!movable) document.body.classList.add('locked');
        else document.body.classList.remove('locked');

        if (window.py && window.py.set_always_on_top) {
            window.py.set_always_on_top(settings.alwaysOnTop !== false);
        }
    },

    /**
     * Promise-based wrapper for backend calls
     * @param {string} method 
     * @param {Array} args 
     * @returns {Promise}
     */
    callBackend: function (method, args) {
        var actualArgs = args || [];
        return new Promise(function (resolve, reject) {
            if (window.py && typeof window.py[method] === 'function') {
                var callback = function (response) {
                    try {
                        resolve(response ? JSON.parse(response) : { ok: true });
                    } catch (e) {
                        console.error("Error parsing response from " + method + ":", e);
                        reject(e);
                    }
                };
                window.py[method].apply(window.py, actualArgs.concat([callback]));
            } else {
                reject(new Error("Method " + method + " not found on backend"));
            }
        });
    }
};
