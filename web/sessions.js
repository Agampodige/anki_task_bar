
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

    // Modals
    const createFolderModal = document.getElementById('create-folder-modal');
    const moveModal = document.getElementById('move-modal');
    const newFolderInput = document.getElementById('new-folder-input');
    const confirmCreateFolderBtn = document.getElementById('confirm-create-folder');
    const folderSelectionList = document.getElementById('folder-selection-list');

    // Context Menu
    const contextMenu = document.getElementById('context-menu');
    const ctxActivate = document.getElementById('ctx-activate');
    const ctxEdit = document.getElementById('ctx-edit');
    const ctxMove = document.getElementById('ctx-move');
    const ctxDelete = document.getElementById('ctx-delete');

    // Status
    const statusToast = document.getElementById('status-toast');

    // --- State ---
    let appState = {
        sessions: [],
        folders: [],
        activeSessionId: null,
        currentView: 'all', // 'all', 'uncategorized', or specific folder name
        contextMenuTargetId: null // ID of session right-clicked
    };

    // --- Timers ---
    let toastTimer = null;

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
            const data = await callBackend('get_sessions');
            if (data) {
                appState.sessions = data.sessions || [];
                appState.folders = data.folders || [];
                appState.activeSessionId = data.active_session_id;

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

    // --- Rendering ---
    function renderApp() {
        renderSidebar();
        renderMainContent();
    }

    function renderSidebar() {
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
        allItem.onclick = () => {
            appState.currentView = 'all';
            renderApp();
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
            item.onclick = () => {
                appState.currentView = 'uncategorized';
                renderApp();
            };
            foldersListEl.appendChild(item);
        }

        // Folders
        appState.folders.forEach(folder => {
            const count = appState.sessions.filter(s => s.folder === folder).length;

            const item = document.createElement('div');
            item.className = 'nav-item';
            if (appState.currentView === folder) item.classList.add('active');
            item.innerHTML = `
                <span>${folder}</span>
                <span class="nav-item-count">${count}</span>
            `;

            // Context menu for folders (delete/rename) - Simplified for now
            item.oncontextmenu = (e) => {
                e.preventDefault();
                if (confirm(`Delete folder "${folder}"?`)) {
                    deleteFolder(folder);
                }
            };

            item.onclick = () => {
                appState.currentView = folder;
                renderApp();
            };
            foldersListEl.appendChild(item);
        });
    }

    function renderMainContent() {
        if (!sessionsGridEl) return;

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
                    <div class="card-icon">
                        ${session.name ? session.name[0].toUpperCase() : 'S'}
                    </div>
                     <button class="card-menu-btn" data-id="${session.id}">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                    </button>
                </div>
                <div>
                    <div class="card-title" title="${session.name}">${session.name || 'Untitled Session'}</div>
                    <div class="card-meta">${deckCount} deck${deckCount !== 1 ? 's' : ''}</div>
                    ${folderBadge}
                    ${progressBar}
                </div>
                <div class="card-footer">
                    ${String(session.id) === String(appState.activeSessionId)
                    ? '<div class="active-tag">Active</div>'
                    : '<div></div>'}
                    <button class="play-btn" data-id="${session.id}">
                        ${String(session.id) === String(appState.activeSessionId) ? 'Current' : 'Activate'}
                    </button>
                </div>
            `;

            const menuBtn = card.querySelector('.card-menu-btn');
            if (menuBtn) {
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    showContextMenu(e, session.id);
                };
            }

            const playBtn = card.querySelector('.play-btn');
            if (playBtn) {
                playBtn.onclick = (e) => {
                    e.stopPropagation();
                    activateSession(session.id);
                };
            }

            // Allow right click anywhere on card
            card.oncontextmenu = (e) => {
                e.preventDefault();
                showContextMenu(e, session.id);
            };

            sessionsGridEl.appendChild(card);
        });
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
        callBackend('delete_folder', [name]).then(res => {
            if (res.ok) {
                showToast('Folder deleted', 'success');
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
    }

    function hideContextMenu() {
        if (contextMenu) contextMenu.classList.add('hidden');
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
            if (createFolderModal) {
                createFolderModal.classList.remove('hidden');
                setTimeout(() => newFolderInput && newFolderInput.focus(), 100);
            }
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
    // Check for QWebChannel
    if (typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined' && qt.webChannelTransport) {
        new QWebChannel(qt.webChannelTransport, (channel) => {
            window.py = channel.objects.py;
            refreshData();
        });
    } else {
        // Fallback or dev mode
        refreshData();
    }
});
