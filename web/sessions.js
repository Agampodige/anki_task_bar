document.addEventListener("DOMContentLoaded", function () {
    // Initialize common utilities and bridge
    AnkiTaskbar.init(function (py) {
        if (!py) return;

        // Load settings and apply initial UI state
        AnkiTaskbar.loadAndApplySettings(function (cfg) {
            window.refreshData();
        });
    });

    // --- State Management ---
    window.sessionData = { folders: [], sessions: [], active_session_id: null };
    window.currentFolderId = null;
    window.focusSection = 'folders'; // 'folders' or 'sessions'
    window.folderFocusIndex = 0;
    window.sessionFocusIndex = 0;

    // --- Data Refresh & Rendering ---
    window.refreshData = function () {
        AnkiTaskbar.callBackend('get_sessions', []).then(function (data) {
            window.sessionData = data || { sessions: [], folders: [], active_session_id: null };
            renderFolders();
            renderMainContent();
            updateKeyboardNavState();
        });
    };

    function renderFolders() {
        var list = document.getElementById('folders-list');
        if (!list) return;

        var fragment = document.createDocumentFragment();

        // "All Sessions" item
        var allItem = document.createElement('div');
        allItem.className = 'nav-item' + (!window.currentFolderId ? ' active' : '');
        allItem.innerHTML = '<span>All Sessions</span>';
        allItem.onclick = function () {
            window.currentFolderId = null;
            window.refreshData();
        };
        fragment.appendChild(allItem);

        var folders = window.sessionData.folders || [];
        for (var i = 0; i < folders.length; i++) {
            (function () {
                var folderName = folders[i];
                var item = document.createElement('div');
                item.className = 'nav-item' + (window.currentFolderId === folderName ? ' active' : '');
                item.innerHTML = '<span>' + folderName + '</span>';

                item.onclick = function () {
                    window.currentFolderId = folderName;
                    window.refreshData();
                };

                // Context menu for folders
                item.oncontextmenu = function (e) {
                    e.preventDefault();
                    showContextMenu(e, [
                        { label: 'Rename', action: function () { renameFolder(folderName); } },
                        { label: 'Delete', action: function () { deleteFolder(folderName); }, danger: true }
                    ]);
                };

                fragment.appendChild(item);
            })();
        }

        list.innerHTML = '';
        list.appendChild(fragment);
    }

    function renderMainContent() {
        var container = document.getElementById('sessions-grid');
        if (!container) return;

        var fragment = document.createDocumentFragment();
        var allSessions = window.sessionData.sessions || [];
        var activeId = String(window.sessionData.active_session_id || '');
        var sessions = [];

        for (var i = 0; i < allSessions.length; i++) {
            var s = allSessions[i];
            if (!window.currentFolderId || s.folder === window.currentFolderId) {
                sessions.push(s);
            }
        }

        var titleEl = document.getElementById('current-view-title');
        if (titleEl) titleEl.textContent = window.currentFolderId || 'All Sessions';

        var badgeEl = document.getElementById('session-count-badge');
        if (badgeEl) badgeEl.textContent = String(sessions.length);

        if (sessions.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No sessions found in this folder.';
            fragment.appendChild(empty);
        } else {
            for (var i = 0; i < sessions.length; i++) {
                (function () {
                    var s = sessions[i];
                    var card = document.createElement('div');
                    var isThisActive = (String(s.id) === activeId);

                    card.className = 'session-card' + (isThisActive ? ' active-session' : '');
                    var progress = (s.progress || 0) * 100;
                    var deckCount = (s.deck_ids && s.deck_ids.length) || 0;

                    var html =
                        '<div class="card-header">' +
                        '<span class="card-title">' + s.name + '</span>' +
                        '<span class="card-menu-btn">\u22EE</span>' +
                        '</div>';

                    if (s.folder) {
                        html += '<div class="folder-badge">' + s.folder + '</div>';
                    }

                    html += '<div class="session-progress-wrapper">' +
                        '<div class="session-progress-text">' + Math.round(progress) + '%</div>' +
                        '<div class="session-progress-container">' +
                        '<div class="session-progress-bar" style="width: ' + progress + '%"></div>' +
                        '</div>' +
                        '</div>' +
                        '<div class="card-meta">' + deckCount + ' Decks</div>';

                    card.innerHTML = html;

                    card.onclick = function () {
                        if (window.py) {
                            window.py.activate_session(String(s.id));
                            setTimeout(function () { window.location.href = 'index.html'; }, 150);
                        }
                    };

                    var dots = card.querySelector('.card-menu-btn');
                    dots.onclick = function (e) {
                        e.stopPropagation();
                        showContextMenu(e, [
                            { label: 'Edit', action: function () { editSession(s.id); } },
                            { label: 'Move to Folder', action: function () { moveSession(s.id); } },
                            { label: 'Duplicate', action: function () { duplicateSession(s.id); } },
                            { label: 'Delete', action: function () { deleteSession(s.id); }, danger: true }
                        ]);
                    };

                    fragment.appendChild(card);
                })();
            }
        }

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    // --- Keyboard Navigation ---
    function updateKeyboardNavState() {
        var folders = document.querySelectorAll('.nav-item');
        var sessions = document.querySelectorAll('.session-card');

        // Clamp indices
        if (window.folderFocusIndex >= folders.length) window.folderFocusIndex = Math.max(0, folders.length - 1);
        if (window.sessionFocusIndex >= sessions.length) window.sessionFocusIndex = Math.max(0, sessions.length - 1);

        applyFocusUI();
    }

    function applyFocusUI() {
        // Clear all previous focus
        var items = document.querySelectorAll('.nav-item, .session-card');
        for (var i = 0; i < items.length; i++) items[i].classList.remove('keyboard-focus');

        var focusedEl = null;
        if (window.focusSection === 'folders') {
            var folders = document.querySelectorAll('.nav-item');
            focusedEl = folders[window.folderFocusIndex];
        } else {
            var sessions = document.querySelectorAll('.session-card');
            focusedEl = sessions[window.sessionFocusIndex];
        }

        if (focusedEl) {
            focusedEl.classList.add('keyboard-focus');
            if (typeof focusedEl.scrollIntoView === 'function') {
                focusedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    function handleKeyDown(e) {
        var isInput = ['INPUT', 'TEXTAREA'].indexOf(e.target.tagName) !== -1;
        if (isInput) return;

        // Global Shortcuts
        if (e.key === 'n') { document.getElementById('new-session-btn').click(); return; }
        if (e.key === 'f') { document.getElementById('add-folder-btn').click(); return; }
        if (e.key === 's') { document.getElementById('shuffle-sessions-btn').click(); return; }
        if (e.key === 'Escape') { hideContextMenu(); return; }

        var folders = document.querySelectorAll('.nav-item');
        var sessions = document.querySelectorAll('.session-card');

        if (window.focusSection === 'folders') {
            if (e.key === 'ArrowDown' || e.key === 'j') {
                window.folderFocusIndex = (window.folderFocusIndex + 1) % folders.length;
                e.preventDefault();
            } else if (e.key === 'ArrowUp' || e.key === 'k') {
                window.folderFocusIndex = (window.folderFocusIndex - 1 + folders.length) % folders.length;
                e.preventDefault();
            } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'Tab') {
                if (sessions.length > 0) {
                    window.focusSection = 'sessions';
                    e.preventDefault();
                }
            } else if (e.key === 'Enter') {
                folders[window.folderFocusIndex].click();
            }
        } else {
            // Sessions Grid Navigation
            var container = document.getElementById('sessions-grid');
            var cols = 1;
            if (container) {
                var style = window.getComputedStyle(container);
                cols = style.getPropertyValue('grid-template-columns').split(' ').length;
            }

            if (e.key === 'ArrowRight' || e.key === 'l') {
                window.sessionFocusIndex = (window.sessionFocusIndex + 1) % sessions.length;
                e.preventDefault();
            } else if (e.key === 'ArrowLeft' || e.key === 'h') {
                if (window.sessionFocusIndex % cols === 0) {
                    window.focusSection = 'folders';
                } else {
                    window.sessionFocusIndex = (window.sessionFocusIndex - 1 + sessions.length) % sessions.length;
                }
                e.preventDefault();
            } else if (e.key === 'ArrowDown' || e.key === 'j') {
                if (window.sessionFocusIndex + cols < sessions.length) {
                    window.sessionFocusIndex += cols;
                } else {
                    window.sessionFocusIndex = window.sessionFocusIndex % cols; // Wrap to top
                }
                e.preventDefault();
            } else if (e.key === 'ArrowUp' || e.key === 'k') {
                if (window.sessionFocusIndex - cols >= 0) {
                    window.sessionFocusIndex -= cols;
                } else {
                    // Wrap to bottom
                    var lastRowStart = Math.floor((sessions.length - 1) / cols) * cols;
                    var pos = window.sessionFocusIndex % cols;
                    window.sessionFocusIndex = (lastRowStart + pos < sessions.length) ? lastRowStart + pos : sessions.length - 1;
                }
                e.preventDefault();
            } else if (e.key === 'Tab') {
                window.focusSection = 'folders';
                e.preventDefault();
            } else if (e.key === 'Enter') {
                sessions[window.sessionFocusIndex].click();
            } else if (e.key === 'm' || e.key === 'c') {
                // Open menu for focused card
                var s = sessions[window.sessionFocusIndex];
                if (s) {
                    var menuBtn = s.querySelector('.card-menu-btn');
                    if (menuBtn) {
                        var rect = menuBtn.getBoundingClientRect();
                        showContextMenu({ pageX: rect.left, pageY: rect.bottom }, getContextMenuItemsForSession(window.sessionData.sessions[window.sessionFocusIndex].id));
                    }
                }
            }
        }

        applyFocusUI();
    }

    function getContextMenuItemsForSession(id) {
        return [
            { label: 'Edit', action: function () { editSession(id); } },
            { label: 'Move to Folder', action: function () { moveSession(id); } },
            { label: 'Duplicate', action: function () { duplicateSession(id); } },
            { label: 'Delete', action: function () { deleteSession(id); }, danger: true }
        ];
    }

    document.addEventListener('keydown', handleKeyDown);

    // --- Actions ---
    function renameFolder(currentName) {
        var newName = prompt('New folder name:', currentName);
        if (newName && newName !== currentName) {
            AnkiTaskbar.callBackend('rename_folder', [currentName, newName]).then(window.refreshData);
        }
    }

    function deleteFolder(name) {
        if (confirm('Are you sure you want to delete this folder? Sessions will be moved to "All Sessions".')) {
            AnkiTaskbar.callBackend('delete_folder', [name]).then(window.refreshData);
        }
    }

    function editSession(id) {
        sessionStorage.setItem('editingSessionId', id);
        window.location.href = 'select-deck.html';
    }

    function deleteSession(id) {
        if (confirm('Are you sure you want to delete this session?')) {
            AnkiTaskbar.callBackend('delete_session', [String(id)]).then(window.refreshData);
        }
    }

    function moveSession(id) {
        var folders = window.sessionData.folders || [];
        if (folders.length === 0) {
            alert('Create a folder first!');
            return;
        }
        var folderName = prompt('Enter folder name to move to (available: ' + folders.join(', ') + '):');
        if (folderName !== null) {
            var allSessions = window.sessionData.sessions || [];
            var session = null;
            for (var i = 0; i < allSessions.length; i++) {
                if (String(allSessions[i].id) === String(id)) {
                    session = JSON.parse(JSON.stringify(allSessions[i]));
                    break;
                }
            }
            if (session) {
                session.folder = folderName;
                AnkiTaskbar.callBackend('upsert_session', [JSON.stringify(session)]).then(window.refreshData);
            }
        }
    }

    function duplicateSession(id) {
        AnkiTaskbar.callBackend('duplicate_session', [String(id)]).then(window.refreshData);
    }

    // --- Context Menu ---
    function showContextMenu(e, items) {
        var menu = document.getElementById('context-menu');
        if (!menu) return;

        var fragment = document.createDocumentFragment();
        for (var i = 0; i < items.length; i++) {
            (function () {
                var item = items[i];
                var div = document.createElement('div');
                div.className = 'menu-item' + (item.danger ? ' destructive' : '');
                div.textContent = item.label;
                div.onclick = function () {
                    item.action();
                    hideContextMenu();
                };
                fragment.appendChild(div);
            })();
        }

        menu.innerHTML = '';
        menu.appendChild(fragment);
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
        menu.classList.remove('hidden');
        menu.classList.add('visible');

        var hide = function () { hideContextMenu(); };
        setTimeout(function () {
            document.addEventListener('click', hide, { once: true });
        }, 10);
    }

    function hideContextMenu() {
        var menu = document.getElementById('context-menu');
        if (menu) {
            menu.classList.add('hidden');
            menu.classList.remove('visible');
        }
    }

    // --- Window Buttons ---
    var newSessionBtn = document.getElementById('new-session-btn');
    if (newSessionBtn) {
        newSessionBtn.onclick = function () {
            sessionStorage.removeItem('editingSessionId');
            window.location.href = 'select-deck.html';
        };
    }

    var addFolderBtn = document.getElementById('add-folder-btn');
    if (addFolderBtn) {
        addFolderBtn.onclick = function () {
            var name = prompt('Folder name:');
            if (name) {
                AnkiTaskbar.callBackend('create_folder', [name]).then(window.refreshData);
            }
        };
    }

    var shuffleBtn = document.getElementById('shuffle-sessions-btn');
    if (shuffleBtn) {
        shuffleBtn.onclick = function () {
            if (window.sessionData && window.sessionData.sessions) {
                window.sessionData.sessions.sort(function () { return 0.5 - Math.random(); });
                renderMainContent();
            }
        };
    }
});
