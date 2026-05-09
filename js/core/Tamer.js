class Tamer {
    constructor(name) {
        this.name = name;
        this.rank = 0;
        this.maxCapacity = 10;
        this.cageList = [];
        this.inventory = {};
    }

    // 모든 케이지에 있는 디지몬을 하나로 합쳐서 반환
    get digimonList() {
        return this.cageList.flatMap(c => c.digimonList);
    }

    get usedCapacity() {
        return this.digimonList.reduce((sum, d) => sum + d.capacity, 0);
    }

    addCage(cage) {
        this.cageList.push(cage);
    }

    removeCage(cage) {
        const idx = this.cageList.indexOf(cage);
        if (idx === -1) return false;
        this.cageList.splice(idx, 1);
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
        const food = FOOD_DATA[foodId];
        this.inventory[foodId]--;
        digimon.foodQueue.push(food);
        return true;
    }
}
