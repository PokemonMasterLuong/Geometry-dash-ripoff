'use strict';

const Save = (() => {
    const KEYS = {
        COINS:     'cd_coins',
        OWNED:     'cd_owned_chars',
        SELECTED:  'cd_selected_char',
        COMPLETED: 'cd_completed_levels',
    };

    // In-memory fallback for private browsing
    const mem = {
        [KEYS.COINS]:     '0',
        [KEYS.OWNED]:     '["PL"]',
        [KEYS.SELECTED]:  'PL',
        [KEYS.COMPLETED]: '[]',
    };

    function get(key) {
        try { return localStorage.getItem(key) ?? mem[key]; }
        catch { return mem[key]; }
    }

    function set(key, value) {
        mem[key] = String(value);
        try { localStorage.setItem(key, value); } catch {}
    }

    return {
        getCoins() {
            return Math.max(0, parseInt(get(KEYS.COINS)) || 0);
        },

        addCoins(n) {
            set(KEYS.COINS, this.getCoins() + Math.max(0, n));
        },

        spendCoins(n) {
            const current = this.getCoins();
            if (current < n) return false;
            set(KEYS.COINS, current - n);
            return true;
        },

        getOwned() {
            try { return JSON.parse(get(KEYS.OWNED)) || ['PL']; }
            catch { return ['PL']; }
        },

        addOwned(code) {
            const owned = this.getOwned();
            if (!owned.includes(code)) {
                owned.push(code);
                set(KEYS.OWNED, JSON.stringify(owned));
            }
        },

        isOwned(code) {
            if (code === 'PL') return true;
            return this.getOwned().includes(code);
        },

        getSelected() {
            const code = get(KEYS.SELECTED);
            return this.isOwned(code) ? code : 'PL';
        },

        setSelected(code) {
            if (this.isOwned(code)) set(KEYS.SELECTED, code);
        },

        getCompleted() {
            try { return JSON.parse(get(KEYS.COMPLETED)) || []; }
            catch { return []; }
        },

        completeLevel(index) {
            const completed = this.getCompleted();
            if (!completed.includes(index)) {
                completed.push(index);
                set(KEYS.COMPLETED, JSON.stringify(completed));
            }
        },

        isLevelUnlocked(_index) {
            return true;  // All levels unlocked
        },

        isLevelCompleted(index) {
            return this.getCompleted().includes(index);
        },
    };
})();
