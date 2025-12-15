
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
// -----------------------------
// Deck Priority Management
// -----------------------------

function loadDeckMetadata() {
    try {
        const data = localStorage.getItem('deck_metadata');
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error('Error loading deck metadata:', e);
        return {};
    }
}

function saveDeckMetadata(metadata) {
    try {
        localStorage.setItem('deck_metadata', JSON.stringify(metadata));
    } catch (e) {
        console.error('Error saving deck metadata:', e);
    }
}

function getDeckPriority(deckId) {
    const metadata = loadDeckMetadata();
    return metadata[deckId]?.priority || 'medium';
}

function setDeckPriority(deckId, priority) {
    const metadata = loadDeckMetadata();
    if (!metadata[deckId]) {
        metadata[deckId] = {};
    }
    metadata[deckId].priority = priority;
    saveDeckMetadata(metadata);
}

// -----------------------------
// Tree Building
// -----------------------------

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
    checkbox.className = 'deck-checkbox';
    itemDiv.appendChild(checkbox);

    // Create and append label
    const label = document.createElement('label');
    label.htmlFor = `deck-${node.id}`;
    const displayName = node.name.includes('::') ? node.name.split('::').pop() : node.name;

    // Create deck name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'deck-name';
    nameSpan.textContent = displayName;
    label.appendChild(nameSpan);

    // Add priority selector
    const prioritySelect = document.createElement('select');
    prioritySelect.className = 'priority-select';
    prioritySelect.innerHTML = `
        <option value="low">⚪ Low</option>
        <option value="medium">🟡 Medium</option>
        <option value="high">🔴 High</option>
    `;
    prioritySelect.value = getDeckPriority(node.id);
    prioritySelect.onclick = (e) => {
        e.stopPropagation();
    };
    prioritySelect.onchange = (e) => {
        e.stopPropagation();
        const priority = prioritySelect.value;
        setDeckPriority(node.id, priority);

        // Update visual
        itemDiv.className = `deck-item priority-${priority}`;
    };
    label.appendChild(prioritySelect);

    // Set initial priority class
    itemDiv.classList.add(`priority-${getDeckPriority(node.id)}`);

    // Badge-style counts
    const countsContainer = document.createElement('span');
    countsContainer.className = 'counts';

    const totalCards = node.review + node.learn + node.new;

    if (node.review > 0) {
        const reviewBadge = document.createElement('span');
        reviewBadge.className = 'count-badge has-cards';
        reviewBadge.innerHTML = `<span class="count-review">${node.review}</span> R`;
        countsContainer.appendChild(reviewBadge);
    }

    if (node.learn > 0) {
        const learnBadge = document.createElement('span');
        learnBadge.className = 'count-badge has-cards';
        learnBadge.innerHTML = `<span class="count-learn">${node.learn}</span> L`;
        countsContainer.appendChild(learnBadge);
    }

    if (node.new > 0) {
        const newBadge = document.createElement('span');
        newBadge.className = 'count-badge has-cards';
        newBadge.innerHTML = `<span class="count-new">${node.new}</span> N`;
        countsContainer.appendChild(newBadge);
    }

    if (totalCards === 0) {
        const emptyBadge = document.createElement('span');
        emptyBadge.className = 'count-badge';
        emptyBadge.textContent = 'No cards';
        countsContainer.appendChild(emptyBadge);
    }

    label.appendChild(countsContainer);
    itemDiv.appendChild(label);

    // Click anywhere on deck-item to toggle checkbox
    itemDiv.addEventListener('click', (e) => {
        // Don't trigger if clicking the checkbox itself or toggle
        if (e.target === checkbox || e.target.classList.contains('toggle')) {
            return;
        }
        e.stopPropagation();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
    });

    // Update visual state when checkbox changes
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            itemDiv.classList.add('selected');
        } else {
            itemDiv.classList.remove('selected');
        }
        updateSelectionCounter();
    });

    li.appendChild(itemDiv);
    parentElement.appendChild(li);

    // If the deck has children, create a nested list and recurse
    if (node.children && node.children.length > 0) {
        li.classList.add('has-children');

        const toggle = document.createElement('span');
        toggle.className = 'toggle';
        itemDiv.insertBefore(toggle, checkbox);

        const nestedUl = document.createElement('ul');
        nestedUl.className = 'nested-list';
        li.appendChild(nestedUl);
        node.children.forEach(child => buildTree(child, nestedUl));

        // Add click event to the toggle
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
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
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
            cb.dispatchEvent(new Event('change'));
        });
    });

    document.getElementById('btn-none')?.addEventListener('click', () => {
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        });
    });

    document.getElementById('btn-invert')?.addEventListener('click', () => {
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
        });
    });

    // Expand/Collapse All
    document.getElementById('btn-expand-all')?.addEventListener('click', () => {
        document.querySelectorAll('li.has-children').forEach(li => {
            li.classList.add('expanded');
        });
    });

    document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
        document.querySelectorAll('li.has-children').forEach(li => {
            li.classList.remove('expanded');
        });
    });

    // Selection Counter
    function updateSelectionCounter() {
        const counter = document.getElementById('selection-counter');
        const countText = document.getElementById('selection-count');
        const checked = document.querySelectorAll('input[type="checkbox"]:checked').length;

        if (checked > 0) {
            counter.style.display = 'block';
            countText.textContent = `${checked} deck${checked !== 1 ? 's' : ''} selected`;
        } else {
            counter.style.display = 'none';
        }
    }

    // Make updateSelectionCounter globally accessible
    window.updateSelectionCounter = updateSelectionCounter;

    // --- Search & Shortcut Logic ---
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const emptyState = document.getElementById('empty-state');

    // Shortcut '/' to focus search
    document.addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;

        // Navigation in Search Mode
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && document.activeElement === searchInput) {
            e.preventDefault();
            const firstVisible = document.querySelector('.deck-item:not([style*="display: none"]) input[type="checkbox"]');
            if (firstVisible) firstVisible.focus();
            return;
        }

        if (e.key === '/' && document.activeElement !== searchInput) {
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

            e.preventDefault();
            searchInput.focus();
        }

        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.blur();
        }
    });

    // Clear Button Logic
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            runDeckFilter('');
            searchInput.focus();
        });
    }

    // Filter Logic
    let isComposing = false;

    searchInput.addEventListener('compositionstart', () => { isComposing = true; });
    searchInput.addEventListener('compositionend', (e) => {
        isComposing = false;
        runDeckFilter(e.target.value);
    });

    searchInput.addEventListener('input', (e) => {
        if (isComposing) return;
        runDeckFilter(e.target.value);
    });

    function runDeckFilter(searchValue) {
        const term = searchValue.toLowerCase();
        const treeContainer = document.getElementById('deck-tree-container');
        const items = treeContainer.querySelectorAll('li');

        // Toggle Clear Button
        if (clearBtn) {
            clearBtn.style.display = term ? 'block' : 'none';
        }

        if (!term) {
            items.forEach(li => {
                li.style.display = '';
                const label = li.querySelector('label');
                if (label && label.dataset.originalText) {
                    label.innerHTML = label.dataset.originalText; // Restore original HTML (with colored counts)
                }
            });
            if (emptyState) emptyState.style.display = 'none';
            return;
        }

        let visibleCount = 0;

        // Reset visibility first to clean state
        items.forEach(li => li.style.display = 'none');

        items.forEach(li => {
            const label = li.querySelector('label');
            if (!label) return;

            // Cache original content if not already done
            if (!label.dataset.originalText) {
                label.dataset.originalText = label.innerHTML;
            }
            // Use textContent for matching to ignore HTML tags
            const rawText = label.textContent;
            // We want to match against the display name part typically
            // but matching raw text is safer/easier. 
            // NOTE: rawText includes counts "(R: 0...)"

            if (rawText.toLowerCase().includes(term)) {
                let current = li;
                // Walk up to show parents
                while (current && current.tagName === 'LI') {
                    if (current.style.display === 'none') { // Only count if effectively unhiding
                        current.style.display = '';
                        visibleCount++;
                    }
                    if (current.classList.contains('has-children')) {
                        current.classList.add('expanded');
                    }
                    const parentUl = current.parentElement;
                    if (parentUl && parentUl.classList.contains('nested-list')) {
                        const parentLi = parentUl.parentElement;
                        if (parentLi) {
                            parentLi.classList.add('expanded');
                            current = parentLi;
                        } else {
                            current = null;
                        }
                    } else {
                        current = null;
                    }
                }

                // Highlight Logic
                // We need to carefully replace text while preserving the structure (checkbox is sibling, not child of label)
                // Actually label innerHTML has "Name <span class='counts'>...</span>"
                // It's tricky to highlight just the name part without breaking the counts span structure
                // Let's rely on caching the original HTML.

                // 1. Get just the name part
                const originalHTML = label.dataset.originalText;
                // Parse it temporarily or regex it? 
                // Regex: Match text before <span class="counts">
                const match = originalHTML.match(/^(.+?)(\s*<span class="counts">.*<\/span>)$/);

                if (match) {
                    const namePart = match[1];
                    const countsPart = match[2];

                    // Highlight inside namePart
                    // Regex replace, case insensitive, global?
                    const regex = new RegExp(`(${term})`, 'gi');
                    const highlightedName = namePart.replace(regex, '<mark class="highlight">$1</mark>');

                    label.innerHTML = highlightedName + countsPart;
                } else {
                    // Fallback if structure is different
                    label.innerHTML = originalHTML;
                }
            } else {
                // No match? already hidden.
            }
        });

        if (emptyState) {
            emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }
});