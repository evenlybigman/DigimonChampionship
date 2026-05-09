const SEASONS = ['봄', '여름', '가을', '겨울'];

const CAGE_W       = 260;
const CAGE_H       = 520;
const CAGE_GAP     = 14;
const CAGE_START_X = 20;
const CAGE_START_Y = 100;

const SPRITE_SPEED = 45; // px/s
const SPRITE_PAD   = 28; // 케이지 벽에서 최소 거리

const PANEL_X = 960;
const PANEL_Y = 100;
const PANEL_W = 300;
const PANEL_H = 520;

class CageScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CageScene' });
        this.elapsed         = 0;
        this.cageZones       = []; // { cage, x, y, w, h, objects[] }
        this.digimonSprites  = []; // { digimon, cage, sprite }
        this.digimonPos      = new Map(); // digimon -> { x, y }
        this.digimonTarget   = new Map(); // digimon -> { tx, ty }
        this.draggingSprite  = null;
        this.selectedDigimon = null;
    }

    create() {
        this.add.rectangle(640, 360, 1280, 720, 0x1a1a2e);
        this.dateText     = this.add.text(20, 40, '', { fontSize: '22px', color: '#ffffff' });
        this.capacityText = this.add.text(20, 70, '', { fontSize: '22px', color: '#ffffff' });

        this._createStatsPanel();
        this.createButtons();
        this.buildScene();
        this.setupDrag();
    }

    _createStatsPanel() {
        this.add.rectangle(
            PANEL_X + PANEL_W / 2, PANEL_Y + PANEL_H / 2,
            PANEL_W, PANEL_H, 0x111133, 0.9
        ).setStrokeStyle(1, 0x4444aa);

        this.add.text(PANEL_X + 10, PANEL_Y + 8, '[ 디지몬 정보 ]', {
            fontSize: '16px', color: '#aaaaff',
        });

        this.panelText   = this.add.text(PANEL_X + 10, PANEL_Y + 36, '', {
            fontSize: '18px', color: '#ffffff', lineSpacing: 10,
        });
        this.panelApText = this.add.text(PANEL_X + 10, PANEL_Y + 300, '', {
            fontSize: '15px', color: '#aaddff', lineSpacing: 7,
        });
    }

    createButtons() {
        const buttons = [
            { label: '먹이주기',    x: 80,  action: () => this.onFeed() },
            { label: '휴식',        x: 230, action: () => this.onRest() },
            { label: '훈련',        x: 350, action: () => this.onTrain() },
            { label: '하루 끝내기', x: 470, action: () => this.onSkipDay() },
        ];
        buttons.forEach(btn => {
            const b = this.add.text(btn.x, 670, btn.label, {
                fontSize: '22px', color: '#ffffff',
                backgroundColor: '#333366', padding: { x: 14, y: 8 },
            }).setInteractive({ useHandCursor: true });
            b.on('pointerdown', btn.action);
            b.on('pointerover', () => b.setColor('#ffff00'));
            b.on('pointerout',  () => b.setColor('#ffffff'));
        });
    }

    buildScene() {
        this.digimonSprites.forEach(({ sprite }) => sprite.destroy());
        this.cageZones.forEach(z => z.objects.forEach(o => o.destroy()));
        this.digimonSprites = [];
        this.cageZones      = [];

        const tamer = game.tamer;
        if (!tamer) return;

        tamer.cageList.forEach((cage, i) => {
            const cx = CAGE_START_X + i * (CAGE_W + CAGE_GAP);
            const cy = CAGE_START_Y;

            const zoneBg = this.add.rectangle(
                cx + CAGE_W / 2, cy + CAGE_H / 2,
                CAGE_W, CAGE_H, 0x1a1a3a, 0.8
            ).setStrokeStyle(1, 0x3333aa);

            const nameLabel = this.add.text(cx + 6, cy + 6, cage.name, {
                fontSize: '14px', color: '#8888cc',
            });

            this.cageZones.push({
                cage, x: cx, y: cy, w: CAGE_W, h: CAGE_H,
                objects: [zoneBg, nameLabel],
            });

            cage.digimonList.forEach(d => {
                // 위치 초기화 (처음 등장 시만)
                if (!this.digimonPos.has(d)) {
                    this.digimonPos.set(d, {
                        x: cx + CAGE_W / 2,
                        y: cy + CAGE_H / 2,
                    });
                }
                this._pickNewTarget(d, cage);
                this._createSprite(d, cage);
            });
        });
    }

    _createSprite(digimon, cage) {
        const pos = this.digimonPos.get(digimon);

        let sprite;
        if (this.textures.exists(digimon.id)) {
            sprite = this.add.image(pos.x, pos.y, digimon.id).setScale(0.6);
        } else {
            sprite = this.add.rectangle(pos.x, pos.y, 48, 48, 0x334466);
        }

        sprite.setInteractive({ useHandCursor: true });
        this.input.setDraggable(sprite);

        sprite.on('pointerdown', () => {
            this.selectedDigimon = digimon;
        });

        this.digimonSprites.push({ digimon, cage, sprite });
    }

    _pickNewTarget(digimon, cage) {
        const zone = this.cageZones.find(z => z.cage === cage);
        if (!zone) return;
        this.digimonTarget.set(digimon, {
            tx: Phaser.Math.Between(zone.x + SPRITE_PAD, zone.x + zone.w - SPRITE_PAD),
            ty: Phaser.Math.Between(zone.y + SPRITE_PAD, zone.y + zone.h - SPRITE_PAD),
        });
    }

    setupDrag() {
        this.input.on('dragstart', (pointer, sprite) => {
            this.draggingSprite = sprite;
            sprite.setDepth(10);
        });

        this.input.on('drag', (pointer, sprite, dragX, dragY) => {
            sprite.setPosition(dragX, dragY);
            const entry = this.digimonSprites.find(e => e.sprite === sprite);
            if (entry) {
                const pos = this.digimonPos.get(entry.digimon);
                pos.x = dragX;
                pos.y = dragY;
            }
        });

        this.input.on('dragend', (pointer, sprite) => {
            this.draggingSprite = null;
            sprite.setDepth(0);

            const entry = this.digimonSprites.find(e => e.sprite === sprite);
            if (!entry) return;

            const { digimon, cage: srcCage } = entry;

            const targetZone = this.cageZones.find(z =>
                pointer.x >= z.x && pointer.x <= z.x + z.w &&
                pointer.y >= z.y && pointer.y <= z.y + z.h
            );

            // 케이지 밖에 드롭 → 원래 케이지로 클램프
            const snapZone = targetZone ?? this.cageZones.find(z => z.cage === srcCage);
            if (!snapZone) return;

            const clampedX = Phaser.Math.Clamp(pointer.x, snapZone.x + SPRITE_PAD, snapZone.x + snapZone.w - SPRITE_PAD);
            const clampedY = Phaser.Math.Clamp(pointer.y, snapZone.y + SPRITE_PAD, snapZone.y + snapZone.h - SPRITE_PAD);

            if (targetZone && targetZone.cage !== srcCage) {
                if (!game.tamer.canAdd(digimon, targetZone.cage)) {
                    // 이동 불가 → 원래 케이지 클램프
                    const srcZone = this.cageZones.find(z => z.cage === srcCage);
                    if (srcZone) {
                        const sx = Phaser.Math.Clamp(pointer.x, srcZone.x + SPRITE_PAD, srcZone.x + srcZone.w - SPRITE_PAD);
                        const sy = Phaser.Math.Clamp(pointer.y, srcZone.y + SPRITE_PAD, srcZone.y + srcZone.h - SPRITE_PAD);
                        this.digimonPos.set(digimon, { x: sx, y: sy });
                        sprite.setPosition(sx, sy);
                        this._pickNewTarget(digimon, srcCage);
                    }
                    return;
                }
                srcCage.removeDigimon(digimon);
                targetZone.cage.addDigimon(digimon);
                this.digimonPos.set(digimon, { x: clampedX, y: clampedY });
                this.buildScene();
                return;
            }

            // 같은 케이지 안 or 케이지 밖→복귀
            this.digimonPos.set(digimon, { x: clampedX, y: clampedY });
            sprite.setPosition(clampedX, clampedY);
            this._pickNewTarget(digimon, entry.cage);
        });
    }

    update(time, delta) {
        this.elapsed += delta;
        if (this.elapsed >= 1000) {
            this.elapsed = 0;
            game.onTick();
        }
        this._updateMovement(delta);
        this._updateHUD();
        this._updateStatsPanel();
    }

    _updateMovement(delta) {
        this.digimonSprites.forEach(({ digimon, cage, sprite }) => {
            if (sprite === this.draggingSprite) return;

            const pos    = this.digimonPos.get(digimon);
            const target = this.digimonTarget.get(digimon);
            if (!pos || !target) return;

            const dx   = target.tx - pos.x;
            const dy   = target.ty - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 4) {
                this._pickNewTarget(digimon, cage);
                return;
            }

            const step = SPRITE_SPEED * (delta / 1000);
            pos.x += (dx / dist) * Math.min(step, dist);
            pos.y += (dy / dist) * Math.min(step, dist);
            sprite.setPosition(pos.x, pos.y);
        });
    }

    _updateHUD() {
        const tamer = game.tamer;
        if (!tamer) return;
        this.dateText.setText(
            `${SEASONS[game.month - 1]} ${game.day}일  ` +
            `${String(game.gameHour).padStart(2, '0')}:${String(game.gameMinute).padStart(2, '0')}`
        );
        this.capacityText.setText(`용량: ${tamer.usedCapacity} / ${tamer.maxCapacity}`);
    }

    _updateStatsPanel() {
        const d = this.selectedDigimon;
        if (!d) {
            this.panelText.setText('디지몬을 선택하세요.');
            this.panelApText.setText('');
            return;
        }
        this.panelText.setText([
            `${d.name}${d.isEating ? '  [먹는 중]' : ''}`,
            ``,
            `배고픔   ${d.hunger}`,
            `피로     ${d.fatigue}`,
            `기분     ${d.mood}`,
            `나이     ${d.age}일`,
            `케어실수 ${d.careMistakes}`,
            `먹이 대기 ${d.foodQueue.length}개`,
        ].join('\n'));

        const ap = d.ap;
        this.panelApText.setText([
            '── AP ──',
            `용    ${ap.dragon}    야수  ${ap.beast}`,
            `조류  ${ap.bird}    식물  ${ap.plant}`,
            `수중  ${ap.water}    성    ${ap.holy}`,
            `암흑  ${ap.dark}    기계  ${ap.machine}`,
            `바이러스 ${ap.virus}`,
            `백신   ${ap.vaccine}`,
            `데이터 ${ap.data}`,
        ].join('\n'));
    }

    onFeed() {
        game.tamer.digimonList.forEach(d => game.tamer.feedDigimon(d, 'meat'));
    }

    onRest() {
        game.tamer.digimonList.forEach(d => d.rest());
    }

    onTrain() {
        game.tamer.digimonList.forEach(d => d.train());
    }

    onSkipDay() {
        game.skipDay();
        this.buildScene();
    }
}
