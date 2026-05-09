const SEASONS = ['봄', '여름', '가을', '겨울'];

// 월드 맵 상수
const HEX_R      = 160;
const TOTAL_COLS = 10;
const TOTAL_W    = TOTAL_COLS * HEX_R * Math.sqrt(3); // ≈2771px
const MAP_ROW_Y  = [240, 240 + HEX_R * 1.5];          // r=0(위), r=1(아래) 화면 Y

// 배회/스프라이트
const SPRITE_SPEED = 60;
const SPRITE_PAD   = 20;
const HEX_INSC_R   = HEX_R * Math.sqrt(3) / 2;
const EAT_REACH    = 24;
const EAT_TICKS    = 5;

// 패널
const PANEL_X = 980;
const PANEL_Y = 10;
const PANEL_W = 290;
const PANEL_H = 440;

// 미니맵
const MM_R    = 11;                      // 미니맵 헥스 반지름(px)
const MM_X    = 995;                     // q=0,r=0 센터 X
const MM_Y    = 430;                     // r=0 센터 Y

// 타일 (q,r) → 월드 픽셀 좌표
function tileWorldPos(q, r) {
    return {
        x: (q + r * 0.5) * HEX_R * Math.sqrt(3),
        y: r * HEX_R * 1.5,
    };
}

// 월드 X → 화면 X (스크롤 + 랩핑)
function worldToScreenX(worldX, scrollX) {
    let sx = ((worldX - scrollX) % TOTAL_W + TOTAL_W) % TOTAL_W;
    if (sx > TOTAL_W - HEX_R * 2) sx -= TOTAL_W; // 왼쪽 끝에서 wrap
    return sx;
}

// 화면 X → 월드 X
function screenToWorldX(screenX, scrollX) {
    return ((screenX + scrollX) % TOTAL_W + TOTAL_W) % TOTAL_W;
}

// 월드 X에서 가장 가까운 q 찾기 (r 고정)
function nearestQ(worldX, r) {
    const step = HEX_R * Math.sqrt(3);
    const offset = r * 0.5;
    const raw = worldX / step - offset;
    return ((Math.round(raw) % TOTAL_COLS) + TOTAL_COLS) % TOTAL_COLS;
}

class CageScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CageScene' });
        this.elapsed        = 0;
        this.scrollX        = 0;
        this.isDragging     = false;
        this.dragStartX     = 0;
        this.dragScrollX    = 0;
        this.digimonSprites = []; // { digimon, cage, sprite, trackedId, worldX, worldY }
        this.digimonWPos    = new Map(); // digimon → { x, y } (월드 좌표)
        this.digimonTarget  = new Map(); // digimon → { tx, ty } (월드 좌표)
        this.foodSprites    = new Map();
        this.draggingSprite      = null;
        this.selectedDigimon     = null;
        this.feedMode            = false;
        this.evolutionInProgress = false;
        this.minimapGfx          = null;
        this.notifObjects        = []; // { textObj, createdAt }
    }

    create() {
        this.add.rectangle(640, 360, 1280, 720, 0x1a1a2e);

        this.mapGfx = this.add.graphics();

        this.dateText     = this.add.text(10, 10, '', { fontSize: '20px', color: '#ffffff' }).setDepth(10);
        this.capacityText = this.add.text(10, 36, '', { fontSize: '18px', color: '#aaaaaa' }).setDepth(10);

        this.minimapGfx = this.add.graphics().setDepth(15);

        this._createStatsPanel();
        this._createButtons();
        this._buildDigimonSprites();
        this._setupScroll();
        this._setupDrag();
        this._setupFoodClick();

        // EvolutionScene 종료 후 진화 완료 플래그 리셋
        this.events.on('resume', () => { this.evolutionInProgress = false; });
    }

    _createStatsPanel() {
        this.add.rectangle(
            PANEL_X + PANEL_W / 2, PANEL_Y + PANEL_H / 2,
            PANEL_W, PANEL_H, 0x0a0a22, 0.85
        ).setStrokeStyle(1, 0x3344aa).setDepth(10);

        this.panelText   = this.add.text(PANEL_X + 10, PANEL_Y + 10, '디지몬을 선택하세요.', {
            fontSize: '16px', color: '#ffffff', lineSpacing: 8,
        }).setDepth(11);
        this.panelApText = this.add.text(PANEL_X + 10, PANEL_Y + 305, '', {
            fontSize: '13px', color: '#aaddff', lineSpacing: 6,
        }).setDepth(11);
    }

    _createButtons() {
        const btns = [
            { label: '휴식',        x: 10,  action: () => game.tamer.digimonList.forEach(d => d.rest()) },
            { label: '훈련',        x: 120, action: () => game.tamer.digimonList.forEach(d => d.train()) },
            { label: '하루 끝내기', x: 230, action: () => { game.skipDay(); this._buildDigimonSprites(); } },
            { label: '케이지 설정', x: 430, action: () => this.scene.start('CageSetupScene') },
        ];
        btns.forEach(b => {
            const t = this.add.text(b.x, 680, b.label, {
                fontSize: '20px', color: '#ffffff',
                backgroundColor: '#222244', padding: { x: 12, y: 6 },
            }).setInteractive({ useHandCursor: true }).setDepth(10);
            t.on('pointerdown', b.action);
            t.on('pointerover', () => t.setColor('#ffff00'));
            t.on('pointerout',  () => t.setColor('#ffffff'));
        });

        this.feedBtn = this.add.text(340, 680, '먹이', {
            fontSize: '20px', color: '#ffffff',
            backgroundColor: '#222244', padding: { x: 12, y: 6 },
        }).setInteractive({ useHandCursor: true }).setDepth(10);
        this.feedBtn.on('pointerdown', () => {
            this.feedMode = !this.feedMode;
            this.feedBtn.setColor(this.feedMode ? '#ffff00' : '#ffffff');
            this.feedBtn.setBackgroundColor(this.feedMode ? '#553300' : '#222244');
        });
    }

    // ── 맵 렌더링 ───────────────────────────────────────────────
    _drawMap() {
        const gfx = this.mapGfx;
        gfx.clear();

        const wm = game.tamer.worldMap;

        for (let r = 0; r < 2; r++) {
            for (let q = 0; q < TOTAL_COLS; q++) {
                const wp = tileWorldPos(q, r);
                const sx = worldToScreenX(wp.x, this.scrollX);
                const sy = MAP_ROW_Y[r];

                const entry = wm.getAt(q, r);
                if (entry) {
                    gfx.fillStyle(0x1a2a4a, 1);
                    gfx.lineStyle(2, 0x4488cc, 1);
                } else {
                    gfx.fillStyle(0x111122, 0.7);
                    gfx.lineStyle(1, 0x223344, 0.8);
                }

                gfx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 2;
                    const px = sx + HEX_R * Math.cos(a);
                    const py = sy + HEX_R * Math.sin(a);
                    i === 0 ? gfx.moveTo(px, py) : gfx.lineTo(px, py);
                }
                gfx.closePath();
                gfx.fillPath();
                gfx.strokePath();

                // 케이지 이름 — 앵커 타일에만 표시
                if (entry && entry.anchorQ === q && entry.anchorR === r) {
                    // 텍스트는 매 프레임 파괴/재생성 대신 update에서 처리
                }
            }
        }
    }

    // ── 디지몬 스프라이트 ────────────────────────────────────────
    _buildDigimonSprites() {
        this.digimonSprites.forEach(e => e.sprite.destroy());
        this.digimonSprites = [];

        game.tamer.worldMap.placedCages.forEach(({ cage, anchorQ, anchorR }) => {
            const absTiles = game.tamer.worldMap.absoluteTiles(cage.id, anchorQ, anchorR);

            cage.digimonList.forEach(d => {
                if (!this.digimonWPos.has(d)) {
                    const mid = absTiles[Math.floor(absTiles.length / 2)];
                    const wp  = tileWorldPos(mid[0], mid[1]);
                    this.digimonWPos.set(d, { x: wp.x, y: wp.y });
                }
                this._pickTarget(d, cage, absTiles);
                this._createSprite(d, cage, absTiles);
            });
        });
    }

    _createSprite(digimon, cage, absTiles) {
        const wp = this.digimonWPos.get(digimon);
        const sx = worldToScreenX(wp.x, this.scrollX);
        const sy = MAP_ROW_Y[0] + wp.y; // wp.y relative from r=0

        let sprite;
        if (this.textures.exists(digimon.id)) {
            sprite = this.add.image(sx, sy, digimon.id).setScale(0.55).setDepth(3);
        } else {
            sprite = this.add.rectangle(sx, sy, 46, 46, 0x334466).setDepth(3);
        }

        sprite.setInteractive({ useHandCursor: true });
        this.input.setDraggable(sprite);
        sprite.on('pointerdown', () => { this.selectedDigimon = digimon; });

        this.digimonSprites.push({ digimon, cage, sprite, trackedId: digimon.id, absTiles });
    }

    _pickTarget(digimon, cage, absTiles) {
        const tc  = Phaser.Utils.Array.GetRandom(absTiles);
        const wp  = tileWorldPos(tc[0], tc[1]);
        const maxR = HEX_INSC_R - SPRITE_PAD;
        const a   = Math.random() * Math.PI * 2;
        const d   = Math.random() * maxR;
        this.digimonTarget.set(digimon, {
            tx: wp.x + Math.cos(a) * d,
            ty: wp.y + Math.sin(a) * d,
        });
    }

    // ── 스크롤 ───────────────────────────────────────────────────
    _setupScroll() {
        this.input.on('pointerdown', (pointer) => {
            if (pointer.y > 660) return; // 버튼 영역 제외
            this.isDragging  = true;
            this.dragStartX  = pointer.x;
            this.dragScrollX = this.scrollX;
        });
        this.input.on('pointermove', (pointer) => {
            if (!this.isDragging || this.draggingSprite) return;
            const dx = pointer.x - this.dragStartX;
            this.scrollX = ((this.dragScrollX - dx) % TOTAL_W + TOTAL_W) % TOTAL_W;
        });
        this.input.on('pointerup', () => { this.isDragging = false; });
    }

    // ── 먹이 클릭 ────────────────────────────────────────────────
    _setupFoodClick() {
        this.input.on('pointerdown', (pointer, currentlyOver) => {
            if (!this.feedMode) return;
            if (pointer.y > 660) return;
            const onSprite = this.digimonSprites.some(e => currentlyOver.includes(e.sprite));
            if (onSprite) return;

            const worldX = screenToWorldX(pointer.x, this.scrollX);
            const worldY = pointer.y - MAP_ROW_Y[0];
            const r      = worldY < HEX_R * 1.5 * 0.5 + HEX_R * 0.5 ? 0 : 1;
            const q      = nearestQ(worldX, r);
            const entry  = game.tamer.worldMap.getAt(q, r);
            if (!entry) return;

            const inv    = game.tamer.inventory;
            const foodId = Object.keys(inv).find(k => inv[k] > 0);
            if (!foodId) return;
            inv[foodId]--;
            entry.cage.addFood(FOOD_DATA[foodId], worldX, worldY);
        });
    }

    // ── 드래그 (디지몬 재배치) ────────────────────────────────────
    _setupDrag() {
        this.input.on('dragstart', (pointer, sprite) => {
            this.draggingSprite = sprite;
            sprite.setDepth(10);
        });
        this.input.on('drag', (pointer, sprite, dragX, dragY) => {
            sprite.setPosition(dragX, dragY);
        });
        this.input.on('dragend', (pointer, sprite) => {
            this.draggingSprite = null;
            sprite.setDepth(3);
            const entry = this.digimonSprites.find(e => e.sprite === sprite);
            if (!entry) return;

            const wx = screenToWorldX(pointer.x, this.scrollX);
            const wy = pointer.y - MAP_ROW_Y[0];

            // 드롭 위치의 케이지 찾기
            const hit = game.tamer.worldMap.placedCages.find(({ cage, anchorQ, anchorR }) => {
                return game.tamer.worldMap.absoluteTiles(cage.id, anchorQ, anchorR)
                    .some(([tq, tr]) => {
                        const tp = tileWorldPos(tq, tr);
                        return Math.hypot(wx - tp.x, wy - tp.y) < HEX_R * 0.9;
                    });
            });

            if (hit && hit.cage !== entry.cage) {
                // 다른 케이지로 이동
                entry.cage.removeDigimon(entry.digimon);
                if (hit.cage.canAdd(entry.digimon)) {
                    hit.cage.addDigimon(entry.digimon);
                    entry.cage     = hit.cage;
                    entry.absTiles = game.tamer.worldMap.absoluteTiles(hit.cage.id, hit.anchorQ, hit.anchorR);
                } else {
                    entry.cage.addDigimon(entry.digimon); // 용량 초과 시 원래 케이지 복귀
                }
            }

            this.digimonWPos.set(entry.digimon, { x: wx, y: wy });
            this._pickTarget(entry.digimon, entry.cage, entry.absTiles);
        });
    }

    // ── 업데이트 루프 ─────────────────────────────────────────────
    update(time, delta) {
        // 진화 큐 처리
        if (game.pendingEvolutions.length > 0 && !this.evolutionInProgress) {
            this.evolutionInProgress = true;
            this._startEvolution(game.pendingEvolutions.shift());
        }

        this.elapsed += delta;
        if (this.elapsed >= 1000) {
            this.elapsed = 0;
            game.onTick();
        }

        if (this.digimonSprites.some(e => e.digimon.id !== e.trackedId)) {
            this._buildDigimonSprites();
            return;
        }

        this._drawMap();
        this._drawCageLabels();
        this._updateMovement(delta);
        this._syncFoodSprites();
        this._updateHUD();
        this._updateStatsPanel();
        this._drawMiniMap();
        this._processNotifications();
    }

    _drawCageLabels() {
        // 케이지 이름 텍스트는 별도 오브젝트로 관리하지 않고 graphics로 처리하기 어려워
        // 씬에 text 오브젝트를 재생성하는 대신, 별도 텍스트 레이어를 한 번만 만들어 위치 업데이트
        // → 간단히 매 빌드 시 처리 (buildDigimonSprites 내에서 처리 가능)
        // 지금은 생략 — 케이지 설정 씬에서 확인 가능
    }

    // ── 진화 연출 ─────────────────────────────────────────────────
    _startEvolution({ digimon, fromId, toId }) {
        const wp = this.digimonWPos.get(digimon);
        const launch = () => {
            this.scene.launch('EvolutionScene', { digimon, fromId, toId });
            this.scene.pause();
        };

        if (!wp) { launch(); return; }

        const targetScrollX = ((wp.x - 640) % TOTAL_W + TOTAL_W) % TOTAL_W;
        let delta = targetScrollX - this.scrollX;
        if (delta >  TOTAL_W / 2) delta -= TOTAL_W;
        if (delta < -TOTAL_W / 2) delta += TOTAL_W;

        const startScrollX = this.scrollX;
        const counter      = { t: 0 };
        this.tweens.add({
            targets: counter, t: 1,
            duration: 700, ease: 'Cubic.easeInOut',
            onUpdate: () => {
                this.scrollX = ((startScrollX + delta * counter.t) % TOTAL_W + TOTAL_W) % TOTAL_W;
            },
            onComplete: launch,
        });
    }

    // ── 알림 ─────────────────────────────────────────────────────
    _processNotifications() {
        while (game.notifications.length > 0) {
            const { text } = game.notifications.shift();
            this._showNotification(text);
        }

        const now = Date.now();
        this.notifObjects = this.notifObjects.filter(n => {
            const age = now - n.createdAt;
            if (age > 3500) { n.textObj.destroy(); return false; }
            n.textObj.setAlpha(age > 2500 ? 1 - (age - 2500) / 1000 : 1);
            return true;
        });
    }

    _showNotification(text) {
        const NOTIF_X = 20;
        const NOTIF_BASE_Y = 630;
        const LINE_H = 22;

        // 기존 알림들 위로 올리기
        this.notifObjects.forEach((n, i) => {
            const targetY = NOTIF_BASE_Y - (this.notifObjects.length - i) * LINE_H;
            n.textObj.setY(targetY);
        });

        const textObj = this.add.text(NOTIF_X, NOTIF_BASE_Y, text, {
            fontSize: '13px', color: '#aaffcc',
            stroke: '#000000', strokeThickness: 3,
        }).setDepth(20);

        this.notifObjects.push({ textObj, createdAt: Date.now() });
        if (this.notifObjects.length > 5) {
            const old = this.notifObjects.shift();
            old.textObj.destroy();
        }
    }

    // ── 미니맵 ────────────────────────────────────────────────────
    _drawMiniMap() {
        const gfx      = this.minimapGfx;
        const colStep  = MM_R * Math.sqrt(3);
        const rowStep  = MM_R * 1.5;
        const bgLeft   = MM_X - colStep / 2 - 3;
        const bgTop    = MM_Y - MM_R - 3;
        const bgW      = TOTAL_COLS * colStep + 6;
        const bgH      = rowStep + MM_R * 2 + 6;

        gfx.clear();
        gfx.fillStyle(0x050510, 0.88);
        gfx.fillRect(bgLeft, bgTop, bgW, bgH);
        gfx.lineStyle(1, 0x334466, 1);
        gfx.strokeRect(bgLeft, bgTop, bgW, bgH);

        const wm = game.tamer.worldMap;
        for (let r = 0; r < 2; r++) {
            for (let q = 0; q < TOTAL_COLS; q++) {
                const cx = MM_X + (q + r * 0.5) * colStep;
                const cy = MM_Y + r * rowStep;
                gfx.fillStyle(wm.getAt(q, r) ? 0x3377bb : 0x111133, 1);
                gfx.lineStyle(1, 0x223355, 0.7);
                gfx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a  = (Math.PI / 3) * i - Math.PI / 2;
                    const px = cx + MM_R * Math.cos(a);
                    const py = cy + MM_R * Math.sin(a);
                    i === 0 ? gfx.moveTo(px, py) : gfx.lineTo(px, py);
                }
                gfx.closePath();
                gfx.fillPath();
                gfx.strokePath();
            }
        }

        // 뷰포트 인디케이터
        const mmW    = TOTAL_COLS * colStep;
        const vpW    = (1280 / TOTAL_W) * mmW;
        const vpLeft = bgLeft + (this.scrollX / TOTAL_W) * mmW;
        gfx.lineStyle(2, 0xffee44, 0.95);
        gfx.strokeRect(vpLeft, bgTop, vpW, bgH);
        if (vpLeft + vpW > bgLeft + mmW) {
            gfx.strokeRect(vpLeft - mmW, bgTop, vpW, bgH);
        }
    }

    _clampToCage(wp, absTiles) {
        const inside = absTiles.some(([tq, tr]) => {
            const tp = tileWorldPos(tq, tr);
            return Math.hypot(wp.x - tp.x, wp.y - tp.y) < HEX_R * 0.9;
        });
        if (inside) return;

        // 가장 가까운 타일 중심으로 스냅
        let nearest = null, nearestDist = Infinity;
        absTiles.forEach(([tq, tr]) => {
            const tp   = tileWorldPos(tq, tr);
            const dist = Math.hypot(wp.x - tp.x, wp.y - tp.y);
            if (dist < nearestDist) { nearestDist = dist; nearest = tp; }
        });
        if (nearest) { wp.x = nearest.x; wp.y = nearest.y; }
    }

    _updateMovement(delta) {
        this.digimonSprites.forEach(({ digimon, cage, sprite, absTiles }) => {
            if (sprite === this.draggingSprite) return;

            const wp = this.digimonWPos.get(digimon);
            if (!wp) return;

            // 화면 위치 업데이트
            const sx = worldToScreenX(wp.x, this.scrollX);
            const sy = MAP_ROW_Y[0] + wp.y;

            if (digimon.isEating) {
                sprite.setPosition(sx, sy);
                return;
            }

            // 먹이 탐색
            if (digimon.targetFood) {
                const food = digimon.targetFood;
                const dx   = food.x - wp.x;
                const dy   = food.y - wp.y;
                const dist = Math.hypot(dx, dy);
                if (dist < EAT_REACH) {
                    digimon.isEating = true;
                    digimon.eatTimer = EAT_TICKS;
                    sprite.setPosition(sx, sy);
                    return;
                }
                const step = SPRITE_SPEED * (delta / 1000);
                wp.x += (dx / dist) * Math.min(step, dist);
                wp.y += (dy / dist) * Math.min(step, dist);
                this._clampToCage(wp, absTiles);
                sprite.setPosition(worldToScreenX(wp.x, this.scrollX), MAP_ROW_Y[0] + wp.y);
                return;
            }

            const unclaimed = cage.foods.find(f => !f.eatenBy && !f.consumed);
            if (unclaimed) {
                unclaimed.eatenBy  = digimon;
                digimon.targetFood = unclaimed;
                return;
            }

            // 배회
            const target = this.digimonTarget.get(digimon);
            if (!target) {
                const entry = game.tamer.worldMap.placedCages.find(e => e.cage === cage);
                if (entry) this._pickTarget(digimon, cage, game.tamer.worldMap.absoluteTiles(cage.id, entry.anchorQ, entry.anchorR));
                return;
            }

            const dx   = target.tx - wp.x;
            const dy   = target.ty - wp.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 4) {
                const entry = game.tamer.worldMap.placedCages.find(e => e.cage === cage);
                if (entry) this._pickTarget(digimon, cage, game.tamer.worldMap.absoluteTiles(cage.id, entry.anchorQ, entry.anchorR));
                return;
            }
            const step = SPRITE_SPEED * (delta / 1000);
            wp.x += (dx / dist) * Math.min(step, dist);
            wp.y += (dy / dist) * Math.min(step, dist);
            this._clampToCage(wp, absTiles);
            sprite.setPosition(worldToScreenX(wp.x, this.scrollX), MAP_ROW_Y[0] + wp.y);
        });
    }

    _syncFoodSprites() {
        for (const [food, sprite] of this.foodSprites) {
            if (food.consumed) { sprite.destroy(); this.foodSprites.delete(food); continue; }
            const sx = worldToScreenX(food.x, this.scrollX);
            const sy = MAP_ROW_Y[0] + food.y;
            sprite.setPosition(sx, sy);
        }
        game.tamer.worldMap.placedCages.forEach(({ cage }) => {
            cage.foods = cage.foods.filter(f => !f.consumed);
            cage.foods.forEach(food => {
                if (!this.foodSprites.has(food)) {
                    const s = this.add.circle(0, 0, 7, 0xff6633).setDepth(2);
                    this.foodSprites.set(food, s);
                }
            });
        });
    }

    _updateHUD() {
        const t = game.tamer;
        if (!t) return;
        this.dateText.setText(
            `${SEASONS[game.month - 1]} ${game.day}일  ` +
            `${String(game.gameHour).padStart(2, '0')}:${String(game.gameMinute).padStart(2, '0')}`
        );
        this.capacityText.setText(`용량 ${t.usedCapacity}/${t.maxCapacity}`);
    }

    _updateStatsPanel() {
        const d = this.selectedDigimon;
        if (!d) { this.panelText.setText('디지몬을 선택하세요.'); this.panelApText.setText(''); return; }
        const s = d.currentStats;
        this.panelText.setText([
            `${d.name}${d.isEating ? ' [먹는 중]' : ''}`,
            `No.${DIGIMON_DATA[d.id].no}  ${DIGIMON_DATA[d.id].stage}`,
            ``,
            `HP  ${s.hp}   MP  ${s.mp}`,
            `공격 ${s.atk}  방어 ${s.def}`,
            `속도 ${s.spd}`,
            ``,
            `배고픔 ${d.hunger}`,
            `피로   ${d.fatigue}`,
            `기분   ${d.mood}`,
            `나이   ${d.age}일`,
            `케어실수 ${d.careMistakes}`,
        ].join('\n'));
        const ap = d.ap;
        this.panelApText.setText([
            '── AP ──',
            `용 ${ap.dragon}  야수 ${ap.beast}  조류 ${ap.bird}`,
            `식 ${ap.plant}  수 ${ap.water}  성 ${ap.holy}`,
            `암 ${ap.dark}  기 ${ap.machine}`,
            `바 ${ap.virus}  백 ${ap.vaccine}  데 ${ap.data}`,
        ].join('\n'));
    }
}
