const S_HEX_R     = 55;
const S_TOTAL_W   = 10 * S_HEX_R * Math.sqrt(3);
const S_MAP_X     = (1280 - S_TOTAL_W) / 2;
const S_MAP_ROW_Y = [160, 160 + S_HEX_R * 1.5];

const S_INV_Y  = 430;
const S_INV_H  = 220;
const S_CELL_R = 40;

function sTilePos(q, r) {
    return {
        x: S_MAP_X + (q + r * 0.5) * S_HEX_R * Math.sqrt(3),
        y: S_MAP_ROW_Y[r],
    };
}

class CageSetupScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CageSetupScene' });
        this.dragging     = null;
        this.ghostGfx     = null;
        this.invDragStart = null;
        this.invScrollX   = 0;
        this.mapGfx       = null;
        this.invGfx       = null;
        this.invCells     = [];
        this.mapLabels    = []; // 맵 위 케이지 이름 텍스트 (rebuild 시 교체)
        this.invLabels    = []; // 인벤토리 이름 텍스트 (rebuild 시 교체)
    }

    create() {
        this.add.rectangle(640, 360, 1280, 720, 0x0d0d1a);

        this.add.text(640, 20, '케이지 설정', {
            fontSize: '26px', color: '#aabbff',
        }).setOrigin(0.5, 0);

        this.add.text(640, 58, '인벤토리에서 드래그해 맵에 올리거나, 맵의 케이지를 드래그해 위치를 바꾸거나 제거하세요.', {
            fontSize: '13px', color: '#667788',
        }).setOrigin(0.5, 0);

        this.add.rectangle(640, S_INV_Y + S_INV_H / 2, 1240, S_INV_H, 0x111122)
            .setStrokeStyle(1, 0x334466);
        this.add.text(20, S_INV_Y - 22, '보유 케이지', { fontSize: '14px', color: '#667788' });

        const back = this.add.text(1240, 16, '✕  돌아가기', {
            fontSize: '18px', color: '#ffffff',
            backgroundColor: '#332244', padding: { x: 10, y: 6 },
        }).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.scene.start('CageScene'));
        back.on('pointerover', () => back.setColor('#ffff00'));
        back.on('pointerout',  () => back.setColor('#ffffff'));

        this.mapGfx   = this.add.graphics();
        this.invGfx   = this.add.graphics();
        this.ghostGfx = this.add.graphics().setDepth(20);

        this._setupInput();
        this._buildMap();
        this._buildInventory();
    }

    // ── 맵 렌더링 ──────────────────────────────────────────────
    _buildMap() {
        this.mapLabels.forEach(t => t.destroy());
        this.mapLabels = [];
        this.mapGfx.clear();

        const wm = game.tamer.worldMap;
        for (let r = 0; r < 2; r++) {
            for (let q = 0; q < 10; q++) {
                const p     = sTilePos(q, r);
                const entry = wm.getAt(q, r);

                if (entry && entry.cage.id === 'default') {
                    this.mapGfx.fillStyle(0x2a1a40, 1);
                    this.mapGfx.lineStyle(2, 0xddaa22, 1); // 금색 — 잠금 표시
                } else if (entry) {
                    this.mapGfx.fillStyle(0x1a2a50, 1);
                    this.mapGfx.lineStyle(2, 0x4488dd, 1);
                } else {
                    this.mapGfx.fillStyle(0x0e0e22, 1);
                    this.mapGfx.lineStyle(1, 0x223344, 0.8);
                }
                this._drawHex(this.mapGfx, p.x, p.y, S_HEX_R);

                if (entry && entry.anchorQ === q && entry.anchorR === r) {
                    const lbl = this.add.text(p.x, p.y, entry.cage.name, {
                        fontSize: '10px', color: '#aaddff',
                    }).setOrigin(0.5).setDepth(2);
                    this.mapLabels.push(lbl);
                }
            }
        }
    }

    // ── 인벤토리 렌더링 ────────────────────────────────────────
    _buildInventory() {
        this.invLabels.forEach(t => t.destroy());
        this.invLabels = [];
        this.invGfx.clear();
        this.invCells = [];

        const inv   = game.tamer.cageInventory;
        const cellW = 160;

        inv.forEach((cage, i) => {
            const cx = 40 + i * cellW - this.invScrollX;
            const cy = S_INV_Y + S_INV_H / 2 - 24;
            if (cx + cellW < 0 || cx - cellW > 1280) return;

            CAGE_DATA[cage.id].tiles.forEach(([dq, dr]) => {
                const tx = cx + (dq + dr * 0.5) * S_CELL_R * Math.sqrt(3);
                const ty = cy + dr * S_CELL_R * 1.5;
                this.invGfx.fillStyle(0x223366, 1);
                this.invGfx.lineStyle(1, 0x4466aa, 1);
                this._drawHex(this.invGfx, tx, ty, S_CELL_R);
            });

            const lbl = this.add.text(cx, cy + S_CELL_R * 1.5 + 10, cage.name, {
                fontSize: '12px', color: '#aabbcc',
            }).setOrigin(0.5, 0).setDepth(2);
            this.invLabels.push(lbl);

            this.invCells.push({ cage, x: cx, y: cy });
        });
    }

    _rebuild() {
        this._buildMap();
        this._buildInventory();
    }

    _drawHex(gfx, cx, cy, r) {
        gfx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a  = (Math.PI / 3) * i - Math.PI / 2;
            const px = cx + r * Math.cos(a);
            const py = cy + r * Math.sin(a);
            i === 0 ? gfx.moveTo(px, py) : gfx.lineTo(px, py);
        }
        gfx.closePath();
        gfx.fillPath();
        gfx.strokePath();
    }

    _hitTestMap(px, py) {
        for (let r = 0; r < 2; r++) {
            for (let q = 0; q < 10; q++) {
                const p = sTilePos(q, r);
                if (Math.hypot(px - p.x, py - p.y) < S_HEX_R * 0.9) return { q, r };
            }
        }
        return null;
    }

    // ── 입력 처리 ──────────────────────────────────────────────
    _setupInput() {
        this.input.on('pointerdown', (pointer) => {
            if (pointer.y >= S_INV_Y) {
                // 인벤토리 영역
                const hit = this.invCells.find(c =>
                    Math.hypot(pointer.x - c.x, pointer.y - c.y) < S_CELL_R * 1.8
                );
                if (hit) {
                    this._startDrag(hit.cage, pointer);
                } else {
                    this.invDragStart = { px: pointer.x, sx: this.invScrollX };
                }
                return;
            }

            // 맵 영역 — 배치된 케이지 픽업 (기본케이지는 고정)
            const cell = this._hitTestMap(pointer.x, pointer.y);
            if (cell) {
                const entry = game.tamer.worldMap.getAt(cell.q, cell.r);
                if (entry && entry.cage.id !== 'default') {
                    // removeCage가 이미 인벤토리에 추가함
                    game.tamer.removeCage(entry.cage);
                    this._startDrag(entry.cage, pointer);
                    this._rebuild();
                }
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (this.invDragStart && !this.dragging) {
                this.invScrollX = Math.max(0,
                    this.invDragStart.sx - (pointer.x - this.invDragStart.px)
                );
                this._buildInventory();
                return;
            }
            if (!this.dragging) return;
            this.dragging.sprite.setPosition(pointer.x, pointer.y);
            this._drawGhost(pointer.x, pointer.y);
        });

        this.input.on('pointerup', (pointer) => {
            this.invDragStart = null;
            if (!this.dragging) return;

            const cage = this.dragging.cage;
            this.dragging.sprite.destroy();
            this.ghostGfx.clear();
            this.dragging = null;

            // 맵 위 드롭
            if (pointer.y < S_INV_Y) {
                const cell = this._hitTestMap(pointer.x, pointer.y);
                if (cell && game.tamer.worldMap.canPlace(cage.id, cell.q, cell.r)) {
                    // cage는 이미 인벤토리에 있음 (removeCage or 원래 인벤토리)
                    if (!game.tamer.cageInventory.includes(cage)) {
                        game.tamer.addCageToInventory(cage);
                    }
                    game.tamer.placeCage(cage, cell.q, cell.r);
                    this._rebuild();
                    return;
                }
            }

            // 드롭 실패 → 인벤토리 복귀 (이미 있으면 추가 안 함)
            if (!game.tamer.cageInventory.includes(cage)) {
                game.tamer.addCageToInventory(cage);
            }
            this._rebuild();
        });
    }

    _startDrag(cage, pointer) {
        if (this.dragging) { this.dragging.sprite.destroy(); }

        const spr = this.add.graphics().setDepth(21);
        spr.fillStyle(0x3355aa, 0.85);
        spr.lineStyle(2, 0x66aaff, 1);
        CAGE_DATA[cage.id].tiles.forEach(([dq, dr]) => {
            const tx = (dq + dr * 0.5) * S_CELL_R * Math.sqrt(3);
            const ty = dr * S_CELL_R * 1.5;
            this._drawHex(spr, tx, ty, S_CELL_R);
        });
        spr.setPosition(pointer.x, pointer.y);

        this.dragging = { cage, sprite: spr };
    }

    _drawGhost(px, py) {
        this.ghostGfx.clear();
        if (!this.dragging || py >= S_INV_Y) return;

        const cell = this._hitTestMap(px, py);
        if (!cell) return;

        const ok    = game.tamer.worldMap.canPlace(this.dragging.cage.id, cell.q, cell.r);
        const color = ok ? 0x44ff88 : 0xff4444;

        this.ghostGfx.fillStyle(color, 0.35);
        this.ghostGfx.lineStyle(2, color, 0.9);
        game.tamer.worldMap.absoluteTiles(this.dragging.cage.id, cell.q, cell.r)
            .forEach(([tq, tr]) => {
                const p = sTilePos(tq, tr);
                this._drawHex(this.ghostGfx, p.x, p.y, S_HEX_R);
            });
    }
}
