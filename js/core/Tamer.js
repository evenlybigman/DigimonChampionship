// 육성 라이센스 레벨 → 진화 가능 최대 단계
// 0:유아기, 1:유년기, 2:성장기, 3:성숙기, 4:완전체, 5:궁극체
const RANK_CAPACITY = [10, 15, 20, 30, 40, 50, 60];
const RANK_MAX_CAGES = [3, 4, 5, 7, 10, 14, 20];

class Tamer {
    constructor(name) {
        this.name = name;
        this.rank = 0;

        // 재화
        this.money = 0;

        // 플레이 시간 (초)
        this.playTime = 0;

        // 육성 라이센스 (진화 가능 최대 단계)
        this.license = 2; // 기본: 성장기까지

        // 월드맵 & 케이지
        this.worldMap      = new WorldMap();
        this.cageInventory = [];

        // 아이템
        this.inventory = {};  // { itemId: count }
        this.plugins   = [];  // 보유 플러그인 id 목록
        this.gears     = {};  // { gearId: count }

        // 사냥 보관함
        this.huntBox = []; // 포획한 디지몬 임시 보관

        // 달성
        this.badges  = [];  // 획득한 배지 id 목록
        this.digidex = {};  // { digimonId: true } 도감 등록

        // 배틀
        this.wins   = 0;
        this.losses = 0;
        this.battleLog = []; // { opponentName, result, date }

        // 잠금 해제된 사냥 지역
        this.unlockedRegions = ['swamp']; // 기본 1곳
    }

    // ── 용량/공간 (랭크 연동) ────────────────────────────
    get maxCapacity() {
        return RANK_CAPACITY[Math.min(this.rank, RANK_CAPACITY.length - 1)];
    }

    get maxCages() {
        return RANK_MAX_CAGES[Math.min(this.rank, RANK_MAX_CAGES.length - 1)];
    }

    // ── 배틀 ────────────────────────────────────────────
    get battleCount() { return this.wins + this.losses; }

    get winRate() {
        if (this.battleCount === 0) return 0;
        return Math.round((this.wins / this.battleCount) * 100);
    }

    // ── 달성률 ──────────────────────────────────────────
    badgeRate(totalBadges) {
        if (totalBadges === 0) return 0;
        return Math.round((this.badges.length / totalBadges) * 100);
    }

    digidexRate(totalDigimon) {
        if (totalDigimon === 0) return 0;
        return Math.round((Object.keys(this.digidex).length / totalDigimon) * 100);
    }

    regionRate(totalRegions) {
        if (totalRegions === 0) return 0;
        return Math.round((this.unlockedRegions.length / totalRegions) * 100);
    }

    // ── 케이지 ──────────────────────────────────────────
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

    // ── 디지몬 ──────────────────────────────────────────
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

    // ── 도감 등록 ────────────────────────────────────────
    registerDigidex(digimonId) {
        this.digidex[digimonId] = true;
    }

    // ── 배지 획득 ────────────────────────────────────────
    earnBadge(badgeId) {
        if (!this.badges.includes(badgeId)) this.badges.push(badgeId);
    }

    // ── 지역 잠금 해제 ──────────────────────────────────
    unlockRegion(regionId) {
        if (!this.unlockedRegions.includes(regionId)) this.unlockedRegions.push(regionId);
    }

    feedDigimon(digimon, foodId) {
        const count = this.inventory[foodId] ?? 0;
        if (count <= 0) return false;
        this.inventory[foodId]--;
        digimon.foodQueue.push(FOOD_DATA[foodId]);
        return true;
    }
}
