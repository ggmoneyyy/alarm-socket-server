export default class HourglassVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.alarms = [];
        this.activeRings = [];
        this.ringClickListener = null;
        
        this.hasReceivedData = false;

        this.isRotating = false;
        this.rotationStartTime = 0;
        this.lastDisplayAlarm = null; 

        this.particles = [];
        this.lastSecond = -1;

        this.hgCanvas = document.createElement('canvas');
        this.hgCtx = this.hgCanvas.getContext('2d');
        this.hgCanvas.width = 64;
        this.hgCanvas.height = 96;
    }

    init() {
        this.alarms = [];
        this.activeRings = [];
        this.particles = [];
        this.isRotating = false;
        this.lastSecond = -1;
        this.hasReceivedData = false;
        this.lastDisplayAlarm = null;
    }

    updateAlarms(nextOccurrences) {
        this.alarms = nextOccurrences;
        this.hasReceivedData = true; 
    }

    handleRing(alarm) {
        this.activeRings.push(alarm);
        this.isRotating = false; 
    }

    stopRing() {
        const wasRinging = this.activeRings.length > 0;
        
        this.activeRings = [];
        if (this.ringClickListener) {
            document.removeEventListener('click', this.ringClickListener);
            this.ringClickListener = null;
            this.canvas.style.cursor = 'default';
        }
        
        if (wasRinging) {
            this.isRotating = true;
            this.rotationStartTime = Date.now();
            this.particles = []; 
        }
    }

    draw16BitHourglass(pct) {
        const ctx = this.hgCtx;
        ctx.clearRect(0, 0, 64, 96);

        ctx.fillStyle = '#4a3219'; 
        ctx.fillRect(4, 2, 56, 8);
        ctx.fillRect(4, 86, 56, 8);
        
        ctx.fillStyle = '#8a6233'; 
        ctx.fillRect(6, 4, 52, 4);
        ctx.fillRect(6, 88, 52, 4);

        ctx.fillStyle = '#c79f67'; 
        ctx.fillRect(6, 4, 52, 1);
        ctx.fillRect(6, 88, 52, 1);

        const drawTopGlass = () => {
            ctx.beginPath();
            ctx.moveTo(8, 10);
            ctx.lineTo(56, 10);
            ctx.lineTo(34, 46);
            ctx.lineTo(30, 46);
            ctx.closePath();
        };

        const drawBottomGlass = () => {
            ctx.beginPath();
            ctx.moveTo(30, 50);
            ctx.lineTo(34, 50);
            ctx.lineTo(56, 86);
            ctx.lineTo(8, 86);
            ctx.closePath();
        };

        const drawSpeckledSand = (yStart, height) => {
            ctx.fillStyle = '#fdfaf2'; 
            ctx.fillRect(0, yStart, 64, height);
            
            ctx.fillStyle = '#d4c5b0'; 
            for (let r = Math.floor(yStart); r < yStart + height; r++) {
                for (let c = 8; c < 56; c++) {
                    if ((r * 13 + c * 17) % 7 === 0) {
                        ctx.fillRect(c, r, 1, 1);
                    }
                }
            }
        };

        if (pct > 0) {
            ctx.save();
            drawTopGlass();
            ctx.clip();
            const topSandHeight = 36 * pct;
            const topSandY = 46 - topSandHeight;
            drawSpeckledSand(topSandY, topSandHeight);
            
            ctx.fillStyle = '#ffffff'; 
            ctx.fillRect(0, topSandY, 64, 1);
            ctx.restore();
        }

        if (pct < 1) {
            ctx.save();
            drawBottomGlass();
            ctx.clip();
            const bottomSandHeight = 36 * (1 - pct);
            const bottomSandY = 86 - bottomSandHeight;
            drawSpeckledSand(bottomSandY, bottomSandHeight);
            
            ctx.fillStyle = '#ffffff'; 
            ctx.fillRect(0, bottomSandY, 64, 1);
            ctx.restore();
        }

        ctx.fillStyle = '#fdfaf2';
        for (let p of this.particles) {
            ctx.fillRect(31, p.y, 2, 2);
        }

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#050505'; 
        drawTopGlass();
        ctx.stroke();
        drawBottomGlass();
        ctx.stroke();

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(12, 12);
        ctx.lineTo(31, 44);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(31, 52);
        ctx.lineTo(12, 84);
        ctx.stroke();
    }

    drawRetroText(text, x, y, size, color, align = 'left') {
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'top';
        this.ctx.font = `${size}px "Press Start 2P", "VT323", "Courier New", monospace`;
        
        this.ctx.fillStyle = '#050505';
        this.ctx.fillText(text, x + 4, y + 4); 
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x, y);
    }

    getWrappedLines(text, maxWidth) {
        let words = text.split(' ');
        let lines = [];
        let currentLine = words[0] || '';

        for (let i = 1; i < words.length; i++) {
            let word = words[i];
            let width = this.ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    render(now) {
        if (!this.hasReceivedData) return;

        const elevenHoursMs = 11 * 60 * 60 * 1000;
        const visibleAlarms = this.alarms.filter(occ => {
            return !this.activeRings.some(ring => ring.id === occ.alarm.id) && (occ.date - now) <= elevenHoursMs;
        });

        const isRinging = this.activeRings.length > 0;
        const showModal = isRinging; 

        let displayAlarm = visibleAlarms.length > 0 ? visibleAlarms[0] : null;
        
        if (isRinging || this.isRotating) {
            displayAlarm = this.lastDisplayAlarm; 
        } else {
            this.lastDisplayAlarm = displayAlarm; 
        }

        const CAPACITY_MS = 2 * 60 * 60 * 1000; 

        let pct = 0;
        let remaining = 0;
        
        if (isRinging || this.isRotating) {
            pct = 0; 
            remaining = 0;
        } else if (displayAlarm) {
            remaining = Math.max(0, displayAlarm.date - now);
            pct = remaining / CAPACITY_MS;
            if (pct > 1) pct = 1; 
        }

        const currentSecond = now.getSeconds();
        if (pct > 0 && pct < 1 && !isRinging && !this.isRotating) {
            if (currentSecond !== this.lastSecond) {
                this.lastSecond = currentSecond;
                this.particles.push({ y: 46 }); 
            }
        }

        const bottomSandTopY = 86 - (36 * (1 - pct));
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.y += 0.8; 
            if (p.y >= bottomSandTopY) {
                this.particles.splice(i, 1);
            }
        }

        this.draw16BitHourglass(pct);

        this.ctx.fillStyle = '#18241b'; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const pad = 16;
        this.ctx.strokeStyle = '#b38b59'; 
        this.ctx.lineWidth = 6;
        this.ctx.strokeRect(pad, pad, this.canvas.width - pad * 2, this.canvas.height - pad * 2);
        
        this.ctx.strokeStyle = '#6e502c'; 
        this.ctx.lineWidth = 6;
        this.ctx.strokeRect(pad + 6, pad + 6, this.canvas.width - pad * 2 - 12, this.canvas.height - pad * 2 - 12);

        const scale = (this.canvas.height * 0.75) / 96; 
        const drawW = 64 * scale;
        const drawH = 96 * scale;
        
        // RE-CENTERED HORIZONTAL SPACING
        const hgStartX = this.canvas.width * 0.10; // Left padding explicitly set to 10%
        const hgStartY = (this.canvas.height - drawH) / 2;

        let currentAngle = 0;
        if (this.isRotating) {
            const rotElapsed = Date.now() - this.rotationStartTime;
            const rotDuration = 800; 
            
            if (rotElapsed < rotDuration) {
                let t = rotElapsed / rotDuration;
                let ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                currentAngle = ease * Math.PI; 
            } else {
                this.isRotating = false; 
            }
        }

        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false; 
        this.ctx.translate(hgStartX + drawW / 2, hgStartY + drawH / 2);
        this.ctx.rotate(currentAngle);
        this.ctx.drawImage(this.hgCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
        this.ctx.restore();
        
        this.ctx.imageSmoothingEnabled = true;

        // Gap tightened up to 6%, right boundary strictly respects the identical 10% padding
        const textStartX = hgStartX + drawW + (this.canvas.width * 0.06);
        const maxTextWidth = this.canvas.width - textStartX - (this.canvas.width * 0.10); 
        const textStartY = hgStartY + 20;

        if (displayAlarm) {
            const h = Math.floor(remaining / 3600000).toString().padStart(2, '0');
            const m = Math.floor((remaining % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');

            this.drawRetroText("UPCOMING EVENT:", textStartX, textStartY, 24, '#f8d878');

            this.ctx.font = `32px "Press Start 2P", "VT323", monospace`;
            let label = (displayAlarm.alarm.label || 'ALARM').toUpperCase();
            let labelLines = this.getWrappedLines(label, maxTextWidth);
            
            let currentLabelY = textStartY + 50;
            for (let line of labelLines) {
                this.drawRetroText(line, textStartX, currentLabelY, 32, '#ffffff');
                currentLabelY += 45; 
            }

            const clockY = currentLabelY + 20;
            this.drawRetroText(`${h}:${m}:${s}`, textStartX, clockY, 90, '#ffffff');

            let upNextAlarm = (isRinging || this.isRotating) ? visibleAlarms[0] : visibleAlarms[1];

            if (upNextAlarm) {
                const nd = new Date(upNextAlarm.date);
                const nh = nd.getHours().toString().padStart(2, '0');
                const nm = nd.getMinutes().toString().padStart(2, '0');
                
                const headerSize = 28;
                const textSize = 24;
                const lineHeight = 38;

                this.ctx.font = `${textSize}px "Press Start 2P", "VT323", monospace`;
                
                let nextLabel = `${nh}:${nm} - ${(upNextAlarm.alarm.label || 'ALARM').toUpperCase()}`;
                let nextLines = this.getWrappedLines(nextLabel, maxTextWidth - 45);
                
                const blockHeight = headerSize + 15 + (nextLines.length * lineHeight);
                const nextY = (hgStartY + drawH) - blockHeight;
                
                this.drawRetroText("AFTER THAT:", textStartX, nextY, headerSize, '#f8d878');
                
                let nextLabelY = nextY + headerSize + 15;
                for (let i = 0; i < nextLines.length; i++) {
                    let prefix = (i === 0) ? "> " : "  ";
                    this.drawRetroText(`${prefix}${nextLines[i]}`, textStartX, nextLabelY, textSize, '#c0c8d0'); 
                    nextLabelY += lineHeight;
                }
            }
        } else {
            this.drawRetroText("NO UPCOMING EVENTS", textStartX, textStartY, 32, '#c0c8d0');
        }

        if (showModal) {
            if (!this.ringClickListener) {
                this.ringClickListener = () => window.stopAlarm();
                setTimeout(() => {
                    document.addEventListener('click', this.ringClickListener);
                    this.canvas.style.cursor = 'pointer';
                }, 50);
            }

            const alarm = this.activeRings[0];
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            const boxW = Math.min(1000, this.canvas.width * 0.9);
            const boxH = 450;
            const boxX = cx - boxW / 2;
            const boxY = cy - boxH / 2;

            this.ctx.fillStyle = '#050505'; 
            this.ctx.fillRect(boxX, boxY, boxW, boxH);

            this.ctx.strokeStyle = '#b38b59'; 
            this.ctx.lineWidth = 4;
            this.ctx.strokeRect(boxX, boxY, boxW, boxH);
            this.ctx.strokeStyle = '#6e502c'; 
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(boxX + 6, boxY + 6, boxW - 12, boxH - 12);
            
            let label = (alarm.label || 'ALARM').toUpperCase();
            
            let formats = [
                { size: 50, maxLines: 2 },
                { size: 36, maxLines: 3 },
                { size: 28, maxLines: 4 }
            ];

            let lines = [];
            let chosenConfig = null;

            for (let format of formats) {
                this.ctx.font = `${format.size}px "Press Start 2P", "VT323", monospace`;
                let testLines = this.getWrappedLines(label, boxW - 80);
                
                if (testLines.length <= format.maxLines) {
                    lines = testLines;
                    chosenConfig = format;
                    break;
                }
            }

            if (!chosenConfig) {
                chosenConfig = formats[2];
                lines = [label.substring(0, 30) + "..."]; 
            }

            const blockHeight = lines.length * (chosenConfig.size + 15);
            let blockStartY = boxY + 180 - (blockHeight / 2);

            for (let k = 0; k < lines.length; k++) {
                let lineY = blockStartY + (k * (chosenConfig.size + 15));
                this.drawRetroText(lines[k], cx, lineY, chosenConfig.size, '#ffffff', 'center');
            }

            const pulse = Math.floor(now.getTime() / 500) % 2 === 0;
            const btnText = pulse ? "► STOP ALARM ◄" : "  STOP ALARM  ";
            this.drawRetroText(btnText, cx, boxY + boxH - 70, 24, '#f8d878', 'center'); 
        }
    }

    destroy() { 
        this.particles = [];
        this.stopRing();
    }
}