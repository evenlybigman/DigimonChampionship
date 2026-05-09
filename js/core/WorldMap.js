class WorldMap {
    constructor() {
        this.COLS = 10;
        this.ROWS = 2;
        this.grid = {};          // `${q},${r}` → placedEntry
        this.placedCages = [];   // { cage, anchorQ, anchorR }
    }

    _wrapQ(q) {
        return ((q % this.COLS) + this.COLS) % this.COLS;
    }

    _key(q, r) {
        return `${this._wrapQ(q)},${r}`;
    }

    // cageId의 tiles를 anchorQ, anchorR 기준으로 절대 그리드 좌표로 변환
    absoluteTiles(cageId, anchorQ, anchorR) {
        return CAGE_DATA[cageId].tiles.map(([dq, dr]) => [
            this._wrapQ(anchorQ + dq),
            anchorR + dr,
        ]);
    }

    isOccupied(q, r) {
        return !!this.grid[this._key(q, r)];
    }

    getAt(q, r) {
        return this.grid[this._key(q, r)] ?? null;
    }

    canPlace(cageId, anchorQ, anchorR) {
        return this.absoluteTiles(cageId, anchorQ, anchorR)
            .every(([q, r]) => r >= 0 && r < this.ROWS && !this.isOccupied(q, r));
    }

    place(cage, anchorQ, anchorR) {
        if (!this.canPlace(cage.id, anchorQ, anchorR)) return false;
        const entry = { cage, anchorQ, anchorR };
        this.absoluteTiles(cage.id, anchorQ, anchorR).forEach(([q, r]) => {
            this.grid[this._key(q, r)] = entry;
        });
        this.placedCages.push(entry);
        return true;
    }

    remove(cage) {
        const idx = this.placedCages.findIndex(e => e.cage === cage);
        if (idx === -1) return false;
        const entry = this.placedCages[idx];
        this.absoluteTiles(entry.cage.id, entry.anchorQ, entry.anchorR).forEach(([q, r]) => {
            delete this.grid[this._key(q, r)];
        });
        this.placedCages.splice(idx, 1);
        return true;
    }
}
