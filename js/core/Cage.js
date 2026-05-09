const AP_LABELS = {
    dragon: '용', beast: '야수', bird: '조류', plant: '식물',
    water: '수', holy: '성', dark: '암', machine: '기계',
    virus: '바이러스', vaccine: '백신', data: '데이터',
};

const STAT_LABELS = {
    hp: 'HP', mp: 'MP', atk: '공격', def: '방어', int: '지능', spd: '속도',
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
        this.digimonList.forEach(d => {
            // 진입 시 1회성 효과 (training, ap)
            if (d.pendingEntry) {
                d.pendingEntry = false;
                if (this.effect) {
                    this._applyTraining(d);
                    this._applyAp(d);
                }
            }

            // 지속 효과 (recover)
            if (this.effect) {
                this._applyRecover(d);
            }
        });
    }

    // 훈련 HP 비용 처리 — 현재 HP의 1/3 감소, 부족하면 false 반환
    _spendTrainingHp(d) {
        const cost = Math.floor(d.currentStats.hp / 3);
        if (cost < 1) {
            game.addNotification(`${d.name}의 HP가 부족해 훈련할 수 없습니다.`);
            return false;
        }
        d.currentStats.hp -= cost;
        game.addNotification(`${d.name}의 HP가 ${cost} 감소했습니다.`);
        return true;
    }

    // 진입할 때마다 1회 — 스탯 상승 + HP 감소
    _applyTraining(d) {
        const effs = this.effect.filter(e => e.type === 'training');
        if (effs.length === 0) return;
        if (!this._spendTrainingHp(d)) return;

        effs.forEach(eff => {
            d.currentStats[eff.stat] = (d.currentStats[eff.stat] ?? 0) + eff.amount;
            const label = STAT_LABELS[eff.stat] ?? eff.stat;
            game.addNotification(`${d.name}의 ${label}이(가) ${eff.amount} 올랐습니다.`);
        });
    }

    // 진입할 때마다 1회 — AP 속성 상승 + HP 감소 (훈련을 통해 얻음)
    _applyAp(d) {
        const effs = this.effect.filter(e => e.type === 'ap');
        if (effs.length === 0) return;
        if (!this._spendTrainingHp(d)) return;

        effs.forEach(eff => {
            d.ap[eff.stat] = (d.ap[eff.stat] ?? 0) + eff.amount;
            const label = AP_LABELS[eff.stat] ?? eff.stat;
            game.addNotification(`${d.name}의 ${label} 속성이 ${eff.amount} 올랐습니다.`);
        });
    }

    // 2틱마다 지속 — 스탯 회복
    _applyRecover(d) {
        this.effect.filter(e => e.type === 'recover').forEach(eff => {
            const max = DIGIMON_DATA[d.id].baseStats[eff.stat];
            if (max === undefined) return;
            const prev = d.currentStats[eff.stat];
            d.currentStats[eff.stat] = Math.min(max, prev + eff.amount);
            const healed = d.currentStats[eff.stat] - prev;
            if (healed > 0) {
                const label = STAT_LABELS[eff.stat] ?? eff.stat;
                game.addNotification(`${d.name}의 ${label}이(가) ${healed} 회복됐습니다.`);
            }
        });
    }
}
