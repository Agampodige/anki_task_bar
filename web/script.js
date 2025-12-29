document.addEventListener("DOMContentLoaded", () => {
    // Disable Ctrl+Scroll Zoom
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) e.preventDefault();
    }, { passive: false });

    // Establish connection with Python backend
    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.py = channel.objects.py;

        // Fetch the deck tree (direct call)
        py.get_deck_tree(function (jsonTree) {
            let deckTree = {};
            try {
                deckTree = JSON.parse(jsonTree);
            } catch (e) {
                console.error("Failed to parse deck tree JSON:", e);
            }

            const container = document.getElementById('deck-tree-container');
            container.innerHTML = ""; // Clear container first

            if (deckTree && deckTree.children) {
                const ul = document.createElement('ul');
                deckTree.children.forEach(childNode => {
                    buildTree(childNode, ul);
                });
                container.appendChild(ul);
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

    // Checkbox for the deck
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `deck-${node.id}`;
    checkbox.value = node.id;

    // Label for checkbox
    const label = document.createElement('label');
    label.htmlFor = `deck-${node.id}`;
    const displayName = node.name.includes('::') ? node.name.split('::').pop() : node.name;
    label.textContent = ` ${displayName}`;

    li.appendChild(checkbox);
    li.appendChild(label);
    parentElement.appendChild(li);

    // Recursively add children if any
    if (node.children && node.children.length > 0) {
        const nestedUl = document.createElement('ul');
        li.appendChild(nestedUl);
        node.children.forEach(child => buildTree(child, nestedUl));
    }
}
