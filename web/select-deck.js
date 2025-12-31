document.addEventListener("DOMContentLoaded", () => {
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
    
    // Check if we're editing an existing session
    const editingSessionId = sessionStorage.getItem('editingSessionId');
    let isEditing = !!editingSessionId;

    // Establish connection with Python backend
    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.py = channel.objects.py;
        
        // Initialize drag functionality
        addDragFunctionality();

        // Check if sessions are enabled
        if (window.py && typeof window.py.load_settings_from_file === 'function') {
            window.py.load_settings_from_file((data) => {
                try {
                    const cfg = data ? JSON.parse(data) : {};
                    const sessionsEnabled = cfg.sessionsEnabled !== false; // Default to enabled

                    // Apply Theme
                    const theme = cfg.theme || 'green';
                    const appearance = cfg.appearance || 'dark';
                    const compactMode = !!cfg.compactMode;
                    const zoomLevel = cfg.zoomLevel !== undefined ? cfg.zoomLevel : 1.0;
                    const movable = cfg.movable !== false;

                    document.documentElement.setAttribute('data-theme', theme);
                    document.documentElement.setAttribute('data-appearance', appearance);
                    document.body.style.zoom = zoomLevel;
                    document.body.classList.toggle('locked', !movable);
                    if (compactMode) document.body.classList.add('compact');
                    else document.body.classList.remove('compact');

                    // Hide session creation UI if disabled
                    const sessionCreateRow = document.querySelector('.session-create-row');
                    if (sessionCreateRow) {
                        sessionCreateRow.style.display = sessionsEnabled ? 'flex' : 'none';
                    }

                    // If editing but sessions disabled, clear editing state
                    if (isEditing && !sessionsEnabled) {
                        sessionStorage.removeItem('editingSessionId');
                        isEditing = false;
                    }
                } catch (e) {
                    console.error('Failed to load settings:', e);
                }
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

        // Fetch the deck tree and render it
        py.get_deck_tree(function (jsonTree) {
            let deckTree = {};
            try {
                deckTree = JSON.parse(jsonTree);
            } catch (e) {
                console.error("Failed to parse deck tree JSON:", e);
                return;
            }

            const container = document.getElementById('deck-tree-container');
            if (container && deckTree && deckTree.children) {
                container.innerHTML = '';
                const ul = document.createElement('ul');
                deckTree.children.forEach(child => buildTree(child, ul));
                container.appendChild(ul);
            }

            // If editing, load the session and restore its state
            if (isEditing && window.py && typeof window.py.get_sessions === 'function') {
                window.py.get_sessions((json) => {
                    try {
                        const data = JSON.parse(json);
                        const session = (data.sessions || []).find(s => String(s.id) === editingSessionId);
                        if (session) {
                            // Restore name
                            const nameInput = document.getElementById('new-session-name');
                            if (nameInput) nameInput.value = session.name || '';
                            // Restore deck selection
                            const wanted = new Set((session.deck_ids || []).map(d => parseInt(d, 10)).filter(n => !Number.isNaN(n)));
                            setTimeout(() => {
                                document.querySelectorAll('input.deck-checkbox').forEach(cb => {
                                    const did = parseInt(cb.value, 10);
                                    cb.checked = wanted.has(did);
                                    cb.dispatchEvent(new Event('change'));
                                });
                                // Update parent states after all checkboxes are set
                                document.querySelectorAll('#deck-tree-container li').forEach(li => {
                                    // Update parent states bottom-up
                                    const parentCb = li.querySelector(':scope > .deck-item input.deck-checkbox');
                                    const childCbs = Array.from(li.querySelectorAll(':scope > ul.nested-list input.deck-checkbox'));
                                    if (parentCb && childCbs.length > 0) {
                                        let checkedCount = 0;
                                        childCbs.forEach(cb => {
                                            if (cb.checked) checkedCount++;
                                        });
                                        if (checkedCount === 0) {
                                            parentCb.checked = false;
                                            parentCb.indeterminate = false;
                                        } else if (checkedCount === childCbs.length) {
                                            parentCb.checked = true;
                                            parentCb.indeterminate = false;
                                        } else {
                                            parentCb.checked = false;
                                            parentCb.indeterminate = true;
                                        }
                                    }
                                });
                                const all = document.querySelectorAll('input.deck-checkbox');
                                all.forEach(cb => {
                                    const row = cb.closest('.deck-item');
                                    if (!row) return;
                                    if (cb.checked || cb.indeterminate) row.classList.add('selected');
                                    else row.classList.remove('selected');
                                });
                            }, 100);
                        }
                    } catch (e) {
                        console.error('Failed to load session for editing:', e);
                    }
                });
            }

            // Update button text if editing
            if (isEditing) {
                const createBtn = document.getElementById('create-session-btn');
                if (createBtn) createBtn.textContent = 'Save Changes';
            }
        });
    });
});

// Disable Ctrl+Scroll Zoom
window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

/**
 * Recursively builds the HTML for the deck tree.
 * @param {object} node - The current deck node from the tree data.
 * @param {HTMLElement} parentElement - The <ul> element to append the new item to.
 */
// -----------------------------
// Deck Priority Management
// -----------------------------

function loadDeckMetadata() {
    try {
        const data = localStorage.getItem('deck_metadata');
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error('Error loading deck metadata:', e);
        return {};
    }
}

function saveDeckMetadata(metadata) {
    try {
        localStorage.setItem('deck_metadata', JSON.stringify(metadata));
    } catch (e) {
        console.error('Error saving deck metadata:', e);
    }
}

function getDeckPriority(deckId) {
    const metadata = loadDeckMetadata();
    return metadata[deckId]?.priority || 'medium';
}

function setDeckPriority(deckId, priority) {
    const metadata = loadDeckMetadata();
    if (!metadata[deckId]) {
        metadata[deckId] = {};
    }
    metadata[deckId].priority = priority;
    saveDeckMetadata(metadata);
}

// -----------------------------
// Tree Building
// -----------------------------

function buildTree(node, parentElement) {
    const li = document.createElement('li');

    // Main container for the visible part of the list item
    const itemDiv = document.createElement('div');
    itemDiv.className = 'deck-item';

    // Create and append checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `deck-${node.id}`;
    checkbox.value = node.id;
    checkbox.className = 'deck-checkbox';
    itemDiv.appendChild(checkbox);

    function setChildrenChecked(checked) {
        const childCbs = li.querySelectorAll('ul.nested-list input.deck-checkbox');
        childCbs.forEach(cb => {
            cb.checked = checked;
            cb.indeterminate = false;
        });
    }

    function updateParentState(targetLi) {
        const parentCb = targetLi.querySelector(':scope > .deck-item input.deck-checkbox');
        const childCbs = Array.from(targetLi.querySelectorAll(':scope > ul.nested-list input.deck-checkbox'));
        if (!parentCb || childCbs.length === 0) return;

        let checkedCount = 0;
        let indeterminateCount = 0;
        childCbs.forEach(cb => {
            if (cb.indeterminate) indeterminateCount++;
            else if (cb.checked) checkedCount++;
        });

        if (checkedCount === 0 && indeterminateCount === 0) {
            parentCb.checked = false;
            parentCb.indeterminate = false;
        } else if (checkedCount === childCbs.length) {
            parentCb.checked = true;
            parentCb.indeterminate = false;
        } else {
            parentCb.checked = false;
            parentCb.indeterminate = true;
        }
    }

    function updateAncestors() {
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

    function refreshItemVisuals() {
        const all = document.querySelectorAll('input.deck-checkbox');
        all.forEach(cb => {
            const row = cb.closest('.deck-item');
            if (!row) return;
            if (cb.checked || cb.indeterminate) row.classList.add('selected');
            else row.classList.remove('selected');
        });
    }

    // Create and append label
    const label = document.createElement('label');
    label.htmlFor = `deck-${node.id}`;
    const displayName = node.name.includes('::') ? node.name.split('::').pop() : node.name;

    // Create deck name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'deck-name';
    nameSpan.textContent = displayName;
    label.appendChild(nameSpan);

    // Add priority selector
    const prioritySelect = document.createElement('select');
    prioritySelect.className = 'priority-select';
    prioritySelect.innerHTML = `
        <option value="low"> Low</option>
        <option value="medium"> Medium</option>
        <option value="high"> High</option>
    `;
    prioritySelect.value = getDeckPriority(node.id);
    prioritySelect.onclick = (e) => {
        e.stopPropagation();
    };
    prioritySelect.onchange = (e) => {
        e.stopPropagation();
        const priority = prioritySelect.value;
        setDeckPriority(node.id, priority);

        // Update visual
        itemDiv.className = `deck-item priority-${priority}`;
    };
    label.appendChild(prioritySelect);

    // Set initial priority class
    itemDiv.classList.add(`priority-${getDeckPriority(node.id)}`);

    // Badge-style counts
    const countsContainer = document.createElement('span');
    countsContainer.className = 'counts';

    const totalCards = node.review + node.learn + node.new;

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

    // Click anywhere on deck-item to toggle checkbox
    itemDiv.addEventListener('click', (e) => {
        // Don't trigger if clicking the checkbox itself or toggle
        if (e.target === checkbox || e.target.classList.contains('toggle')) {
            return;
        }
        e.stopPropagation();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
    });

    // Update visual state when checkbox changes
    checkbox.addEventListener('change', () => {
        setChildrenChecked(checkbox.checked);
        checkbox.indeterminate = false;
        updateAncestors();
        refreshItemVisuals();
        if (typeof window.updateSelectionCounter === 'function') {
            window.updateSelectionCounter();
        }
    });

    li.appendChild(itemDiv);
    parentElement.appendChild(li);

    // If the deck has children, create a nested list and recurse
    if (node.children && node.children.length > 0) {
        li.classList.add('has-children');

        const toggle = document.createElement('span');
        toggle.className = 'toggle';
        itemDiv.insertBefore(toggle, checkbox);

        const nestedUl = document.createElement('ul');
        nestedUl.className = 'nested-list';
        li.appendChild(nestedUl);
        node.children.forEach(child => buildTree(child, nestedUl));

        // Add click event to the toggle
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            li.classList.toggle('expanded');
        });
    }
}

