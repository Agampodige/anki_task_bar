
document.addEventListener("DOMContentLoaded", () => {
    // Establish connection with Python backend
    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.py = channel.objects.py;

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
            if (deckTree && deckTree.children) {
                const ul = document.createElement('ul');
                deckTree.children.forEach(childNode => {
                    buildTree(childNode, ul);
                });
                container.appendChild(ul);

                // restore previously saved selection
                if (window.py && typeof window.py.get_selected_decks === 'function') {
                    window.py.get_selected_decks(function (jsonResp) {
                        try {
                            const data = JSON.parse(jsonResp);
                            if (data && data.selected_decks) {
                                data.selected_decks.forEach(did => {
                                    const cb = document.getElementById(`deck-${did}`);
                                    if (cb) cb.checked = true;
                                });
                            }
                        } catch (e) {
                            console.error("Failed to parse selected decks:", e);
                        }
                    });
                }
            }
        });
    });
});

/**
 * Recursively builds the HTML for the deck tree.
 * @param {object} node - The current deck node from the tree data.
 * @param {HTMLElement} parentElement - The <ul> element to append the new item to.
 */
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
    itemDiv.appendChild(checkbox);

    // Create and append label
    const label = document.createElement('label');
    label.htmlFor = `deck-${node.id}`;
    const displayName = node.name.includes('::') ? node.name.split('::').pop() : node.name;
    const counts = ` <span class="counts">(R: ${node.review}, L: ${node.learn}, N: ${node.new})</span>`;
    label.innerHTML = `${displayName}${counts}`;
    itemDiv.appendChild(label);

    li.appendChild(itemDiv);
    parentElement.appendChild(li);

    // If the deck has children, create a nested list and recurse
    if (node.children && node.children.length > 0) {
        li.classList.add('has-children');

        const toggle = document.createElement('span');
        toggle.className = 'toggle';
        toggle.innerHTML = '▶';
        itemDiv.insertBefore(toggle, checkbox); // Add toggle before the checkbox

        const nestedUl = document.createElement('ul');
        nestedUl.className = 'nested-list';
        li.appendChild(nestedUl);
        node.children.forEach(child => buildTree(child, nestedUl));

        // Add click event to the toggle
        toggle.addEventListener('click', () => {
            li.classList.toggle('expanded');
        });
    }
}

// Save selection button handler - collect checked deck ids and persist
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-selection-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', () => {
        const checked = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
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

    // Helper Action Listeners
    document.getElementById('btn-all')?.addEventListener('click', () => {
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    });

    document.getElementById('btn-none')?.addEventListener('click', () => {
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    });

    document.getElementById('btn-invert')?.addEventListener('click', () => {
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = !cb.checked);
    });
});