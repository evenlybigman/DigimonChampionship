class Cage {
    constructor(id) {
        const data = CAGE_DATA[id];
        this.id = id;
        this.name = data.name;
        this.size = data.size;
        this.maxDigimon = data.maxDigimon; // null = 제한 없음
        this.image = data.image;
        this.effect = data.effect;         // null or array
        this.digimonList = [];
    }

    get isFull() {
        if (this.maxDigimon === null) return false;
        return this.digimonList.length >= this.maxDigimon;
    }

    canAdd(digimon) {
        return !this.isFull;
    }

    addDigimon(digimon) {
        if (!this.canAdd(digimon)) return false;
        this.digimonList.push(digimon);
        return true;
    }

    removeDigimon(digimon) {
        const idx = this.digimonList.indexOf(digimon);
        if (idx === -1) return false;
        this.digimonList.splice(idx, 1);
        return true;
    }

    // 매 2틱마다 GameManager에서 호출
    applyEffects() {
        if (!this.effect) return;
        this.digimonList.forEach(d => {
            this.effect.forEach(eff => {
                if (eff.type === 'recover') {
                    if (eff.stat === 'hp') {
                        d.fatigue = Math.max(0, d.fatigue - eff.amount);
                    }
                } else if (eff.type === 'ap') {
                    if (d.ap) {
                        d.ap[eff.stat] = (d.ap[eff.stat] ?? 0) + eff.amount;
                    }
                }
            });
        });
    }
}
