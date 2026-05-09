const SEASONS = ['봄', '여름', '가을', '겨울'];

const CAGE_W       = 260;
const CAGE_H       = 520;
const CAGE_GAP     = 14;
const CAGE_START_X = 20;
const CAGE_START_Y = 100;
const CARD_W       = 90;
const CARD_H       = 100;

const PANEL_X = 960;
const PANEL_Y = 100;
const PANEL_W = 300;
const PANEL_H = 520;

class CageScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CageScene' });
        this.elapsed       = 0;
        this.cageZones     = []; // { cage, x, y, w, h, objects[] }
        this.digimonCards  = []; // { digimon, cage, container, nameText }
        this.digimonPos    = new Map(); // digimon -> { x, y } (절대 좌표)
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

        this.panelText = this.add.text(PANEL_X + 10, PANEL_Y + 36, '', {
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
        this.cageZones.forEach(z => z.objects.forEach(o => o.destroy()));
        this.digimonCards.forEach(c => c.container.destroy());
        this.cageZones  = [];
        this.digimonCards = [];

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

            cage.digimonList.forEach((d, j) => {
                // 저장된 위치 없으면 기본 배치
                if (!this.digimonPos.has(d)) {
                    this.digimonPos.set(d, {
                        x: cx + CAGE_W / 2,
                        y: cy + 60 + j * (CARD_H + 16),
                    });
                }
                const pos = this.digimonPos.get(d);
                this._createCard(d, cage, pos.x, pos.y);
            });
        });
    }

    _createCard(digimon, cage, x, y) {
        const isSelected = this.selectedDigimon === digimon;

        const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, isSelected ? 0x444488 : 0x2a2a55)
            .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xaaaaff : 0x5555aa);

        let sprite;
        if (this.textures.exists(digimon.id)) {
            sprite = this.add.image(0, -16, digimon.id).setScale(0.5);
        } else {
            sprite = this.add.rectangle(0, -16, 50, 50, 0x334455);
        }

        const nameText = this.add.text(0, 34, digimon.name, {
            fontSize: '12px', color: '#dddddd', align: 'center',
        }).setOrigin(0.5, 0);

        const container = this.add.container(x, y, [bg, sprite, nameText]);
        container.setInteractive(
            new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
            Phaser.Geom.Rectangle.Contains
        );
        this.input.setDraggable(container);

        container.on('pointerdown', () => {
            this.selectedDigimon = digimon;
            this.buildScene();
        });

        this.digimonCards.push({ digimon, cage, container, nameText });
    }

    setupDrag() {
        this.input.on('dragstart', (pointer, obj) => {
            obj.setDepth(10);
        });

        this.input.on('drag', (pointer, obj, dragX, dragY) => {
            obj.setPosition(dragX, dragY);
        });

        this.input.on('dragend', (pointer, obj) => {
            obj.setDepth(0);
            const card = this.digimonCards.find(c => c.container === obj);
            if (!card) return;

            const { digimon, cage: srcCage } = card;

            const targetZone = this.cageZones.find(z =>
                pointer.x >= z.x && pointer.x <= z.x + z.w &&
                pointer.y >= z.y && pointer.y <= z.y + z.h
            );

            if (!targetZone) {
                // 케이지 밖 → 복귀
                this.buildScene();
                return;
            }

            // 케이지 경계 안으로 클램프
            const clampedX = Phaser.Math.Clamp(pointer.x, targetZone.x + CARD_W/2, targetZone.x + targetZone.w - CARD_W/2);
            const clampedY = Phaser.Math.Clamp(pointer.y, targetZone.y + CARD_H/2, targetZone.y + targetZone.h - CARD_H/2);

            if (targetZone.cage !== srcCage) {
                if (!game.tamer.canAdd(digimon, targetZone.cage)) {
                    this.buildScene();
                    return;
                }
                srcCage.removeDigimon(digimon);
                targetZone.cage.addDigimon(digimon);
            }

            this.digimonPos.set(digimon, { x: clampedX, y: clampedY });
            this.buildScene();
        });
    }

    update(time, delta) {
        this.elapsed += delta;
        if (this.elapsed >= 1000) {
            this.elapsed = 0;
            game.onTick();
        }
        this._updateHUD();
        this._updateStatsPanel();
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
