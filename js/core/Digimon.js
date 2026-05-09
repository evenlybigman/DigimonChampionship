class Digimon {
    constructor(id) {
        const data = DIGIMON_DATA[id];
        this.id = id;
        this.name = data.name;
        this.level = data.level;
        this.type = data.type;
        this.attribute = data.attribute;
        this.capacity  = data.capacity;
        this.specialMove = [...data.specialMove];
        this.currentStats = { ...data.baseStats };
        this.hunger = 0;
        this.fatigue = 0;
        this.mood = 100;
        this.age = 0;
        this.careMistakes = 0;
        this.wins = 0;
        this.losses = 0;
        this.levelTicks = 0;
        this.ap = {
            dragon: 0, beast: 0, bird: 0, plant: 0, water: 0,
            holy: 0, dark: 0, machine: 0, virus: 0, vaccine: 0, data: 0,
        };
        this.foodQueue = [];   // 케이지에 넣은 먹이 목록
        this.isEating = false; // 먹는 중 여부
        this.eatTimer = 0;     // 먹는 데 걸리는 틱 카운트
    }

    update() {
        this.levelTicks++;
        this.hunger  = Math.min(100, this.hunger + 2);
        this.fatigue = Math.min(100, this.fatigue + 1);

        if (this.hunger >= 80)  this.mood = Math.max(0, this.mood - 3);
        if (this.fatigue >= 80) this.mood = Math.max(0, this.mood - 2);

        this._eat();
    }

    _eat() {
        if (this.isEating) {
            this.eatTimer--;
            if (this.eatTimer <= 0) {
                const food = this.foodQueue.shift();
                this.hunger = Math.max(0, this.hunger - food.hunger);
                this.mood   = Math.min(100, this.mood + food.mood);
                this.isEating = false;
            }
        } else if (this.foodQueue.length > 0) {
            this.isEating = true;
            this.eatTimer = 5; // 5틱 동안 먹는 애니메이션
        }
    }

    rest() {
        this.fatigue = Math.max(0, this.fatigue - 40);
    }

    train() {
        this.fatigue = Math.min(100, this.fatigue + 20);
    }

    evolve(toId) {
        const data = DIGIMON_DATA[toId];
        this.id           = toId;
        this.name         = data.name;
        this.level        = data.level;
        this.type         = data.type;
        this.attribute    = data.attribute;
        this.capacity     = data.capacity;
        this.currentStats = { ...data.baseStats };
        this.specialMove  = [...data.specialMove];
        this.levelTicks   = 0;
    }
}
