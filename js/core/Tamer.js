class Tamer {
    constructor(name) {
        this.name = name;
        this.rank = 0;
        this.maxCapacity = 10;
        this.worldMap = new WorldMap();
        this.cageInventory = []; // 배치 안 된 케이지
        this.inventory = {};
    }

    // 배치된 케이지 + 인벤토리 케이지 전부
    get cageList() {
        return [
            ...this.worldMap.placedCages.map(e => e.cage),
            ...this.cageInventory,
        ];
    }

    get digimonList() {
        return this.cageList.flatMap(c => c.digimonList);
    }

    get usedCapacity() {
        return this.digimonList.reduce((s, d) => s + d.capacity, 0);
    }

    addCageToInventory(cage) {
        this.cageInventory.push(cage);
    }

    placeCage(cage, anchorQ, anchorR) {
        const idx = this.cageInventory.indexOf(cage);
        if (idx === -1) return false;
        if (!this.worldMap.place(cage, anchorQ, anchorR)) return false;
        this.cageInventory.splice(idx, 1);
        return true;
    }

    removeCage(cage) {
        if (!this.worldMap.remove(cage)) return false;
        this.cageInventory.push(cage);
        return true;
    }

    canAdd(digimon, cage) {
        if (cage.isFull) return false;
        return this.usedCapacity + digimon.capacity <= this.maxCapacity;
    }

    addDigimon(digimon, cage) {
        if (!this.canAdd(digimon, cage)) return false;
        return cage.addDigimon(digimon);
    }

    removeDigimon(digimon) {
        for (const cage of this.cageList) {
            if (cage.removeDigimon(digimon)) return true;
        }
        return false;
    }

    feedDigimon(digimon, foodId) {
        const count = this.inventory[foodId] ?? 0;
        if (count <= 0) return false;
        this.inventory[foodId]--;
        digimon.foodQueue.push(FOOD_DATA[foodId]);
        return true;
    }
}
