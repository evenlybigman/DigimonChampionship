class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        this.add.text(640, 360, '로딩 중...', {
            fontSize: '32px',
            color: '#ffffff',
        }).setOrigin(0.5);

        this.load.json('digimonDB', 'js/data/DigimonDB.json');
        this.load.json('foodDB',    'js/data/FoodDB.json');
        this.load.json('cageDB',    'js/data/CageDB.json');
        this.load.image('title-bg',  'assets/images/title/bg.png');
        this.load.image('btn-start', 'assets/images/title/btn-start.png');
        this.load.image('putimon',   'assets/images/sprites/digimon/putimon.png');
    }

    create() {
        window.DIGIMON_DATA = this.cache.json.get('digimonDB');
        window.FOOD_DATA    = this.cache.json.get('foodDB');
        window.CAGE_DATA    = this.cache.json.get('cageDB');
        this.scene.start('TitleScene');
    }
}
