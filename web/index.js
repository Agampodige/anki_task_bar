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

            // Create a list to hold the tasks
            const ul = document.createElement('ul');
            ul.className = 'task-list';

            data.forEach(task => {
                const li = document.createElement('li');
                li.className = 'task-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'task-checkbox';
                checkbox.checked = task.completed; // auto-check if completed

                const deckName = document.createElement('span');
                deckName.className = 'task-name';
                deckName.textContent = task.name;

                const counts = document.createElement('span');
                counts.className = 'task-counts';
                counts.innerHTML = `
                    <span class="count-done">${task.done} Done</span>
                    <span class="count-due">${task.dueNow} Remaining</span>
                `;

                li.appendChild(checkbox);
                li.appendChild(deckName);
                li.appendChild(counts);
                ul.appendChild(li);
            });

            container.appendChild(ul);
        });
    });
});
