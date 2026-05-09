const AP_LABELS = {
    dragon: '용', beast: '야수', bird: '조류', plant: '식물',
    water: '수', holy: '성', dark: '암', machine: '기계',
    virus: '바이러스', vaccine: '백신', data: '데이터',
};

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
        this.foods = []; // { data, x, y, eatenBy: null, consumed: false }
    }

    addFood(foodData, x, y) {
        this.foods.push({ data: foodData, x, y, eatenBy: null, consumed: false });
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
            const hasAp = this.effect.some(e => e.type === 'ap');
            this.effect.forEach(eff => {
                if (eff.type === 'recover') {
                    if (eff.stat === 'hp') {
                        const maxHp = DIGIMON_DATA[d.id].baseStats.hp;
                        const prev  = d.currentStats.hp;
                        d.currentStats.hp = Math.min(maxHp, d.currentStats.hp + eff.amount);
                        const healed = d.currentStats.hp - prev;
                        if (healed > 0) {
                            game.addNotification(`${d.name}의 HP가 ${healed} 회복됐습니다.`);
                        }
                    }
                } else if (eff.type === 'ap') {
                    if (d.ap && !d.effectsReceived[this.id]) {
                        d.ap[eff.stat] = (d.ap[eff.stat] ?? 0) + eff.amount;
                        const label = AP_LABELS[eff.stat] ?? eff.stat;
                        game.addNotification(`${d.name}의 ${label} 속성이 ${eff.amount} 올랐습니다.`);
                    }
                }
            });
            if (hasAp) d.effectsReceived[this.id] = true;
        });
    }
}
