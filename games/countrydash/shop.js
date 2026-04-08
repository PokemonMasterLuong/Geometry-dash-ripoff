'use strict';

const Shop = (() => {
    const overlay    = document.getElementById('shopOverlay');
    const grid       = document.getElementById('shopGrid');
    const coinCount  = document.getElementById('shopCoinCount');
    const closeBtn   = document.getElementById('shopClose');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('shopSearch');

    let currentRarity = 'all';
    let currentSearch = '';

    function open() {
        renderGrid();
        coinCount.textContent = Save.getCoins();
        overlay.classList.add('active');
    }

    function close() {
        overlay.classList.remove('active');
    }

    function renderGrid() {
        grid.innerHTML = '';
        const owned    = Save.getOwned();
        const selected = Save.getSelected();
        const coins    = Save.getCoins();

        const filtered = CHARACTERS.filter(c => {
            if (c.rarity === 'starter') return false;   // Poland shown separately
            if (currentRarity !== 'all' && c.rarity !== currentRarity) return false;
            if (currentSearch) {
                const q = currentSearch.toLowerCase();
                if (!c.name.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q)) return false;
            }
            return true;
        });

        for (const char of filtered) {
            const isOwned    = owned.includes(char.code);
            const isEquipped = selected === char.code;
            const canAfford  = coins >= char.price;

            const card = document.createElement('div');
            card.className = 'char-card' + (isOwned ? ' owned' : '') + (isEquipped ? ' equipped' : '');
            card.dataset.code = char.code;

            // Flag preview canvas
            const previewCanvas = document.createElement('canvas');
            previewCanvas.width  = 50;
            previewCanvas.height = 50;
            previewCanvas.style.borderRadius = '50%';
            const pCtx = previewCanvas.getContext('2d');
            Renderer.drawFlag(pCtx, 25, 25, 22, char.code);
            card.appendChild(previewCanvas);

            // Name
            const nameEl = document.createElement('div');
            nameEl.className = 'char-name';
            nameEl.textContent = char.name;
            card.appendChild(nameEl);

            // Rarity
            const rarityEl = document.createElement('div');
            rarityEl.className = `char-rarity ${char.rarity}`;
            rarityEl.textContent = char.rarity.charAt(0).toUpperCase() + char.rarity.slice(1);
            card.appendChild(rarityEl);

            // Button
            const btn = document.createElement('button');
            if (isEquipped) {
                btn.className = 'char-btn equipped-label';
                btn.textContent = 'Equipped';
            } else if (isOwned) {
                btn.className = 'char-btn equip';
                btn.textContent = 'Equip';
                btn.addEventListener('click', () => equip(char.code));
            } else if (canAfford) {
                btn.className = 'char-btn buy';
                btn.textContent = `● ${char.price}`;
                btn.addEventListener('click', () => buy(char.code));
            } else {
                btn.className = 'char-btn cant-afford';
                btn.textContent = `● ${char.price}`;
            }
            card.appendChild(btn);

            grid.appendChild(card);
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="color:#888;padding:2rem;text-align:center;grid-column:1/-1;">No characters found.</div>';
        }
    }

    function buy(code) {
        const char = CharacterMap.get(code);
        if (!char || Save.isOwned(code)) return;
        if (!Save.spendCoins(char.price)) {
            showToast('Not enough coins!');
            return;
        }
        Save.addOwned(code);
        showToast(`${char.name} unlocked!`);
        coinCount.textContent = Save.getCoins();
        renderGrid();
    }

    function equip(code) {
        if (!Save.isOwned(code)) return;
        Save.setSelected(code);
        showToast(`Now playing as ${CharacterMap.get(code)?.name || code}`);
        renderGrid();
    }

    // ── Event listeners ───────────────────────────────────────────────────

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRarity = btn.dataset.rarity;
            renderGrid();
        });
    });

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = searchInput.value.trim();
            renderGrid();
        }, 200);
    });

    return { open, close };
})();

// ── Toast helper ──────────────────────────────────────────────────────────

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Level Select ──────────────────────────────────────────────────────────

const LevelSelect = (() => {
    const overlay   = document.getElementById('levelSelectOverlay');
    const levelGrid = document.getElementById('levelGrid');
    const backBtn   = document.getElementById('levelSelectBack');

    function open() {
        renderGrid();
        overlay.classList.add('active');
    }

    function close() {
        overlay.classList.remove('active');
    }

    function renderGrid() {
        levelGrid.innerHTML = '';
        for (let i = 0; i < Levels.count; i++) {
            const def       = Levels.list[i];
            const unlocked  = Save.isLevelUnlocked(i);
            const completed = Save.isLevelCompleted(i);

            const box = document.createElement('div');
            box.className = 'level-box' +
                (unlocked ? '' : ' locked') +
                (completed ? ' completed' : '');

            const numEl = document.createElement('div');
            numEl.className = 'level-num';
            numEl.textContent = def.id;
            box.appendChild(numEl);

            const nameEl = document.createElement('div');
            nameEl.className = 'level-name-small';
            nameEl.textContent = def.name;
            box.appendChild(nameEl);

            const starEl = document.createElement('div');
            starEl.className = 'level-star';
            starEl.textContent = completed ? '★' : (unlocked ? '○' : '🔒');
            box.appendChild(starEl);

            if (unlocked) {
                box.addEventListener('click', () => {
                    close();
                    Game.startLevel(i);
                });
            }

            levelGrid.appendChild(box);
        }
    }

    backBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
    });

    return { open, close };
})();
