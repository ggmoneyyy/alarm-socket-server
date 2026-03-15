export default class DeparturesVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.alarms = [];
        this.activeRings = [];
        this.ringClickListener = null;
        
        // Timer states for the 3-second delay
        this.ringStartTime = 0;
        this.hasModalOpened = false;
        
        // Board Configuration
        this.cols = 38; 
        this.rows = 12;  // Expanded to 12 rows to fill large monitors!
        this.grid = [];
        
        this.charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 :+-()[]/".split('');
    }

    init() {
        this.alarms = [];
        this.activeRings = [];
        this.grid = [];
        this.ringStartTime = 0;
        this.hasModalOpened = false;
        
        for (let r = 0; r < this.rows; r++) {
            let row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push({
                    target: ' ',
                    current: ' ',
                    display: ' ',
                    flipTicks: 0 
                });
            }
            this.grid.push(row);
        }
    }

    updateAlarms(nextOccurrences) {
        this.alarms = nextOccurrences;
    }

    handleRing(alarm) {
        this.activeRings.push(alarm);
        
        if (this.activeRings.length === 1) {
            this.ringStartTime = Date.now();
            this.hasModalOpened = false;
        }
    }

    stopRing() {
        this.activeRings = [];
        this.ringStartTime = 0;
        this.hasModalOpened = false;
        
        if (this.ringClickListener) {
            document.removeEventListener('click', this.ringClickListener);
            this.ringClickListener = null;
            this.canvas.style.cursor = 'default';
        }
    }

    generateRowStrings(now) {
        let strings = [];
        strings.push("TIME      EVENT                         ");

        const visibleAlarms = this.alarms.filter(occ => {
            return !this.activeRings.some(ring => ring.id === occ.alarm.id);
        });

        // Loop dynamically up to the maximum number of data rows
        for (let i = 0; i < this.rows - 1; i++) {
            if (i < visibleAlarms.length) {
                const occ = visibleAlarms[i];
                let diffMs = Math.max(0, occ.date - now);
                
                const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
                const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
                const s = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
                
                const timeStr = `${h}:${m}:${s}`;
                let label = (occ.alarm.label || 'ALARM').toUpperCase();
                
                if (label.length > 28) label = label.substring(0, 25) + "...";
                label = label.padEnd(28, ' ');

                strings.push(`${timeStr}  ${label}`);
            } else {
                strings.push("                                      ");
            }
        }
        return strings;
    }

    render(now) {
        const padding = 4; 
        
        // --- NEW OMNI-DIRECTIONAL SCALING MATH ---
        const maxAllowedWidth = Math.min(this.canvas.width * 0.95, 1600);
        // Leave ~22% of screen height for margins, headers, and the massive clock
        const maxAllowedHeight = this.canvas.height * 0.78; 
        
        // First try scaling by width
        let cellW = (maxAllowedWidth - (this.cols * padding)) / this.cols;
        let cellH = cellW * 1.6; 
        
        // If the resulting board is too tall for the screen, shrink it based on height instead
        const expectedBoardH = (cellH * this.rows) + (padding * this.rows);
        if (expectedBoardH > maxAllowedHeight) {
            cellH = (maxAllowedHeight - (padding * this.rows)) / this.rows;
            cellW = cellH / 1.6;
        }

        const boardW = (cellW * this.cols) + (padding * this.cols);
        const boardH = (cellH * this.rows) + (padding * this.rows);
        
        const startX = (this.canvas.width - boardW) / 2;
        // Shift startY down slightly to give the giant clock breathing room
        const startY = (this.canvas.height - boardH) / 2 + 60; 

        const isRinging = this.activeRings.length > 0;
        const timeSinceRing = isRinging ? Date.now() - this.ringStartTime : 0;
        const showModal = isRinging && timeSinceRing > 3000; 
        const isMajorShuffle = isRinging && !showModal;

        // Background
        this.ctx.fillStyle = '#1c1c1c'; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Header
        const headerY = startY - 90;
        const iconSize = 54; 
        this.ctx.strokeStyle = '#ffcc00';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        if (this.ctx.roundRect) this.ctx.roundRect(startX, headerY, iconSize * 1.4, iconSize, 8);
        else this.ctx.strokeRect(startX, headerY, iconSize * 1.4, iconSize);
        this.ctx.stroke();

        this.ctx.save();
        this.ctx.translate(startX + (iconSize * 1.4)/2, headerY + iconSize/2);
        this.ctx.fillStyle = '#ffcc00';
        
        this.ctx.fillRect(-16, 14, 32, 4); 
        this.ctx.rotate(-Math.PI / 7); 
        
        this.ctx.beginPath();
        if (this.ctx.roundRect) this.ctx.roundRect(-14, -3, 28, 6, 3);
        else this.ctx.rect(-14, -3, 28, 6);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.moveTo(-2, 0);
        this.ctx.lineTo(-8, -14);
        this.ctx.lineTo(-3, -14);
        this.ctx.lineTo(4, 0);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.moveTo(-10, -2);
        this.ctx.lineTo(-14, -10);
        this.ctx.lineTo(-10, -10);
        this.ctx.lineTo(-7, -2);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.moveTo(-2, 2);
        this.ctx.lineTo(-5, 8);
        this.ctx.lineTo(-2, 8);
        this.ctx.lineTo(2, 2);
        this.ctx.fill();
        
        this.ctx.restore();

        this.ctx.textAlign = 'left';
        this.ctx.font = 'bold 50px "Helvetica Neue", Helvetica, Arial, sans-serif';
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.fillText('Departures', startX + (iconSize * 1.4) + 20, headerY + iconSize/2 + 4);

        // Massive Clock
        const ch = now.getHours().toString().padStart(2, '0');
        const cm = now.getMinutes().toString().padStart(2, '0');
        const cs = now.getSeconds().toString().padStart(2, '0');
        const clockStr = `${ch}:${cm}:${cs}`;
        
        const cFlapW = cellW * 2.0;
        const cFlapH = cellH * 2.2;
        const cTotalW = (clockStr.length * cFlapW) + (clockStr.length * padding);
        const cStartX = startX + boardW - cTotalW + padding;
        
        this.ctx.textAlign = 'center';
        this.ctx.font = `bold ${cFlapH * 0.8}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

        for(let i = 0; i < clockStr.length; i++) {
            const char = clockStr[i];
            const fx = cStartX + (i * (cFlapW + padding));
            const fy = headerY + (iconSize/2) - (cFlapH/2);
            
            this.ctx.fillStyle = '#050505';
            this.ctx.beginPath();
            if (this.ctx.roundRect) this.ctx.roundRect(fx, fy, cFlapW, cFlapH, 6);
            else this.ctx.rect(fx, fy, cFlapW, cFlapH);
            this.ctx.fill();

            this.ctx.fillStyle = '#ffcc00';
            this.ctx.fillText(char, fx + cFlapW/2, fy + cFlapH/2 + 2);

            this.ctx.fillStyle = '#1c1c1c';
            this.ctx.fillRect(fx, fy + cFlapH/2 - 1, cFlapW, 3);
        }

        const targetStrings = this.generateRowStrings(now);
        
        for (let r = 0; r < this.rows; r++) {
            let rowStr = targetStrings[r];
            for (let c = 0; c < this.cols; c++) {
                let char = rowStr[c] || ' ';
                let cell = this.grid[r][c];
                
                if (cell.target !== char) {
                    cell.target = char;
                    if (isMajorShuffle) {
                        cell.flipTicks = Math.floor(Math.random() * 20) + 90 + (r * 8); 
                    } else {
                        cell.flipTicks = Math.floor(Math.random() * 8) + 4; 
                    }
                }
            }
        }

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = `bold ${cellH * 0.8}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let cell = this.grid[r][c];
                
                if (cell.flipTicks > 0) {
                    cell.flipTicks--;
                    cell.display = this.charSet[Math.floor(Math.random() * this.charSet.length)];
                } else {
                    cell.display = cell.target;
                }

                const cx = startX + (c * (cellW + padding));
                const cy = startY + (r * (cellH + padding));

                this.ctx.fillStyle = '#050505'; 
                this.ctx.beginPath();
                if (this.ctx.roundRect) this.ctx.roundRect(cx, cy, cellW, cellH, 4);
                else this.ctx.rect(cx, cy, cellW, cellH);
                this.ctx.fill();

                if (cell.display !== ' ') {
                    if (r === 0) {
                        this.ctx.fillStyle = '#ffcc00'; 
                    } else {
                        this.ctx.fillStyle = '#ffffff'; 
                        
                        if (targetStrings[r] && targetStrings[r].match(/^00:0[0-4]/) && !showModal) {
                            const pulse = Math.floor(now.getTime() / 500) % 2 === 0;
                            this.ctx.fillStyle = pulse ? '#ef4444' : '#ffffff'; 
                        }
                    }

                    this.ctx.fillText(cell.display, cx + (cellW / 2), cy + (cellH / 2) + 2);
                }

                this.ctx.fillStyle = '#1c1c1c'; 
                this.ctx.fillRect(cx, cy + (cellH / 2) - 1, cellW, 2);
            }
        }

        if (showModal) {
            
            if (!this.hasModalOpened) {
                this.hasModalOpened = true;
                this.ringClickListener = () => window.stopAlarm();
                setTimeout(() => {
                    document.addEventListener('click', this.ringClickListener);
                    this.canvas.style.cursor = 'pointer';
                }, 50);
            }

            const alarm = this.activeRings[0];
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            
            this.ctx.fillStyle = 'rgba(28, 28, 28, 0.85)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            const boxW = Math.min(1100, this.canvas.width * 0.95);
            const boxH = 400;
            const boxX = cx - boxW / 2;
            const boxY = cy - boxH / 2;

            this.ctx.fillStyle = '#1c1c1c';
            this.ctx.strokeStyle = '#ef4444';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            if (this.ctx.roundRect) this.ctx.roundRect(boxX, boxY, boxW, boxH, 12);
            else this.ctx.rect(boxX, boxY, boxW, boxH);
            this.ctx.fill();
            this.ctx.stroke();

            const depText = "DEPARTING";
            const depFlapW = 42; const depFlapH = 68; const depPad = 4;
            const depTotalW = (depText.length * depFlapW) + ((depText.length - 1) * depPad);
            const depStartX = cx - (depTotalW / 2);
            const depY = boxY + 30;

            const strobe = Math.floor(now.getTime() / 500) % 2 === 0;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.font = `bold ${depFlapH * 0.8}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

            for (let i = 0; i < depText.length; i++) {
                let fx = depStartX + (i * (depFlapW + depPad));
                
                this.ctx.fillStyle = '#050505';
                this.ctx.beginPath();
                if (this.ctx.roundRect) this.ctx.roundRect(fx, depY, depFlapW, depFlapH, 4);
                else this.ctx.rect(fx, depY, depFlapW, depFlapH);
                this.ctx.fill();

                this.ctx.fillStyle = strobe ? '#ef4444' : '#ffcc00';
                this.ctx.fillText(depText[i], fx + depFlapW/2, depY + depFlapH/2 + 2);

                this.ctx.fillStyle = '#1c1c1c';
                this.ctx.fillRect(fx, depY + depFlapH/2 - 1, depFlapW, 2);
            }

            let label = (alarm.label || 'ALARM').toUpperCase();
            let words = label.split(' ');
            let lines = [];
            let chosenConfig = null;
            
            const formats = [
                { w: 60, h: 96, maxLines: 1 },
                { w: 46, h: 74, maxLines: 2 },
                { w: 32, h: 52, maxLines: 3 }
            ];

            for (let format of formats) {
                let maxChars = Math.floor((boxW - 60) / (format.w + 4));
                let testLines = [];
                let currentLine = '';

                for (let n = 0; n < words.length; n++) {
                    let testStr = currentLine + (currentLine ? ' ' : '') + words[n];
                    if (testStr.length <= maxChars) {
                        currentLine = testStr;
                    } else {
                        if (currentLine) testLines.push(currentLine);
                        currentLine = words[n];
                    }
                }
                if (currentLine) testLines.push(currentLine);

                let overflow = testLines.some(l => l.length > maxChars);
                if (testLines.length <= format.maxLines && !overflow) {
                    lines = testLines;
                    chosenConfig = format;
                    break;
                }
            }

            if (!chosenConfig) {
                chosenConfig = formats[2];
                let maxChars = Math.floor((boxW - 60) / (chosenConfig.w + 4));
                let testLines = [];
                let currentLine = '';
                for (let n = 0; n < words.length; n++) {
                    let testStr = currentLine + (currentLine ? ' ' : '') + words[n];
                    if (testStr.length <= maxChars) {
                        currentLine = testStr;
                    } else {
                        if (currentLine) testLines.push(currentLine);
                        currentLine = words[n].substring(0, maxChars); 
                    }
                }
                if (currentLine) testLines.push(currentLine);
                
                lines = testLines.slice(0, 3);
                if (testLines.length > 3) {
                    let last = lines[2];
                    if (last.length > maxChars - 3) last = last.substring(0, maxChars - 3);
                    lines[2] = last + "...";
                }
            }

            this.ctx.font = `bold ${chosenConfig.h * 0.8}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
            const blockHeight = lines.length * (chosenConfig.h + 10);
            let blockStartY = boxY + 210 - (blockHeight / 2);

            for (let k = 0; k < lines.length; k++) {
                let lineStr = lines[k];
                let lineTotalW = (lineStr.length * chosenConfig.w) + ((lineStr.length - 1) * 4);
                let lineStartX = cx - (lineTotalW / 2);
                let lineY = blockStartY + (k * (chosenConfig.h + 10));

                for (let i = 0; i < lineStr.length; i++) {
                    let char = lineStr[i];
                    let fx = lineStartX + (i * (chosenConfig.w + 4));
                    
                    this.ctx.fillStyle = '#050505';
                    this.ctx.beginPath();
                    if (this.ctx.roundRect) this.ctx.roundRect(fx, lineY, chosenConfig.w, chosenConfig.h, 4);
                    else this.ctx.rect(fx, lineY, chosenConfig.w, chosenConfig.h);
                    this.ctx.fill();

                    if (char !== ' ') {
                        this.ctx.fillStyle = '#ffffff'; 
                        this.ctx.fillText(char, fx + chosenConfig.w/2, lineY + chosenConfig.h/2 + 2);
                    }

                    this.ctx.fillStyle = '#1c1c1c';
                    this.ctx.fillRect(fx, lineY + chosenConfig.h/2 - 1, chosenConfig.w, 2);
                }
            }

            const btnW = 280; const btnH = 60;
            const btnX = cx - btnW / 2;
            const btnY = boxY + boxH - 90;
            
            this.ctx.strokeStyle = '#ef4444';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            if (this.ctx.roundRect) this.ctx.roundRect(btnX, btnY, btnW, btnH, 8);
            else this.ctx.strokeRect(btnX, btnY, btnW, btnH);
            this.ctx.stroke();

            this.ctx.fillStyle = '#ef4444';
            this.ctx.font = 'bold 26px "Helvetica Neue", Helvetica, Arial, sans-serif';
            this.ctx.fillText("STOP ALARM", cx, btnY + 32);
        }
    }

    destroy() { 
        this.grid = [];
        this.stopRing();
    }
}