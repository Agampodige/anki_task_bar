document.addEventListener("DOMContentLoaded", () => {
    function _applySettingsToHomeUI(settings) {
        const cfg = settings || {};
        const hideCompleted = !!cfg.hideCompleted;
        const compactMode = !!cfg.compactMode;
        const hideSearchBar = !!cfg.hideSearchBar;
        const theme = cfg.theme || 'green';
        const appearance = cfg.appearance || 'dark';
        const zoomLevel = cfg.zoomLevel !== undefined ? cfg.zoomLevel : 1.0;

        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-appearance', appearance);
        document.body.style.zoom = zoomLevel;

        const titleBar = document.getElementById('window-title-bar');
        if (titleBar) {
            const showTitleBar = cfg.showTitleBar !== false;
            if (showTitleBar) {
                titleBar.classList.remove('hidden');
            } else {
                titleBar.classList.add('hidden');
            }
        }

        if (compactMode) {
            document.body.classList.add('compact');
        } else {
            document.body.classList.remove('compact');
        }

        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.parentNode.style.display = hideSearchBar ? 'none' : 'block';
        }

        const completedSection = document.getElementById('completed-section');
        const completedContainer = document.getElementById('completed-list-container');
        if (hideCompleted) {
            if (completedSection) completedSection.style.display = 'none';
            if (completedContainer) completedContainer.style.display = 'none';
        } else {
            // Only show if there's actually data, refreshData handles this usually
            // but we ensure it's not forced 'none' if we just toggled it off.
        }

        const sessionsBtn = document.getElementById('btn-sessions');
        const manageBtn = document.getElementById('btn-manage');
        if (sessionsBtn) {
            const sessionsEnabled = cfg.sessionsEnabled !== false;
            sessionsBtn.style.display = sessionsEnabled ? 'flex' : 'none';
            if (manageBtn) {
                manageBtn.style.display = sessionsEnabled ? 'none' : 'flex';
            }
        }

        const statsBar = document.getElementById('selected-decks-stats');
        if (statsBar) {
            const showStatsBar = cfg.showStatsBar !== false; // Default to true
            statsBar.style.display = showStatsBar && window.selectedDecksStats && window.selectedDecksStats.totalDecks > 0 ? 'flex' : 'none';
        }

        if (window.py && typeof window.py.set_always_on_top === 'function') {
            const alwaysOnTop = cfg.alwaysOnTop !== false; // Default to true
            window.py.set_always_on_top(alwaysOnTop);
        }

        const isMovable = cfg.movable !== false;
        if (isMovable) {
            document.body.classList.remove('locked');
        } else {
            document.body.classList.add('locked');
        }

        window.ankiTaskBarSettings = cfg;
    }

    // Disable Ctrl+Scroll Zoom
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });

    function _loadSettings(cb) {
        const fallback = () => {
            try {
                const local = localStorage.getItem('anki_task_bar_settings');
                cb(local ? JSON.parse(local) : {});
            } catch (e) {
                cb({});
            }
        };

        if (window.py && typeof window.py.load_settings_from_file === 'function') {
            window.py.load_settings_from_file((data) => {
                try {
                    const cfg = data ? JSON.parse(data) : {};
                    try { localStorage.setItem('anki_task_bar_settings', JSON.stringify(cfg)); } catch (e) { }
                    cb(cfg);
                } catch (e) {
                    fallback();
                }
            });
            return;
        }

        fallback();
    }

    // Function to update selected decks statistics bar
    function updateSelectedDecksStats(data) {
        const statsBar = document.getElementById('selected-decks-stats');
        if (!statsBar) return;

        // Use ALL decks (active + completed) for persistence
        const allDecks = data;
        const totalDecks = allDecks.length;
        const totalCards = allDecks.reduce((sum, t) => sum + (t.dueStart || 0), 0);

        // Active decks calculate pending work
        const pendingCards = allDecks.reduce((sum, t) => sum + (t.dueNow || 0), 0);
        const completedCards = allDecks.reduce((sum, t) => sum + (t.done || 0), 0);

        // Fetch today's review totals for better time estimation
        if (window.py && typeof window.py.get_today_review_totals === 'function') {
            window.py.get_today_review_totals((jsonData) => {
                let totals = { total_cards: 0, total_reviews: 0, total_time_ms: 0 };
                try {
                    totals = JSON.parse(jsonData);
                } catch (e) { }

                // Calculate average time per card (seconds)
                // Use total_cards for a more conservative estimate of cards vs. total reviews
                let secondsPerCard = 60; // Fallback: 1 minute
                if (totals.total_cards > 5 && totals.total_time_ms > 0) {
                    secondsPerCard = (totals.total_time_ms / 1000) / totals.total_cards;
                    // Sanity check: cap between 5s and 180s
                    secondsPerCard = Math.min(Math.max(secondsPerCard, 5), 180);
                }

                const estimatedSeconds = pendingCards * secondsPerCard;
                const estimatedMinutes = Math.round(estimatedSeconds / 60);

                let estimatedTime = '';
                if (estimatedMinutes < 1) {
                    estimatedTime = pendingCards > 0 ? '<1m' : '0m';
                } else if (estimatedMinutes < 60) {
                    estimatedTime = `${estimatedMinutes}m`;
                } else {
                    estimatedTime = `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`;
                }

                // Estimated Finish Time
                let finishTimeStr = '';
                if (pendingCards > 0) {
                    const finishDate = new Date(Date.now() + estimatedSeconds * 1000);
                    const hours = finishDate.getHours();
                    const minutes = finishDate.getMinutes();
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    const displayHours = hours % 12 || 12;
                    const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
                    finishTimeStr = `Finish: ${displayHours}:${displayMinutes} ${ampm}`;
                }

                // Update Globals
                window.selectedDecksStats = {
                    totalDecks,
                    totalCards,
                    completedCards,
                    estimatedTime,
                    finishTimeStr
                };

                _renderStatsUI();
            });
        } else {
            // Fallback for no backend
            const estimatedMinutes = pendingCards;
            const estimatedTime = estimatedMinutes < 60
                ? `${estimatedMinutes}m`
                : `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`;

            window.selectedDecksStats = {
                totalDecks,
                totalCards,
                completedCards,
                estimatedTime,
                finishTimeStr: ''
            };
            _renderStatsUI();
        }

        function _renderStatsUI() {
            const stats = window.selectedDecksStats;
            const deckCountEl = document.getElementById('stats-deck-count');
            const cardsFormatEl = document.getElementById('stats-cards-format');
            const timeEl = document.getElementById('stats-estimated-time');

            if (deckCountEl) deckCountEl.textContent = `${stats.totalDecks}`;

            // Format: Total / Completed
            if (cardsFormatEl) cardsFormatEl.textContent = `${stats.totalCards} / ${stats.completedCards}`;

            if (timeEl) {
                if (stats.finishTimeStr) {
                    timeEl.innerHTML = `<span>${stats.estimatedTime}</span><span class="finish-time">${stats.finishTimeStr}</span>`;
                } else {
                    timeEl.textContent = stats.estimatedTime;
                }
            }

            // Show/hide based on settings and data
            const cfg = window.ankiTaskBarSettings || {};
            const showStatsBar = cfg.showStatsBar !== false;
            statsBar.style.display = showStatsBar && stats.totalDecks > 0 ? 'flex' : 'none';
        }
    }

    // Refactored Data Fetching Logic
    window.refreshData = function () {
        if (!window.py) return;

        const mainContainer = document.getElementById('main-content-container');
        const container = document.getElementById('task-list-container');
        // Save state
        const savedScrollTop = mainContainer ? mainContainer.scrollTop : 0;

        py.get_taskbar_tasks(function (jsonData) {
            let data = [];
            try {
                data = JSON.parse(jsonData);
            } catch (e) {
                console.error("Failed to parse tasks JSON:", e);
            }

            const tasksById = new Map();
            data.forEach(t => {
                tasksById.set(Number(t.deckId), t);
            });

            // Helper to load deck metadata
            function loadDeckMetadata() {
                try {
                    const metaData = localStorage.getItem('deck_metadata');
                    return metaData ? JSON.parse(metaData) : {};
                } catch (e) {
                    console.error('Error loading deck metadata:', e);
                    return {};
                }
            }

            function getDeckPriority(deckId) {
                const metadata = loadDeckMetadata();
                return metadata[deckId]?.priority || 'medium';
            }

            // Sort by priority: high -> medium -> low, then by completion
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            data.sort((a, b) => {
                // First by completion status
                if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1;
                }
                // Then by priority
                const aPriority = getDeckPriority(a.deckId);
                const bPriority = getDeckPriority(b.deckId);
                return priorityOrder[aPriority] - priorityOrder[bPriority];
            });

            // Separate active and completed
            const activeDecks = data.filter(t => !t.completed);
            const completedDecks = data.filter(t => t.completed);

            // Store globally for stats and selection restoration
            window.taskData = data;

            // Update selected decks statistics bar
            updateSelectedDecksStats(data);

            const completedContainer = document.getElementById('completed-list-container');
            const completedSection = document.getElementById('completed-section');

            container.innerHTML = ""; // clear container first
            if (completedContainer) completedContainer.innerHTML = "";

            if (!data || data.length === 0) {
                container.innerHTML = '<p class="placeholder">No decks selected. Go to "Manage Decks" to add tasks.</p>';
                if (completedSection) completedSection.style.display = 'none';
                return;
            }

            // Calculate Global Progress & Stats
            let totalDue = 0;
            let totalDone = 0;
            data.forEach(t => {
                totalDue += (t.dueStart || 0);
                totalDone += (t.done || 0);
            });
            window.totalDoneToday = totalDone;

            const globalPct = totalDue > 0 ? (totalDone / totalDue) * 100 : 0;
            const globalBar = document.getElementById('global-progress-value');
            if (globalBar) {
                globalBar.style.width = `${Math.min(Math.max(globalPct, 0), 100)}%`;
            }

            // Tree view rendering for active decks
            const selectedActiveSet = new Set(activeDecks.map(t => Number(t.deckId)));

            function displayName(fullName) {
                if (!fullName) return '';
                return fullName.includes('::') ? fullName.split('::').pop() : fullName;
            }

            function buildPrunedTree(root) {
                if (!root) return null;
                const id = Number(root.id);
                const children = Array.isArray(root.children) ? root.children : [];

                const prunedChildren = [];
                for (const c of children) {
                    const pruned = buildPrunedTree(c);
                    if (pruned) prunedChildren.push(pruned);
                }

                const keep = selectedActiveSet.has(id) || prunedChildren.length > 0;
                if (!keep) return null;

                return {
                    id,
                    name: root.name,
                    children: prunedChildren,
                };
            }

            function renderActiveTree(deckTreeRoot) {
                // State for keyboard navigation
                let taskElements = [];

                const updateSelection = (index) => {
                    taskElements.forEach((el, idx) => {
                        if (idx === index) {
                            el.classList.add('selected');
                        } else {
                            el.classList.remove('selected');
                        }
                    });
                    window.currentSelectedIndex = index;
                };

                const ul = document.createElement('ul');
                ul.className = 'task-tree';

                function renderNode(node, parentUl) {
                    const li = document.createElement('li');
                    const row = document.createElement('div');
                    row.className = 'deck-item task-node';

                    const isSelected = selectedActiveSet.has(node.id);
                    const task = isSelected ? tasksById.get(node.id) : null;

                    if (task) {
                        const priority = getDeckPriority(task.deckId);
                        row.classList.add(`priority-${priority}`);
                    }

                    if (node.children && node.children.length > 0) {
                        li.classList.add('has-children');
                        const toggle = document.createElement('span');
                        toggle.className = 'toggle';
                        toggle.addEventListener('click', (e) => {
                            e.stopPropagation();
                            li.classList.toggle('expanded');
                        });
                        row.appendChild(toggle);
                        li.classList.add('expanded');
                    }
                    // REMOVED: Else block that added spacer/icon

                    if (task) {
                        const progressBar = document.createElement('div');
                        progressBar.className = 'task-progress-bar';
                        const pct = Math.min(Math.max(task.progress * 100, 0), 100);
                        progressBar.style.width = `${pct}%`;
                        row.appendChild(progressBar);
                    }

                    const content = document.createElement('div');
                    content.className = 'task-content';

                    const deckName = document.createElement('span');
                    deckName.className = 'task-name';
                    deckName.textContent = displayName(node.name);

                    const counts = document.createElement('span');
                    counts.className = 'task-counts';
                    if (task) {
                        const total = task.dueStart;
                        const done = task.done;
                        const pending = task.dueNow;
                        counts.innerHTML = `<span class="highlight review-count">${pending}</span><span class="separator"> / </span>${done}<span class="separator"> / </span>${total}`;
                    } else {
                        counts.textContent = '';
                    }

                    content.appendChild(deckName);
                    content.appendChild(counts);
                    row.appendChild(content);

                    if (task) {
                        row.addEventListener('click', (e) => {
                            if (e.target && e.target.classList && e.target.classList.contains('toggle')) return;
                            if (window.py && typeof window.py.start_review === 'function') {
                                window.py.start_review(String(task.deckId));
                            }
                        });

                        row.addEventListener('mouseenter', () => {
                            const idx = taskElements.indexOf(row);
                            if (idx >= 0) updateSelection(idx);
                        });

                        taskElements.push(row);
                    }

                    li.appendChild(row);

                    if (node.children && node.children.length > 0) {
                        const nestedUl = document.createElement('ul');
                        nestedUl.className = 'nested-list';
                        li.appendChild(nestedUl);
                        node.children.forEach(child => renderNode(child, nestedUl));
                    }

                    parentUl.appendChild(li);
                }

                if (deckTreeRoot && Array.isArray(deckTreeRoot.children)) {
                    deckTreeRoot.children.forEach(child => {
                        const pruned = buildPrunedTree(child);
                        if (pruned) renderNode(pruned, ul);
                    });
                }

                container.appendChild(ul);

                if (taskElements.length > 0) {
                    updateSelection(0);
                }

                return taskElements;
            }

            // Render completed decks section
            if (completedDecks.length > 0 && completedContainer && completedSection) {
                completedSection.style.display = 'block';
                const completedUl = document.createElement('ul');
                completedUl.className = 'task-list completed-list';

                completedDecks.forEach((task) => {
                    const li = document.createElement('li');
                    li.className = 'task-item completed';

                    const priority = getDeckPriority(task.deckId);
                    li.classList.add(`priority-${priority}`);

                    const progressBar = document.createElement('div');
                    progressBar.className = 'task-progress-bar';
                    progressBar.style.width = '100%';

                    const content = document.createElement('div');
                    content.className = 'task-content';

                    const deckName = document.createElement('span');
                    deckName.className = 'task-name';
                    deckName.textContent = task.name;

                    const counts = document.createElement('span');
                    counts.className = 'task-counts status-completed';
                    counts.textContent = "Completed";

                    content.appendChild(deckName);
                    content.appendChild(counts);

                    li.appendChild(progressBar);
                    li.appendChild(content);

                    // Click to review (still clickable)
                    li.addEventListener('click', () => {
                        if (window.py && typeof window.py.start_review === 'function') {
                            window.py.start_review(String(task.deckId));
                        }
                    });

                    completedUl.appendChild(li);
                });

                completedContainer.appendChild(completedUl);
            } else if (completedSection) {
                completedSection.style.display = 'none';
            }

            // Apply settings-based visibility overrides after render
            _applySettingsToHomeUI(window.ankiTaskBarSettings);

            // Render active decks as tree (needs deck tree)
            if (activeDecks.length === 0) {
                container.innerHTML = '<p class="placeholder">All decks completed! 🎉</p>';
                if (window.confetti && window.ankiTaskBarSettings && window.ankiTaskBarSettings.confettiEnabled !== false) {
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                }
            } else if (typeof window.py.get_deck_tree === 'function') {
                window.py.get_deck_tree((jsonTree) => {
                    let tree = null;
                    try {
                        tree = JSON.parse(jsonTree);
                    } catch (e) {
                        tree = null;
                    }

                    // Clear container again (we had completed rendering already)
                    container.innerHTML = '';
                    const taskElements = renderActiveTree(tree);

                    // Keyboard Event Listener
                    if (window._taskListKeyHandler) {
                        document.removeEventListener('keydown', window._taskListKeyHandler);
                    }

                    window._taskListKeyHandler = (e) => {
                        if (e.isComposing || e.keyCode === 229) return;
                        const tag = e.target.tagName;
                        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
                        if (!taskElements || taskElements.length === 0) return;

                        const visibleTaskElements = taskElements.filter((row) => {
                            const li = row.closest('li');
                            return li && li.style.display !== 'none' && row.style.display !== 'none';
                        });

                        if (visibleTaskElements.length === 0) return;

                        let idx = typeof window.currentSelectedIndex !== 'undefined' ? window.currentSelectedIndex : 0;
                        if (idx < 0 || idx >= visibleTaskElements.length) idx = 0;

                        if (e.key === 'ArrowDown') {
                            idx = (idx + 1) % visibleTaskElements.length;
                            visibleTaskElements[idx].classList.add('selected');
                            visibleTaskElements.forEach((el, i) => { if (i !== idx) el.classList.remove('selected'); });
                            window.currentSelectedIndex = idx;
                            visibleTaskElements[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            e.preventDefault();
                        } else if (e.key === 'ArrowUp') {
                            idx = (idx - 1 + visibleTaskElements.length) % visibleTaskElements.length;
                            visibleTaskElements[idx].classList.add('selected');
                            visibleTaskElements.forEach((el, i) => { if (i !== idx) el.classList.remove('selected'); });
                            window.currentSelectedIndex = idx;
                            visibleTaskElements[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            e.preventDefault();
                        } else if (e.key === 'Enter') {
                            const el = visibleTaskElements[idx];
                            if (el) el.click();
                        }
                    };

                    document.addEventListener('keydown', window._taskListKeyHandler);

                    // Restore Scroll Position
                    if (mainContainer) {
                        mainContainer.scrollTop = savedScrollTop;
                    }
                });
            }
        });
    };

    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.py = channel.objects.py;
        _loadSettings((cfg) => {
            _applySettingsToHomeUI(cfg);
            // Initial Load
            window.refreshData();
        });
    });

    // Window Control Handlers
    const winMin = document.getElementById('win-min');
    const winExpand = document.getElementById('win-expand');
    const winClose = document.getElementById('win-close');

    if (winMin) {
        winMin.addEventListener('click', () => {
            if (window.py && typeof window.py.minimize_window === 'function') {
                window.py.minimize_window();
            }
        });
    }

    if (winExpand) {
        winExpand.addEventListener('click', () => {
            if (window.py && typeof window.py.toggle_expand === 'function') {
                window.py.toggle_expand();
            }
        });
    }

    if (winClose) {
        winClose.addEventListener('click', () => {
            if (window.py && typeof window.py.close_window === 'function') {
                window.py.close_window();
            }
        });
    }

    // Grind Button
    const grindBtn = document.getElementById('grind-btn');
    if (grindBtn) {
        grindBtn.addEventListener('click', () => {
            if (window.py && typeof window.py.close_window === 'function') {
                window.py.close_window();
            }
        });
    }



    // Stats Logic
    const statsBtn = document.getElementById('btn-stats');
    const modal = document.getElementById('stats-modal');

    if (statsBtn && modal) {
        const modalContent = modal.querySelector('.modal-content');
        const countDisplay = document.getElementById('total-done-count');
        const titleEl = document.getElementById('stats-title');

        let statsMode = 1; // Default to 1 (reviews) instead of 0 (cards)

        const renderStats = () => {
            const totals = window._todayTotals || { total_cards: 0, total_reviews: 0 };
            if (statsMode === 0) {
                if (titleEl) titleEl.textContent = 'Total Cards Today';
                if (countDisplay) countDisplay.textContent = String(totals.total_cards ?? 0);
            } else {
                if (titleEl) titleEl.textContent = 'Total Reviews Today';
                if (countDisplay) countDisplay.textContent = String(totals.total_reviews ?? 0);
            }
        };

        const fetchTotals = (cb) => {
            if (window.py && typeof window.py.get_today_review_totals === 'function') {
                window.py.get_today_review_totals((jsonData) => {
                    try {
                        window._todayTotals = JSON.parse(jsonData);
                    } catch (e) {
                        window._todayTotals = { total_cards: 0, total_reviews: 0 };
                    }
                    if (cb) cb();
                });
            } else {
                window._todayTotals = { total_cards: 0, total_reviews: 0 };
                if (cb) cb();
            }
        };

        statsBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent drag

            statsMode = 0;
            fetchTotals(() => {
                renderStats();
                modal.classList.add('visible');
            });
        });

        if (!window._statsClickBound && modalContent) {
            window._statsClickBound = true;

            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
                statsMode = statsMode === 0 ? 1 : 0;
                renderStats();
            });
        }

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (!modalContent.contains(e.target)) {
                modal.classList.remove('visible');
            }
        });
    }





    // --- Search & Shortcut Logic ---
    const searchInput = document.getElementById('search-input');

    if (searchInput) {
        // Shortcut '/' to focus search
        document.addEventListener('keydown', (e) => {
            if (e.isComposing || e.keyCode === 229) return;

            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
            // ESC to blur
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.blur();
            }
        });

        // Filter Logic
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const container = document.getElementById('task-list-container');
            const completedContainer = document.getElementById('completed-list-container');
            const completedSection = document.getElementById('completed-section');

            if (!container) return;

            // Filter active tasks
            const treeRoot = container.querySelector('ul.task-tree');
            if (treeRoot) {
                const filterLi = (li) => {
                    const row = li.querySelector(':scope > .task-node');
                    const nameEl = row ? row.querySelector('.task-name') : null;
                    const name = nameEl ? nameEl.textContent.toLowerCase() : '';
                    const selfMatch = term === '' ? true : name.includes(term);

                    const childLis = Array.from(li.querySelectorAll(':scope > ul.nested-list > li'));
                    let childMatch = false;
                    childLis.forEach(child => {
                        if (filterLi(child)) childMatch = true;
                    });

                    const visible = term === '' ? true : (selfMatch || childMatch);
                    li.style.display = visible ? '' : 'none';

                    if (term !== '' && childMatch && li.classList.contains('has-children')) {
                        li.classList.add('expanded');
                    }

                    return visible;
                };

                Array.from(treeRoot.querySelectorAll(':scope > li')).forEach(li => filterLi(li));

                const visibleRows = Array.from(container.querySelectorAll('.task-node')).filter((row) => {
                    const li = row.closest('li');
                    return li && li.style.display !== 'none';
                });

                if (visibleRows.length > 0) {
                    visibleRows.forEach(r => r.classList.remove('selected'));
                    visibleRows[0].classList.add('selected');
                    window.currentSelectedIndex = 0;
                }
            }

            // Filter completed tasks
            let completedVisibleCount = 0;
            if (completedContainer) {
                const completedTasks = completedContainer.querySelectorAll('.task-item');
                completedTasks.forEach((task) => {
                    const nameEl = task.querySelector('.task-name');
                    const name = nameEl ? nameEl.textContent.toLowerCase() : '';

                    if (name.includes(term)) {
                        task.style.display = 'flex';
                        completedVisibleCount++;
                    } else {
                        task.style.display = 'none';
                    }
                });

                // Hide completed section if no completed tasks match OR if hidden by settings
                if (completedSection) {
                    const hideCompleted = window.ankiTaskBarSettings && window.ankiTaskBarSettings.hideCompleted;
                    if (hideCompleted) {
                        completedSection.style.display = 'none';
                        if (completedContainer) completedContainer.style.display = 'none';
                    } else if (completedVisibleCount > 0) {
                        completedSection.style.display = 'block';
                        if (completedContainer) completedContainer.style.display = 'block';
                    } else if (term !== '') {
                        completedSection.style.display = 'none';
                    }
                }
            }

            // Update selection if current selection is hidden
            // Selection syncing is handled by the tree filter above.
        });
    }

    // Window Dragging logic - Only from header
    document.addEventListener('mousedown', (e) => {
        // Check if movable
        const isMovable = window.ankiTaskBarSettings ? window.ankiTaskBarSettings.movable !== false : true;
        if (!isMovable) return;

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

