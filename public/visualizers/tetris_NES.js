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
        
        // --- GAME STATE ---
        this.gridW = 10; this.gridH = 20;
        this.grid = Array.from({ length: this.gridH }, () => Array(this.gridW).fill(0));
        this.dropTimer = 0; 
        this.currentPiece = null;
        this.nextPieceType = Math.floor(Math.random() * 7) + 1;
        
        this.totalLines = 0;
        this.level = 0;
        this.score = 0;
        this.isManual = false;
        this.isPaused = false;
        this.gameState = 'PLAYING'; // 'PLAYING', 'ANIMATING_CLEAR', 'GAMEOVER_INPUT'
        this.playerNameInput = '';
        this.animatingLines = [];
        this.animationTimer = 0;

        try {
            this.highScore = parseInt(localStorage.getItem('tetrisHighScore')) || 0;
            this.highName = localStorage.getItem('tetrisHighName') || 'AAA';
        } catch(e) {
            this.highScore = 0;
            this.highName = 'AAA';
        }

        this.targetX = 0;
        this.targetRot = 0;
        this.currentRot = 0;
        this.targetShape = null;

        // NES Authentic Level Palettes
        this.palettes = [
            { primary: '#0058F8', secondary: '#3CBCFC' }, // 0: Blue / Cyan
            { primary: '#00A800', secondary: '#88D800' }, // 1: Green / Lime
            { primary: '#D800CC', secondary: '#F878F8' }, // 2: Purple / Pink
            { primary: '#0058F8', secondary: '#58D854' }, // 3: Blue / Light Green
            { primary: '#E40058', secondary: '#58F898' }, // 4: Magenta / Sea Green
            { primary: '#58F898', secondary: '#6888FC' }, // 5: Sea Green / Light Blue
            { primary: '#F83800', secondary: '#7C7C7C' }, // 6: Red / Grey
            { primary: '#D82800', secondary: '#8800CC' }, // 7: Orange-Red / Purple
            { primary: '#0058F8', secondary: '#F83800' }, // 8: Blue / Red
            { primary: '#F83800', secondary: '#F87858' }  // 9: Red / Orange
        ];

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

        // Keyboard Listener
        this.keyHandler = (e) => this.handleKeyDown(e);
        window.addEventListener('keydown', this.keyHandler);

        this.createProceduralBackground();
        this.createFloatingUI();
    }

    // --- HTML DOM OVERLAY ---
    createFloatingUI() {
        if (this.uiContainer) return;

        this.uiContainer = document.createElement('div');
        this.uiContainer.style.cssText = 'position: fixed; top: 80px; right: 20px; display: flex; flex-direction: column; gap: 15px; z-index: 99999;';
        
        const btnStyle = `
            width: 44px; height: 44px; border-radius: 50%;
            background: rgba(0, 0, 0, 0.7); border: 2px solid #FFFFFF;
            color: #FFFFFF; font-size: 20px; cursor: pointer;
            display: flex; justify-content: center; align-items: center;
            opacity: 0.25; transition: opacity 0.2s, border-color 0.2s;
            position: relative; overflow: hidden; padding: 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3); outline: none;
        `;

        // Controller Button
        this.modeBtn = document.createElement('button');
        this.modeBtn.style.cssText = btnStyle;
        this.modeBtn.innerHTML = `🎮`;
        
        // Red Slash for "AI Mode"
        this.slash = document.createElement('div');
        this.slash.style.cssText = 'position:absolute; width:3px; height:36px; background:#F83800; transform:rotate(45deg); border: 1px solid #000;';
        this.modeBtn.appendChild(this.slash);

        // Hover Effects
        this.modeBtn.onmouseenter = () => this.modeBtn.style.opacity = '1';
        this.modeBtn.onmouseleave = () => this.modeBtn.style.opacity = '0.25';

        // Click Logic
        this.modeBtn.onclick = () => {
            if (this.activeRings.length > 0) return;
            this.isManual = !this.isManual;
            this.slash.style.display = this.isManual ? 'none' : 'block';
            this.resetGame();
        };

        this.uiContainer.appendChild(this.modeBtn);
        document.body.appendChild(this.uiContainer);
    }

    createProceduralBackground() {
        const patCanvas = document.createElement('canvas');
        const blockSize = 14; 
        const gridW = 100; const gridH = 100;
        patCanvas.width = blockSize * gridW; patCanvas.height = blockSize * gridH;
        const pCtx = patCanvas.getContext('2d');

        const bgGrid = Array.from({ length: gridH }, () => Array(gridW).fill(0));
        let nextBlockId = 1;

        const templates = [
            [[0,0], [0,1], [1,0], [1,1]], [[0,0], [0,1], [0,2], [0,3]], [[0,0], [1,0], [2,0], [3,0]], 
            [[0,0], [0,1], [0,2], [1,1]], [[0,0], [1,-1], [1,0], [2,0]], [[0,0], [1,-1], [1,0], [1,1]], 
            [[0,0], [1,0], [1,1], [2,0]], [[0,0], [0,1], [0,2], [1,0]], [[0,0], [0,1], [1,1], [2,1]], 
            [[0,0], [1,-2], [1,-1], [1,0]], [[0,0], [1,0], [2,0], [2,1]], [[0,0], [0,1], [0,2], [1,2]], 
            [[0,0], [1,0], [2,-1], [2,0]], [[0,0], [1,0], [1,1], [1,2]], [[0,0], [0,1], [1,0], [2,0]], 
            [[0,0], [0,1], [1,-1], [1,0]], [[0,0], [1,0], [1,1], [2,1]], [[0,0], [0,1], [1,1], [1,2]], 
            [[0,0], [1,-1], [1,0], [2,-1]] 
        ];

        for (let r = 0; r < gridH; r++) {
            for (let c = 0; c < gridW; c++) {
                if (bgGrid[r][c] !== 0) continue;
                const shuffled = [...templates].sort(() => Math.random() - 0.5);
                let placed = false;
                for (let shape of shuffled) {
                    let canFit = true;
                    for (let [dr, dc] of shape) {
                        let nr = r + dr; let nc = c + dc;
                        if (nr < 0 || nr >= gridH || nc < 0 || nc >= gridW || bgGrid[nr][nc] !== 0) {
                            canFit = false; break;
                        }
                    }
                    if (canFit) {
                        for (let [dr, dc] of shape) bgGrid[r + dr][c + dc] = nextBlockId;
                        nextBlockId++; placed = true; break;
                    }
                }
                if (!placed) bgGrid[r][c] = nextBlockId++;
            }
        }

        pCtx.fillStyle = '#747474'; pCtx.fillRect(0, 0, patCanvas.width, patCanvas.height);
        const hi = 2; const sh = 2; 
        for (let r = 0; r < gridH; r++) {
            for (let c = 0; c < gridW; c++) {
                const id = bgGrid[r][c];
                const x = c * blockSize; const y = r * blockSize;
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
        this.resetGame();
    }

    resetGame() {
        this.grid = Array.from({ length: this.gridH }, () => Array(this.gridW).fill(0));
        this.totalLines = 0;
        this.level = 0;
        this.score = 0;
        this.targetShape = null;
        this.isPaused = false;
        this.gameState = 'PLAYING';
        this.animatingLines = [];
        this.animationTimer = 0;
        this.spawnPiece();
    }

    updateAlarms(nextOccurrences) {
        this.alarms = nextOccurrences; 
        this.hasReceivedData = true;
    }

    handleRing(alarm) {
        this.activeRings.push(alarm);
        if (this.isManual && this.gameState === 'PLAYING') {
            this.isPaused = true;
        }
    }

    stopRing() {
        this.activeRings = [];
        if (this.ringClickListener) {
            document.removeEventListener('click', this.ringClickListener);
            this.ringClickListener = null;
            this.canvas.style.cursor = 'default';
        }
    }

    handleKeyDown(e) {
        if (this.activeRings.length > 0) return;

        // High Score Name Entry Mode
        if (this.gameState === 'GAMEOVER_INPUT') {
            if (/^[a-zA-Z]$/.test(e.key) && this.playerNameInput.length < 3) {
                this.playerNameInput += e.key.toUpperCase();
            } else if (e.key === 'Backspace') {
                this.playerNameInput = this.playerNameInput.slice(0, -1);
            } else if (e.key === 'Enter' && this.playerNameInput.length === 3) {
                this.highScore = this.score;
                this.highName = this.playerNameInput;
                try {
                    localStorage.setItem('tetrisHighScore', this.highScore);
                    localStorage.setItem('tetrisHighName', this.highName);
                } catch(e) {}
                this.resetGame();
            }
            return;
        }

        // Standard Gameplay Input
        if (!this.isManual) return;
        
        // Handle Pause Toggle with 'P'
        if (e.key.toLowerCase() === 'p' && this.gameState === 'PLAYING') {
            this.isPaused = !this.isPaused;
            return;
        }

        if (this.isPaused || this.gameState !== 'PLAYING') return;
        
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
            e.preventDefault(); 
        }

        if (e.key === 'ArrowLeft') {
            if (!this.checkCollision(this.currentPiece.x - 1, this.currentPiece.y, this.currentPiece.shape)) {
                this.currentPiece.x--;
            }
        } else if (e.key === 'ArrowRight') {
            if (!this.checkCollision(this.currentPiece.x + 1, this.currentPiece.y, this.currentPiece.shape)) {
                this.currentPiece.x++;
            }
        } else if (e.key === 'ArrowDown') {
            if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
                this.currentPiece.y++;
                this.score += 1; 
            }
        } else if (e.key === 'ArrowUp') {
            let newShape = this.rotateMatrix(this.currentPiece.shape);
            if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y, newShape)) {
                this.currentPiece.shape = newShape;
            } else if (!this.checkCollision(this.currentPiece.x - 1, this.currentPiece.y, newShape)) {
                this.currentPiece.shape = newShape; this.currentPiece.x--;
            } else if (!this.checkCollision(this.currentPiece.x + 1, this.currentPiece.y, newShape)) {
                this.currentPiece.shape = newShape; this.currentPiece.x++;
            }
        } else if (e.key === ' ') {
            let dropDist = 0;
            while (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
                this.currentPiece.y++;
                dropDist++;
            }
            this.score += dropDist * 2; 
            this.lockPiece();
        }
    }

    // --- TETRIS LOGIC ---
    spawnPiece() {
        const type = this.nextPieceType;
        this.nextPieceType = Math.floor(Math.random() * 7) + 1;
        
        this.currentPiece = {
            shape: this.shapes[type], type: type,
            x: Math.floor(this.gridW / 2) - Math.floor(this.shapes[type][0].length / 2),
            y: 0
        };

        this.targetShape = null; 
        this.currentRot = 0;

        if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
            if (this.isManual && this.score > this.highScore) {
                this.gameState = 'GAMEOVER_INPUT';
                this.playerNameInput = '';
            } else {
                this.resetGame();
            }
        }
    }

    rotateMatrix(matrix) {
        const N = matrix.length; const M = matrix[0].length;
        let result = Array.from({length: M}, () => Array(N).fill(0));
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < M; c++) result[c][N - 1 - r] = matrix[r][c];
        }
        return result;
    }

    checkCollision(nx, ny, shape) {
        if (!shape) return true;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                let newX = nx + c; let newY = ny + r;
                if (newX < 0 || newX >= this.gridW || newY >= this.gridH) return true;
                if (newY >= 0 && this.grid[newY][newX] !== 0) return true;
            }
        }
        return false;
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
        this.currentPiece = null; // Hide piece during check/animation
        this.checkLines();
    }

    checkLines() {
        this.animatingLines = [];
        for (let r = 0; r < this.gridH; r++) {
            if (this.grid[r].every(cell => cell !== 0)) {
                this.animatingLines.push(r);
            }
        }

        if (this.animatingLines.length > 0) {
            this.gameState = 'ANIMATING_CLEAR';
            this.animationTimer = 15; // 15 frames for the classic center-out clear
        } else {
            this.spawnPiece();
        }
    }

    executeLineClear() {
        let linesClearedNow = this.animatingLines.length;
        let newGrid = [];
        
        // Filter out cleared lines
        for (let r = 0; r < this.gridH; r++) {
            if (!this.animatingLines.includes(r)) {
                newGrid.push(this.grid[r]);
            }
        }
        
        // Pad top with empty lines
        while (newGrid.length < this.gridH) {
            newGrid.unshift(Array(this.gridW).fill(0));
        }
        
        this.grid = newGrid;
        
        const baseScores = [0, 40, 100, 300, 1200];
        this.score += baseScores[linesClearedNow] * (this.level + 1);
        this.totalLines += linesClearedNow;
        this.level = Math.floor(this.totalLines / 10);
        
        this.animatingLines = [];
        this.gameState = 'PLAYING';
        this.spawnPiece();
    }

    // --- MANUAL LOOP ---
    updateManual() {
        this.dropTimer++;
        const speed = Math.max(2, 24 - (this.level * 2)); 
        if (this.dropTimer > speed) {
            this.dropTimer = 0;
            if (this.currentPiece && !this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
                this.currentPiece.y++;
            } else {
                this.lockPiece();
            }
        }
    }

    // --- AI LOOP ---
    calculateBestMove() {
        let bestScore = -Infinity;
        let bestX = 0; let bestRot = 0; let bestShape = this.currentPiece.shape;
        let currentShape = this.currentPiece.shape;
        
        for (let rot = 0; rot < 4; rot++) {
            for (let x = -3; x < this.gridW; x++) {
                if (!this.checkCollision(x, 0, currentShape)) {
                    let y = 0;
                    while (!this.checkCollision(x, y + 1, currentShape)) { y++; }
                    let score = this.evaluateBoard(x, y, currentShape);
                    if (score > bestScore) {
                        bestScore = score; bestX = x; bestRot = rot; bestShape = currentShape;
                    }
                }
            }
            currentShape = this.rotateMatrix(currentShape);
        }
        this.targetX = bestX; this.targetRot = bestRot; this.targetShape = bestShape;
    }

    evaluateBoard(x, y, shape) {
        let board = this.grid.map(row => [...row]);
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] && y + r >= 0) board[y + r][x + c] = 1;
            }
        }

        let lines = 0; let newBoard = [];
        for (let r = 0; r < this.gridH; r++) {
            if (board[r].every(cell => cell !== 0)) lines++;
            else newBoard.push(board[r]);
        }
        while(newBoard.length < this.gridH) newBoard.unshift(Array(this.gridW).fill(0));
        board = newBoard;

        let heights = Array(this.gridW).fill(0);
        let holes = 0; let aggregateHeight = 0; let bumpiness = 0;

        for (let c = 0; c < this.gridW; c++) {
            let foundTop = false;
            for (let r = 0; r < this.gridH; r++) {
                if (board[r][c] !== 0) {
                    if (!foundTop) { heights[c] = this.gridH - r; aggregateHeight += heights[c]; foundTop = true; }
                } else if (foundTop) { holes++; }
            }
        }
        for (let c = 0; c < this.gridW - 1; c++) bumpiness += Math.abs(heights[c] - heights[c + 1]);

        let score = 0;
        score -= aggregateHeight * 0.6;
        score -= holes * 25.0; 
        score -= bumpiness * 0.3;
        score += lines * 50.0; 
        return score;
    }

    updateTetris() {
        if (!this.targetShape) this.calculateBestMove();
        this.dropTimer++;
        if (this.dropTimer > 1) { 
            this.dropTimer = 0;
            
            if (this.currentRot !== this.targetRot) {
                let newShape = this.rotateMatrix(this.currentPiece.shape);
                if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y, newShape)) {
                    this.currentPiece.shape = newShape; this.currentRot = (this.currentRot + 1) % 4;
                } else if (!this.checkCollision(this.currentPiece.x - 1, this.currentPiece.y, newShape)) {
                    this.currentPiece.shape = newShape; this.currentPiece.x--; this.currentRot = (this.currentRot + 1) % 4;
                } else if (!this.checkCollision(this.currentPiece.x + 1, this.currentPiece.y, newShape)) {
                    this.currentPiece.shape = newShape; this.currentPiece.x++; this.currentRot = (this.currentRot + 1) % 4;
                } else {
                    this.targetRot = this.currentRot; 
                }
                return; 
            }
            
            if (this.currentPiece.x < this.targetX) {
                if(!this.checkCollision(this.currentPiece.x + 1, this.currentPiece.y, this.currentPiece.shape)) {
                    this.currentPiece.x++; return;
                }
            } else if (this.currentPiece.x > this.targetX) {
                if(!this.checkCollision(this.currentPiece.x - 1, this.currentPiece.y, this.currentPiece.shape)) {
                    this.currentPiece.x--; return;
                }
            }
            
            if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
                this.currentPiece.y++;
            } else {
                this.lockPiece();
            }
        }
    }

    // --- UI DRAWING EXPERT ---
    drawNESBlock(x, y, size, colorIndex) {
        if (colorIndex === 0) return;
        
        const p = this.palettes[this.level % 10];
        const isPrimary = (colorIndex === 1 || colorIndex === 4 || colorIndex === 5);
        const baseColor = isPrimary ? p.primary : p.secondary; 
        
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
        
        const p = this.palettes[this.level % 10];
        const isPrimary = (colorIndex === 1 || colorIndex === 4 || colorIndex === 5);
        const baseColor = isPrimary ? p.primary : p.secondary; 
        
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
        
        // Handle Game States & Logic Updates
        if (!isRinging) {
            if (this.gameState === 'ANIMATING_CLEAR') {
                this.animationTimer--;
                if (this.animationTimer <= 0) {
                    this.executeLineClear();
                }
            } else if (this.gameState === 'PLAYING') {
                if (this.isManual) {
                    if (!this.isPaused) this.updateManual();
                } else {
                    this.updateTetris();
                }
            }
        }

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
            let isAnimatingRow = this.animatingLines.includes(r);
            // Hide cols spreading from center (cols 4,5) outwards over 15 frames
            let hideCols = isAnimatingRow ? Math.floor((15 - this.animationTimer) / 3) : -1; 

            for (let c = 0; c < this.gridW; c++) {
                if (this.grid[r][c] !== 0) {
                    if (isAnimatingRow) {
                        let distFromCenter = c < 5 ? 4 - c : c - 5; 
                        if (distFromCenter <= hideCols) continue; // Skip drawing this block for animation
                    }
                    this.drawNESBlock(matrixX + c * blockSize, matrixY + r * blockSize, blockSize, this.grid[r][c]);
                }
            }
        }
        
        if (this.currentPiece && this.gameState === 'PLAYING') {
            for (let r = 0; r < this.currentPiece.shape.length; r++) {
                for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
                    if (this.currentPiece.shape[r][c]) {
                        this.drawNESBlock(matrixX + (this.currentPiece.x + c) * blockSize, matrixY + (this.currentPiece.y + r) * blockSize, blockSize, this.currentPiece.type);
                    }
                }
            }
        }
        this.ctx.restore();

        if (this.isPaused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(matrixX, matrixY, matrixW, matrixH);
            this.drawRetroText("PAUSED", matrixX + matrixW/2, matrixY + matrixH/2, 14, '#FFFFFF', 'center');
        }

        // --- DRAW LEFT PANEL (LINES & STATISTICS) ---
        this.drawNESFrame(85, 55, 120, 32);
        this.drawRetroText(`LINES-${this.totalLines.toString().padStart(3, '0')}`, 145, 71, 10, '#FFFFFF', 'center');

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

        // --- DRAW RIGHT PANEL (SCORE, NEXT ALARM, NEXT PIECE, LEVEL) ---
        this.drawNESFrame(420, 10, 170, 42);
        this.drawRetroText("TOP", 430, 22, 10, '#FFFFFF', 'left');
        this.drawRetroText(`${this.highName} ${this.highScore.toString().padStart(6, '0')}`, 580, 22, 10, nesOrange, 'right');
        this.drawRetroText("SCORE", 430, 38, 10, '#FFFFFF', 'left');
        this.drawRetroText(this.score.toString().padStart(6, '0'), 580, 38, 10, '#FFFFFF', 'right');

        this.drawNESFrame(420, 58, 170, 95);
        this.drawRetroText("NEXT ALARM", 505, 73, 12, '#FFFFFF', 'center');
        
        const nextAlarm = visibleAlarms[0];
        if (nextAlarm) {
            const tr = Math.max(0, nextAlarm.date - nowTime);
            const hrs = Math.floor(tr / 3600000).toString().padStart(2, '0');
            const mins = Math.floor((tr % 3600000) / 60000).toString().padStart(2, '0');
            const secs = Math.floor((tr % 60000) / 1000).toString().padStart(2, '0');
            
            const label = (nextAlarm.alarm.label || 'ALARM').toUpperCase();
            const lines = this.getWrappedLines(label, 150, 10);
            
            let startLabelY = 91;
            lines.slice(0, 3).forEach((line, i) => {
                this.drawRetroText(line, 505, startLabelY + (i * 12), 10, nesCyan, 'center');
            });
            
            this.drawRetroText(`${hrs}:${mins}:${secs}`, 505, 135, 16, nesOrange, 'center');
        } else {
            this.drawRetroText("00:00:00", 505, 135, 16, '#FFFFFF', 'center');
        }

        this.drawNESFrame(470, 160, 70, 70);
        this.drawRetroText("NEXT", 505, 175, 10, '#FFFFFF', 'center');
        
        const npShape = this.shapes[this.nextPieceType];
        if (npShape) {
            const pW = npShape[0].length * blockSize;
            const pH = npShape.length * blockSize;
            const px = 470 + (70 - pW) / 2;
            const py = 207.5 - (pH / 2); 
            
            for (let r = 0; r < npShape.length; r++) {
                for (let c = 0; c < npShape[r].length; c++) {
                    if (npShape[r][c]) {
                        this.drawNESBlock(px + c * blockSize, py + r * blockSize, blockSize, this.nextPieceType);
                    }
                }
            }
        }

        this.drawNESFrame(470, 240, 70, 50);
        this.drawRetroText("LEVEL", 505, 258, 10, '#FFFFFF', 'center');
        this.drawRetroText(this.level.toString().padStart(2, '0'), 505, 275, 14, nesOrange, 'center');

        if (this.isManual) {
            this.drawNESFrame(420, 298, 170, 55);
            // Reduced 'CONTROLS' title size and adjusted Y-spacing
            this.drawRetroText("CONTROLS", 505, 308, 8, nesCyan, 'center');
            this.drawRetroText("ARROWS: MOVE/ROTATE", 505, 320, 7, '#FFFFFF', 'center');
            this.drawRetroText("SPACE: HARD DROP", 505, 331, 7, '#FFFFFF', 'center');
            this.drawRetroText("P: PAUSE", 505, 342, 7, '#FFFFFF', 'center');
        }

        // --- NEW HIGH SCORE MODAL ---
        if (this.gameState === 'GAMEOVER_INPUT') {
            const ncx = this.vw / 2;
            const boxH = 140; const boxY = this.vh / 2 - boxH / 2;
            this.drawNESFrame(ncx - 180, boxY, 360, boxH);
            
            this.drawRetroText("NEW HIGH SCORE!", ncx, boxY + 40, 16, nesOrange, 'center');
            this.drawRetroText("ENTER NAME:", ncx, boxY + 75, 12, '#FFFFFF', 'center');
            
            const cursor = (Math.floor(Date.now() / 300) % 2 === 0) ? '_' : ' ';
            let displayString = this.playerNameInput;
            if (displayString.length < 3) displayString += cursor;
            
            this.drawRetroText(displayString, ncx, boxY + 105, 16, nesCyan, 'center');
        }

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
        window.removeEventListener('keydown', this.keyHandler);
        
        if (this.uiContainer && document.body.contains(this.uiContainer)) {
            document.body.removeChild(this.uiContainer);
        }
    }
}
