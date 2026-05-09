const SEASONS = ['봄', '여름', '가을', '겨울'];

const HEX_TILE_R  = 80;                              // 타일 외접원 반지름
const HEX_INSC_R  = HEX_TILE_R * Math.sqrt(3) / 2;  // 내접원 반지름 (≈69.3)
const CAGE_GAP    = 40;
const CAGE_START_X = 20;
const CAGE_CENTER_Y = 370;

const SPRITE_SPEED = 45;
const SPRITE_PAD   = 14; // 내접원 안쪽 여백
const EAT_REACH    = 20;
const EAT_TICKS    = 5;

const PANEL_X = 960;
const PANEL_Y = 100;
const PANEL_W = 300;
const PANEL_H = 520;

// axial 좌표 → 픽셀 오프셋 (pointy-top)
function axialToPixel(q, r) {
    return {
        x: HEX_TILE_R * Math.sqrt(3) * (q + r / 2),
        y: HEX_TILE_R * 1.5 * r,
    };
}

// 정육각형 꼭짓점 배열 (절대 좌표, flat 배열)
function makeHexPoints(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    return pts;
}

// 케이지 타일 배열로 레이아웃 계산
function buildCageLayout(tiles) {
    const hw = HEX_TILE_R * Math.sqrt(3) / 2;
    const hh = HEX_TILE_R;
    const raw = tiles.map(([q, r]) => axialToPixel(q, r));
    const minX = Math.min(...raw.map(c => c.x)) - hw;
    const maxX = Math.max(...raw.map(c => c.x)) + hw;
    const minY = Math.min(...raw.map(c => c.y)) - hh;
    const maxY = Math.max(...raw.map(c => c.y)) + hh;
    return {
        relCenters: raw,                            // (0,0) 기준 타일 중심 오프셋
        bboxCX: (minX + maxX) / 2,
        bboxCY: (minY + maxY) / 2,
        totalW: maxX - minX,
        totalH: maxY - minY,
    };
}

class CageScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CageScene' });
        this.elapsed        = 0;
        this.cageZones      = []; // { cage, tileCenters[], tileGeoms[], objects[] }
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
        this.setupFoodClick();
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

        let curX = CAGE_START_X;

        tamer.cageList.forEach((cage) => {
            const cageData = CAGE_DATA[cage.id];
            const layout   = buildCageLayout(cageData.tiles);

            // (0,0) 타일의 월드 위치 = 바운딩박스 중심을 CAGE_CENTER_Y에 맞추는 오프셋
            const originX = curX + layout.totalW / 2 - layout.bboxCX;
            const originY = CAGE_CENTER_Y - layout.bboxCY;

            // 각 타일의 월드 중심 좌표
            const tileCenters = layout.relCenters.map(rc => ({
                wx: originX + rc.x,
                wy: originY + rc.y,
            }));

            // 히트 테스트용 Geom.Polygon 배열
            const tileGeoms = tileCenters.map(tc =>
                new Phaser.Geom.Polygon(makeHexPoints(tc.wx, tc.wy, HEX_TILE_R))
            );

            // 타일 렌더링 (Graphics)
            const gfx = this.add.graphics();
            gfx.lineStyle(2, 0x4466cc, 1);
            gfx.fillStyle(0x1a1a3a, 0.9);
            tileCenters.forEach(tc => {
                gfx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 2;
                    const px = tc.wx + HEX_TILE_R * Math.cos(a);
                    const py = tc.wy + HEX_TILE_R * Math.sin(a);
                    i === 0 ? gfx.moveTo(px, py) : gfx.lineTo(px, py);
                }
                gfx.closePath();
                gfx.fillPath();
                gfx.strokePath();
            });

            // 케이지 이름 레이블
            const labelX = originX + layout.bboxCX;
            const labelY  = CAGE_CENTER_Y - layout.totalH / 2 + 6;
            const nameLabel = this.add.text(labelX, labelY, cageData.name, {
                fontSize: '13px', color: '#8899dd',
            }).setOrigin(0.5, 0);

            this.cageZones.push({ cage, tileCenters, tileGeoms, objects: [gfx, nameLabel] });

            cage.digimonList.forEach(d => {
                if (!this.digimonPos.has(d)) {
                    // 첫 등장: 중심 타일 위에 배치
                    const mid = tileCenters[Math.floor(tileCenters.length / 2)];
                    this.digimonPos.set(d, { x: mid.wx, y: mid.wy });
                }
                this._pickNewTarget(d, cage);
                this._createSprite(d, cage);
            });

            curX += layout.totalW + CAGE_GAP;
        });
    }

    _createSprite(digimon, cage) {
        const pos = this.digimonPos.get(digimon);

        let sprite;
        if (this.textures.exists(digimon.id)) {
            sprite = this.add.image(pos.x, pos.y, digimon.id).setScale(0.6).setDepth(2);
        } else {
            sprite = this.add.rectangle(pos.x, pos.y, 44, 44, 0x334466).setDepth(2);
        }

        sprite.setInteractive({ useHandCursor: true });
        this.input.setDraggable(sprite);
        sprite.on('pointerdown', () => { this.selectedDigimon = digimon; });

        this.digimonSprites.push({ digimon, cage, sprite, trackedId: digimon.id });
    }

    _findZoneAt(px, py) {
        return this.cageZones.find(z =>
            z.tileGeoms.some(g => Phaser.Geom.Polygon.Contains(g, px, py))
        );
    }

    _pickNewTarget(digimon, cage) {
        const zone = this.cageZones.find(z => z.cage === cage);
        if (!zone) return;
        const tc    = Phaser.Utils.Array.GetRandom(zone.tileCenters);
        const maxR  = HEX_INSC_R - SPRITE_PAD;
        const angle = Math.random() * Math.PI * 2;
        const dist  = Math.random() * maxR;
        this.digimonTarget.set(digimon, {
            tx: tc.wx + Math.cos(angle) * dist,
            ty: tc.wy + Math.sin(angle) * dist,
        });
    }

    // 포인터 위치를 해당 케이지의 가장 가까운 타일 내접원으로 클램프
    _clampToZone(zone, px, py) {
        let nearestTC   = zone.tileCenters[0];
        let nearestDist = Infinity;
        zone.tileCenters.forEach(tc => {
            const d = Math.hypot(px - tc.wx, py - tc.wy);
            if (d < nearestDist) { nearestDist = d; nearestTC = tc; }
        });
        const dx   = px - nearestTC.wx;
        const dy   = py - nearestTC.wy;
        const dist = Math.hypot(dx, dy);
        const maxR = HEX_INSC_R - SPRITE_PAD;
        if (dist <= maxR || dist === 0) return { x: px, y: py };
        return { x: nearestTC.wx + (dx / dist) * maxR, y: nearestTC.wy + (dy / dist) * maxR };
    }

    setupFoodClick() {
        this.input.on('pointerdown', (pointer, currentlyOver) => {
            if (!this.feedMode) return;
            const onDigimon = this.digimonSprites.some(e => currentlyOver.includes(e.sprite));
            if (onDigimon) return;

            const zone = this._findZoneAt(pointer.x, pointer.y);
            if (!zone) return;

            const inv    = game.tamer.inventory;
            const foodId = Object.keys(inv).find(k => inv[k] > 0);
            if (!foodId) return;

            inv[foodId]--;
            zone.cage.addFood(FOOD_DATA[foodId], pointer.x, pointer.y);
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
            sprite.setDepth(2);

            const entry = this.digimonSprites.find(e => e.sprite === sprite);
            if (!entry) return;

            const { digimon, cage: srcCage } = entry;
            const srcZone    = this.cageZones.find(z => z.cage === srcCage);
            const targetZone = this._findZoneAt(pointer.x, pointer.y);

            if (targetZone && targetZone.cage !== srcCage) {
                if (!game.tamer.canAdd(digimon, targetZone.cage)) {
                    const clamped = this._clampToZone(srcZone, pointer.x, pointer.y);
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
                const clamped = this._clampToZone(targetZone, pointer.x, pointer.y);
                this.digimonPos.set(digimon, clamped);
                this.buildScene();
                return;
            }

            const snapZone = targetZone ?? srcZone;
            if (!snapZone) return;
            const clamped = this._clampToZone(snapZone, pointer.x, pointer.y);
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
                const dist = Math.hypot(dx, dy);
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
            const dist = Math.hypot(dx, dy);
            if (dist < 4) { this._pickNewTarget(digimon, cage); return; }

            const step = SPRITE_SPEED * (delta / 1000);
            pos.x += (dx / dist) * Math.min(step, dist);
            pos.y += (dy / dist) * Math.min(step, dist);
            sprite.setPosition(pos.x, pos.y);
        });
    }

    _syncFoodSprites() {
        for (const [food, sprite] of this.foodSprites) {
            if (food.consumed) { sprite.destroy(); this.foodSprites.delete(food); }
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
            `용 ${ap.dragon}  야수 ${ap.beast}  조류 ${ap.bird}`,
            `식물 ${ap.plant}  수중 ${ap.water}  성 ${ap.holy}`,
            `암흑 ${ap.dark}  기계 ${ap.machine}`,
            `바이러스 ${ap.virus}  백신 ${ap.vaccine}`,
            `데이터 ${ap.data}`,
        ].join('\n'));
    }

    onRest()    { game.tamer.digimonList.forEach(d => d.rest()); }
    onTrain()   { game.tamer.digimonList.forEach(d => d.train()); }
    onSkipDay() { game.skipDay(); this.buildScene(); }
}
