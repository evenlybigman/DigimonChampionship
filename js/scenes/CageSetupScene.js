// 설정 화면 상수
const S_HEX_R    = 55;                                        // 설정 화면 타일 크기
const S_TOTAL_W  = 10 * S_HEX_R * Math.sqrt(3);              // ≈953px
const S_MAP_X    = (1280 - S_TOTAL_W) / 2;                   // 좌측 여백
const S_MAP_ROW_Y = [160, 160 + S_HEX_R * 1.5];              // r=0, r=1 Y

const S_INV_Y    = 430; // 인벤토리 바 Y
const S_INV_H    = 220;
const S_CELL_R   = 40;  // 인벤토리 미리보기 타일 크기

function sTilePos(q, r) {
    return {
        x: S_MAP_X + (q + r * 0.5) * S_HEX_R * Math.sqrt(3),
        y: S_MAP_ROW_Y[r],
    };
}

class CageSetupScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CageSetupScene' });
        this.dragging    = null;  // { cage, sprite, offsetX, offsetY } 드래그 중인 케이지
        this.ghostGfx    = null;
        this.invScrollX  = 0;
        this.invDragStart = null;
        this.mapGfx      = null;
        this.invGfx      = null;
        this.invCells    = [];    // { cage, x, y } 인벤토리 셀 위치
    }

    create() {
        this.add.rectangle(640, 360, 1280, 720, 0x0d0d1a);

        this.add.text(640, 20, '케이지 설정', {
            fontSize: '26px', color: '#aabbff', align: 'center',
        }).setOrigin(0.5, 0);

        this.add.text(640, 58, '인벤토리에서 드래그해 맵에 올리거나, 맵의 케이지를 드래그해 제거하세요.',
            { fontSize: '14px', color: '#778899', align: 'center' }
        ).setOrigin(0.5, 0);

        // 맵 영역
        this.mapGfx = this.add.graphics();

        // 인벤토리 영역
        this.add.rectangle(640, S_INV_Y + S_INV_H / 2, 1240, S_INV_H, 0x111122)
            .setStrokeStyle(1, 0x334466);
        this.add.text(20, S_INV_Y - 22, '보유 케이지', { fontSize: '14px', color: '#667788' });

        this.invGfx = this.add.graphics();
        this.ghostGfx = this.add.graphics().setDepth(20);

        // 돌아가기 버튼
        const back = this.add.text(1240, 16, '✕  돌아가기', {
            fontSize: '18px', color: '#ffffff',
            backgroundColor: '#332244', padding: { x: 10, y: 6 },
        }).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.scene.start('CageScene'));

        this._setupInput();
        this._buildMap();
        this._buildInventory();
    }

    // ── 맵 렌더링 ───────────────────────────────────────────────
    _buildMap() {
        const gfx = this.mapGfx;
        gfx.clear();

        const wm = game.tamer.worldMap;

        for (let r = 0; r < 2; r++) {
            for (let q = 0; q < 10; q++) {
                const p     = sTilePos(q, r);
                const entry = wm.getAt(q, r);

                if (entry) {
                    gfx.fillStyle(0x1a2a50, 1);
                    gfx.lineStyle(2, 0x4488dd, 1);
                } else {
                    gfx.fillStyle(0x0e0e22, 1);
                    gfx.lineStyle(1, 0x223344, 0.8);
                }
                this._drawHex(gfx, p.x, p.y, S_HEX_R);

                // 앵커 타일에 케이지 이름
                if (entry && entry.anchorQ === q && entry.anchorR === r) {
                    this.add.text(p.x, p.y, entry.cage.name, {
                        fontSize: '10px', color: '#aaddff', align: 'center',
                    }).setOrigin(0.5).setDepth(2);
                }
            }
        }
    }

    // ── 인벤토리 렌더링 ──────────────────────────────────────────
    _buildInventory() {
        this.invGfx.clear();
        this.invCells = [];

        const inv = game.tamer.cageInventory;
        const cellW = 160;
        const startX = 40 - this.invScrollX;

        inv.forEach((cage, i) => {
            const cx = startX + i * cellW;
            const cy = S_INV_Y + S_INV_H / 2 - 20;

            // 화면 밖이면 건너뜀
            if (cx + cellW < 0 || cx - cellW > 1280) return;

            // 케이지 미리보기 (타일 패턴)
            const tiles = CAGE_DATA[cage.id].tiles;
            const hw = S_CELL_R * Math.sqrt(3) / 2;
            // 중심 기준으로 타일 그리기
            tiles.forEach(([dq, dr]) => {
                const tx = cx + (dq + dr * 0.5) * S_CELL_R * Math.sqrt(3);
                const ty = cy + dr * S_CELL_R * 1.5;
                this.invGfx.fillStyle(0x223366, 1);
                this.invGfx.lineStyle(1, 0x4466aa, 1);
                this._drawHex(this.invGfx, tx, ty, S_CELL_R);
            });

            // 이름
            this.add.text(cx, cy + S_CELL_R * 1.5 + 10, cage.name, {
                fontSize: '12px', color: '#aabbcc', align: 'center',
            }).setOrigin(0.5, 0).setDepth(2);

            this.invCells.push({ cage, x: cx, y: cy });
        });
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

    // 픽셀 위치 → 가장 가까운 맵 그리드 (q, r)
    _hitTestMap(px, py) {
        for (let r = 0; r < 2; r++) {
            for (let q = 0; q < 10; q++) {
                const p  = sTilePos(q, r);
                const dx = px - p.x;
                const dy = py - p.y;
                if (Math.hypot(dx, dy) < S_HEX_R * 0.9) return { q, r };
            }
        }
        return null;
    }

    // ── 입력 처리 ────────────────────────────────────────────────
    _setupInput() {
        this.input.on('pointerdown', (pointer) => {
            // 인벤토리 영역 드래그 시작 (케이지 픽업 or 스크롤)
            if (pointer.y >= S_INV_Y) {
                const hit = this.invCells.find(c =>
                    Math.hypot(pointer.x - c.x, pointer.y - c.y) < S_CELL_R * 1.5
                );
                if (hit) {
                    this._startDrag(hit.cage, pointer, false);
                } else {
                    this.invDragStart = { px: pointer.x, sx: this.invScrollX };
                }
                return;
            }

            // 맵 영역 클릭 → 배치된 케이지 픽업
            const cell = this._hitTestMap(pointer.x, pointer.y);
            if (cell) {
                const entry = game.tamer.worldMap.getAt(cell.q, cell.r);
                if (entry) {
                    game.tamer.removeCage(entry.cage);
                    this._startDrag(entry.cage, pointer, true);
                }
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (this.invDragStart && !this.dragging) {
                this.invScrollX = Math.max(0,
                    this.invDragStart.sx - (pointer.x - this.invDragStart.px)
                );
                this._rebuildInv();
                return;
            }

            if (!this.dragging) return;
            this.dragging.sprite.setPosition(
                pointer.x + this.dragging.offsetX,
                pointer.y + this.dragging.offsetY
            );
            this._drawGhost(pointer.x, pointer.y);
        });

        this.input.on('pointerup', (pointer) => {
            this.invDragStart = null;
            if (!this.dragging) return;

            const cage = this.dragging.cage;
            this.dragging.sprite.destroy();
            this.ghostGfx.clear();
            this.dragging = null;

            // 맵 위에 드롭
            if (pointer.y < S_INV_Y) {
                const cell = this._hitTestMap(pointer.x, pointer.y);
                if (cell && game.tamer.worldMap.canPlace(cage.id, cell.q, cell.r)) {
                    game.tamer.addCageToInventory(cage);
                    game.tamer.placeCage(cage, cell.q, cell.r);
                    this._rebuild();
                    return;
                }
            }

            // 인벤토리로 복귀
            if (!game.tamer.cageInventory.includes(cage)) {
                game.tamer.addCageToInventory(cage);
            }
            this._rebuild();
        });
    }

    _startDrag(cage, pointer, fromMap) {
        const spr = this.add.graphics().setDepth(21);
        const tiles = CAGE_DATA[cage.id].tiles;
        spr.fillStyle(0x3355aa, 0.8);
        spr.lineStyle(2, 0x66aaff, 1);
        tiles.forEach(([dq, dr]) => {
            const tx = (dq + dr * 0.5) * S_CELL_R * Math.sqrt(3);
            const ty = dr * S_CELL_R * 1.5;
            this._drawHex(spr, tx, ty, S_CELL_R);
        });

        this.dragging = { cage, sprite: spr, offsetX: 0, offsetY: 0 };
        spr.setPosition(pointer.x, pointer.y);
    }

    _drawGhost(px, py) {
        this.ghostGfx.clear();
        if (!this.dragging || py >= S_INV_Y) return;

        const cell = this._hitTestMap(px, py);
        if (!cell) return;

        const canPlace = game.tamer.worldMap.canPlace(this.dragging.cage.id, cell.q, cell.r);
        const color    = canPlace ? 0x44ff88 : 0xff4444;
        const alpha    = 0.35;

        const tiles = game.tamer.worldMap.absoluteTiles(this.dragging.cage.id, cell.q, cell.r);
        this.ghostGfx.fillStyle(color, alpha);
        this.ghostGfx.lineStyle(2, color, 0.8);
        tiles.forEach(([tq, tr]) => {
            const p = sTilePos(tq, tr);
            this._drawHex(this.ghostGfx, p.x, p.y, S_HEX_R);
        });
    }

    _rebuildInv() {
        // invGfx 재그리기 (텍스트는 재생성 불가 → 전체 씬 재빌드)
        this._rebuild();
    }

    _rebuild() {
        // 텍스트 오브젝트 전부 정리 후 재생성
        this.children.list
            .filter(o => o.type === 'Text' && o !== this.children.list[0])
            .forEach(o => o.destroy());
        this._buildMap();
        this._buildInventory();
    }
}
