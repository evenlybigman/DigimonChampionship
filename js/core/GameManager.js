class GameManager {
    constructor() {
        this.tamer = null;
        this.tick = 0;
        this.gameHour = 7;
        this.gameMinute = 0;
        this.day = 1;
        this.month = 1; // 1=봄, 2=여름, 3=가을, 4=겨울
    }

    start(tamerName) {
        this.tamer = new Tamer(tamerName);

        // --- 테스트용 ---
        this.tamer.inventory = { meat: 5, fish: 5 };
        const defaultCage = new Cage('default');
        this.tamer.addCage(defaultCage);
        this.tamer.addDigimon(new Digimon('putimon'), defaultCage);
        // ----------------
    }

    onTick() {
        this.tick++;
        if (this.tick % 2 === 0) {
            this.gameMinute += 10;
            if (this.gameMinute >= 60) {
                this.gameMinute = 0;
                this.gameHour++;
            }
            if (this.gameHour >= 22) {
                this.gameHour   = 7;
                this.gameMinute = 0;
                this.onDayEnd();
            }
            this.tamer.cageList.forEach(cage => cage.applyEffects());
            this.tamer.digimonList.forEach(digimon => {
                digimon.update();
                EvolutionSystem.check(digimon);
            });
        }
    }

    onDayEnd() {
        this.day++;
        if (this.day > 8) {
            this.day = 1;
            this.month++;
            if (this.month > 4) this.month = 1;
        }
        this.tamer.digimonList.forEach(d => {
            d.age++;
            if (d.hunger >= 80 || d.fatigue >= 80) d.careMistakes++;
        });
    }

    skipDay() {
        const TICKS_PER_DAY = 180;
        this.tamer.digimonList.forEach(d => {
            for (let i = 0; i < TICKS_PER_DAY; i++) {
                d.update();
            }
        });
        this.gameHour   = 7;
        this.gameMinute = 0;
        this.onDayEnd();
    }
}

const game = new GameManager();
