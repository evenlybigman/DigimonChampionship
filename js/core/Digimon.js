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
        this.targetFood = null; // 현재 이동 중이거나 먹는 먹이 참조
        this.isEating   = false;
        this.eatTimer   = 0;
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
        if (!this.isEating || !this.targetFood) return;

        const food = this.targetFood;
        this.hunger = Math.max(0, this.hunger - Math.ceil(food.data.hunger / 5));
        this.mood   = Math.min(100, this.mood   + Math.ceil((food.data.mood ?? 0) / 5));
        this.eatTimer--;

        if (this.eatTimer <= 0) {
            food.consumed   = true;
            this.targetFood = null;
            this.isEating   = false;
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
