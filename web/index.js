document.addEventListener("DOMContentLoaded", function () {
    // Initialize common utilities and bridge
    AnkiTaskbar.init(function (py) {
        if (!py) return;

        // Load settings and apply initial UI state
        AnkiTaskbar.loadAndApplySettings(function (cfg) {
            // Initial Load of task data
            window.refreshData();
        });
    });

    // --- Statistics Rendering ---
    function updateSelectedDecksStats(data, totals) {
        var statsBar = document.getElementById('selected-decks-stats');
        if (!statsBar) return;

        var totalDecks = data.length;
        var totalCards = 0;
        var pendingCards = 0;
        var completedCards = 0;

        for (var i = 0; i < data.length; i++) {
            var t = data[i];
            totalCards += (t.dueStart || 0);
            pendingCards += (t.dueNow || 0);
            completedCards += (t.done || 0);
        }

        var secondsPerCard = 60;
        if (totals && totals.total_cards > 5 && totals.total_time_ms > 0) {
            secondsPerCard = (totals.total_time_ms / 1000) / totals.total_cards;
            secondsPerCard = Math.min(Math.max(secondsPerCard, 5), 180);
        }

        var estimatedSeconds = pendingCards * secondsPerCard;
        var estimatedMinutes = Math.round(estimatedSeconds / 60);
        var estimatedTime = estimatedMinutes < 1 ? (pendingCards > 0 ? '<1m' : '0m') :
            estimatedMinutes < 60 ? estimatedMinutes + 'm' :
                Math.floor(estimatedMinutes / 60) + 'h ' + (estimatedMinutes % 60) + 'm';

        var finishTimeStr = '';
        if (pendingCards > 0) {
            var finishDate = new Date(Date.now() + estimatedSeconds * 1000);
            var hours = finishDate.getHours();
            var minutes = finishDate.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            var displayHours = hours % 12 || 12;
            var displayMinutes = minutes < 10 ? '0' + minutes : minutes;
            finishTimeStr = AnkiTaskbar.t('finish') + ': ' + displayHours + ':' + displayMinutes + ' ' + ampm;
        }

        var deckCountEl = document.getElementById('stats-deck-count');
        var cardsFormatEl = document.getElementById('stats-cards-format');
        var timeEl = document.getElementById('stats-estimated-time');
        var doneTodayEl = document.getElementById('stats-total-done-today');

        if (deckCountEl) deckCountEl.textContent = String(totalDecks);
        if (cardsFormatEl) cardsFormatEl.textContent = String(totalCards);
        if (timeEl) {
            if (finishTimeStr) {
                timeEl.innerHTML = '<span>' + estimatedTime + '</span><span class="finish-time">' + finishTimeStr + '</span>';
            } else {
                timeEl.textContent = estimatedTime;
            }
        }
        if (doneTodayEl && totals) {
            doneTodayEl.textContent = String(totals.total_cards || 0);
        }

        var cfg = AnkiTaskbar.settings || {};
        var showStatsBar = cfg.showStatsBar !== false;

        // Show if explicitly enabled OR if there are selected decks OR if we have significant progress today
        if (showStatsBar && (totalDecks > 0 || (totals && totals.total_cards > 0))) {
            statsBar.style.display = 'flex';
        } else {
            statsBar.style.display = 'none';
        }
    }

    // --- Data Refresh Logic ---
    window.refreshData = function () {
        if (!window.py) return;

        var mainContainer = document.getElementById('main-content-container');
        var container = document.getElementById('task-list-container');
        var savedScrollTop = mainContainer ? mainContainer.scrollTop : 0;

        AnkiTaskbar.callBackend('get_taskbar_tasks', []).then(function (data) {
            var tasksById = {};
            for (var i = 0; i < data.length; i++) {
                tasksById[Number(data[i].deckId)] = data[i];
            }

            var metadata = JSON.parse(localStorage.getItem('deck_metadata') || '{}');
            var getPriority = function (id) { return (metadata[id] && metadata[id].priority) || 'medium'; };

            var priorityOrder = { high: 0, medium: 1, low: 2 };
            data.sort(function (a, b) {
                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                return priorityOrder[getPriority(a.deckId)] - priorityOrder[getPriority(b.deckId)];
            });

            var activeDecks = [];
            var completedDecks = [];
            for (var i = 0; i < data.length; i++) {
                if (data[i].completed) completedDecks.push(data[i]);
                else activeDecks.push(data[i]);
            }

            window.taskData = data;

            AnkiTaskbar.callBackend('get_today_review_totals', []).then(function (totals) {
                updateSelectedDecksStats(data, totals);
            });

            var completedContainer = document.getElementById('completed-list-container');
            var completedSection = document.getElementById('completed-section');
            container.innerHTML = "";
            if (completedContainer) completedContainer.innerHTML = "";

            _applyVisibilities();
            if (!data || data.length === 0) {
                container.innerHTML = '<p class="placeholder">' + AnkiTaskbar.t('no_decks_selected') + '</p>';
                if (completedSection) completedSection.style.display = 'none';
                return;
            }

            var totalDue = 0;
            var totalDone = 0;
            for (var i = 0; i < data.length; i++) {
                totalDue += (data[i].dueStart || 0);
                totalDone += (data[i].done || 0);
            }
            window.totalDoneToday = totalDone;

            var globalPct = totalDue > 0 ? (totalDone / totalDue) * 100 : 0;
            var globalBar = document.getElementById('global-progress-value');
            if (globalBar) globalBar.style.width = Math.min(Math.max(globalPct, 0), 100) + '%';

            // Render Decks
            if (activeDecks.length === 0) {
                container.innerHTML = '<p class="placeholder">' + AnkiTaskbar.t('all_decks_completed') + '</p>';
                if (window.triggerConfetti && AnkiTaskbar.settings.confetti !== false) {
                    window.triggerConfetti(100);
                }
            } else {
                AnkiTaskbar.callBackend('get_deck_tree', []).then(function (tree) {
                    var selectedDecksSet = {};
                    for (var i = 0; i < activeDecks.length; i++) {
                        selectedDecksSet[Number(activeDecks[i].deckId)] = true;
                    }
                    var taskElements = renderTree(tree, container, selectedDecksSet, tasksById, getPriority);
                    setupKeyboardNav(taskElements);
                    if (mainContainer) mainContainer.scrollTop = savedScrollTop;
                });
            }

            renderCompleted(completedDecks, completedContainer, completedSection, getPriority);
        });
    };

    function renderTree(tree, container, selectedSet, tasksById, getPriority) {
        var taskElements = [];
        var ul = document.createElement('ul');
        ul.className = 'task-tree';

        function buildPrunedTree(node) {
            var id = Number(node.id);
            var children = [];
            if (node.children) {
                for (var i = 0; i < node.children.length; i++) {
                    var child = buildPrunedTree(node.children[i]);
                    if (child) children.push(child);
                }
            }
            if (selectedSet[id] || children.length > 0) {
                var newNode = JSON.parse(JSON.stringify(node));
                newNode.children = children;
                return newNode;
            }
            return null;
        }

        function renderNode(node, parentUl) {
            var li = document.createElement('li');
            var row = document.createElement('div');
            row.className = 'deck-item task-node';

            var task = tasksById[Number(node.id)];
            if (task) row.className += ' priority-' + getPriority(task.deckId);

            if (node.children && node.children.length > 0) {
                li.className += ' has-children expanded';
                var toggle = document.createElement('span');
                toggle.className = 'toggle';
                toggle.onclick = function (e) {
                    e.stopPropagation();
                    if (li.classList.contains('expanded')) li.classList.remove('expanded');
                    else li.classList.add('expanded');
                };
                row.appendChild(toggle);
            }

            if (task) {
                var prog = document.createElement('div');
                prog.className = 'task-progress-bar';
                prog.style.width = Math.min(Math.max(task.progress * 100, 0), 100) + '%';
                row.appendChild(prog);

                var content = document.createElement('div');
                content.className = 'task-content';
                var nameParts = node.name.split('::');
                var shortName = nameParts[nameParts.length - 1];
                content.innerHTML = '<span class="task-name">' + shortName + '</span><span class="counts">' + task.dueNow + '</span>';
                row.appendChild(content);

                row.onclick = function () { if (window.py) window.py.start_review(String(task.deckId)); };

                (function () {
                    var currentIndex = taskElements.length;
                    row.onmouseenter = function () { updateSelection(currentIndex); };
                    taskElements.push(row);
                })();
            } else {
                var content = document.createElement('div');
                content.className = 'task-content';
                var nameParts = node.name.split('::');
                content.innerHTML = '<span class="task-name">' + nameParts[nameParts.length - 1] + '</span>';
                row.appendChild(content);
            }

            li.appendChild(row);
            if (node.children && node.children.length > 0) {
                var nested = document.createElement('ul');
                nested.className = 'nested-list';
                for (var i = 0; i < node.children.length; i++) {
                    renderNode(node.children[i], nested);
                }
                li.appendChild(nested);
            }
            parentUl.appendChild(li);
        }

        var pruned = buildPrunedTree(tree);
        if (pruned && pruned.children) {
            for (var i = 0; i < pruned.children.length; i++) {
                renderNode(pruned.children[i], ul);
            }
        }
        container.appendChild(ul);

        function updateSelection(idx) {
            for (var i = 0; i < taskElements.length; i++) {
                if (i === idx) taskElements[i].classList.add('selected');
                else taskElements[i].classList.remove('selected');
            }
            window.currentSelectedIndex = idx;
        }
        if (taskElements.length > 0) updateSelection(0);
        return taskElements;
    }

    function setupKeyboardNav(taskElements) {
        if (window._taskListKeyHandler) document.removeEventListener('keydown', window._taskListKeyHandler);
        window._taskListKeyHandler = function (e) {
            var isInput = ['INPUT', 'TEXTAREA'].indexOf(e.target.tagName) !== -1 || e.target.isContentEditable;
            if (isInput) return;
            if (!taskElements.length) return;
            var idx = window.currentSelectedIndex || 0;
            if (e.key === 'ArrowDown') idx = (idx + 1) % taskElements.length;
            else if (e.key === 'ArrowUp') idx = (idx - 1 + taskElements.length) % taskElements.length;
            else if (e.key === 'Enter') {
                if (taskElements[idx]) taskElements[idx].click();
                return;
            }
            else return;

            e.preventDefault();
            for (var i = 0; i < taskElements.length; i++) {
                if (i === idx) taskElements[i].classList.add('selected');
                else taskElements[i].classList.remove('selected');
            }
            window.currentSelectedIndex = idx;
            if (taskElements[idx]) {
                if (typeof taskElements[idx].scrollIntoView === 'function') {
                    taskElements[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        };
        document.addEventListener('keydown', window._taskListKeyHandler);
    }

    function renderCompleted(decks, container, section, getPriority) {
        if (!decks.length || !container || !section) {
            if (section) section.style.display = 'none';
            return;
        }
        section.style.display = 'block';
        var ul = document.createElement('ul');
        ul.className = 'task-list completed-list';
        for (var i = 0; i < decks.length; i++) {
            (function () {
                var t = decks[i];
                var li = document.createElement('li');
                li.className = 'task-item completed';
                li.className += ' priority-' + getPriority(t.deckId);
                li.innerHTML = '<div class="task-progress-bar" style="width:100%"></div>' +
                    '<div class="task-content"><span class="task-name">' + t.name + '</span><span class="counts status-completed">' + AnkiTaskbar.t('completed') + '</span></div>';
                li.onclick = function () { if (window.py) window.py.start_review(String(t.deckId)); };
                ul.appendChild(li);
            })();
        }
        container.appendChild(ul);
    }

    function _applyVisibilities() {
        var s = AnkiTaskbar.settings;
        var sessionsEnabled = s.sessionsEnabled !== false;

        var sessionsBtn = document.getElementById('btn-sessions');
        var manageBtn = document.getElementById('btn-manage');

        if (sessionsBtn) sessionsBtn.style.display = sessionsEnabled ? 'flex' : 'none';

        // Keep Manage button visible even when sessions are enabled to help beginners find decks
        if (manageBtn) manageBtn.style.display = 'flex';

        if (s.hideCompleted) {
            var sec = document.getElementById('completed-section');
            var cont = document.getElementById('completed-list-container');
            if (sec) sec.style.display = 'none';
            if (cont) cont.style.display = 'none';
        }

        var search = document.querySelector('.search-container');
        if (search && search.parentNode) search.parentNode.style.display = s.hideSearchBar ? 'none' : 'block';
    }

    // --- Search Logic ---
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.oninput = function (e) {
            var term = e.target.value.toLowerCase();
            var items = document.querySelectorAll('.task-tree li, .completed-list li');
            for (var i = 0; i < items.length; i++) {
                var li = items[i];
                var nameEl = li.querySelector('.task-name');
                var name = nameEl ? nameEl.textContent.toLowerCase() : '';
                var visible = !term || name.indexOf(term) !== -1;
                li.style.display = visible ? '' : 'none';
                if (visible && term) {
                    var parentNode = li.parentNode;
                    while (parentNode && parentNode.tagName !== 'LI') parentNode = parentNode.parentNode;
                    if (parentNode && parentNode.classList.contains('has-children')) {
                        parentNode.classList.add('expanded');
                    }
                }
            }
        };
        document.addEventListener('keydown', function (e) {
            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.blur();
            }
        });
    }

    // --- Other UI Bindings ---
    var grindBtn = document.getElementById('grind-btn');
    if (grindBtn) {
        grindBtn.onclick = function () { if (window.py) window.py.close_window(); };
    }

});
