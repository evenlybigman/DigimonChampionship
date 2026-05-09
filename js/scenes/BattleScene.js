class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    create() {
        this.add.rectangle(640, 360, 1280, 720, 0x1a1a2e);

        this.add.text(640, 360, '배틀 화면 (준비 중)', {
            fontSize: '36px',
            color: '#ffffff',
        }).setOrigin(0.5);

        const backBtn = this.add.text(640, 500, '돌아가기', {
            fontSize: '26px',
            color: '#ffff00',
            backgroundColor: '#333366',
            padding: { x: 20, y: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => this.scene.start('CageScene'));
    }
}
