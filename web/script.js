document.addEventListener("DOMContentLoaded", () => {
    // Establish connection with Python backend
    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.py = channel.objects.py;

        // Fetch the deck tree and render it
        py.get_deck_tree(function(deckTree) {
            const container = document.getElementById('deck-tree-container');
            if (deckTree && deckTree.children) {
                const ul = document.createElement('ul');
                // Start building the tree from the root's children
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

    // Create a checkbox for the deck
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `deck-${node.id}`;
    checkbox.value = node.id;

    // Create a label for the checkbox
    const label = document.createElement('label');
    label.htmlFor = `deck-${node.id}`;
    // Display only the final part of the deck name
    const displayName = node.name.includes('::') ? node.name.split('::').pop() : node.name;
    label.textContent = ` ${displayName}`;

    li.appendChild(checkbox);
    li.appendChild(label);
    parentElement.appendChild(li);

    // If the deck has children, create a nested list and recurse
    if (node.children && node.children.length > 0) {
        const nestedUl = document.createElement('ul');
        li.appendChild(nestedUl);
        node.children.forEach(child => buildTree(child, nestedUl));
    }
}