// Save selection button handler - collect checked deck ids and persist
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-selection-btn');
    const createSessionBtn = document.getElementById('create-session-btn');
    const newSessionNameInput = document.getElementById('new-session-name');
    const sessionCreateStatus = document.getElementById('session-create-status');

    // Check if we're editing an existing session
    const editingSessionId = sessionStorage.getItem('editingSessionId');
    let isEditing = !!editingSessionId;

    function setSessionCreateStatus(text, kind) {
        if (!sessionCreateStatus) return;
        sessionCreateStatus.textContent = text || '';
        sessionCreateStatus.dataset.kind = kind || '';
        sessionCreateStatus.style.display = text ? 'block' : 'none';
        if (!text) return;
        window.clearTimeout(window._sessionCreateStatusTimer);
        window._sessionCreateStatusTimer = window.setTimeout(() => {
            sessionCreateStatus.style.display = 'none';
            sessionCreateStatus.textContent = '';
            sessionCreateStatus.dataset.kind = '';
        }, 2000);
    }
    if (!saveBtn) return;

    saveBtn.addEventListener('click', () => {
        const checked = Array.from(document.querySelectorAll('input.deck-checkbox:checked'))
            .map(cb => parseInt(cb.value, 10));

        // call python bridge to save
        if (window.py && typeof window.py.save_selected_decks === 'function') {
            const originalText = saveBtn.innerText;
            saveBtn.innerText = 'Saving...';

            const jsonStr = JSON.stringify(checked);
            window.py.save_selected_decks(jsonStr, function (jsonResp) {
                try {
                    const resp = JSON.parse(jsonResp);
                    if (resp && resp.ok) {
                        saveBtn.innerText = 'Saved!';
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 500);
                    } else {
                        console.error('save_selected_decks failed', resp);
                        saveBtn.innerText = 'Error!';
                        setTimeout(() => saveBtn.innerText = originalText, 2000);
                    }
                } catch (e) {
                    console.error("Failed to parse save response:", e);
                    saveBtn.innerText = 'Error!';
                }
            });
        } else {
            console.warn('Save not available in this environment.');
        }
    });

    // Create Session button
    createSessionBtn?.addEventListener('click', () => {
        const name = (newSessionNameInput?.value || '').trim();
        if (!name) {
            setSessionCreateStatus('Name required', 'error');
            return;
        }

        // Get all selected deck IDs and expand parents to children
        const checked = Array.from(document.querySelectorAll('input.deck-checkbox:checked'))
            .map(cb => parseInt(cb.value, 10))
            .filter(n => !Number.isNaN(n));

        // If any parent deck is selected, replace it with all its descendants
        const expandedDeckIds = new Set();
        checked.forEach(deckId => {
            const checkbox = document.querySelector(`input.deck-checkbox[value="${deckId}"]`);
            if (checkbox) {
                const li = checkbox.closest('li');
                if (li && li.classList.contains('has-children')) {
                    // This is a parent deck, add all descendants instead
                    const descendantCbs = li.querySelectorAll('input.deck-checkbox');
                    descendantCbs.forEach(cb => {
                        const did = parseInt(cb.value, 10);
                        if (!Number.isNaN(did)) {
                            expandedDeckIds.add(did);
                        }
                    });
                } else {
                    // This is not a parent deck, add as-is
                    expandedDeckIds.add(deckId);
                }
            }
        });

        const finalDeckIds = Array.from(expandedDeckIds);

        if (finalDeckIds.length === 0) {
            setSessionCreateStatus('Select decks', 'error');
            return;
        }

        if (window.py && typeof window.py.upsert_session === 'function') {
            createSessionBtn.disabled = true;
            createSessionBtn.textContent = isEditing ? 'Saving...' : 'Creating...';

            const payload = isEditing ? { id: editingSessionId, name, deck_ids: finalDeckIds } : { name, deck_ids: finalDeckIds };
            window.py.upsert_session(JSON.stringify(payload), (resp) => {
                try {
                    const r = JSON.parse(resp);
                    if (!r.ok) {
                        setSessionCreateStatus('Error', 'error');
                        return;
                    }
                    setSessionCreateStatus(isEditing ? 'Saved' : 'Created', 'ok');
                    newSessionNameInput.value = '';
                    if (isEditing) {
                        // Clear editing state after successful save
                        sessionStorage.removeItem('editingSessionId');
                        setTimeout(() => {
                            window.location.href = 'sessions.html';
                        }, 1000);
                    }
                } catch (e) {
                    setSessionCreateStatus('Error', 'error');
                } finally {
                    createSessionBtn.disabled = false;
                    createSessionBtn.textContent = isEditing ? 'Save Changes' : 'Create Session';
                }
            });
        } else {
            setSessionCreateStatus('No backend', 'error');
        }
    });

    // Helper Action Listeners
    document.getElementById('btn-all')?.addEventListener('click', () => {
        document.querySelectorAll('input.deck-checkbox').forEach(cb => {
            cb.checked = true;
            cb.dispatchEvent(new Event('change'));
        });
    });

    document.getElementById('btn-none')?.addEventListener('click', () => {
        document.querySelectorAll('input.deck-checkbox').forEach(cb => {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        });
    });

    document.getElementById('btn-invert')?.addEventListener('click', () => {
        document.querySelectorAll('input.deck-checkbox').forEach(cb => {
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
        });
    });

    // Expand/Collapse All
    document.getElementById('btn-expand-all')?.addEventListener('click', () => {
        document.querySelectorAll('li.has-children').forEach(li => {
            li.classList.add('expanded');
        });
    });

    document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
        document.querySelectorAll('li.has-children').forEach(li => {
            li.classList.remove('expanded');
        });
    });

    // Selection Counter
    function updateSelectionCounter() {
        const counter = document.getElementById('selection-counter');
        const countText = document.getElementById('selection-count');
        const checked = document.querySelectorAll('input.deck-checkbox:checked').length;

        if (checked > 0) {
            counter.style.display = 'block';
            countText.textContent = `${checked} deck${checked !== 1 ? 's' : ''} selected`;
        } else {
            counter.style.display = 'none';
        }
    }

    // Make updateSelectionCounter globally accessible
    window.updateSelectionCounter = updateSelectionCounter;

    // --- Search & Shortcut Logic ---
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const emptyState = document.getElementById('empty-state');

    // Shortcut '/' to focus search
    document.addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;

        // Navigation in Search Mode
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && document.activeElement === searchInput) {
            e.preventDefault();
            const firstVisible = document.querySelector('.deck-item:not([style*="display: none"]) input[type="checkbox"]');
            if (firstVisible) firstVisible.focus();
            return;
        }

        if (e.key === '/' && document.activeElement !== searchInput) {
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

            e.preventDefault();
            searchInput.focus();
        }

        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.blur();
        }
    });

    // Clear Button Logic
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            runDeckFilter('');
            searchInput.focus();
        });
    }

    // Filter Logic
    let isComposing = false;

    searchInput.addEventListener('compositionstart', () => { isComposing = true; });
    searchInput.addEventListener('compositionend', (e) => {
        isComposing = false;
        runDeckFilter(e.target.value);
    });

    searchInput.addEventListener('input', (e) => {
        if (isComposing) return;
        runDeckFilter(e.target.value);
    });

    function runDeckFilter(searchValue) {
        const term = searchValue.toLowerCase();
        const treeContainer = document.getElementById('deck-tree-container');
        const items = treeContainer.querySelectorAll('li');

        // Toggle Clear Button
        if (clearBtn) {
            clearBtn.style.display = term ? 'block' : 'none';
        }

        if (!term) {
            items.forEach(li => {
                li.style.display = '';
                const label = li.querySelector('label');
                if (label && label.dataset.originalText) {
                    label.innerHTML = label.dataset.originalText; // Restore original HTML (with colored counts)
                }
            });
            if (emptyState) emptyState.style.display = 'none';
            return;
        }

        let visibleCount = 0;

        // Reset visibility first to clean state
        items.forEach(li => li.style.display = 'none');

        items.forEach(li => {
            const label = li.querySelector('label');
            if (!label) return;

            // Cache original content if not already done
            if (!label.dataset.originalText) {
                label.dataset.originalText = label.innerHTML;
            }
            // Use textContent for matching to ignore HTML tags
            const rawText = label.textContent;
            // We want to match against the display name part typically
            // but matching raw text is safer/easier. 
            // NOTE: rawText includes counts "(R: 0...)"

            if (rawText.toLowerCase().includes(term)) {
                let current = li;
                // Walk up to show parents
                while (current && current.tagName === 'LI') {
                    if (current.style.display === 'none') { // Only count if effectively unhiding
                        current.style.display = '';
                        visibleCount++;
                    }
                    if (current.classList.contains('has-children')) {
                        current.classList.add('expanded');
                    }
                    const parentUl = current.parentElement;
                    if (parentUl && parentUl.classList.contains('nested-list')) {
                        const parentLi = parentUl.parentElement;
                        if (parentLi) {
                            parentLi.classList.add('expanded');
                            current = parentLi;
                        } else {
                            current = null;
                        }
                    } else {
                        current = null;
                    }
                }

                // Highlight Logic
                // We need to carefully replace text while preserving the structure (checkbox is sibling, not child of label)
                // Actually label innerHTML has "Name <span class='counts'>...</span>"
                // It's tricky to highlight just the name part without breaking the counts span structure
                // Let's rely on caching the original HTML.

                // 1. Get just the name part
                const originalHTML = label.dataset.originalText;
                // Parse it temporarily or regex it? 
                // Regex: Match text before <span class="counts">
                const match = originalHTML.match(/^(.+?)(\s*<span class="counts">.*<\/span>)$/);

                if (match) {
                    const namePart = match[1];
                    const countsPart = match[2];

                    // Highlight inside namePart
                    // Regex replace, case insensitive, global?
                    const regex = new RegExp(`(${term})`, 'gi');
                    const highlightedName = namePart.replace(regex, '<mark class="highlight">$1</mark>');

                    label.innerHTML = highlightedName + countsPart;
                } else {
                    // Fallback if structure is different
                    label.innerHTML = originalHTML;
                }
            } else {
                // No match? already hidden.
            }
        });

        if (emptyState) {
            emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    // Window Dragging logic
    document.addEventListener('mousedown', (e) => {
        // Only allow dragging from the page header or window title bar
        const header = e.target.closest('.page-header');
        const titleBar = e.target.closest('.window-title-bar');
        if (!header && !titleBar) return;

        // Don't drag if clicking on buttons or links
        if (e.target.closest('button') ||
            e.target.closest('a') ||
            e.target.closest('input')) {
            return;
        }

        if (window.py && typeof window.py.drag_window === 'function') {
            window.py.drag_window();
        }
    });
});