
document.addEventListener('DOMContentLoaded', () => {
    // Disable Ctrl+Scroll Zoom
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) e.preventDefault();
    }, { passive: false });

    // --- Elements ---
    const sessionsGridEl = document.getElementById('sessions-grid');
    const foldersListEl = document.getElementById('folders-list');
    const currentViewTitleEl = document.getElementById('current-view-title');
    const sessionCountBadgeEl = document.getElementById('session-count-badge');

    // Buttons
    const newSessionBtn = document.getElementById('new-session-btn');
    const addFolderBtn = document.getElementById('add-folder-btn');
    const shuffleSessionsBtn = document.getElementById('shuffle-sessions-btn');

    // Modals
    const createFolderModal = document.getElementById('create-folder-modal');
    const moveModal = document.getElementById('move-modal');
    const newFolderInput = document.getElementById('new-folder-input');
    const confirmCreateFolderBtn = document.getElementById('confirm-create-folder');
    const folderSelectionList = document.getElementById('folder-selection-list');

    // Context Menu
    const contextMenu = document.getElementById('context-menu');
    const folderContextMenu = document.getElementById('folder-context-menu');
    const ctxActivate = document.getElementById('ctx-activate');
    const ctxEdit = document.getElementById('ctx-edit');
    const ctxMove = document.getElementById('ctx-move');
    const ctxDelete = document.getElementById('ctx-delete');
    const folderCtxDelete = document.getElementById('folder-ctx-delete');

    // Status
    const statusToast = document.getElementById('status-toast');

    // --- State ---
    let appState = {
        sessions: [],
        folders: [],
        activeSessionId: null,
        currentView: 'all', // 'all', 'uncategorized', or specific folder name
        contextMenuTargetId: null, // ID of session right-clicked
        contextMenuTargetFolder: null, // Name of folder right-clicked
        settings: {}
    };

    // --- Timers ---
    let toastTimer = null;
    
    // Make navigation state globally accessible
    window.navigationState = {
        currentFocus: 'folders', // 'folders' or 'sessions'
        focusedFolderIndex: 0,
        focusedSessionIndex: 0
    };

    // --- Helpers ---
    function showToast(message, type = 'normal') {
        if (!statusToast) return;
        statusToast.textContent = message;
        statusToast.className = `toast ${type}`;
        statusToast.classList.remove('hidden');

        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            statusToast.classList.add('hidden');
        }, 3000);
    }

    // --- Backend Communication ---
    function callBackend(method, args = []) {
        return new Promise((resolve, reject) => {
            if (window.py && typeof window.py[method] === 'function') {
                window.py[method](...args, (response) => {
                    try {
                        const res = JSON.parse(response);
                        resolve(res);
                    } catch (e) {
                        console.error(`Error parsing response from ${method}:`, e);
                        reject(e);
                    }
                });
            } else {
                console.warn(`Backend method ${method} not found (standalone mode)`);
                // Mock responses for development
                if (method === 'get_sessions') {
                    resolve({
                        sessions: appState.sessions, // Use current state as mock DB
                        folders: appState.folders,
                        active_session_id: appState.activeSessionId
                    });
                } else {
                    resolve({ ok: true });
                }
            }
        });
    }

    async function refreshData() {
        try {
            console.log('Refreshing sessions data...');
            const data = await callBackend('get_sessions');
            if (data) {
                console.log('Received data:', data);
                appState.sessions = data.sessions || [];
                appState.folders = data.folders || [];
                appState.activeSessionId = data.active_session_id;
                appState.settings = await loadSettings(); // Load settings to check random arrangement

                console.log('Sessions loaded:', appState.sessions.length);
                console.log('Folders loaded:', appState.folders.length);
                console.log('Active session ID:', appState.activeSessionId);
                console.log('Random sessions enabled:', appState.settings.randomSessions);

                // Ensure all sessions have a folder property
                appState.sessions.forEach(s => {
                    if (!s.folder) s.folder = '';
                });

                renderApp();
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to load data', 'error');
        }
    }

    async function loadSettings() {
        try {
            if (window.py && typeof window.py.load_settings_from_file === 'function') {
                return new Promise((resolve) => {
                    window.py.load_settings_from_file((data) => {
                        try {
                            const settings = data ? JSON.parse(data) : {};
                            resolve(settings);
                        } catch (e) {
                            resolve({});
                        }
                    });
                });
            } else {
                return Promise.resolve({});
            }
        } catch (e) {
            console.error('Error loading settings:', e);
            return Promise.resolve({});
        }
    }

    // --- Rendering ---
    function renderApp() {
        renderFolders();
        renderMainContent();
    }

    function renderFolders() {
        if (!foldersListEl) return;
        foldersListEl.innerHTML = '';

        // "All Sessions" Item
        const allItem = document.createElement('div');
        allItem.className = 'nav-item';
        if (appState.currentView === 'all') allItem.classList.add('active');
        allItem.innerHTML = `
            <span>All Sessions</span>
            <span class="nav-item-count">${appState.sessions.length}</span>
        `;
        allItem.onclick = (e) => {
            console.log('All Sessions clicked - event:', e);
            console.log('Event target:', e.target);
            console.log('Event currentTarget:', e.currentTarget);
            e.preventDefault();
            e.stopPropagation();
            
            appState.currentView = 'all';
            renderMainContent();
            renderFolders();
            // Update navigation state
            if (window.navigationState) {
                window.navigationState.currentFocus = 'sessions';
                window.navigationState.focusedSessionIndex = 0;
            }
        };
        foldersListEl.appendChild(allItem);

        // "Uncategorized" Item
        const uncategorizedCount = appState.sessions.filter(s => !s.folder).length;
        if (uncategorizedCount > 0) {
            const item = document.createElement('div');
            item.className = 'nav-item';
            if (appState.currentView === 'uncategorized') item.classList.add('active');
            item.innerHTML = `
                <span>Uncategorized</span>
                <span class="nav-item-count">${uncategorizedCount}</span>
            `;
            item.onclick = (e) => {
                console.log('Uncategorized clicked - event:', e);
                console.log('Event target:', e.target);
                console.log('Event currentTarget:', e.currentTarget);
                e.preventDefault();
                e.stopPropagation();
                
                appState.currentView = 'uncategorized';
                renderMainContent();
                renderFolders();
                // Update navigation state
                if (window.navigationState) {
                    window.navigationState.currentFocus = 'sessions';
                    window.navigationState.focusedSessionIndex = 0;
                }
            };
            foldersListEl.appendChild(item);
        }

        // Folders
        const folders = appState.folders || [];
        folders.forEach(folder => {
            const count = appState.sessions.filter(s => s.folder === folder).length;

            const item = document.createElement('div');
            item.className = 'nav-item';
            if (appState.currentView === folder) item.classList.add('active');
            item.innerHTML = `
                <span>${folder}</span>
                <span class="nav-item-count">${count}</span>
            `;

            // Context menu for folders (delete/rename)
            item.oncontextmenu = (e) => {
                e.preventDefault();
                showFolderContextMenu(e, folder);
            };

            item.onclick = (e) => {
                console.log('Folder clicked:', folder, '- event:', e);
                console.log('Event target:', e.target);
                console.log('Event currentTarget:', e.currentTarget);
                e.preventDefault();
                e.stopPropagation();
                
                appState.currentView = folder;
                renderMainContent();
                renderFolders();
                // Reset navigation state when switching folders
                if (window.navigationState) {
                    window.navigationState.focusedSessionIndex = 0;
                    window.navigationState.currentFocus = 'sessions';
                }
            };

            foldersListEl.appendChild(item);
        });
        
        // Reset folder navigation index when folders are re-rendered
        if (window.navigationState) {
            window.navigationState.focusedFolderIndex = 0;
        }
    }

    function renderMainContent() {
        if (!sessionsGridEl) return;

        console.log('Rendering sessions for view:', appState.currentView);
        console.log('Total sessions available:', appState.sessions.length);
        console.log('Random arrangement enabled:', appState.settings?.randomSessions);

        // Filter Sessions
        let filtered = [];
        if (appState.currentView === 'all') {
            filtered = appState.sessions;
            if (currentViewTitleEl) currentViewTitleEl.textContent = 'All Sessions';
        } else if (appState.currentView === 'uncategorized') {
            filtered = appState.sessions.filter(s => !s.folder);
            if (currentViewTitleEl) currentViewTitleEl.textContent = 'Uncategorized';
        } else {
            filtered = appState.sessions.filter(s => s.folder === appState.currentView);
            if (currentViewTitleEl) currentViewTitleEl.textContent = appState.currentView;
        }

        // Apply random arrangement if enabled
        if (appState.settings?.randomSessions && filtered.length > 1) {
            console.log('Applying random arrangement to', filtered.length, 'sessions');
            // Shuffle the filtered sessions
            const shuffled = [...filtered];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            filtered = shuffled;
        }

        console.log('Filtered sessions count:', filtered.length);
        console.log('Filtered sessions:', filtered.map(s => ({id: s.id, name: s.name, folder: s.folder})));

        // Final filter: Hide Completed Sessions if setting enabled
        const hideCompleted = appState.settings && appState.settings.hideCompletedSessions === true;
        if (hideCompleted) {
            filtered = filtered.filter(s => {
                const progress = s.progress || 0;
                const done_cards = s.done_cards || 0;
                const total_cards = s.total_cards || 0;

                // If it has card counts, use them for accuracy
                if (total_cards > 0) return done_cards < total_cards;
                // Fallback to progress float
                return progress < 0.999;
            });
        }

        if (sessionCountBadgeEl) sessionCountBadgeEl.textContent = filtered.length;
        sessionsGridEl.innerHTML = '';

        if (filtered.length === 0) {
            sessionsGridEl.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align:center; padding: 40px; color: #888;">
                    No sessions found here.
                    <br><br>
                    <button class="primary-btn" onclick="document.getElementById('new-session-btn').click()" style="margin:auto;">Create Session</button>
                </div>
            `;
            // Reset session navigation index when no sessions
            if (window.navigationState) {
                window.navigationState.focusedSessionIndex = 0;
            }
            return;
        }

        filtered.forEach((session, index) => {
            const card = document.createElement('div');
            card.className = 'session-card';
            if (String(session.id) === String(appState.activeSessionId)) {
                card.classList.add('active-session');
            }

            // Animation
            card.style.opacity = '0';
            card.style.animation = `fadeIn 0.3s ease-out forwards`;
            card.style.animationDelay = `${index * 0.05}s`;

            const deckCount = session.deck_ids ? session.deck_ids.length : 0;

            // Format folder label
            let folderBadge = '';
            if (session.folder) {
                folderBadge = `<div class="folder-badge" title="In folder: ${session.folder}">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                    ${session.folder}
                </div>`;
            }

            // Progress Bar
            const progress = session.progress || 0; // 0.0 to 1.0
            const pct = Math.round(progress * 100);
            const doneCards = session.done_cards || 0;
            const totalCards = session.total_cards || 0;

            // Only show detailed counts if we have data
            const progressText = totalCards > 0
                ? `${doneCards}/${totalCards} cards`
                : `${pct}%`;

            const progressBar = `
                <div class="session-progress-wrapper" title="${pct}% Completed">
                    <div class="session-progress-text">${progressText}</div>
                    <div class="session-progress-container">
                        <div class="session-progress-bar" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;

            card.innerHTML = `
                <div class="card-header">
                    ${String(session.id) === String(appState.activeSessionId)
                    ? '<div class="active-tag">Active</div>'
                    : '<div></div>'}
                     <button class="card-menu-btn session-delete-btn" data-id="${session.id}">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                    </button>
                </div>
                <div class="card-body">
                    <div class="card-title" title="${session.name}">${session.name || 'Untitled Session'}</div>
                    <div class="card-meta">${deckCount} deck${deckCount !== 1 ? 's' : ''}</div>
                    ${folderBadge}
                    ${progressBar}
                </div>
                <div class="card-footer">
                    <div></div>
                </div>
            `;

            // Card click to activate
            card.onclick = () => {
                if (String(session.id) !== String(appState.activeSessionId)) {
                    activateSession(session.id);
                }
            };

            const menuBtn = card.querySelector('.card-menu-btn');
            if (menuBtn) {
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    showContextMenu(e, session.id);
                };
            }


            // Allow right click anywhere on card
            card.oncontextmenu = (e) => {
                e.preventDefault();
                showContextMenu(e, session.id);
            };

            sessionsGridEl.appendChild(card);
        });
        
        console.log('Rendered session cards count:', sessionsGridEl.children.length);
        console.log('Sessions grid inner HTML length:', sessionsGridEl.innerHTML.length);
        
        // Reset session navigation index when sessions are re-rendered
        if (window.navigationState) {
            window.navigationState.focusedSessionIndex = 0;
        }
    }

    // --- Actions ---

    function activateSession(id) {
        callBackend('activate_session', [String(id)]).then(res => {
            if (res.ok) {
                showToast('Session Activated', 'success');
                window.location.href = 'index.html';
            } else {
                showToast(res.error || 'Error', 'error');
            }
        });
    }

    function createFolder() {
        if (!newFolderInput) return;
        const name = newFolderInput.value.trim();
        if (!name) return;

        callBackend('create_folder', [name]).then(res => {
            if (res.ok) {
                showToast('Folder created', 'success');
                if (createFolderModal) createFolderModal.classList.add('hidden');
                refreshData();
            } else {
                showToast(res.error || 'Error', 'error');
            }
        });
    }

    function deleteFolder(name) {
        const sessionCount = appState.sessions.filter(s => s.folder === name).length;
        const confirmMessage = sessionCount > 0 
            ? `Are you sure you want to delete the folder "${name}"? ${sessionCount} session(s) in this folder will be moved to Uncategorized.`
            : `Are you sure you want to delete the empty folder "${name}"?`;
            
        if (!confirm(confirmMessage)) return;
        
        callBackend('delete_folder', [name]).then(res => {
            if (res.ok) {
                const movedSessions = res.moved_sessions || 0;
                const message = movedSessions > 0 
                    ? `Folder deleted. ${movedSessions} session(s) moved to Uncategorized.`
                    : 'Folder deleted';
                showToast(message, 'success');
                if (appState.currentView === name) appState.currentView = 'all';
                refreshData();
            } else {
                showToast(res.error || 'Error', 'error');
            }
        });
    }

    function moveSession(sessionId, folderName) {
        // Debug
        // console.log(`Moving session ${sessionId} to folder "${folderName}"`);

        callBackend('move_session_to_folder', [String(sessionId), folderName])
            .then(res => {
                if (res.ok) {
                    showToast(`Moved to ${folderName || 'Uncategorized'}`, 'success');
                    if (moveModal) moveModal.classList.add('hidden');
                    refreshData();
                } else {
                    console.error('Move failed:', res);
                    showToast(res.error || 'Move failed', 'error');
                }
            })
            .catch(err => {
                console.error('Backend call failed:', err);
                showToast('Backend Error', 'error');
            });
    }

    function shuffleCurrentSessions() {
        // Get current filtered sessions
        let currentSessions = [];
        if (appState.currentView === 'all') {
            currentSessions = [...appState.sessions];
        } else if (appState.currentView === 'uncategorized') {
            currentSessions = [...appState.sessions.filter(s => !s.folder)];
        } else {
            currentSessions = [...appState.sessions.filter(s => s.folder === appState.currentView)];
        }

        if (currentSessions.length <= 1) {
            showToast('Need at least 2 sessions to shuffle', 'error');
            return;
        }

        // Shuffle sessions using Fisher-Yates algorithm for better randomness
        for (let i = currentSessions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentSessions[i], currentSessions[j]] = [currentSessions[j], currentSessions[i]];
        }

        // Update the sessions in the current view
        if (appState.currentView === 'all') {
            appState.sessions = currentSessions;
        } else if (appState.currentView === 'uncategorized') {
            // Update uncategorized sessions
            const otherSessions = appState.sessions.filter(s => s.folder);
            appState.sessions = [...currentSessions, ...otherSessions];
        } else {
            // Update specific folder sessions
            const otherSessions = appState.sessions.filter(s => s.folder !== appState.currentView);
            appState.sessions = [...otherSessions, ...currentSessions];
        }

        showToast('Sessions shuffled', 'success');
        renderApp();
    }

    function deleteSession(id) {
        if (!confirm('Are you sure you want to delete this session?')) return;

        callBackend('delete_session', [String(id)]).then(res => {
            if (res.ok) {
                showToast('Session deleted', 'success');
                refreshData();
            } else {
                showToast(res.error || 'Error', 'error');
            }
        });
    }

    // --- UI Interactions ---

    function showContextMenu(e, sessionId) {
        if (!contextMenu) return;
        appState.contextMenuTargetId = sessionId;
        appState.contextMenuTargetFolder = null;

        // Position menu
        const x = e.clientX;
        const y = e.clientY;

        // Check bounds
        const menuWidth = 150;
        const menuHeight = 160;

        let finalX = x;
        let finalY = y;

        if (x + menuWidth > window.innerWidth) finalX = x - menuWidth;
        if (y + menuHeight > window.innerHeight) finalY = y - menuHeight;

        contextMenu.style.left = `${finalX}px`;
        contextMenu.style.top = `${finalY}px`;
        contextMenu.classList.remove('hidden');
        
        // Hide folder context menu if shown
        if (folderContextMenu) folderContextMenu.classList.add('hidden');
    }

    function showFolderContextMenu(e, folderName) {
        if (!folderContextMenu) return;
        appState.contextMenuTargetFolder = folderName;
        appState.contextMenuTargetId = null;

        // Position menu
        const x = e.clientX;
        const y = e.clientY;

        // Check bounds
        const menuWidth = 150;
        const menuHeight = 50;

        let finalX = x;
        let finalY = y;

        if (x + menuWidth > window.innerWidth) finalX = x - menuWidth;
        if (y + menuHeight > window.innerHeight) finalY = y - menuHeight;

        folderContextMenu.style.left = `${finalX}px`;
        folderContextMenu.style.top = `${finalY}px`;
        folderContextMenu.classList.remove('hidden');
        
        // Hide session context menu if shown
        if (contextMenu) contextMenu.classList.add('hidden');
    }

    function hideContextMenu() {
        if (contextMenu) contextMenu.classList.add('hidden');
        if (folderContextMenu) folderContextMenu.classList.add('hidden');
    }

    // --- Event Listeners ---

    if (newSessionBtn) {
        newSessionBtn.addEventListener('click', () => {
            sessionStorage.removeItem('editingSessionId');
            window.location.href = 'select-deck.html';
        });
    }

    // Back button in header (Library)
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
        sidebarHeader.addEventListener('click', (e) => {
            if (e.target.closest('a')) return; // let link handle it
            appState.currentView = 'all';
            renderApp();
        });
    }

    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (newFolderInput) newFolderInput.value = '';
            if (createFolderModal) createFolderModal.classList.remove('hidden');
            setTimeout(() => newFolderInput && newFolderInput.focus(), 100);
        });
    }

    if (shuffleSessionsBtn) {
        shuffleSessionsBtn.addEventListener('click', () => {
            shuffleCurrentSessions();
        });
    }

    if (confirmCreateFolderBtn) {
        confirmCreateFolderBtn.addEventListener('click', createFolder);
    }

    if (newFolderInput) {
        newFolderInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') createFolder();
        });
    }

    // Close Modals logic
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
        // Cancel buttons
        modal.querySelectorAll('[data-action="cancel"], .btn.secondary, #cancel-move').forEach(btn => {
            btn.onclick = () => modal.classList.add('hidden');
        });
    });

    // Document click closes context menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            hideContextMenu();
        }
    });

    // Context Menu Actions
    if (ctxActivate) {
        ctxActivate.addEventListener('click', () => {
            if (appState.contextMenuTargetId) activateSession(appState.contextMenuTargetId);
            hideContextMenu();
        });
    }

    if (ctxEdit) {
        ctxEdit.addEventListener('click', () => {
            if (appState.contextMenuTargetId) {
                sessionStorage.setItem('editingSessionId', appState.contextMenuTargetId);
                window.location.href = 'select-deck.html';
            }
            hideContextMenu();
        });
    }

    if (ctxDelete) {
        ctxDelete.addEventListener('click', () => {
            if (appState.contextMenuTargetId) deleteSession(appState.contextMenuTargetId);
            hideContextMenu();
        });
    }

    if (folderCtxDelete) {
        folderCtxDelete.addEventListener('click', () => {
            if (appState.contextMenuTargetFolder) deleteFolder(appState.contextMenuTargetFolder);
            hideContextMenu();
        });
    }

    if (ctxMove) {
        ctxMove.addEventListener('click', () => {
            hideContextMenu();
            if (!appState.contextMenuTargetId) return;

            // Populate folder list
            if (folderSelectionList) {
                folderSelectionList.innerHTML = '';

                // Option: No Folder
                const noFolder = document.createElement('div');
                noFolder.className = 'folder-select-item';
                noFolder.innerHTML = '<span>(No Folder / Uncategorized)</span>';
                noFolder.onclick = () => moveSession(appState.contextMenuTargetId, "");
                folderSelectionList.appendChild(noFolder);

                appState.folders.forEach(folder => {
                    const item = document.createElement('div');
                    item.className = 'folder-select-item';
                    item.innerHTML = `<span>📁 ${folder}</span>`;
                    item.onclick = () => moveSession(appState.contextMenuTargetId, folder);
                    folderSelectionList.appendChild(item);
                });
            }

            if (moveModal) moveModal.classList.remove('hidden');
        });
    }

    // --- Init ---
    // Add drag functionality to all pages
    function addDragFunctionality() {
        const dragRegion = document.querySelector('.drag-region');
        if (dragRegion) {
            dragRegion.addEventListener('mousedown', (e) => {
                if (window.py && typeof window.py.drag_window === 'function') {
                    window.py.drag_window();
                }
            });
        }
    }
    
    // Add resizable functionality to all pages
    function addResizableFunctionality() {
        // Make window resizable by default
        if (window.py && typeof window.py.make_window_resizable === 'function') {
            window.py.make_window_resizable();
        }
    }
    
    // Check for QWebChannel
    if (typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined' && qt.webChannelTransport) {
        new QWebChannel(qt.webChannelTransport, (channel) => {
            window.py = channel.objects.py;
            
            // Initialize drag and resizable functionality
            addDragFunctionality();
            addResizableFunctionality();
            
            // Add keyboard shortcuts for navigation
            function addKeyboardShortcuts() {
                console.log('Initializing keyboard shortcuts for sessions page');
                document.addEventListener('keydown', (e) => {
                    // Handle folder and session navigation
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        console.log('Navigation key pressed:', e.key, 'Current focus:', window.navigationState.currentFocus);
                        handleNavigation(e);
                    }
                    // Handle session activation
                    else if (e.key === 'Enter' || e.key === ' ') {
                        console.log('Activation key pressed:', e.key);
                        handleSessionActivation(e);
                    }
                    // Handle folder switching
                    else if (e.key === 'Tab') {
                        console.log('Tab key pressed');
                        handleTabNavigation(e);
                    }
                    // Ctrl/Cmd + H: Go to Home (main page)
                    else if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                        e.preventDefault();
                        if (window.py && typeof window.py.load_home_page === 'function') {
                            window.py.load_home_page();
                        }
                    }
                    // Ctrl/Cmd + ,: Go to Settings page
                    else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                        e.preventDefault();
                        if (window.py && typeof window.py.load_settings_page === 'function') {
                            window.py.load_settings_page();
                        }
                    }
                    // Escape: Return to main page
                    else if (e.key === 'Escape') {
                        if (window.py && typeof window.py.load_home_page === 'function') {
                            window.py.load_home_page();
                        }
                    }
                    // Ctrl/Cmd + N: New session
                    else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                        e.preventDefault();
                        // Trigger new session creation
                        const createBtn = document.getElementById('new-session-btn');
                        if (createBtn) {
                            createBtn.click();
                        }
                    }
                    // Ctrl/Cmd + F: Add new folder
                    else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                        e.preventDefault();
                        const addFolderBtn = document.getElementById('add-folder-btn');
                        if (addFolderBtn) {
                            addFolderBtn.click();
                        }
                    }
                    // Delete: Delete selected session or folder
                    else if (e.key === 'Delete') {
                        handleDeleteAction(e);
                    }
                });
            }
            
            function handleNavigation(e) {
                e.preventDefault();
                
                if (window.navigationState.currentFocus === 'folders') {
                    handleFolderNavigation(e.key);
                } else {
                    handleSessionNavigation(e.key);
                }
            }
            
            function handleFolderNavigation(key) {
                const navItems = document.querySelectorAll('#folders-list .nav-item');
                if (navItems.length === 0) return;
                
                console.log('Folder navigation:', key, 'Current index:', window.navigationState.focusedFolderIndex, 'Total items:', navItems.length);
                
                if (key === 'ArrowUp') {
                    window.navigationState.focusedFolderIndex = Math.max(0, window.navigationState.focusedFolderIndex - 1);
                } else if (key === 'ArrowDown') {
                    window.navigationState.focusedFolderIndex = Math.min(navItems.length - 1, window.navigationState.focusedFolderIndex + 1);
                } else if (key === 'ArrowRight' || key === 'Enter' || key === ' ') {
                    // Switch to sessions view
                    console.log('Activating folder at index:', window.navigationState.focusedFolderIndex);
                    const folderItem = navItems[window.navigationState.focusedFolderIndex];
                    console.log('Folder item found:', folderItem, 'Text content:', folderItem.textContent.trim());
                    
                    // Try multiple methods to trigger the folder click
                    if (folderItem) {
                        // Method 1: Direct click
                        try {
                            folderItem.click();
                            console.log('Direct click successful');
                        } catch (e) {
                            console.log('Direct click failed:', e);
                        }
                        
                        // Method 2: Dispatch click event
                        try {
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            folderItem.dispatchEvent(clickEvent);
                            console.log('Event dispatch successful');
                        } catch (e) {
                            console.log('Event dispatch failed:', e);
                        }
                        
                        // Method 3: Manually trigger the onclick function
                        try {
                            if (folderItem.onclick) {
                                folderItem.onclick();
                                console.log('Manual onclick successful');
                            }
                        } catch (e) {
                            console.log('Manual onclick failed:', e);
                        }
                    }
                    
                    // Switch focus to sessions regardless of click success
                    window.navigationState.currentFocus = 'sessions';
                    window.navigationState.focusedSessionIndex = 0;
                    return;
                }
                
                // Update visual focus
                updateFolderFocus(navItems);
                console.log('Updated folder focus to index:', window.navigationState.focusedFolderIndex);
            }
            
            function handleSessionNavigation(key) {
                const sessionCards = document.querySelectorAll('#sessions-grid .session-card');
                if (sessionCards.length === 0) return;
                
                if (key === 'ArrowUp') {
                    window.navigationState.focusedSessionIndex = Math.max(0, window.navigationState.focusedSessionIndex - 1);
                } else if (key === 'ArrowDown') {
                    window.navigationState.focusedSessionIndex = Math.min(sessionCards.length - 1, window.navigationState.focusedSessionIndex + 1);
                } else if (key === 'ArrowLeft') {
                    // Switch back to folders
                    window.navigationState.currentFocus = 'folders';
                    updateFolderFocus(document.querySelectorAll('#folders-list .nav-item'));
                    return;
                } else if (key === 'ArrowRight' || key === 'Enter' || key === ' ') {
                    // Activate session
                    sessionCards[window.navigationState.focusedSessionIndex].click();
                    return;
                }
                
                // Update visual focus
                updateSessionFocus(sessionCards);
            }
            
            function updateFolderFocus(navItems) {
                // Remove existing focus classes
                navItems.forEach(item => item.classList.remove('keyboard-focus'));
                
                // Add focus to current item
                if (navItems[window.navigationState.focusedFolderIndex]) {
                    navItems[window.navigationState.focusedFolderIndex].classList.add('keyboard-focus');
                    navItems[window.navigationState.focusedFolderIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    console.log('Applied keyboard-focus to folder:', navItems[window.navigationState.focusedFolderIndex].textContent.trim());
                } else {
                    console.log('No folder found at index:', window.navigationState.focusedFolderIndex);
                }
            }
            
            function updateSessionFocus(sessionCards) {
                // Remove existing focus classes
                sessionCards.forEach(card => card.classList.remove('keyboard-focus'));
                
                // Add focus to current card
                if (sessionCards[window.navigationState.focusedSessionIndex]) {
                    sessionCards[window.navigationState.focusedSessionIndex].classList.add('keyboard-focus');
                    sessionCards[window.navigationState.focusedSessionIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
            
            function handleSessionActivation(e) {
                e.preventDefault();
                
                if (window.navigationState.currentFocus === 'folders') {
                    const navItems = document.querySelectorAll('#folders-list .nav-item');
                    if (navItems[window.navigationState.focusedFolderIndex]) {
                        navItems[window.navigationState.focusedFolderIndex].click();
                        window.navigationState.currentFocus = 'sessions';
                        window.navigationState.focusedSessionIndex = 0;
                    }
                } else {
                    const sessionCards = document.querySelectorAll('#sessions-grid .session-card');
                    if (sessionCards[window.navigationState.focusedSessionIndex]) {
                        sessionCards[window.navigationState.focusedSessionIndex].click();
                    }
                }
            }
            
            function handleTabNavigation(e) {
                e.preventDefault();
                
                // Switch between folders and sessions
                if (window.navigationState.currentFocus === 'folders') {
                    window.navigationState.currentFocus = 'sessions';
                    const sessionCards = document.querySelectorAll('#sessions-grid .session-card');
                    updateSessionFocus(sessionCards);
                } else {
                    window.navigationState.currentFocus = 'folders';
                    const navItems = document.querySelectorAll('#folders-list .nav-item');
                    updateFolderFocus(navItems);
                }
            }
            
            function handleDeleteAction(e) {
                if (window.navigationState.currentFocus === 'sessions') {
                    const sessionCards = document.querySelectorAll('#sessions-grid .session-card');
                    const focusedCard = sessionCards[window.navigationState.focusedSessionIndex];
                    
                    if (focusedCard) {
                        // Find and click the delete button on the focused session
                        const deleteBtn = focusedCard.querySelector('.session-delete-btn');
                        if (deleteBtn) {
                            deleteBtn.click();
                        }
                    }
                }
            }
            
            // Initialize keyboard shortcuts
            addKeyboardShortcuts();
            
            // Add mouse click debugging for folders
            setTimeout(() => {
                console.log('Setting up mouse click debugging');
                const foldersList = document.getElementById('folders-list');
                if (foldersList) {
                    foldersList.addEventListener('click', (e) => {
                        console.log('Folders list clicked:', e.target);
                        console.log('Target class:', e.target.className);
                        console.log('Target parent:', e.target.parentElement);
                        console.log('Is nav-item?', e.target.classList.contains('nav-item'));
                    });
                }
            }, 200);
            
            // Initialize navigation state after a short delay to ensure DOM is ready
            setTimeout(() => {
                console.log('Setting initial navigation state');
                window.navigationState.currentFocus = 'folders';
                window.navigationState.focusedFolderIndex = 0;
                window.navigationState.focusedSessionIndex = 0;
                
                // Apply initial focus to first folder
                const navItems = document.querySelectorAll('#folders-list .nav-item');
                if (navItems.length > 0) {
                    console.log('Found', navItems.length, 'folders, applying initial focus');
                    updateFolderFocus(navItems);
                } else {
                    console.log('No folders found');
                }
            }, 100);

            // Load and apply theme
            if (window.py && typeof window.py.load_settings_from_file === 'function') {
                window.py.load_settings_from_file((data) => {
                    try {
                        const cfg = data ? JSON.parse(data) : {};
                        appState.settings = cfg; // Save to state
                        document.documentElement.setAttribute('data-theme', cfg.theme || 'green');
                        document.documentElement.setAttribute('data-appearance', cfg.appearance || 'dark');
                        if (cfg.zoomLevel) document.body.style.zoom = cfg.zoomLevel;
                        document.body.classList.toggle('locked', cfg.movable === false);
                    } catch (e) { }
                });
            }

            // Window Controls
            document.getElementById('win-min')?.addEventListener('click', () => {
                if (window.py && typeof window.py.minimize_window === 'function') window.py.minimize_window();
            });
            document.getElementById('win-expand')?.addEventListener('click', () => {
                if (window.py && typeof window.py.toggle_expand === 'function') window.py.toggle_expand();
            });
            document.getElementById('win-close')?.addEventListener('click', () => {
                if (window.py && typeof window.py.close_window === 'function') window.py.close_window();
            });

            refreshData();
        });
    } else {
        // Fallback or dev mode
        refreshData();
    }
});
