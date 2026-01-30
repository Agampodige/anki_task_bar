document.addEventListener("DOMContentLoaded", function () {
    // Initialize common utilities and bridge
    AnkiTaskbar.init(function (py) {
        if (!py) return;

        AnkiTaskbar.loadAndApplySettings(function (cfg) {
            fetchDeckTree();
        });
    });

    // --- State & DOM Elements ---
    var editingSessionId = sessionStorage.getItem('editingSessionId');
    var isEditing = !!editingSessionId;
    var container = document.getElementById('deck-tree-container');
    var saveBtn = document.getElementById('save-selection-btn');
    var createBtn = document.getElementById('create-session-btn');
    var nameInput = document.getElementById('new-session-name');
    var statusEl = document.getElementById('session-create-status');

    function setStatus(text, kind) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.setAttribute('data-kind', kind || '');
        statusEl.style.display = text ? 'block' : 'none';
        if (!text) return;
        clearTimeout(window._statusTimer);
        window._statusTimer = setTimeout(function () {
            statusEl.style.display = 'none';
        }, 2000);
    }

    // --- Data Fetching & Rendering ---
    function fetchDeckTree() {
        AnkiTaskbar.callBackend('get_deck_tree').then(function (tree) {
            renderDeckTree(tree);
            loadSelection();
        });
    }

    function renderDeckTree(tree) {
        if (!container || !tree) return;
        var fragment = document.createDocumentFragment();
        var ul = document.createElement('ul');
        var children = tree.children || [];
        for (var i = 0; i < children.length; i++) {
            buildNode(children[i], ul);
        }
        fragment.appendChild(ul);
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    function buildNode(node, parentUl) {
        var li = document.createElement('li');
        var item = document.createElement('div');
        item.className = 'deck-item';

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'deck-checkbox';
        checkbox.value = node.id;
        checkbox.id = 'deck-' + node.id;

        checkbox.onchange = function () {
            updateChildren(li, checkbox.checked);
            updateAncestors(li);
            updateSelectionCounter();
        };

        var label = document.createElement('label');
        label.setAttribute('for', checkbox.id);
        label.className = 'deck-label';
        var namePart = node.name.split('::').pop();
        var count = (node.review || 0) + (node.learn || 0) + (node.new || 0);
        label.innerHTML = '<span class="deck-name">' + namePart + '</span>' +
            '<span class="counts">' + count + '</span>';

        item.appendChild(checkbox);
        item.appendChild(label);
        li.appendChild(item);

        if (node.children && node.children.length > 0) {
            li.classList.add('has-children', 'expanded');
            var toggle = document.createElement('span');
            toggle.className = 'toggle';
            toggle.onclick = function (e) {
                e.stopPropagation();
                if (li.classList.contains('expanded')) {
                    li.classList.remove('expanded');
                } else {
                    li.classList.add('expanded');
                }
            };
            item.insertBefore(toggle, checkbox);

            var nested = document.createElement('ul');
            nested.className = 'nested-list';
            for (var i = 0; i < node.children.length; i++) {
                buildNode(node.children[i], nested);
            }
            li.appendChild(nested);
        }

        parentUl.appendChild(li);
    }

    // --- Selection Logic ---
    function updateChildren(li, checked) {
        var cbs = li.querySelectorAll('input.deck-checkbox');
        for (var i = 0; i < cbs.length; i++) {
            cbs[i].checked = checked;
            cbs[i].indeterminate = false;
        }
    }

    function updateAncestors(li) {
        var parentLi = (li.parentElement && li.parentElement.tagName === 'UL') ? li.parentElement.closest('li') : null;
        while (parentLi) {
            var cb = parentLi.querySelector('.deck-item > input.deck-checkbox');
            var nestedList = parentLi.querySelector('.nested-list');
            if (cb && nestedList) {
                var children = nestedList.querySelectorAll(':scope > li > .deck-item > input.deck-checkbox');
                var checkedCount = 0;
                var indetCount = 0;
                for (var i = 0; i < children.length; i++) {
                    if (children[i].checked) checkedCount++;
                    if (children[i].indeterminate) indetCount++;
                }

                if (checkedCount === children.length) {
                    cb.checked = true;
                    cb.indeterminate = false;
                } else if (checkedCount > 0 || indetCount > 0) {
                    cb.checked = false;
                    cb.indeterminate = true;
                } else {
                    cb.checked = false;
                    cb.indeterminate = false;
                }
            }
            parentLi = (parentLi.parentElement && parentLi.parentElement.tagName === 'UL') ? parentLi.parentElement.closest('li') : null;
        }
    }

    function updateSelectionCounter() {
        var checkedLabels = document.querySelectorAll('input.deck-checkbox:checked');
        var count = checkedLabels.length;
        var counter = document.getElementById('selection-count');
        if (counter) counter.textContent = count + ' deck' + (count !== 1 ? 's' : '') + ' selected';
        var counterContainer = document.getElementById('selection-counter');
        if (counterContainer) counterContainer.style.display = count > 0 ? 'block' : 'none';
    }

    function loadSelection() {
        if (isEditing) {
            AnkiTaskbar.callBackend('get_sessions').then(function (data) {
                var allSessions = data.sessions || [];
                var session = null;
                for (var i = 0; i < allSessions.length; i++) {
                    if (String(allSessions[i].id) === editingSessionId) {
                        session = allSessions[i];
                        break;
                    }
                }
                if (session) {
                    if (nameInput) nameInput.value = session.name || '';
                    var deckIds = session.deck_ids || [];
                    var idSet = {};
                    for (var j = 0; j < deckIds.length; j++) idSet[deckIds[j]] = true;
                    restoreCheckboxes(idSet);
                    if (createBtn) createBtn.textContent = 'Save Changes';
                }
            });
        } else {
            AnkiTaskbar.callBackend('get_selected_decks').then(function (data) {
                var selected = data.selected_decks || [];
                var idSet = {};
                for (var i = 0; i < selected.length; i++) idSet[selected[i]] = true;
                restoreCheckboxes(idSet);
            });
        }
    }

    function restoreCheckboxes(idSet) {
        var cbs = document.querySelectorAll('input.deck-checkbox');
        for (var i = 0; i < cbs.length; i++) {
            var cb = cbs[i];
            if (idSet[cb.value]) {
                cb.checked = true;
                updateAncestors(cb.closest('li'));
            }
        }
        updateSelectionCounter();
    }

    // --- Save Actions ---
    if (saveBtn) {
        saveBtn.onclick = function () {
            var checkedInputs = document.querySelectorAll('input.deck-checkbox:checked');
            var ids = [];
            for (var i = 0; i < checkedInputs.length; i++) {
                ids.push(Number(checkedInputs[i].value));
            }
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            AnkiTaskbar.callBackend('save_selected_decks', [JSON.stringify(ids)]).then(function (res) {
                if (res && res.ok) {
                    saveBtn.textContent = 'Saved!';
                    setTimeout(function () { window.location.href = 'index.html'; }, 500);
                } else {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Error';
                }
            });
        };
    }

    if (createBtn) {
        createBtn.onclick = function () {
            var name = nameInput.value.trim();
            if (!name) return setStatus('Name required', 'error');

            var checkedInputs = document.querySelectorAll('input.deck-checkbox:checked');
            if (checkedInputs.length === 0) return setStatus('Select decks', 'error');

            var ids = [];
            for (var i = 0; i < checkedInputs.length; i++) {
                ids.push(Number(checkedInputs[i].value));
            }

            createBtn.disabled = true;
            var payload = isEditing ? { id: editingSessionId, name: name, deck_ids: ids } : { name: name, deck_ids: ids };

            AnkiTaskbar.callBackend('upsert_session', [JSON.stringify(payload)]).then(function (res) {
                if (res && res.ok) {
                    setStatus(isEditing ? 'Saved' : 'Created', 'ok');
                    sessionStorage.removeItem('editingSessionId');
                    setTimeout(function () { window.location.href = isEditing ? 'sessions.html' : 'index.html'; }, 1000);
                } else {
                    createBtn.disabled = false;
                    setStatus('Error', 'error');
                }
            });
        };
    }

    // --- Bulk Actions ---
    var btnAll = document.getElementById('btn-all');
    if (btnAll) btnAll.onclick = function () {
        var cbs = document.querySelectorAll('input.deck-checkbox');
        for (var i = 0; i < cbs.length; i++) {
            cbs[i].checked = true;
            cbs[i].indeterminate = false;
        }
        updateSelectionCounter();
    };

    var btnNone = document.getElementById('btn-none');
    if (btnNone) btnNone.onclick = function () {
        var cbs = document.querySelectorAll('input.deck-checkbox');
        for (var i = 0; i < cbs.length; i++) {
            cbs[i].checked = false;
            cbs[i].indeterminate = false;
        }
        updateSelectionCounter();
    };

    var btnExpandAll = document.getElementById('btn-expand-all');
    if (btnExpandAll) btnExpandAll.onclick = function () {
        var listItems = document.querySelectorAll('li.has-children');
        for (var i = 0; i < listItems.length; i++) {
            listItems[i].classList.add('expanded');
        }
    };

    var btnCollapseAll = document.getElementById('btn-collapse-all');
    if (btnCollapseAll) btnCollapseAll.onclick = function () {
        var listItems = document.querySelectorAll('li.has-children');
        for (var i = 0; i < listItems.length; i++) {
            listItems[i].classList.remove('expanded');
        }
    };

    // --- Search ---
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.oninput = function (e) {
            var term = e.target.value.toLowerCase();
            var listItems = document.querySelectorAll('#deck-tree-container li');
            for (var i = 0; i < listItems.length; i++) {
                var li = listItems[i];
                var nameEl = li.querySelector('.deck-name');
                var name = nameEl ? nameEl.textContent.toLowerCase() : '';
                var visible = !term || name.indexOf(term) !== -1;
                li.style.display = visible ? '' : 'none';
                if (visible && term) {
                    var parent = li.closest('.has-children');
                    if (parent) parent.classList.add('expanded');
                }
            }
        };
    }
});