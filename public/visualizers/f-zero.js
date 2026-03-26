export default class FZeroVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx; 
        this.vw = 640; this.vh = 360; 
        this.buffer = document.createElement('canvas');
        this.buffer.width = this.vw; this.buffer.height = this.vh;
        this.bCtx = this.buffer.getContext('2d');
        this.bCtx.imageSmoothingEnabled = false; 
        this.fps = 20; this.lastFrameTime = 0;
        this.alarms = []; this.activeRings = []; this.ringClickListener = null;
        this.hasReceivedData = false; this.position = 0; this.lastDisplayAlarm = null; 
        this.passedAlarm = null; this.passingStartTime = 0; this.isPassing = false;
        this.spriteMap = {}; this.spriteCounter = 0; this.opponentTypes = ['opp1', 'opp2', 'opp3'];
        
        // --- ADDED SHADOW SPRITE ---
        this.sprites = { player: new Image(), opp1: new Image(), opp2: new Image(), opp3: new Image(), shadow: new Image() };
        this.sprites.player.src = 'visualizers/sprites/player.png';
        this.sprites.opp1.src = 'visualizers/sprites/opponent1.png';
        this.sprites.opp2.src = 'visualizers/sprites/opponent2.png';
        this.sprites.opp3.src = 'visualizers/sprites/opponent3.png';
        this.sprites.shadow.src = 'visualizers/sprites/shadow.png'; 
    }

    init() {
        this.alarms = []; this.activeRings = []; this.position = 0; this.hasReceivedData = false;
        this.lastDisplayAlarm = null; this.isPassing = false; this.passedAlarm = null;
        this.passingStartTime = 0; this.lastFrameTime = 0;
    }

    updateAlarms(nextOccurrences) {
        this.alarms = nextOccurrences; this.hasReceivedData = true; 
        this.alarms.forEach(occ => {
            const id = String(occ.alarm.id || "temp");
            if (!this.spriteMap[id]) {
                this.spriteMap[id] = {
                    type: this.opponentTypes[this.spriteCounter % 3],
                    laneDir: (this.spriteCounter % 2 === 0) ? -1 : 1 
                };
                this.spriteCounter++;
            }
        });
    }

    handleRing(alarm) {
        const currentOcc = this.alarms.find(o => String(o.alarm.id) === String(alarm.id));
        if (currentOcc) {
            this.isPassing = true;
            this.passedAlarm = currentOcc;
            this.passingStartTime = Date.now();
        }
        this.activeRings.push(alarm); 
    }

    stopRing() {
        this.activeRings = []; this.isPassing = false; this.passedAlarm = null;
        if (this.ringClickListener) {
            document.removeEventListener('click', this.ringClickListener);
            this.ringClickListener = null;
            this.canvas.style.cursor = 'default';
        }
    }

    drawSNESBox(x, y, w, h, alpha = 1.0) {
        this.ctx.save(); this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = '#222222'; this.ctx.fillRect(x, y, w, h);
        this.ctx.fillStyle = '#777777'; this.ctx.fillRect(x, y, w, 4); this.ctx.fillRect(x, y, 4, h);
        this.ctx.fillStyle = '#000000'; this.ctx.fillRect(x, y + h - 4, w, 4); this.ctx.fillRect(x + w - 4, y, 4, h);
        this.ctx.restore();
    }

    drawRetroText(text, x, y, size, color, align = 'left', boldBorder = false) {
        this.ctx.textAlign = align; this.ctx.textBaseline = 'middle'; 
        this.ctx.font = `${size}px "Press Start 2P", monospace`;
        this.ctx.fillStyle = '#050505';
        let offset = boldBorder ? 3 : 2;
        this.ctx.fillText(text, x - offset, y); this.ctx.fillText(text, x + offset, y);
        this.ctx.fillText(text, x, y - offset); this.ctx.fillText(text, x, y + offset);
        this.ctx.fillStyle = color; this.ctx.fillText(text, x, y);
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

    drawMode7Track(horizonY, w, h, cx, offset, cycle, isFast) {
        this.bCtx.fillStyle = '#000000'; this.bCtx.fillRect(0, horizonY, w, h - horizonY);
        const trackTopW = w * 0.05; const trackBotW = w * 1.8; const drawH = h - horizonY;
        const numStripes = 40; 
        
        for (let i = 0; i <= numStripes; i++) {
            let val1 = i + offset; let val2 = (i + 1) + offset;
            const exponent = isFast ? 3.5 : 3.0; 
            let pct1 = Math.pow(val1 / numStripes, exponent);
            let pct2 = Math.pow(val2 / numStripes, exponent);
            
            let y1 = Math.floor(horizonY + pct1 * drawH); 
            let y2 = Math.ceil(horizonY + pct2 * drawH) + 1; 
            
            let w1 = trackTopW + pct1 * (trackBotW - trackTopW);
            let w2 = trackTopW + pct2 * (trackBotW - trackTopW);
            
            let isDarkRoad = (Math.abs(Math.floor((i - cycle) / 2)) % 2) === 0; 
            let isAltSlice = (Math.abs(i - cycle) % 2) === 0; 
            
            if (isDarkRoad) { this.bCtx.fillStyle = '#091326'; this.bCtx.fillRect(0, y1, w, y2 - y1); }
            
            this.bCtx.fillStyle = isDarkRoad ? '#90a09d' : '#98a8a7'; 
            
            this.bCtx.beginPath(); this.bCtx.moveTo(cx - w1/2, y1); this.bCtx.lineTo(cx + w1/2, y1);
            this.bCtx.lineTo(cx + w2/2, y2); this.bCtx.lineTo(cx - w2/2, y2); this.bCtx.fill();
            
            const railW1 = Math.max(1, 20 * pct1); const railW2 = Math.max(1, 20 * pct2);
            this.bCtx.fillStyle = isAltSlice ? '#111111' : '#222222'; 
            this.bCtx.beginPath(); this.bCtx.moveTo(cx - w1/2, y1); this.bCtx.lineTo(cx - w1/2 - railW1, y1);
            this.bCtx.lineTo(cx - w2/2 - railW2, y2); this.bCtx.lineTo(cx - w2/2, y2); this.bCtx.fill();
            this.bCtx.beginPath(); this.bCtx.moveTo(cx + w1/2, y1); this.bCtx.lineTo(cx + w1/2 + railW1, y1);
            this.bCtx.lineTo(cx + w2/2 + railW2, y2); this.bCtx.lineTo(cx + w2/2, y2); this.bCtx.fill();
            
            let midY = (y1 + y2) / 2; let rX = Math.max(2, railW2 * 0.9); let rY = Math.max(1, (y2 - y1) * 0.55); 
            this.bCtx.fillStyle = isAltSlice ? '#49e875' : '#7aff96'; 
            this.bCtx.beginPath(); this.bCtx.ellipse(cx - w1/2 - railW2/2, midY, rX, rY, 0, 0, Math.PI*2); this.bCtx.fill();
            this.bCtx.beginPath(); this.bCtx.ellipse(cx + w1/2 + railW2/2, midY, rX, rY, 0, 0, Math.PI*2); this.bCtx.fill();
            
            const terrWBot = w * 2.0; 
            let traffic1 = (Math.abs(i - cycle * 2.0) % 12) < 4.0; 
            let traffic2 = (Math.abs(i + cycle * 3.0) % 10) < 3.0; 
            let traffic3 = (Math.abs(i - cycle * 1.0) % 16) < 6.0; 
            
            if (traffic1 || traffic2 || traffic3) {
                this.bCtx.fillStyle = traffic1 ? '#00e5ff' : (traffic2 ? '#ff00aa' : '#ffd700'); 
                let laneOffset = traffic1 ? 0.2 : (traffic2 ? 0.5 : 0.8); 
                let tWidth1 = Math.max(2, 60 * pct1); let tWidth2 = Math.max(2, 60 * pct2);
                this.bCtx.beginPath();
                let lx1 = cx - w1/2 - railW1 - (terrWBot * pct1 * laneOffset);
                let lx2 = cx - w2/2 - railW2 - (terrWBot * pct2 * laneOffset);
                this.bCtx.moveTo(lx1, y1); this.bCtx.lineTo(lx1 - tWidth1, y1);
                this.bCtx.lineTo(lx2 - tWidth2, y2); this.bCtx.lineTo(lx2, y2); this.bCtx.fill();
                this.bCtx.beginPath();
                let rx1 = cx + w1/2 + railW1 + (terrWBot * pct1 * laneOffset);
                let rx2 = cx + w2/2 + railW2 + (terrWBot * pct2 * laneOffset);
                this.bCtx.moveTo(rx1, y1); this.ctx.lineTo(rx1 + tWidth1, y1);
                this.bCtx.lineTo(rx2 + tWidth2, y2); this.bCtx.lineTo(rx2, y2); this.bCtx.fill();
            }
        }
    }

    drawShadow(x, y, scale) {
        const img = this.sprites.shadow; 
        if (!img || !img.complete || img.naturalWidth === 0) return;
        const cx = Math.round(img.naturalWidth * scale); 
        const cy = Math.round(img.naturalHeight * scale);
        this.ctx.save(); 
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(img, Math.round(x - cx/2), Math.round(y - cy/2), cx, cy);
        this.ctx.restore();
    }

    drawPlayer(now, x, y, scale) {
        const img = this.sprites.player; if (!img.complete || img.naturalWidth === 0) return;
        const cx = Math.round(img.naturalWidth * scale); const cy = Math.round(img.naturalHeight * scale);
        this.ctx.save(); this.ctx.imageSmoothingEnabled = false; 
        this.ctx.drawImage(img, Math.round(x - cx/2), Math.round(y - cy/2), cx, cy);
        this.ctx.restore();
    }
    
    drawOpponent(type, x, y, scale, alarmOcc) {
        const img = this.sprites[type]; if (!img || !img.complete || img.naturalWidth === 0) return;
        const cx = Math.round(img.naturalWidth * scale); const cy = Math.round(img.naturalHeight * scale);
        this.ctx.save(); this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(img, Math.round(x - cx/2), Math.round(y - cy/2), cx, cy);
        this.ctx.restore();

        if (alarmOcc) {
            const timeRemaining = Math.max(0, alarmOcc.date - Date.now());
            const hrs = Math.floor(timeRemaining / 3600000).toString().padStart(2, '0');
            const mins = Math.floor((timeRemaining % 3600000) / 60000).toString().padStart(2, '0');
            const secs = Math.floor((timeRemaining % 60000) / 1000).toString().padStart(2, '0');
            const countdown = `${hrs}:${mins}:${secs}`;
            const baseFontSize = Math.max(10, 16 * (scale / 5)); 
            const countdownFontSize = Math.max(14, 24 * (scale / 5)); 
            const label = (alarmOcc.alarm.label || 'ALARM').toUpperCase();
            const maxBoxWidth = Math.max(200, 350 * (scale / 5));
            const lines = this.getWrappedLines(label, maxBoxWidth, baseFontSize);
            const boxPadding = 12; const labelLineHeight = baseFontSize + 6; const countdownLineHeight = countdownFontSize + 8;
            let longestLineWidth = 0;
            lines.forEach(l => { const w = this.ctx.measureText(l).width; if (w > longestLineWidth) longestLineWidth = w; });
            const boxW = Math.max(longestLineWidth, this.ctx.measureText(countdown).width) + (boxPadding * 2);
            const boxH = (lines.length * labelLineHeight) + countdownLineHeight + (boxPadding * 2);
            const boxX = x - boxW/2; const boxY = y - cy/2 - boxH - 20;
            if (scale > 0.8) {
                this.drawSNESBox(boxX, boxY, boxW, boxH, 0.85);
                lines.forEach((line, i) => { this.drawRetroText(line, x, boxY + boxPadding + (i * labelLineHeight) + (labelLineHeight / 2), baseFontSize, '#ffffff', 'center'); });
                this.drawRetroText(countdown, x, boxY + boxH - boxPadding - (countdownLineHeight / 2), countdownFontSize, '#e6c835', 'center');
            }
        }
    }

    render(now) {
        if (!this.hasReceivedData) return;
        const nowTime = now.getTime();
        if (nowTime - this.lastFrameTime < 1000 / this.fps) return; 
        this.lastFrameTime = nowTime;
        const vw = this.vw; const vh = this.vh; const vHorizon = vh * 0.40; const vcx = vw / 2;
        const nw = this.canvas.width; const nh = this.canvas.height; const nHorizon = nh * 0.40; const ncx = nw / 2;
        const elevenHoursMs = 11 * 60 * 60 * 1000; const windowMs = 1.5 * 60 * 60 * 1000; 
        
        const isRinging = this.activeRings.length > 0;
        const visibleAlarms = this.alarms.filter(occ => !this.activeRings.some(ring => String(ring.id) === String(occ.alarm.id)) && (occ.date - nowTime) <= elevenHoursMs);
        const carAlarms = visibleAlarms.filter(occ => (occ.date - nowTime) <= windowMs);
        
        if(this.isPassing && (Date.now() - this.passingStartTime >= 2500)) this.isPassing = false; 
        this.position += this.isPassing ? 4.5 : 1.2;
        let offset = this.position % 1; let cycle = Math.floor(this.position);

        const skyBands = 8;
        const bandH = vHorizon / skyBands;
        const skyColors = ['#2b84ff', '#3b8fff', '#4b9aff', '#5ba5ff', '#6bb0ff', '#7bbbff', '#8bc6ff', '#dff2ff'];
        skyColors.forEach((col, i) => {
            this.bCtx.fillStyle = col;
            this.bCtx.fillRect(0, i * bandH, vw, bandH + 1);
        });

        const citySway = Math.floor(Math.sin(this.position * 0.05) * (vw * 0.05));

        this.bCtx.fillStyle = '#1a234f'; 
        for (let b = -30; b < 90; b++) {
            let bHash = Math.abs(b); 
            let bx = Math.floor(b * (vw / 60)) + citySway;
            let bh = 15 + Math.abs(Math.sin(bHash * 12.3) * 35) + Math.abs(Math.cos(bHash * 7.1) * 20);
            
            if (bx + (vw / 60) + 1 < 0 || bx > vw) continue;

            this.bCtx.fillRect(bx, vHorizon - bh, (vw / 60) + 1, bh);
            
            this.bCtx.fillStyle = '#141b3d'; 
            for (let dy = 0; dy < bh; dy += 4) {
                if ((bHash + dy) % 8 === 0) this.bCtx.fillRect(bx, vHorizon - bh + dy, 2, 2);
            }

            if (bHash % 3 === 0) {
                this.bCtx.fillStyle = '#3f4f85';
                this.bCtx.fillRect(bx + 2, vHorizon - bh + 8, 3, bh - 16);
                if (bHash % 6 === 0) {
                    this.bCtx.fillStyle = '#6db2ff';
                    this.bCtx.fillRect(bx + 2, vHorizon - (bh * 0.65), 3, 5);
                    if (Math.abs(Math.sin(bHash * 42.5)) > 0.8) {
                        this.bCtx.fillStyle = '#e6c835';
                        this.bCtx.fillRect(bx + 2, vHorizon - (bh * 0.4), 2, 2);
                    }
                }
                this.bCtx.fillStyle = '#1a234f';
            }
        }
        this.drawMode7Track(vHorizon, vw, vh, vcx, offset, cycle, this.isPassing);

        this.ctx.imageSmoothingEnabled = false; this.ctx.clearRect(0, 0, nw, nh);
        this.ctx.drawImage(this.buffer, 0, 0, nw, nh); 

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        this.ctx.font = '64px "Press Start 2P"';
        const clockWidth = this.ctx.measureText(timeStr).width;
        const clockBoxW = clockWidth + 60;
        const clockBoxH = 110;
        const clockBoxY = 20;
        this.drawSNESBox(ncx - clockBoxW/2, clockBoxY, clockBoxW, clockBoxH, 0.85);
        this.drawRetroText(timeStr, ncx, clockBoxY + (clockBoxH / 2), 64, '#e6c835', 'center', true);

        const pixelStep = 6; 
        const userScale = Math.max(4, nw / 300); const carBaseY = nh - (nh * 0.15); 
        const driftX = Math.floor((Math.sin(this.position * 0.05) * (nw * 0.03)) / pixelStep) * pixelStep;

        let renderQueue = [];
        
        // --- ADDED TIGHT SHADOWS ---
        // Negative offset pulls the shadow up closer behind the ship
        const scaledHoverBaseY = -8 * (nh / 900); 

        // 1. Queue Player Car + Shadow
        renderQueue.push({ y: carBaseY, draw: () => {
            const pImg = this.sprites.player;
            if (pImg.complete) {
                this.drawShadow(ncx + driftX, carBaseY + (pImg.naturalHeight * userScale) / 2 + scaledHoverBaseY, userScale);
            }
            this.drawPlayer(nowTime / 1000, ncx + driftX, carBaseY, userScale);
        }});

        // 2. Queue Opponent Cars + Shadows
        carAlarms.forEach((occ, index) => {
            const timeDiff = occ.date - nowTime;
            let trackYPct = Math.pow(1 - Math.max(0, timeDiff / windowMs), 5.0); 
            const carY = Math.floor((nHorizon + trackYPct * (carBaseY - nHorizon)) / pixelStep) * pixelStep;
            const trackWidthAtY = (nw * 0.05) + trackYPct * (nw * 1.8 - nw * 0.05);
            const id = String(occ.alarm.id || "temp");
            const carData = this.spriteMap[id] || { type: 'opp1', laneDir: 1 };
            let avoidance = trackYPct > 0.7 ? (trackYPct - 0.7) * 3.33 * (nw * 0.12) * carData.laneDir : 0;
            const carXOffset = Math.floor(((trackWidthAtY * 0.08) * carData.laneDir + Math.sin(this.position * 0.08 + index * 4) * (trackWidthAtY * 0.03) + avoidance) / pixelStep) * pixelStep; 
            
            renderQueue.push({ y: carY, draw: () => {
                const carScale = (userScale * 0.1) + ((userScale * 0.9) * trackYPct);
                const oppImg = this.sprites[carData.type];
                if (oppImg && oppImg.complete) {
                    this.drawShadow(ncx + carXOffset, carY + (oppImg.naturalHeight * carScale) / 2 + scaledHoverBaseY * (carScale / userScale), carScale);
                }
                this.drawOpponent(carData.type, ncx + carXOffset, carY, carScale, occ);
            }});
        });
        
        // 3. Queue Passing Car + Shadow
        if(this.isPassing && this.passedAlarm) {
            const passingPct = (Date.now() - this.passingStartTime) / 2500; 
            const id = String(this.passedAlarm.alarm.id || "temp");
            const passCarData = this.spriteMap[id] || { type: 'opp1', laneDir: 1 };
            const passY = Math.floor((carBaseY + passingPct * (nh * 0.8)) / pixelStep) * pixelStep;
            const loomX = Math.floor((ncx + (driftX * 0.5) + (passCarData.laneDir * (nw * 0.15)) + (passCarData.laneDir * passingPct * nw * 0.5)) / pixelStep) * pixelStep;
            
            renderQueue.push({ y: passY, draw: () => {
                const passScale = userScale + passingPct * (userScale * 1.5);
                const passImg = this.sprites[passCarData.type];
                if (passImg && passImg.complete) {
                    this.drawShadow(loomX, passY + (passImg.naturalHeight * passScale) / 2 + scaledHoverBaseY * (passScale / userScale), passScale);
                }
                this.drawOpponent(passCarData.type, loomX, passY, passScale, null);
            }});
        }

        renderQueue.sort((a, b) => a.y - b.y).forEach(item => item.draw());

        if (isRinging && !this.isPassing) {
            if (!this.ringClickListener) {
                this.ringClickListener = () => window.stopAlarm();
                setTimeout(() => document.addEventListener('click', this.ringClickListener), 50);
                this.canvas.style.cursor = 'pointer';
            }
            const labelText = (this.activeRings[0].label || 'ALARM').toUpperCase();
            const modalFontSize = 48;
            const modalWidth = Math.min(800, nw * 0.8);
            const modalLines = this.getWrappedLines(labelText, modalWidth - 100, modalFontSize);
            const modalLineHeight = modalFontSize + 15;
            const boxH = (modalLines.length * modalLineHeight) + 180;
            const boxY = nh / 2 - boxH / 2;
            this.drawSNESBox(ncx - modalWidth/2, boxY, modalWidth, boxH);
            modalLines.forEach((line, i) => { this.drawRetroText(line, ncx, boxY + 60 + (i * modalLineHeight) + (modalLineHeight / 2), modalFontSize, '#ffffff', 'center', true); });
            this.drawRetroText(Math.floor(Date.now() / 250) % 2 === 0 ? "► STOP ALARM ◄" : "  STOP ALARM  ", ncx, boxY + boxH - 80, 36, '#e6c835', 'center', true); 
        }
    }

    destroy() { this.stopRing(); }
}
