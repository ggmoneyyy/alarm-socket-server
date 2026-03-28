export default class TetrisVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.vw = 640; this.vh = 360;
        this.buffer = document.createElement('canvas');
        this.buffer.width = this.vw; this.buffer.height = this.vh;
        this.bCtx = this.buffer.getContext('2d');
        this.bCtx.imageSmoothingEnabled = false;
        
        this.fps = 30; this.lastFrameTime = 0;
        this.alarms = []; this.activeRings = []; this.ringClickListener = null;
        this.hasReceivedData = false;
        
        // --- TETRIS ENGINE ---
        this.gridW = 10; this.gridH = 20;
        this.grid = Array.from({ length: this.gridH }, () => Array(this.gridW).fill(0));
        this.dropTimer = 0; 
        this.currentPiece = null;
        this.nextPieceType = Math.floor(Math.random() * 7) + 1;
        this.clearedLines = 0;

        this.targetX = 0;
        this.targetRot = 0;
        this.currentRot = 0;
        this.targetShape = null;

        // Standard Tetromino shapes
        this.shapes = [
            [],
            [[1,1,1,1]], // I (1)
            [[1,1],[1,1]], // O (2)
            [[0,1,0],[1,1,1]], // T (3)
            [[0,0,1],[1,1,1]], // L (4)
            [[1,0,0],[1,1,1]], // J (5)
            [[0,1,1],[1,1,0]], // S (6)
            [[1,1,0],[0,1,1]]  // Z (7)
        ];

        // Generate the massive, unique procedural background mosaic
        this.createProceduralBackground();
    }

    createProceduralBackground() {
        const patCanvas = document.createElement('canvas');
        const blockSize = 14; 
        const gridW = 100; 
        const gridH = 100;
        patCanvas.width = blockSize * gridW;
        patCanvas.height = blockSize * gridH;
        const pCtx = patCanvas.getContext('2d');

        const bgGrid = Array.from({ length: gridH }, () => Array(gridW).fill(0));
        let nextBlockId = 1;

        const templates = [
            [[0,0], [0,1], [1,0], [1,1]], // O
            [[0,0], [0,1], [0,2], [0,3]], // I_h
            [[0,0], [1,0], [2,0], [3,0]], // I_v
            [[0,0], [0,1], [0,2], [1,1]], // T_up
            [[0,0], [1,-1], [1,0], [2,0]], // T_right
            [[0,0], [1,-1], [1,0], [1,1]], // T_down
            [[0,0], [1,0], [1,1], [2,0]], // T_left
            [[0,0], [0,1], [0,2], [1,0]], // L_up
            [[0,0], [0,1], [1,1], [2,1]], // L_right
            [[0,0], [1,-2], [1,-1], [1,0]], // L_down
            [[0,0], [1,0], [2,0], [2,1]], // L_left
            [[0,0], [0,1], [0,2], [1,2]], // J_up
            [[0,0], [1,0], [2,-1], [2,0]], // J_right
            [[0,0], [1,0], [1,1], [1,2]], // J_down
            [[0,0], [0,1], [1,0], [2,0]], // J_left
            [[0,0], [0,1], [1,-1], [1,0]], // S_h
            [[0,0], [1,0], [1,1], [2,1]], // S_v
            [[0,0], [0,1], [1,1], [1,2]], // Z_h
            [[0,0], [1,-1], [1,0], [2,-1]]  // Z_v
        ];

        // High-speed packer algorithm
        for (let r = 0; r < gridH; r++) {
            for (let c = 0; c < gridW; c++) {
                if (bgGrid[r][c] !== 0) continue;

                const shuffled = [...templates].sort(() => Math.random() - 0.5);
                let placed = false;

                for (let shape of shuffled) {
                    let canFit = true;
                    for (let [dr, dc] of shape) {
                        let nr = r + dr;
                        let nc = c + dc;
                        if (nr < 0 || nr >= gridH || nc < 0 || nc >= gridW || bgGrid[nr][nc] !== 0) {
                            canFit = false;
                            break;
                        }
                    }
                    if (canFit) {
                        for (let [dr, dc] of shape) {
                            bgGrid[r + dr][c + dc] = nextBlockId;
                        }
                        nextBlockId++;
                        placed = true;
                        break;
                    }
                }

                if (!placed) bgGrid[r][c] = nextBlockId++;
            }
        }

        pCtx.fillStyle = '#747474';
        pCtx.fillRect(0, 0, patCanvas.width, patCanvas.height);

        const hi = 2; const sh = 2; 
        for (let r = 0; r < gridH; r++) {
            for (let c = 0; c < gridW; c++) {
                const id = bgGrid[r][c];
                const x = c * blockSize;
                const y = r * blockSize;

                const up = (r > 0) ? bgGrid[r - 1][c] : -1;
                const down = (r < gridH - 1) ? bgGrid[r + 1][c] : -1;
                const left = (c > 0) ? bgGrid[r][c - 1] : -1;
                const right = (c < gridW - 1) ? bgGrid[r][c + 1] : -1;

                if (up !== id) { pCtx.fillStyle = '#A8A8A8'; pCtx.fillRect(x, y, blockSize, hi); }
                if (left !== id) { pCtx.fillStyle = '#A8A8A8'; pCtx.fillRect(x, y, hi, blockSize); }
                if (down !== id) { pCtx.fillStyle = '#000000'; pCtx.fillRect(x, y + blockSize - sh, blockSize, sh); }
                if (right !== id) { pCtx.fillStyle = '#000000'; pCtx.fillRect(x + blockSize - sh, y, sh, blockSize); }
            }
        }
        this.bgPatternCanvas = patCanvas;
    }

    init() {
        this.alarms = []; this.activeRings = []; this.hasReceivedData = false;
        this.lastFrameTime = 0;
        this.grid = Array.from({ length: this.gridH }, () => Array(this.gridW).fill(0));
        this.clearedLines = 0;
        this.targetShape = null;
        this.spawnPiece();
    }

    updateAlarms(nextOccurrences) {
        this.alarms = nextOccurrences; 
        this.hasReceivedData = true;
    }

    handleRing(alarm) {
        this.activeRings.push(alarm);
    }

    stopRing() {
        this.activeRings = [];
        if (this.ringClickListener) {
            document.removeEventListener('click', this.ringClickListener);
            this.ringClickListener = null;
            this.canvas.style.cursor = 'default';
        }
    }

    // --- TETRIS LOGIC & SURVIVAL AI ---
    spawnPiece() {
        const type = this.nextPieceType;
        this.nextPieceType = Math.floor(Math.random() * 7) + 1;
        
        this.currentPiece = {
            shape: this.shapes[type],
            type: type,
            x: Math.floor(this.gridW / 2) - Math.floor(this.shapes[type][0].length / 2),
            y: 0
        };

        this.targetShape = null; 
        this.currentRot = 0;

        if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
            this.grid = Array.from({ length: this.gridH }, () => Array(this.gridW).fill(0));
            this.clearedLines = 0;
        }
    }

    rotateMatrix(matrix) {
        const N = matrix.length;
        const M = matrix[0].length;
        let result = Array.from({length: M}, () => Array(N).fill(0));
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < M; c++) {
                result[c][N - 1 - r] = matrix[r][c];
            }
        }
        return result;
    }

    checkCollision(nx, ny, shape) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                let newX = nx + c;
                let newY = ny + r;
                if (newX < 0 || newX >= this.gridW || newY >= this.gridH) return true;
                if (newY >= 0 && this.grid[newY][newX] !== 0) return true;
            }
        }
        return false;
    }

    calculateBestMove() {
        let bestScore = -Infinity;
        let bestX = 0;
        let bestRot = 0;
        let bestShape = this.currentPiece.shape;

        let currentShape = this.currentPiece.shape;
        
        for (let rot = 0; rot < 4; rot++) {
            for (let x = -3; x < this.gridW; x++) {
                if (!this.checkCollision(x, 0, currentShape)) {
                    let y = 0;
                    while (!this.checkCollision(x, y + 1, currentShape)) { y++; }
                    
                    let score = this.evaluateBoard(x, y, currentShape);
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestX = x;
                        bestRot = rot;
                        bestShape = currentShape;
                    }
                }
            }
            currentShape = this.rotateMatrix(currentShape);
        }
        
        this.targetX = bestX;
        this.targetRot = bestRot;
        this.targetShape = bestShape;
    }

    evaluateBoard(x, y, shape) {
        let board = this.grid.map(row => [...row]);
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] && y + r >= 0) {
                    board[y + r][x + c] = 1;
                }
            }
        }

        let lines = 0;
        let newBoard = [];
        for (let r = 0; r < this.gridH; r++) {
            if (board[r].every(cell => cell !== 0)) {
                lines++;
            } else {
                newBoard.push(board[r]);
            }
        }
        while(newBoard.length < this.gridH) newBoard.unshift(Array(this.gridW).fill(0));
        board = newBoard;

        let heights = Array(this.gridW).fill(0);
        let holes = 0;
        let aggregateHeight = 0;
        let bumpiness = 0;

        for (let c = 0; c < this.gridW; c++) {
            let foundTop = false;
            for (let r = 0; r < this.gridH; r++) {
                if (board[r][c] !== 0) {
                    if (!foundTop) {
                        heights[c] = this.gridH - r;
                        aggregateHeight += heights[c];
                        foundTop = true;
                    }
                } else if (foundTop) {
                    holes++;
                }
            }
        }

        for (let c = 0; c < this.gridW - 1; c++) {
            bumpiness += Math.abs(heights[c] - heights[c + 1]);
        }

        let score = 0;
        // Survival Heuristic: Keep it flat, fill holes, clear lines whenever possible
        score -= aggregateHeight * 0.6;
        score -= holes * 25.0; // Massive penalty for holes
        score -= bumpiness * 0.3;
        score += lines * 50.0; // Consistently reward ANY line clear

        return score;
    }

    lockPiece() {
        for (let r = 0; r < this.currentPiece.shape.length; r++) {
            for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
                if (this.currentPiece.shape[r][c]) {
                    let py = this.currentPiece.y + r;
                    let px = this.currentPiece.x + c;
                    if (py >= 0 && py < this.gridH) this.grid[py][px] = this.currentPiece.type;
                }
            }
        }
        this.clearLines();
        this.spawnPiece();
    }

    clearLines() {
        let linesClearedNow = 0;
        for (let r = this.gridH - 1; r >= 0; r--) {
            if (this.grid[r].every(cell => cell !== 0)) {
                this.grid.splice(r, 1);
                this.grid.unshift(Array(this.gridW).fill(0));
                linesClearedNow++;
                r++; 
            }
        }
        this.clearedLines += linesClearedNow;
    }

    updateTetris() {
        if (!this.targetShape) {
            this.calculateBestMove();
        }

        this.dropTimer++;
        if (this.dropTimer > 1) { 
            this.dropTimer = 0;
            
            // --- FIXED: Safe Rotation & Wall Kick Logic ---
            if (this.currentRot !== this.targetRot) {
                let newShape = this.rotateMatrix(this.currentPiece.shape);
                
                // 1. Try rotating in place
                if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y, newShape)) {
                    this.currentPiece.shape = newShape;
                    this.currentRot = (this.currentRot + 1) % 4;
                } 
                // 2. Try wall-kick left
                else if (!this.checkCollision(this.currentPiece.x - 1, this.currentPiece.y, newShape)) {
                    this.currentPiece.shape = newShape;
                    this.currentPiece.x--;
                    this.currentRot = (this.currentRot + 1) % 4;
                } 
                // 3. Try wall-kick right
                else if (!this.checkCollision(this.currentPiece.x + 1, this.currentPiece.y, newShape)) {
                    this.currentPiece.shape = newShape;
                    this.currentPiece.x++;
                    this.currentRot = (this.currentRot + 1) % 4;
                } 
                // 4. Give up on rotation to prevent infinite loop freezing
                else {
                    this.targetRot = this.currentRot; 
                }
                return; 
            }
            
            if (this.currentPiece.x < this.targetX) {
                if(!this.checkCollision(this.currentPiece.x + 1, this.currentPiece.y, this.currentPiece.shape)) {
                    this.currentPiece.x++;
                    return;
                }
            } else if (this.currentPiece.x > this.targetX) {
                if(!this.checkCollision(this.currentPiece.x - 1, this.currentPiece.y, this.currentPiece.shape)) {
                    this.currentPiece.x--;
                    return;
                }
            }
            
            if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
                this.currentPiece.y++;
            } else {
                this.lockPiece();
            }
        }
    }

    // --- EXACT NES RENDERING ---
    drawNESBlock(x, y, size, colorIndex) {
        if (colorIndex === 0) return;
        const isRed = (colorIndex === 1 || colorIndex === 4 || colorIndex === 5);
        const baseColor = isRed ? '#D82800' : '#8800CC'; 
        
        this.ctx.fillStyle = baseColor;
        this.ctx.fillRect(x, y, size, size);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(x, y, size, 2);
        this.ctx.fillRect(x, y, 2, size);
        
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + size - 2, y, 2, size);
        this.ctx.fillRect(x, y + size - 2, size, 2);
        
        this.ctx.fillStyle = '#FFFFFF';
        const innerSize = Math.max(2, Math.floor(size * 0.35));
        this.ctx.fillRect(x + 3, y + 3, innerSize, innerSize);
    }

    drawMiniBlock(x, y, size, colorIndex) {
        if (colorIndex === 0) return;
        const isRed = (colorIndex === 1 || colorIndex === 4 || colorIndex === 5);
        const baseColor = isRed ? '#D82800' : '#8800CC'; 
        
        this.ctx.fillStyle = baseColor;
        this.ctx.fillRect(x, y, size, size);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(x, y, size, 1);
        this.ctx.fillRect(x, y, 1, size);
        
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x + size - 1, y, 1, size);
        this.ctx.fillRect(x, y + size - 1, size, 1);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    }

    drawNESFrame(x, y, w, h) {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x, y, w, h);
        
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, w, h);
        
        this.ctx.strokeStyle = '#3CBCFC'; 
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    }

    drawRetroText(text, x, y, size, color, align = 'left') {
        this.ctx.textAlign = align; 
        this.ctx.textBaseline = 'middle'; 
        this.ctx.font = `${size}px "Press Start 2P", monospace`;
        this.ctx.fillStyle = color; 
        this.ctx.fillText(text, x, y);
    }

    getWrappedLines(text, maxWidth, fontSize) {
        this.ctx.font = `${fontSize}px "Press Start 2P"`;
        const words = text.split(' '); const lines = []; let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = this.ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) { currentLine += " " + word; } 
            else { lines.push(currentLine); currentLine = word; }
        }
        lines.push(currentLine); return lines;
    }

    render(now) {
        if (!this.hasReceivedData) return;
        const nowTime = now.getTime();
        if (nowTime - this.lastFrameTime < 1000 / this.fps) return; 
        this.lastFrameTime = nowTime;

        const nw = this.canvas.width; 
        const nh = this.canvas.height;
        
        const scale = Math.min(nw / this.vw, nh / this.vh);
        const offsetX = (nw - this.vw * scale) / 2;
        const offsetY = (nh - this.vh * scale) / 2;

        this.ctx.save();
        this.ctx.translate(offsetX, offsetY);
        this.ctx.scale(scale, scale);

        const invScale = 1 / scale;
        const bgX = -offsetX * invScale;
        const bgY = -offsetY * invScale;
        const bgW = nw * invScale;
        const bgH = nh * invScale;

        this.ctx.fillStyle = this.ctx.createPattern(this.bgPatternCanvas, 'repeat');
        this.ctx.fillRect(bgX, bgY, bgW, bgH);

        const isRinging = this.activeRings.length > 0;
        if (!isRinging) this.updateTetris();

        const blockSize = 14; 
        const matrixW = blockSize * this.gridW; 
        const matrixH = blockSize * this.gridH; 
        const matrixX = 250; 
        const matrixY = 65;
        const nesOrange = '#F83800';
        const nesCyan = '#3CBCFC';

        // --- DRAW CENTER (MATRIX & TIME) ---
        this.drawNESFrame(238, 10, 164, 46);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        this.drawRetroText("TIME", 320, 24, 10, '#FFFFFF', 'center');
        this.drawRetroText(timeStr, 320, 42, 16, '#FFFFFF', 'center');

        this.drawNESFrame(matrixX - 4, matrixY - 4, matrixW + 8, matrixH + 8);
        
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(matrixX, matrixY, matrixW, matrixH);
        this.ctx.clip();

        for (let r = 0; r < this.gridH; r++) {
            for (let c = 0; c < this.gridW; c++) {
                if (this.grid[r][c] !== 0) {
                    this.drawNESBlock(matrixX + c * blockSize, matrixY + r * blockSize, blockSize, this.grid[r][c]);
                }
            }
        }
        if (this.currentPiece) {
            for (let r = 0; r < this.currentPiece.shape.length; r++) {
                for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
                    if (this.currentPiece.shape[r][c]) {
                        this.drawNESBlock(matrixX + (this.currentPiece.x + c) * blockSize, matrixY + (this.currentPiece.y + r) * blockSize, blockSize, this.currentPiece.type);
                    }
                }
            }
        }
        this.ctx.restore();

        // --- DRAW LEFT PANEL (A-TYPE & STATISTICS) ---
        this.drawNESFrame(85, 55, 100, 32);
        this.drawRetroText("A-TYPE", 135, 71, 12, '#FFFFFF', 'center');

        this.drawNESFrame(30, 100, 190, 245);
        this.drawRetroText("UPCOMING", 125, 118, 12, '#FFFFFF', 'center');

        const elevenHoursMs = 11 * 60 * 60 * 1000;
        const visibleAlarms = this.alarms.filter(occ => (occ.date - nowTime) <= elevenHoursMs);
        const futureAlarms = visibleAlarms.slice(1, 5); 
        
        let startY = 145;
        const maxBottomY = 340; 
        
        futureAlarms.forEach((occ, index) => {
            const tr = Math.max(0, occ.date - nowTime);
            const hrs = Math.floor(tr / 3600000).toString().padStart(2, '0');
            const mins = Math.floor((tr % 3600000) / 60000).toString().padStart(2, '0');
            const secs = Math.floor((tr % 60000) / 1000).toString().padStart(2, '0');
            
            const label = (occ.alarm.label || 'ALARM').toUpperCase();
            const lines = this.getWrappedLines(label, 125, 10); 
            
            const textHeight = lines.length * 14;
            const requiredSpace = Math.max(textHeight, 14) + 25;
            
            if (startY + requiredSpace > maxBottomY) return;

            const shapeType = (index % 7) + 1;
            const shape = this.shapes[shapeType];
            const miniSize = 6;
            
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (shape[r][c]) {
                        this.drawMiniBlock(40 + (c * miniSize), startY + (r * miniSize), miniSize, shapeType);
                    }
                }
            }
            
            lines.forEach((line, i) => {
                this.drawRetroText(line, 80, startY + 4 + (i * 14), 10, nesCyan, 'left');
            });
            
            this.drawRetroText(`${hrs}:${mins}:${secs}`, 205, startY + textHeight + 10, 12, nesOrange, 'right');
            
            startY += requiredSpace;
        });

        // --- DRAW RIGHT PANEL (NEXT ALARM, NEXT PIECE, LEVEL) ---
        this.drawNESFrame(420, 55, 170, 95);
        this.drawRetroText("NEXT ALARM", 505, 70, 12, '#FFFFFF', 'center');
        
        const nextAlarm = visibleAlarms[0];
        if (nextAlarm) {
            const tr = Math.max(0, nextAlarm.date - nowTime);
            const hrs = Math.floor(tr / 3600000).toString().padStart(2, '0');
            const mins = Math.floor((tr % 3600000) / 60000).toString().padStart(2, '0');
            const secs = Math.floor((tr % 60000) / 1000).toString().padStart(2, '0');
            
            const label = (nextAlarm.alarm.label || 'ALARM').toUpperCase();
            const lines = this.getWrappedLines(label, 150, 10);
            
            let startLabelY = 88;
            lines.slice(0, 3).forEach((line, i) => {
                this.drawRetroText(line, 505, startLabelY + (i * 12), 10, nesCyan, 'center');
            });
            
            this.drawRetroText(`${hrs}:${mins}:${secs}`, 505, 132, 16, nesOrange, 'center');
        } else {
            this.drawRetroText("00:00:00", 505, 132, 16, '#FFFFFF', 'center');
        }

        this.drawNESFrame(470, 165, 70, 70);
        this.drawRetroText("NEXT", 505, 180, 10, '#FFFFFF', 'center');
        
        const npShape = this.shapes[this.nextPieceType];
        if (npShape) {
            const pW = npShape[0].length * blockSize;
            const pH = npShape.length * blockSize;
            const px = 470 + (70 - pW) / 2;
            const py = 212.5 - (pH / 2); 
            
            for (let r = 0; r < npShape.length; r++) {
                for (let c = 0; c < npShape[r].length; c++) {
                    if (npShape[r][c]) {
                        this.drawNESBlock(px + c * blockSize, py + r * blockSize, blockSize, this.nextPieceType);
                    }
                }
            }
        }

        this.drawNESFrame(470, 250, 70, 50);
        this.drawRetroText("LEVEL", 505, 268, 10, '#FFFFFF', 'center');
        this.drawRetroText("07", 505, 285, 14, nesOrange, 'center');

        // --- ALARM RINGING MODAL ---
        if (isRinging) {
            if (!this.ringClickListener) {
                this.ringClickListener = () => window.stopAlarm();
                setTimeout(() => document.addEventListener('click', this.ringClickListener), 50);
                this.canvas.style.cursor = 'pointer';
            }
            const ncx = this.vw / 2;
            const labelText = (this.activeRings[0].label || 'ALARM').toUpperCase();
            const modalFontSize = 36;
            const modalWidth = Math.min(500, this.vw * 0.8);
            const modalLines = this.getWrappedLines(labelText, modalWidth - 60, modalFontSize);
            const modalLineHeight = modalFontSize + 10;
            const boxH = (modalLines.length * modalLineHeight) + 120;
            const boxY = this.vh / 2 - boxH / 2;
            
            this.drawNESFrame(ncx - modalWidth/2, boxY, modalWidth, boxH);
            
            modalLines.forEach((line, i) => { 
                this.drawRetroText(line, ncx, boxY + 50 + (i * modalLineHeight), modalFontSize, '#FFFFFF', 'center'); 
            });
            
            if (Math.floor(Date.now() / 250) % 2 === 0) {
                this.drawRetroText("► PUSH START ◄", ncx, boxY + boxH - 40, 24, nesOrange, 'center'); 
            }
        }
        
        this.ctx.restore();
    }

    destroy() { 
        this.stopRing(); 
    }
}
