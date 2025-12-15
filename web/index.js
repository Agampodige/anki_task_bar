document.addEventListener("DOMContentLoaded", () => {
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

            // Create a list to hold the active tasks
            const ul = document.createElement('ul');
            ul.className = 'task-list';

            // State for keyboard navigation
            let taskElements = [];
            let newSelectedIndex = -1;

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

            activeDecks.forEach((task, index) => {
                const li = document.createElement('li');
                li.className = 'task-item';
                li.dataset.index = index;

                // Add priority class
                const priority = getDeckPriority(task.deckId);
                li.classList.add(`priority-${priority}`);

                // Progress Bar Background
                const progressBar = document.createElement('div');
                progressBar.className = 'task-progress-bar';
                const pct = Math.min(Math.max(task.progress * 100, 0), 100);
                progressBar.style.width = `${pct}%`;

                // Content Container
                const content = document.createElement('div');
                content.className = 'task-content';

                const deckName = document.createElement('span');
                deckName.className = 'task-name';
                deckName.textContent = task.name;

                const counts = document.createElement('span');
                counts.className = 'task-counts';
                const total = task.dueStart;
                const done = task.done;

                if (task.completed) {
                    counts.textContent = "Completed";
                    counts.classList.add('status-completed');
                } else {
                    counts.innerHTML = `<span class="highlight">${done}</span><span class="separator"> / </span>${total}`;
                }

                content.appendChild(deckName);
                content.appendChild(counts);

                li.appendChild(progressBar);
                li.appendChild(content);

                // Click to review
                li.addEventListener('click', () => {
                    if (window.py && typeof window.py.start_review === 'function') {
                        window.py.start_review(String(task.deckId));
                    }
                });

                // Mouse hover sets selection
                li.addEventListener('mouseenter', () => {
                    updateSelection(index);
                });

                ul.appendChild(li);
                taskElements.push(li);
            });

            if (activeDecks.length > 0) {
                container.appendChild(ul);
            } else {
                container.innerHTML = '<p class="placeholder">All decks completed! 🎉</p>';
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

            // Restore Selection
            if (newSelectedIndex !== -1) {
                updateSelection(newSelectedIndex);
            } else if (taskElements.length > 0) {
                // Default to first if nothing selected previously
                updateSelection(0);
            }

            // Restore Scroll Position
            if (mainContainer) {
                mainContainer.scrollTop = savedScrollTop;
            }

            // Keyboard Event Listener
            // Remove any existing listener to prevent duplicates
            if (window._taskListKeyHandler) {
                document.removeEventListener('keydown', window._taskListKeyHandler);
            }

            window._taskListKeyHandler = (e) => {
                // Ignore if composing (IME) or if typing in an input field
                if (e.isComposing || e.keyCode === 229) return;

                const tag = e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

                if (taskElements.length === 0) return;

                let idx = typeof window.currentSelectedIndex !== 'undefined' ? window.currentSelectedIndex : 0;

                if (e.key === 'ArrowDown') {
                    idx = (idx + 1) % taskElements.length;
                    updateSelection(idx);
                    // Ensure visible
                    taskElements[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    e.preventDefault();
                } else if (e.key === 'ArrowUp') {
                    idx = (idx - 1 + taskElements.length) % taskElements.length;
                    updateSelection(idx);
                    taskElements[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    e.preventDefault();
                } else if (e.key === 'Enter') {
                    if (idx >= 0 && idx < taskElements.length) {
                        const task = data[idx];
                        if (window.py && typeof window.py.start_review === 'function') {
                            window.py.start_review(String(task.deckId));
                        }
                    }
                }
            };

            document.addEventListener('keydown', window._taskListKeyHandler);

        });
    };

    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.py = channel.objects.py;
        // Initial Load
        window.refreshData();
    });

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

        statsBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent drag

            // Calculate total done from current DOM or Data?
            // Easier to rely on the data if we have it scope-accessible,
            // but since 'data' var is local to the callback, let's grab it from DOM or recalculate.
            // Actually, we can just sum up the counters in the DOM if we don't want to expose 'data' globally.
            // Or better, make 'taskData' a global variable or attached to window.

            // Let's scrape the DOM for simplicity and robustness (what you see is what you get)
            // Wait, accuracy matters. Let's look for the progress bars...
            // Actually, we calculated 'totalDone' in the main callback.
            // Let's create a global for it.

            if (typeof window.totalDoneToday !== 'undefined') {
                countDisplay.textContent = window.totalDoneToday;
            } else {
                countDisplay.textContent = "0";
            }

            modal.classList.add('visible');
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (!modalContent.contains(e.target)) {
                modal.classList.remove('visible');
            }
        });
    }

    // Analytics Logic
    const analyticsBtn = document.getElementById('btn-analytics');
    const analyticsModal = document.getElementById('analytics-modal');

    if (analyticsBtn && analyticsModal) {
        const analyticsContent = analyticsModal.querySelector('.modal-content');
        const closeBtn = document.getElementById('analytics-close');

        analyticsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadAnalyticsData();
            analyticsModal.classList.add('visible');
        });

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                analyticsModal.classList.remove('visible');
            });
        }

        // Close on outside click
        analyticsModal.addEventListener('click', (e) => {
            if (!analyticsContent.contains(e.target)) {
                analyticsModal.classList.remove('visible');
            }
        });
    }

    function loadAnalyticsData() {
        if (!window.py) return;

        // Get total stats
        if (typeof window.py.get_total_stats === 'function') {
            window.py.get_total_stats((jsonData) => {
                try {
                    const stats = JSON.parse(jsonData);

                    document.getElementById('current-streak').textContent = stats.current_streak || 0;
                    document.getElementById('total-days').textContent = stats.total_days || 0;
                    document.getElementById('total-cards').textContent = stats.total_cards || 0;
                    document.getElementById('avg-cards').textContent = stats.avg_cards_per_day || 0;
                } catch (e) {
                    console.error('Error parsing total stats:', e);
                }
            });
        }

        // Get last 7 days
        if (typeof window.py.get_daily_stats === 'function') {
            window.py.get_daily_stats(7, (jsonData) => {
                try {
                    const days = JSON.parse(jsonData);
                    const container = document.getElementById('recent-days-list');
                    container.innerHTML = '';

                    if (days.length === 0) {
                        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No data yet. Start studying to see your progress!</p>';
                        return;
                    }

                    days.forEach(day => {
                        const dayItem = document.createElement('div');
                        dayItem.className = 'day-item';

                        const dateStr = new Date(day.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        });

                        dayItem.innerHTML = `
                            <span class="day-date">${dateStr}</span>
                            <span>
                                <span class="day-cards">${day.total_cards_reviewed} cards</span>
                                <span class="day-streak">🔥 ${day.streak_days} day streak</span>
                            </span>
                        `;

                        container.appendChild(dayItem);
                    });
                } catch (e) {
                    console.error('Error parsing daily stats:', e);
                }
            });
        }
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
            const tasks = container.querySelectorAll('.task-item');
            let visibleCount = 0;
            let firstVisibleIndex = -1;

            tasks.forEach((task, idx) => {
                const nameEl = task.querySelector('.task-name');
                const name = nameEl ? nameEl.textContent.toLowerCase() : '';

                if (name.includes(term)) {
                    task.style.display = 'flex';
                    visibleCount++;
                    if (firstVisibleIndex === -1) firstVisibleIndex = idx;
                } else {
                    task.style.display = 'none';
                }
            });

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

                // Hide completed section if no completed tasks match
                if (completedSection) {
                    if (completedVisibleCount > 0) {
                        completedSection.style.display = 'block';
                    } else if (term !== '') {
                        completedSection.style.display = 'none';
                    }
                }
            }

            // Update selection if current selection is hidden
            if (visibleCount > 0 && firstVisibleIndex !== -1) {
                const currentSelected = container.querySelector('.task-item.selected');
                if (currentSelected && currentSelected.style.display === 'none') {
                    tasks.forEach(t => t.classList.remove('selected'));
                    tasks[firstVisibleIndex].classList.add('selected');
                    // Update global index if we rely on it
                    if (typeof window.currentSelectedIndex !== 'undefined') {
                        window.currentSelectedIndex = firstVisibleIndex;
                    }
                }
            }
        });
    }

    // Window Dragging logic - Only from header
    document.addEventListener('mousedown', (e) => {
        // Only allow dragging from the page header
        const header = e.target.closest('.page-header');
        if (!header) return;

        // Don't drag if clicking on buttons or links in the header
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

