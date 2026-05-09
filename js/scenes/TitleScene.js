class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const bg = this.add.image(640, 360, 'title-bg');
        bg.setDisplaySize(1280, 720);

        const startBtn = this.add.image(640, 600, 'btn-start')
            .setInteractive({ useHandCursor: true });

        startBtn.on('pointerdown', (pointer) => {
            if (!pointer.leftButtonDown()) return;
            game.start('Tamer');
            this.scene.start('CageScene');
        });
    }
}
