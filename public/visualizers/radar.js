export default class RadarVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        
        this.fps = 30; 
        this.targetColor = '#42f566'; 
        this.glowColor = '#ccffcc';   
        
        this.sweepSpeed = (Math.PI * 2) / 5.0; 
        this.lastFrameTime = 0;
        this.sweeperAngle = 0; 
        
        this.alarms = [];
        this.activeRings = [];
        this.hasReceivedData = false;

        this.bgImage = new Image();
        this.bgImage.src = 'visualizers/sprites/radar-scope-bg.jpg';
        this.bgLoaded = false;
        this.bgImage.onload = () => { this.bgLoaded = true; };

        if (!document.getElementById('radar-web-font')) {
            const link = document.createElement('link');
            link.id = 'radar-web-font';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap';
            document.head.appendChild(link);
        }
    }

    init() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.sweeperAngle = 0;
    }

    updateAlarms(nextOccurrences) {
        this.alarms = nextOccurrences;
        this.hasReceivedData = true;
    }

    handleRing(alarm) { this.activeRings.push(alarm); }
    stopRing() { this.activeRings = []; }

    getFontString(size) {
        return `bold ${Math.floor(size)}px "Courier Prime", monospace`;
    }

    drawCRTBox(x, y, w, h, color, fill = false, blur = 4) {
        this.ctx.save();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = color;
        this.ctx.shadowBlur = blur; 
        this.ctx.shadowColor = color;
        this.ctx.fillStyle = fill ? 'rgba(0, 15, 0, 0.9)' : 'rgba(0,0,0,0)';
        this.ctx.beginPath();
        this.ctx.rect(x, y, w, h);
        if(fill) this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawRetroText(text, x, y, size, color, align = 'left', shadowBlur = 0, shadowColor = 'transparent') {
        this.ctx.save();
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'middle';
        this.ctx.font = this.getFontString(size);
        this.ctx.fillStyle = color;
        if (shadowBlur > 0) {
            this.ctx.shadowBlur = shadowBlur;
            this.ctx.shadowColor = shadowColor;
        }
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
    }

    getWrappedLines(text, maxWidth, fontSize) {
        this.ctx.font = this.getFontString(fontSize);
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = this.ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) { currentLine += " " + word; } 
            else { lines.push(currentLine); currentLine = word; }
        }
        lines.push(currentLine); return lines;
    }

    // Creates a stable pseudo-random value between 0 and 1 based on a string
    getStringHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
        }
        return (Math.abs(hash) / 2147483647) || Math.random(); 
    }

    render(now) {
        const nowTime = now.getTime();
        const deltaTime = (nowTime - (this.lastFrameTime || nowTime)) / 1000;
        if (this.lastFrameTime && (nowTime - this.lastFrameTime < 1000 / this.fps)) return;
        this.lastFrameTime = nowTime;

        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, w, h);

        let cx, cy, maxRadius, baseScale, clockYOffset;

        if (this.bgLoaded) {
            const iw = this.bgImage.width;
            const ih = this.bgImage.height;
            const scale = Math.max(w / iw, h / ih);
            const dw = iw * scale;
            const dh = ih * scale;
            const dx = (w - dw) / 2;
            const dy = (h - dh) / 2;

            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.drawImage(this.bgImage, dx, dy, dw, dh);

            cx = dx + (dw * 0.502); 
            cy = dy + (dh * 0.439); 
            maxRadius = dh * 0.258; 
            clockYOffset = dy + (dh * 0.90);
        } else {
            cx = w / 2; cy = h / 2; 
            maxRadius = h * 0.258;
            clockYOffset = h * 0.95;
        }

        baseScale = Math.max(0.6, Math.min(1.2, h / 900));

        this.sweeperAngle += this.sweepSpeed * deltaTime;
        if (this.sweeperAngle >= Math.PI * 2) this.sweeperAngle -= Math.PI * 2;

        this.ctx.globalCompositeOperation = 'screen';

        const windowMs = 1.5 * 60 * 60 * 1000;
        const isRinging = this.activeRings.length > 0;
        let displayAlarms = this.alarms.filter(occ => 
            !this.activeRings.some(ring => String(ring.id) === String(occ.alarm.id)) &&
            (occ.date - nowTime) <= windowMs
        );

        if (displayAlarms.length === 0 && !isRinging) {
            displayAlarms = [{ date: nowTime + 45 * 60 * 1000, alarm: { id: 'sys', label: 'RADAR NOMINAL' } }];
        }

        const timeOfDaySize = Math.max(48, Math.floor(64 * baseScale)); 
        this.ctx.font = this.getFontString(timeOfDaySize);
        const clockTextWidth = this.ctx.measureText("00:00:00").width; 
        
        const clockBoxW = clockTextWidth + (60 * baseScale);
        const clockBoxH = timeOfDaySize + (30 * baseScale);
        const clockBoxX = cx - (clockBoxW / 2);
        const clockBoxY = clockYOffset - (clockBoxH / 2);

        const clockCollisionBox = {
            l: clockBoxX - (15 * baseScale),
            r: clockBoxX + clockBoxW + (15 * baseScale),
            t: clockBoxY - (15 * baseScale),
            b: clockBoxY + clockBoxH + (15 * baseScale)
        };

        let targets = [];

        // --- NEW ORGANIC PLACEMENT ENGINE ---
        displayAlarms.forEach((occ) => {
            const timeRemaining = Math.max(0, occ.date - nowTime);
            const timePct = timeRemaining / windowMs;
            const dist = (maxRadius * 0.1) + (maxRadius * 0.85) * timePct;
            
            // Generate a natural, organic angle based on the alarm's unique ID/Name
            const seed = (occ.alarm.id || '') + (occ.alarm.label || 'TGT');
            const baseAngle = this.getStringHash(seed) * Math.PI * 2;
            
            const fontSize = Math.max(18, Math.floor(22 * baseScale));
            const timeFontSize = Math.floor(fontSize * 1.5); 
            const label = (occ.alarm.label || 'TARGET').toUpperCase();
            const boxW = 380 * baseScale; 
            const pX = 12 * baseScale; 
            const pY = 12 * baseScale; 
            
            const lines = this.getWrappedLines(label, boxW - (pX * 2), fontSize);
            const boxH = (pY * 2) + (lines.length * (fontSize + 4)) + timeFontSize + (4 * baseScale);

            const calloutDistX = 55 * baseScale;
            const calloutDistY = 55 * baseScale;

            let bestPlacement = null;

            // Rotate the blip by 5 degrees until it finds a clear sector
            for (let attempt = 0; attempt < 72; attempt++) {
                let targetAngle = baseAngle + (attempt * (Math.PI * 2 / 72));
                if (targetAngle > Math.PI * 2) targetAngle -= Math.PI * 2;

                let tx = cx + Math.cos(targetAngle) * dist;
                let ty = cy + Math.sin(targetAngle) * dist;
                let isRight = tx >= cx;
                let isBottom = ty >= cy;

                let bx = isRight ? tx + calloutDistX : tx - calloutDistX - boxW;
                let by = isBottom ? ty + calloutDistY : ty - calloutDistY - boxH;

                let overlap = false;
                let pad = 15 * baseScale;
                let b1 = { l: bx - pad, r: bx + boxW + pad, t: by - pad, b: by + boxH + pad };

                // 1. Hard Screen Bounds - NEVER go off screen
                if (b1.l < 10 || b1.r > w - 10 || b1.t < 10 || b1.b > h - 10) overlap = true;

                // 2. Physical Clock Box
                if (!overlap && !(clockCollisionBox.l > b1.r || clockCollisionBox.r < b1.l || clockCollisionBox.t > b1.b || clockCollisionBox.b < b1.t)) {
                    overlap = true;
                }

                // 3. Other Targets
                if (!overlap) {
                    for (let j = 0; j < targets.length; j++) {
                        let pt = targets[j];
                        let b2 = { l: pt.bx - pad, r: pt.bx + pt.boxW + pad, t: pt.by - pad, b: pt.by + pt.boxH + pad };
                        
                        // Prevent Boxes overlapping Boxes
                        if (!(b2.l > b1.r || b2.r < b1.l || b2.t > b1.b || b2.b < b1.t)) { overlap = true; break; }
                        
                        // Prevent Boxes hiding other Blips
                        if (pt.tx >= b1.l && pt.tx <= b1.r && pt.ty >= b1.t && pt.ty <= b1.b) { overlap = true; break; }
                        if (tx >= b2.l && tx <= b2.r && ty >= b2.t && ty <= b2.b) { overlap = true; break; }
                    }
                }

                if (!overlap) {
                    bestPlacement = { targetAngle, tx, ty, bx, by, isRight, isBottom };
                    break;
                }
            }

            // Fallback (forces it to stay on screen if heavily crowded)
            if (!bestPlacement) {
                let targetAngle = baseAngle;
                let tx = cx + Math.cos(targetAngle) * dist;
                let ty = cy + Math.sin(targetAngle) * dist;
                let isRight = tx >= cx;
                let isBottom = ty >= cy;
                let bx = isRight ? tx + calloutDistX : tx - calloutDistX - boxW;
                let by = isBottom ? ty + calloutDistY : ty - calloutDistY - boxH;
                bx = Math.max(10, Math.min(bx, w - boxW - 10));
                by = Math.max(10, Math.min(by, h - boxH - 10));
                bestPlacement = { targetAngle, tx, ty, bx, by, isRight, isBottom };
            }

            // Decay Bloom calculation based on final angle
            let diff = (this.sweeperAngle - bestPlacement.targetAngle) % (Math.PI * 2);
            if (diff < 0) diff += Math.PI * 2;
            const timeSinceHit = diff / this.sweepSpeed;
            const decayDuration = 3.0; 
            let glowFactor = 0;
            if (timeSinceHit <= decayDuration) {
                glowFactor = Math.pow(1.0 - (timeSinceHit / decayDuration), 2);
            } else if (diff > (Math.PI * 2 - 0.1)) {
                glowFactor = 1.0; 
            }

            targets.push({
                occ, timeRemaining, boxW, boxH, lines, fontSize, timeFontSize, pX, pY, glowFactor,
                ...bestPlacement
            });
        });

        // --- DRAW SOLID WEDGE RADAR SWEEP ---
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        
        const tailCount = 40; 
        const tailArc = 1.0; 
        
        for (let i = 0; i < tailCount; i++) {
            const stepStart = this.sweeperAngle - ((i + 1) / tailCount) * tailArc;
            const stepEnd = this.sweeperAngle - (i / tailCount) * tailArc;
            
            const alpha = Math.pow(1 - (i / tailCount), 2) * 0.55;
            
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = this.targetColor;
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.arc(cx, cy, maxRadius, stepStart, stepEnd);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1.0;
        this.ctx.strokeStyle = '#e0ffe0'; 
        this.ctx.lineWidth = 2.5;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.targetColor;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + Math.cos(this.sweeperAngle) * maxRadius, cy + Math.sin(this.sweeperAngle) * maxRadius);
        this.ctx.stroke();
        this.ctx.restore();

        // --- DRAW GLOWING BLIPS ---
        targets.forEach((t) => {
            const r = Math.round(66 + (255 - 66) * t.glowFactor);
            const g = Math.round(245 + (255 - 245) * t.glowFactor);
            const b = Math.round(102 + (255 - 102) * t.glowFactor);
            const interpolatedColor = `rgb(${r}, ${g}, ${b})`;
            
            const bloom = 5 + (25 * t.glowFactor);

            this.ctx.save();
            this.ctx.fillStyle = interpolatedColor;
            this.ctx.shadowBlur = bloom;
            this.ctx.shadowColor = interpolatedColor;
            this.ctx.translate(t.tx, t.ty);
            this.ctx.rotate(Math.PI / 4);
            const blipSize = 5 * baseScale;
            this.ctx.fillRect(-blipSize, -blipSize, blipSize * 2, blipSize * 2);
            this.ctx.restore();
        });

        // --- DRAW LABELS & DIAGONAL LINES ---
        this.ctx.globalCompositeOperation = 'source-over';

        targets.forEach((t) => {
            const r = Math.round(66 + (255 - 66) * t.glowFactor);
            const g = Math.round(245 + (255 - 245) * t.glowFactor);
            const b = Math.round(102 + (255 - 102) * t.glowFactor);
            const interpolatedColor = `rgb(${r}, ${g}, ${b})`;
            
            const boxBloom = 4 + (20 * t.glowFactor);
            const textBloom = 10 * t.glowFactor; 

            // Connect strictly to the corner of the box closest to the blip
            const connectX = t.isRight ? t.bx : t.bx + t.boxW;
            const connectY = t.isBottom ? t.by : t.by + t.boxH;

            this.ctx.save();
            this.ctx.strokeStyle = interpolatedColor;
            this.ctx.shadowBlur = boxBloom;
            this.ctx.shadowColor = interpolatedColor;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(t.tx, t.ty); 
            this.ctx.lineTo(connectX, connectY);
            this.ctx.stroke();
            this.ctx.restore();

            this.drawCRTBox(t.bx, t.by, t.boxW, t.boxH, interpolatedColor, true, boxBloom);
            
            t.lines.forEach((line, i) => {
                this.drawRetroText(line, t.bx + t.pX, t.by + t.pY + (t.fontSize / 2) + (i * (t.fontSize + 4)), t.fontSize, '#fff', 'left', textBloom, interpolatedColor);
            });
            
            const hrs = Math.floor(t.timeRemaining / 3600000).toString().padStart(2, '0');
            const mins = Math.floor((t.timeRemaining % 3600000) / 60000).toString().padStart(2, '0');
            const secs = Math.floor((t.timeRemaining % 60000) / 1000).toString().padStart(2, '0');
            this.drawRetroText(`${hrs}:${mins}:${secs}`, t.bx + t.boxW - t.pX, t.by + t.boxH - t.pY - (t.timeFontSize / 2), t.timeFontSize, '#e6c835', 'right');
        });

        // --- DRAW PHYSICAL METAL LABEL (Time of Day) ---
        const localTimeStr = now.toLocaleTimeString('en-US', { hour12: false });
        
        this.ctx.save();
        this.ctx.fillStyle = '#0f0c0a'; 
        this.ctx.strokeStyle = '#3a2e24'; 
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'; 
        
        this.ctx.beginPath();
        this.ctx.rect(clockBoxX, clockBoxY, clockBoxW, clockBoxH);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = 'rgba(255, 180, 120, 0.15)'; 
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(clockBoxX + 2, clockBoxY + 2, clockBoxW - 4, clockBoxH - 4);
        
        const screwPad = 8 * baseScale;
        const screwRadius = 2.5 * baseScale;
        this.ctx.fillStyle = '#1f1a16'; 
        const drawScrew = (x, y) => {
            this.ctx.beginPath();
            this.ctx.arc(x, y, screwRadius, 0, Math.PI*2);
            this.ctx.fill();
        };
        drawScrew(clockBoxX + screwPad, clockBoxY + screwPad);
        drawScrew(clockBoxX + clockBoxW - screwPad, clockBoxY + screwPad);
        drawScrew(clockBoxX + screwPad, clockBoxY + clockBoxH - screwPad);
        drawScrew(clockBoxX + clockBoxW - screwPad, clockBoxY + clockBoxH - screwPad);
        this.ctx.restore();

        this.ctx.save();
        this.ctx.shadowBlur = 3;
        this.ctx.shadowColor = 'rgba(255, 190, 120, 0.4)'; 
        this.drawRetroText(localTimeStr, cx, clockYOffset, timeOfDaySize, '#fff3e0', 'center'); 
        this.ctx.restore();

        // --- MODAL ---
        if (isRinging) {
            const alarm = this.activeRings[0];
            const modalScale = Math.max(0.6, Math.min(1.2, h / 900));
            const modalW = 650 * modalScale; 
            const modalH = 280 * modalScale;
            const my = (h / 2) - (modalH / 2);
            const pulse = Math.floor(nowTime / 250) % 2 === 0;
            
            this.drawCRTBox((w / 2) - (modalW / 2), my, modalW, modalH, pulse ? this.glowColor : this.targetColor, true);
            this.drawRetroText("INTERCEPT TARGET", w / 2, my + (50 * modalScale), 26 * modalScale, this.glowColor, "center");
            
            const modalLines = this.getWrappedLines((alarm.label || "ALARM").toUpperCase(), modalW - (50 * modalScale), 32 * modalScale);
            modalLines.forEach((line, i) => {
                this.drawRetroText(line, w / 2, my + (120 * modalScale) + (i * (42 * modalScale)), 32 * modalScale, "#fff", "center");
            });
            this.drawRetroText(pulse ? "► NEUTRALIZE ◄" : "  NEUTRALIZE  ", w / 2, my + (230 * modalScale), 28 * modalScale, "#e6c835", "center");
            
            if (!this.ringClickListener) {
                this.ringClickListener = () => window.stopAlarm();
                setTimeout(() => document.addEventListener('click', this.ringClickListener), 50);
                this.canvas.style.cursor = 'pointer';
            }
        }
    }

    destroy() {
        this.stopRing();
    }
}