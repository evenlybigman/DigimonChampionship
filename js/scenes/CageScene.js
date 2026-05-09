const SEASONS = ['봄', '여름', '가을', '겨울'];

const HEX_R        = 160;  // 정육각형 외접원 반지름
const HEX_GAP      = 30;   // 케이지 간격
const HEX_INNER_R  = HEX_R * Math.sqrt(3) / 2; // 내접원 반지름 (배회 범위 기준)
const HEX_SPACING  = HEX_R * Math.sqrt(3) + HEX_GAP; // 중심 간 거리

const CAGE_CENTER_Y = 370;
const CAGE_START_CX = HEX_R + 20; // 첫 번째 케이지 중심 X

const SPRITE_SPEED  = 45;
const SPRITE_PAD    = 30;  // 내접원에서 추가 여백
const EAT_REACH     = 20;
const EAT_TICKS     = 5;

const PANEL_X = 960;
const PANEL_Y = 100;
const PANEL_W = 300;
const PANEL_H = 520;

function makeHexPoints(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    return pts;
}

class CageScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CageScene' });
        this.elapsed        = 0;
        this.cageZones      = []; // { cage, cx, cy, geom, objects[] }
        this.digimonSprites = []; // { digimon, cage, sprite, trackedId }
        this.digimonPos     = new Map();
        this.digimonTarget  = new Map();
        this.foodSprites    = new Map();
        this.draggingSprite = null;
        this.selectedDigimon = null;
        this.feedMode       = false;
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
        this.panelApText = this.add.text(PANEL_X + 10, PANEL_Y + 280, '', {
            fontSize: '15px', color: '#aaddff', lineSpacing: 7,
        });
    }

    createButtons() {
        const buttons = [
            { label: '휴식',        x: 80,  action: () => this.onRest() },
            { label: '훈련',        x: 200, action: () => this.onTrain() },
            { label: '하루 끝내기', x: 320, action: () => this.onSkipDay() },
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

        this.feedBtn = this.add.text(500, 670, '먹이', {
            fontSize: '22px', color: '#ffffff',
            backgroundColor: '#333366', padding: { x: 14, y: 8 },
        }).setInteractive({ useHandCursor: true });

        this.feedBtn.on('pointerdown', () => {
            this.feedMode = !this.feedMode;
            this.feedBtn.setColor(this.feedMode ? '#ffff00' : '#ffffff');
            this.feedBtn.setBackgroundColor(this.feedMode ? '#664400' : '#333366');
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
            const cx = CAGE_START_CX + i * HEX_SPACING;
            const cy = CAGE_CENTER_Y;

            // 렌더링용 상대좌표 포인트 (add.polygon은 원점 기준)
            const relPts = makeHexPoints(0, 0, HEX_R);
            const hexObj = this.add.polygon(cx, cy, relPts, 0x1a1a3a, 0.9)
                .setStrokeStyle(2, 0x4466cc, 1);

            // 히트 테스트용 절대좌표 Geom
            const geom = new Phaser.Geom.Polygon(makeHexPoints(cx, cy, HEX_R));

            hexObj.setInteractive(
                new Phaser.Geom.Polygon(makeHexPoints(0, 0, HEX_R)),
                Phaser.Geom.Polygon.Contains
            );
            hexObj.on('pointerdown', (pointer) => {
                if (!this.feedMode) return;
                const inv = game.tamer.inventory;
                const foodId = Object.keys(inv).find(k => inv[k] > 0);
                if (!foodId) return;
                inv[foodId]--;
                cage.addFood(FOOD_DATA[foodId], pointer.worldX, pointer.worldY);
            });

            const nameLabel = this.add.text(cx, cy - HEX_R + 14, cage.name, {
                fontSize: '14px', color: '#8899dd',
            }).setOrigin(0.5, 0);

            this.cageZones.push({ cage, cx, cy, geom, objects: [hexObj, nameLabel] });

            cage.digimonList.forEach(d => {
                if (!this.digimonPos.has(d)) {
                    this.digimonPos.set(d, { x: cx, y: cy });
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
            sprite = this.add.image(pos.x, pos.y, digimon.id).setScale(0.6).setDepth(2);
        } else {
            sprite = this.add.rectangle(pos.x, pos.y, 48, 48, 0x334466).setDepth(2);
        }

        sprite.setInteractive({ useHandCursor: true });
        this.input.setDraggable(sprite);
        sprite.on('pointerdown', () => { this.selectedDigimon = digimon; });

        this.digimonSprites.push({ digimon, cage, sprite, trackedId: digimon.id });
    }

    _pickNewTarget(digimon, cage) {
        const zone = this.cageZones.find(z => z.cage === cage);
        if (!zone) return;
        // 내접원 안쪽에서 랜덤 위치 (항상 육각형 내부 보장)
        const maxR = HEX_INNER_R - SPRITE_PAD;
        const angle = Math.random() * Math.PI * 2;
        const dist  = Math.random() * maxR;
        this.digimonTarget.set(digimon, {
            tx: zone.cx + Math.cos(angle) * dist,
            ty: zone.cy + Math.sin(angle) * dist,
        });
    }

    _clampToHex(zone, px, py) {
        const dx   = px - zone.cx;
        const dy   = py - zone.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxR = HEX_INNER_R - SPRITE_PAD;
        if (dist <= maxR || dist === 0) return { x: px, y: py };
        return {
            x: zone.cx + (dx / dist) * maxR,
            y: zone.cy + (dy / dist) * maxR,
        };
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
            sprite.setDepth(2);

            const entry = this.digimonSprites.find(e => e.sprite === sprite);
            if (!entry) return;

            const { digimon, cage: srcCage } = entry;
            const srcZone = this.cageZones.find(z => z.cage === srcCage);

            const targetZone = this.cageZones.find(z =>
                Phaser.Geom.Polygon.Contains(z.geom, pointer.x, pointer.y)
            );

            if (targetZone && targetZone.cage !== srcCage) {
                if (!game.tamer.canAdd(digimon, targetZone.cage)) {
                    // 이동 불가 → 원래 케이지로 복귀
                    const clamped = this._clampToHex(srcZone, pointer.x, pointer.y);
                    this.digimonPos.set(digimon, clamped);
                    sprite.setPosition(clamped.x, clamped.y);
                    return;
                }
                if (digimon.targetFood) {
                    digimon.targetFood.eatenBy = null;
                    digimon.targetFood = null;
                    digimon.isEating   = false;
                }
                srcCage.removeDigimon(digimon);
                targetZone.cage.addDigimon(digimon);
                const clamped = this._clampToHex(targetZone, pointer.x, pointer.y);
                this.digimonPos.set(digimon, clamped);
                this.buildScene();
                return;
            }

            // 같은 케이지 or 케이지 밖 → 내접원 범위로 클램프
            const snapZone = targetZone ?? srcZone;
            if (!snapZone) return;
            const clamped = this._clampToHex(snapZone, pointer.x, pointer.y);
            this.digimonPos.set(digimon, clamped);
            sprite.setPosition(clamped.x, clamped.y);
            this._pickNewTarget(digimon, entry.cage);
        });
    }

    update(time, delta) {
        this.elapsed += delta;
        if (this.elapsed >= 1000) {
            this.elapsed = 0;
            game.onTick();
        }
        if (this.digimonSprites.some(e => e.digimon.id !== e.trackedId)) {
            this.buildScene();
            return;
        }
        this._updateMovement(delta);
        this._syncFoodSprites();
        this._updateHUD();
        this._updateStatsPanel();
    }

    _updateMovement(delta) {
        this.digimonSprites.forEach(({ digimon, cage, sprite }) => {
            if (sprite === this.draggingSprite) return;
            if (digimon.isEating) return;

            const pos = this.digimonPos.get(digimon);
            if (!pos) return;

            if (digimon.targetFood) {
                const food = digimon.targetFood;
                const dx   = food.x - pos.x;
                const dy   = food.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < EAT_REACH) {
                    digimon.isEating = true;
                    digimon.eatTimer = EAT_TICKS;
                    return;
                }
                const step = SPRITE_SPEED * (delta / 1000);
                pos.x += (dx / dist) * Math.min(step, dist);
                pos.y += (dy / dist) * Math.min(step, dist);
                sprite.setPosition(pos.x, pos.y);
                return;
            }

            const unclaimed = cage.foods.find(f => !f.eatenBy && !f.consumed);
            if (unclaimed) {
                unclaimed.eatenBy  = digimon;
                digimon.targetFood = unclaimed;
                return;
            }

            const target = this.digimonTarget.get(digimon);
            if (!target) { this._pickNewTarget(digimon, cage); return; }

            const dx   = target.tx - pos.x;
            const dy   = target.ty - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 4) { this._pickNewTarget(digimon, cage); return; }

            const step = SPRITE_SPEED * (delta / 1000);
            pos.x += (dx / dist) * Math.min(step, dist);
            pos.y += (dy / dist) * Math.min(step, dist);
            sprite.setPosition(pos.x, pos.y);
        });
    }

    _syncFoodSprites() {
        for (const [food, sprite] of this.foodSprites) {
            if (food.consumed) {
                sprite.destroy();
                this.foodSprites.delete(food);
            }
        }
        game.tamer.cageList.forEach(cage => {
            cage.foods = cage.foods.filter(f => !f.consumed);
            cage.foods.forEach(food => {
                if (!this.foodSprites.has(food)) {
                    const s = this.add.circle(food.x, food.y, 7, 0xff6633).setDepth(1);
                    this.foodSprites.set(food, s);
                }
            });
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

    onRest()    { game.tamer.digimonList.forEach(d => d.rest()); }
    onTrain()   { game.tamer.digimonList.forEach(d => d.train()); }
    onSkipDay() { game.skipDay(); this.buildScene(); }
}
