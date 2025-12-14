document.addEventListener("DOMContentLoaded", () => {
    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.py = channel.objects.py;

        // Fetch the data for the selected decks
        py.get_task_list_data(function(data) {
            const container = document.getElementById('task-list-container');
            if (!data || !data.selected_decks || data.selected_decks.length === 0) {
                container.innerHTML = '<p class="placeholder">No decks selected. Go to "Manage Decks" to add tasks.</p>';
                return;
            }

            // Create a list to hold the tasks
            const ul = document.createElement('ul');
            ul.className = 'task-list';

            for (const did of data.selected_decks) {
                const details = data.deck_details[did];
                if (!details) continue;

                const li = document.createElement('li');
                li.className = 'task-item';

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

                li.appendChild(deckName);
                li.appendChild(counts);
                ul.appendChild(li);
            }

            container.appendChild(ul);
        });
    });
});