document.addEventListener('DOMContentLoaded', () => {
    const sessionsListEl = document.getElementById('sessions-list');
    const deleteBtn = document.getElementById('delete-session');
    const activateBtn = document.getElementById('activate-session');
    const editBtn = document.getElementById('edit-session');
    const statusEl = document.getElementById('sessions-status');

    let sessionsData = { sessions: [], active_session_id: null };
    let currentSessionId = null;

    function setStatus(text, kind) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.dataset.kind = kind || '';
        if (!text) return;
        window.clearTimeout(window._sessionsStatusTimer);
        window._sessionsStatusTimer = window.setTimeout(() => {
            statusEl.textContent = '';
            statusEl.dataset.kind = '';
        }, 1500);
    }

    function getSelectedDeckIds() {
        const checked = Array.from(document.querySelectorAll('input.deck-checkbox:checked'))
            .map(cb => parseInt(cb.value, 10))
            .filter(n => !Number.isNaN(n));
        // Deduplicate
        return Array.from(new Set(checked));
    }

    function clearSelectionUI() {
        document.querySelectorAll('input.deck-checkbox').forEach(cb => {
            cb.checked = false;
            cb.indeterminate = false;
            cb.dispatchEvent(new Event('change'));
        });
    }

    function applySelectedDeckIds(deckIds) {
        const wanted = new Set((deckIds || []).map(d => parseInt(d, 10)).filter(n => !Number.isNaN(n)));
        document.querySelectorAll('input.deck-checkbox').forEach(cb => {
            const did = parseInt(cb.value, 10);
            cb.checked = wanted.has(did);
        });
        // update states bottom-up
        document.querySelectorAll('#deck-tree-container li').forEach(li => {
            updateParentState(li);
        });
        refreshVisuals();
    }

    function refreshVisuals() {
        document.querySelectorAll('input.deck-checkbox').forEach(cb => {
            const itemDiv = cb.closest('.deck-item');
            if (!itemDiv) return;
            if (cb.checked || cb.indeterminate) itemDiv.classList.add('selected');
            else itemDiv.classList.remove('selected');
        });
    }

    function updateParentState(li) {
        if (!li) return;
        const checkbox = li.querySelector(':scope > .deck-item input.deck-checkbox');
        const childCheckboxes = Array.from(li.querySelectorAll(':scope > ul.nested-list input.deck-checkbox'));
        if (!checkbox || childCheckboxes.length === 0) {
            return;
        }

        let checkedCount = 0;
        let indeterminateCount = 0;
        childCheckboxes.forEach(cb => {
            if (cb.indeterminate) indeterminateCount++;
            else if (cb.checked) checkedCount++;
        });

        if (checkedCount === 0 && indeterminateCount === 0) {
            checkbox.checked = false;
            checkbox.indeterminate = false;
        } else if (checkedCount === childCheckboxes.length) {
            checkbox.checked = true;
            checkbox.indeterminate = false;
        } else {
            checkbox.checked = false;
            checkbox.indeterminate = true;
        }
    }

    function updateAncestors(li) {
        let current = li;
        while (current) {
            const parentUl = current.parentElement;
            if (!parentUl || !parentUl.classList.contains('nested-list')) break;
            const parentLi = parentUl.closest('li');
            if (!parentLi) break;
            updateParentState(parentLi);
            current = parentLi;
        }
    }

    function setChildrenChecked(li, checked) {
        const childCheckboxes = li.querySelectorAll('ul.nested-list input.deck-checkbox');
        childCheckboxes.forEach(cb => {
            cb.checked = checked;
            cb.indeterminate = false;
        });
    }

    function bindTreeSelectionHandlers(li, checkbox) {
        checkbox.addEventListener('change', (e) => {
            // Cascade to children
            setChildrenChecked(li, checkbox.checked);
            checkbox.indeterminate = false;

            // Update ancestors
            updateAncestors(li);
            refreshVisuals();
        });
    }

    function buildTree(node, parentElement) {
        const li = document.createElement('li');

        const itemDiv = document.createElement('div');
        itemDiv.className = 'deck-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `deck-${node.id}`;
        checkbox.value = node.id;
        checkbox.className = 'deck-checkbox';
        itemDiv.appendChild(checkbox);

        const label = document.createElement('label');
        label.htmlFor = `deck-${node.id}`;

        const displayName = node.name.includes('::') ? node.name.split('::').pop() : node.name;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'deck-name';
        nameSpan.textContent = displayName;
        label.appendChild(nameSpan);

        const countsContainer = document.createElement('span');
        countsContainer.className = 'counts';

        const totalCards = (node.review || 0) + (node.learn || 0) + (node.new || 0);
        if (node.review > 0) {
            const reviewBadge = document.createElement('span');
            reviewBadge.className = 'count-badge has-cards';
            reviewBadge.innerHTML = `<span class="count-review">${node.review}</span> R`;
            countsContainer.appendChild(reviewBadge);
        }
        if (node.learn > 0) {
            const learnBadge = document.createElement('span');
            learnBadge.className = 'count-badge has-cards';
            learnBadge.innerHTML = `<span class="count-learn">${node.learn}</span> L`;
            countsContainer.appendChild(learnBadge);
        }
        if (node.new > 0) {
            const newBadge = document.createElement('span');
            newBadge.className = 'count-badge has-cards';
            newBadge.innerHTML = `<span class="count-new">${node.new}</span> N`;
            countsContainer.appendChild(newBadge);
        }
        if (totalCards === 0) {
            const emptyBadge = document.createElement('span');
            emptyBadge.className = 'count-badge';
            emptyBadge.textContent = 'No cards';
            countsContainer.appendChild(emptyBadge);
        }

        label.appendChild(countsContainer);
        itemDiv.appendChild(label);

        // Click row to toggle checkbox (except toggle)
        itemDiv.addEventListener('click', (e) => {
            if (e.target === checkbox || e.target.classList.contains('toggle')) return;
            e.stopPropagation();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });

        li.appendChild(itemDiv);
        parentElement.appendChild(li);

        if (node.children && node.children.length > 0) {
            li.classList.add('has-children');
            const toggle = document.createElement('span');
            toggle.className = 'toggle';
            itemDiv.insertBefore(toggle, checkbox);

            const nestedUl = document.createElement('ul');
            nestedUl.className = 'nested-list';
            li.appendChild(nestedUl);
            node.children.forEach(child => buildTree(child, nestedUl));

            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                li.classList.toggle('expanded');
            });
        }

        bindTreeSelectionHandlers(li, checkbox);
    }

    function renderSessionsList() {
        if (!sessionsListEl) return;
        sessionsListEl.innerHTML = '';

        const sessions = Array.isArray(sessionsData.sessions) ? sessionsData.sessions : [];
        if (sessions.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No sessions yet.';
            sessionsListEl.appendChild(empty);
            return;
        }

        sessions.forEach(sess => {
            if (!sess || typeof sess !== 'object') return;
            const item = document.createElement('div');
            item.className = 'session-item';
            if (String(sess.id) === String(currentSessionId)) item.classList.add('selected');

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.flexDirection = 'column';
            left.style.gap = '2px';

            const title = document.createElement('div');
            title.textContent = sess.name || 'Untitled';
            title.style.fontWeight = '700';

            const meta = document.createElement('div');
            meta.className = 'session-meta';
            const count = Array.isArray(sess.deck_ids) ? sess.deck_ids.length : 0;
            meta.textContent = `${count} deck${count === 1 ? '' : 's'}`;

            left.appendChild(title);
            left.appendChild(meta);

            const badge = document.createElement('div');
            badge.className = 'session-meta';
            badge.textContent = (String(sessionsData.active_session_id) === String(sess.id)) ? 'Active' : '';

            item.appendChild(left);
            item.appendChild(badge);

            item.addEventListener('click', () => {
                selectSession(sess.id);
            });

            sessionsListEl.appendChild(item);
        });
    }

    function selectSession(sessionId) {
        currentSessionId = String(sessionId);
        renderSessionsList();
    }

    function setNewSessionDraft() {
        currentSessionId = null;
        renderSessionsList();
    }

    function loadDeckTree() {
        return new Promise((resolve) => {
            if (!window.py || typeof window.py.get_deck_tree !== 'function') {
                resolve(null);
                return;
            }
            window.py.get_deck_tree((jsonTree) => {
                try {
                    deckTree = JSON.parse(jsonTree);
                } catch (e) {
                    deckTree = null;
                }
                resolve(deckTree);
            });
        });
    }

    function renderDeckTree() {
        const container = document.getElementById('deck-tree-container');
        if (!container) return;
        container.innerHTML = '';

        if (!deckTree || !deckTree.children) {
            container.innerHTML = '<p class="placeholder">Unable to load deck tree.</p>';
            return;
        }

        const ul = document.createElement('ul');
        deckTree.children.forEach(child => buildTree(child, ul));
        container.appendChild(ul);
    }

    function loadSessions() {
        return new Promise((resolve) => {
            if (!window.py || typeof window.py.get_sessions !== 'function') {
                sessionsData = { sessions: [], active_session_id: null };
                resolve(sessionsData);
                return;
            }
            window.py.get_sessions((json) => {
                try {
                    sessionsData = JSON.parse(json);
                } catch (e) {
                    sessionsData = { sessions: [], active_session_id: null };
                }
                resolve(sessionsData);
            });
        });
    }

    async function refreshAll() {
        await loadSessions();
        renderSessionsList();
    }

    function editCurrentSession() {
        if (!currentSessionId) {
            setStatus('Select a session', 'error');
            return;
        }
        // Store the session ID in sessionStorage so select-deck.js knows we're editing
        sessionStorage.setItem('editingSessionId', currentSessionId);
        window.location.href = 'select-deck.html';
    }

    function deleteCurrentSession() {
        if (!currentSessionId) {
            setStatus('Select a session', 'error');
            return;
        }
        if (!window.py || typeof window.py.delete_session !== 'function') {
            setStatus('No backend', 'error');
            return;
        }
        window.py.delete_session(String(currentSessionId), (resp) => {
            try {
                const r = JSON.parse(resp);
                if (!r.ok) {
                    setStatus('Error', 'error');
                    return;
                }
                setStatus('Deleted', 'ok');
                currentSessionId = null;
                refreshAll();
            } catch (e) {
                setStatus('Error', 'error');
            }
        });
    }

    function activateCurrentSession() {
        if (!currentSessionId) {
            setStatus('Select a session', 'error');
            return;
        }
        if (!window.py || typeof window.py.activate_session !== 'function') {
            setStatus('No backend', 'error');
            return;
        }
        window.py.activate_session(String(currentSessionId), (resp) => {
            try {
                const r = JSON.parse(resp);
                if (!r.ok) {
                    setStatus('Error', 'error');
                    return;
                }
                setStatus('Activated', 'ok');
                window.location.href = 'index.html';
            } catch (e) {
                setStatus('Error', 'error');
            }
        });
    }

    function bindActions() {
        editBtn?.addEventListener('click', () => editCurrentSession());
        deleteBtn?.addEventListener('click', () => deleteCurrentSession());
        activateBtn?.addEventListener('click', () => activateCurrentSession());
    }

    function ensureSessionsEnabled() {
        return new Promise((resolve) => {
            if (!window.py || typeof window.py.load_settings_from_file !== 'function') {
                resolve(true);
                return;
            }
            window.py.load_settings_from_file((data) => {
                try {
                    const cfg = data ? JSON.parse(data) : {};
                    resolve(cfg.sessionsEnabled !== false);
                } catch (e) {
                    resolve(true);
                }
            });
        });
    }

    if (typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined' && qt.webChannelTransport) {
        new QWebChannel(qt.webChannelTransport, async (channel) => {
            window.py = channel.objects.py;

            const enabled = await ensureSessionsEnabled();
            if (!enabled) {
                window.location.href = 'index.html';
                return;
            }

            bindActions();

            await refreshAll();
            setNewSessionDraft();
        });
    }
});
