document.addEventListener("DOMContentLoaded", () => {
    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.py = channel.objects.py;

        // Fetch the data for the selected decks
        py.get_taskbar_tasks(function (jsonData) {
            console.debug('get_taskbar_tasks ->', jsonData);

            let data = [];
            try {
                data = JSON.parse(jsonData);
            } catch (e) {
                console.error("Failed to parse tasks JSON:", e);
            }

            const container = document.getElementById('task-list-container');
            container.innerHTML = ""; // clear container first

            if (!data || data.length === 0) {
                container.innerHTML = '<p class="placeholder">No decks selected. Go to "Manage Decks" to add tasks.</p>';
                const dbg = document.createElement('pre');
                dbg.className = 'debug';
                dbg.textContent = JSON.stringify(data, null, 2);
                container.appendChild(dbg);
                return;
            }

            // Sort: Incomplete first, then Completed
            data.sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);

            // Create a list to hold the tasks
            const ul = document.createElement('ul');
            ul.className = 'task-list';

            data.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';
                if (task.completed) {
                    li.classList.add('completed');
                }

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
                // Show "Done / Total" format for clarity
                const total = task.dueStart;
                const done = task.done;

                if (task.completed) {
                    counts.textContent = "Completed";
                    counts.classList.add('status-completed');
                } else {
                    counts.innerHTML = `<span class="highlight">${done}</span> / ${total}`;
                }

                content.appendChild(deckName);
                content.appendChild(counts);

                li.appendChild(progressBar);
                li.appendChild(content);

                // Click to review
                li.addEventListener('click', () => {
                    if (window.py && typeof window.py.start_review === 'function') {
                        // Pass ID as string to be safe with standard Qt types
                        window.py.start_review(String(task.deckId));
                    }
                });

                ul.appendChild(li);
            });

            container.appendChild(ul);
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

        // Window Dragging logic
        document.addEventListener('mousedown', (e) => {
            // Ignore if clicking interactive elements
            if (e.target.closest('button') ||
                e.target.closest('input') ||
                e.target.closest('a') ||
                e.target.closest('.deck-item') ||
                e.target.closest('.task-item') ||
                e.target.closest('.toggle')) {
                return;
            }

            if (window.py && typeof window.py.drag_window === 'function') {
                window.py.drag_window();
            }
        });
    });
});
