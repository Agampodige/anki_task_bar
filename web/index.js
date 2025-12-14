document.addEventListener("DOMContentLoaded", () => {
    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.py = channel.objects.py;

        // Fetch the data for the selected decks
        py.get_task_list_data(function(data) {
            console.debug('get_task_list_data ->', data);
            const container = document.getElementById('task-list-container');
            if (!data || !data.selected_decks || data.selected_decks.length === 0) {
                container.innerHTML = '<p class="placeholder">No decks selected. Go to "Manage Decks" to add tasks.</p>';
                // show debug info so the user can see what the backend returned
                const dbg = document.createElement('pre');
                dbg.className = 'debug';
                dbg.textContent = JSON.stringify(data, null, 2);
                container.appendChild(dbg);
                return;
            }

            // Create a list to hold the tasks
                    const ul = document.createElement('ul');
                    ul.className = 'task-list';

                    // if there are missing ids (selected but no details), show debug info
                    if (data.missing && data.missing.length) {
                        const warn = document.createElement('div');
                        warn.className = 'debug';
                        warn.textContent = `Missing deck details for IDs: ${data.missing.join(', ')} (loaded_from: ${data.loaded_from || 'unknown'})`;
                        container.appendChild(warn);
                    }

            for (const did of data.selected_decks) {
                const details = data.deck_details[String(did)];
                if (!details) continue;

                const li = document.createElement('li');
                li.className = 'task-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'task-checkbox';

                const deckName = document.createElement('span');
                deckName.className = 'task-name';
                deckName.textContent = details.name;

                const counts = document.createElement('span');
                counts.className = 'task-counts';
                counts.innerHTML = `
                    <span class="count-new">${details.new} New</span>
                    <span class="count-learn">${details.learn} Learn</span>
                    <span class="count-review">${details.review} Review</span>
                `;

                li.appendChild(checkbox);
                li.appendChild(deckName);
                li.appendChild(counts);
                ul.appendChild(li);
            }

            container.appendChild(ul);
        });
    });
});