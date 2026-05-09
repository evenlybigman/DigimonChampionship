class EvolutionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EvolutionScene' });
    }

    init(data) {
        this.digimon = data.digimon;
        this.fromId  = data.fromId;
        this.toId    = data.toId;
    }

    create() {
        const W = 1280, H = 720, cx = W / 2, cy = H / 2;

        const overlay = this.add.rectangle(cx, cy, W, H, 0x000011).setAlpha(0).setDepth(0);
        const glow    = this.add.rectangle(cx, cy, W, H, 0xaaddff).setAlpha(0).setDepth(1);

        const fromSprite = this._makeSprite(cx, cy, this.fromId);
        const toSprite   = this._makeSprite(cx, cy, this.toId);
        fromSprite.setDepth(5).setAlpha(0);
        toSprite  .setDepth(5).setAlpha(0);

        this._setSilhouette(fromSprite, this.fromId);
        this._setSilhouette(toSprite,   this.toId);

        const t = (ms, fn) => this.time.delayedCall(ms, fn);

        // 1. 오버레이 페이드인
        this.tweens.add({ targets: overlay, alpha: 0.92, duration: 500 });

        // 2. 현재 디지몬 줌인
        t(300, () => {
            fromSprite.setAlpha(1);
            this._setScale(fromSprite, this.fromId, 0.25);
            this.tweens.add({
                targets: fromSprite,
                scaleX: this._zoomScale(this.fromId),
                scaleY: this._zoomScale(this.fromId),
                duration: 700, ease: 'Back.easeOut',
            });
        });

        // 3. 글로우 번쩍임
        t(1150, () => {
            this.tweens.add({ targets: glow, alpha: 0.55, duration: 200, yoyo: true });
        });

        // 4. 실루엣 교대 (4쌍 × 220ms)
        const ALT_START = 1500;
        const ALT_DT    = 220;
        const ALT_PAIRS = 4;
        for (let i = 0; i < ALT_PAIRS * 2; i++) {
            t(ALT_START + i * ALT_DT, () => {
                const showFrom = (i % 2 === 0);
                fromSprite.setAlpha(showFrom ? 1 : 0);
                toSprite  .setAlpha(showFrom ? 0 : 1);
                this._setScale(toSprite, this.toId, this._zoomScale(this.toId));
            });
        }

        // 5. 진화형 컬러 공개 + 줌아웃
        const REVEAL = ALT_START + ALT_PAIRS * 2 * ALT_DT;
        t(REVEAL, () => {
            fromSprite.setAlpha(0);
            toSprite  .setAlpha(1);
            this._clearSilhouette(toSprite, this.toId);
            this.tweens.add({
                targets: toSprite,
                scaleX: this._normalScale(this.toId),
                scaleY: this._normalScale(this.toId),
                duration: 550, ease: 'Cubic.easeOut',
            });
            this.tweens.add({ targets: overlay, alpha: 0, delay: 300, duration: 450 });
        });

        // 6. 진화 처리 후 씬 종료
        t(REVEAL + 1000, () => {
            this.digimon.evolve(this.toId);
            this.scene.resume('CageScene');
            this.scene.stop();
        });
    }

    _makeSprite(x, y, id) {
        if (this.textures.exists(id)) {
            return this.add.image(x, y, id).setScale(this._normalScale(id));
        }
        return this.add.rectangle(x, y, 80, 80, 0x334466);
    }

    _normalScale(id) { return this.textures.exists(id) ? 0.55 : 1.0; }
    _zoomScale(id)   { return this.textures.exists(id) ? 1.6  : 2.2; }

    _setScale(sprite, id, s) {
        sprite.scaleX = s;
        sprite.scaleY = s;
    }

    _setSilhouette(sprite, id) {
        if (this.textures.exists(id)) sprite.setTintFill(0x000000);
        else if (sprite.setFillStyle) sprite.setFillStyle(0x050510);
    }

    _clearSilhouette(sprite, id) {
        if (this.textures.exists(id)) sprite.clearTint();
        else if (sprite.setFillStyle) sprite.setFillStyle(0x6655aa);
    }
}
