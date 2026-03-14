export default class TetrisVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.swimmers = []; 
        this.ripples = []; 
        this.alarms = []; 
        this.shockwaves = []; 
        this.activeRings = []; 
        this.ringEchoes = []; 
        this.lastEchoTime = 0; 
        this.echoBurstCount = 0; 
        this.screenFlash = 0; 
        this.laneMap = {};
        this.nextLaneIndex = 0;
        this.lastRippleSec = -1;
        this.lastSwimmerSec = -1;
        this.lastExplosionMin = -1; 
        this.pulseIntensity = 0;
        this.ringClickListener = null;
    }

    init() {
        this.particles = [];
        this.swimmers = [];
        this.ripples = [];
        this.alarms = [];
        this.shockwaves = [];
        this.activeRings = [];
        this.ringEchoes = [];
        this.echoBurstCount = 0;
        this.screenFlash = 0;
        
        const numParticles = window.innerWidth < 768 ? 150 : 300; 
        const colors = ['#00f0ff', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ffffff'];
        
        for (let i = 0; i < numParticles; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                baseSpeedX: (Math.random() - 0.5) * 0.2, 
                baseSpeedY: (Math.random() - 1) * 0.3 - 0.1, 
                vx: 0, vy: 0, 
                color: colors[Math.floor(Math.random() * colors.length)],
                baseOpacity: Math.random() * 0.3 + 0.1, 
                flashGroup: i % 5,
                life: 999 
            });
        }
    }

    updateAlarms(nextOccurrences) {
        this.alarms = nextOccurrences;
    }

    handleRing(alarm) {
        this.activeRings.push(alarm);
        this.screenFlash = 1.0; 
        this.ringEchoes = [];
        this.lastEchoTime = 0; 
        this.echoBurstCount = 0; 
        
        if (!this.ringClickListener) {
            this.ringClickListener = () => {
                window.stopAlarm();
            };
            setTimeout(() => {
                document.addEventListener('click', this.ringClickListener);
                this.canvas.style.cursor = 'pointer';
            }, 100);
        }
    }

    stopRing() {
        this.activeRings = [];
        this.ringEchoes = [];
        this.echoBurstCount = 0;
        if (this.ringClickListener) {
            document.removeEventListener('click', this.ringClickListener);
            this.ringClickListener = null;
            this.canvas.style.cursor = 'default';
        }
    }

    spawnSwimmer() {
        if (this.swimmers.length >= 3) return; 

        const fromLeft = Math.random() > 0.5;
        const sizeScale = Math.random() * 2.0 + 0.5; 
        const speedMagnitude = (sizeScale * 2.0) + 5.0; 

        this.swimmers.push({
            x: fromLeft ? -150 : this.canvas.width + 150,
            y: Math.random() * (this.canvas.height * 0.6) + (this.canvas.height * 0.1),
            speedX: speedMagnitude * (fromLeft ? 1 : -1), 
            amplitude: Math.random() * 80 + 30, 
            frequency: Math.random() * 0.015 + 0.005, 
            sizeScale: sizeScale,
            time: 0,
            color: Math.random() > 0.5 ? '#00f0ff' : '#ffffff'
        });
    }

    spawnShockwave() {
        this.screenFlash = 0.8; 
        
        const spawnX = this.canvas.width * 0.15 + Math.random() * (this.canvas.width * 0.7);
        const spawnY = this.canvas.height * 0.15 + Math.random() * (this.canvas.height * 0.7);
        
        const shapes = ['circle', 'triangle', 'pentagon', 'hexagon'];
        const burstShape = shapes[Math.floor(Math.random() * shapes.length)];
        
        const ringColors = ['#ffffff', '#00f0ff', '#8b5cf6'];
        for(let i = 0; i < 3; i++) {
            this.shockwaves.push({
                x: spawnX,
                y: spawnY,
                radius: 10,
                speed: 25 + (i * 15), 
                thickness: 30 - (i * 5),
                color: ringColors[i],
                shape: burstShape, 
                life: 1.0,
                decay: 0.015 + (i * 0.005) 
            });
        }
    }

    render(now) {
        const time = Date.now();
        const currentSec = now.getSeconds();
        const currentMin = now.getMinutes();
        const currentMs = now.getMilliseconds();
        this.pulseIntensity = Math.sin(Math.PI * currentMs / 1000); 

        const isRinging = this.activeRings.length > 0;

        if (isRinging) {
            this.ctx.fillStyle = '#f8fafc'; 
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalCompositeOperation = 'source-over'; 
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalCompositeOperation = 'lighter'; 
        }

        if (currentSec === 0 && currentMin !== this.lastExplosionMin && !isRinging) {
            this.spawnShockwave();
            this.lastExplosionMin = currentMin;
        }

        if (currentSec % 8 === 0 && currentSec !== this.lastSwimmerSec && !isRinging) {
            this.spawnSwimmer();
            this.lastSwimmerSec = currentSec;
        }

        if (currentSec % 5 === 0 && currentSec !== this.lastRippleSec) {
            const directions = [
                { axis: 'x', speed: 12, startPos: -100 },                     
                { axis: 'x', speed: -12, startPos: this.canvas.width + 100 }, 
                { axis: 'y', speed: 12, startPos: -100 },                     
                { axis: 'y', speed: -12, startPos: this.canvas.height + 100 } 
            ];
            const dir = directions[Math.floor(Math.random() * directions.length)];
            this.ripples.push({ axis: dir.axis, speed: dir.speed, pos: dir.startPos, thickness: 350, force: 0.25 });
            this.lastRippleSec = currentSec;
        }
        
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            let r = this.ripples[i];
            r.pos += r.speed; 
            if (r.pos < -500 || r.pos > Math.max(this.canvas.width, this.canvas.height) + 500) this.ripples.splice(i, 1);
        }

        for (let i = this.swimmers.length - 1; i >= 0; i--) {
            let s = this.swimmers[i];
            s.time++; s.x += s.speedX;
            let currentY = s.y + Math.sin(s.time * s.frequency) * s.amplitude;

            let particlesToEmit = s.sizeScale > 1.5 ? 3 : 1;
            let emitOpacity = s.sizeScale > 1.5 ? 0.15 : 0.3; 

            if (this.particles.length < 800 && !isRinging) {
                for(let j = 0; j < particlesToEmit; j++) {
                    this.particles.push({
                        x: s.x + (Math.random() * 8 * s.sizeScale - 4 * s.sizeScale),
                        y: currentY + (Math.random() * 8 * s.sizeScale - 4 * s.sizeScale), 
                        size: (Math.random() * 2.0 + 0.5) * s.sizeScale, 
                        baseSpeedX: -s.speedX * 0.08 + (Math.random() - 0.5) * 0.5, 
                        baseSpeedY: (Math.random() - 0.5) * 1.5 * s.sizeScale, 
                        vx: 0, vy: 0, color: s.color, 
                        baseOpacity: emitOpacity, 
                        flashGroup: 0, 
                        life: 1.0, decay: 0.003
                    });
                }
            }
            if (s.x < -300 || s.x > this.canvas.width + 300) this.swimmers.splice(i, 1);
        }

        let activeGroup = currentSec % 5;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];

            this.ripples.forEach(r => {
                const dist = p[r.axis] - r.pos;
                if (Math.abs(dist) < r.thickness) {
                    const push = Math.sin((dist / r.thickness) * Math.PI) * r.force;
                    if (r.axis === 'x') { p.vx += push * Math.sign(r.speed); p.vy += push * 0.4; } 
                    else { p.vy += push * Math.sign(r.speed); p.vx += push * 0.4; }
                }
            });

            p.x += p.baseSpeedX + p.vx; p.y += p.baseSpeedY + p.vy;
            p.vx *= 0.90; p.vy *= 0.90;

            if (p.life === 999) {
                p.x += Math.sin(time * 0.001 + p.y * 0.01) * 0.3;
                if (p.y < 0) p.y = this.canvas.height;
                if (p.y > this.canvas.height) p.y = 0;
                if (p.x < 0) p.x = this.canvas.width;
                if (p.x > this.canvas.width) p.x = 0;
            } else {
                p.life -= p.decay;
                p.size = Math.max(0.1, p.size * 0.992); 
                if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            }
            
            let currentOpacity = (p.life === 999) ? p.baseOpacity : (p.life * p.baseOpacity);
            if (p.life === 999 && p.flashGroup === activeGroup && !isRinging) currentOpacity += this.pulseIntensity * 0.8; 
            
            let finalColor = isRinging ? '#334155' : p.color;
            let finalAlpha = isRinging ? Math.min(1, currentOpacity * 1.5) : currentOpacity;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = finalColor;
            this.ctx.globalAlpha = Math.min(1, Math.max(0, finalAlpha));
            this.ctx.fill();
        }

        if (!isRinging) {
            for (let i = this.shockwaves.length - 1; i >= 0; i--) {
                let sw = this.shockwaves[i];
                sw.radius += sw.speed; sw.life -= sw.decay;
                if (sw.life <= 0) { this.shockwaves.splice(i, 1); continue; }
                
                this.ctx.beginPath();
                if (sw.shape === 'circle') { this.ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2); } 
                else {
                    let sides = sw.shape === 'pentagon' ? 5 : (sw.shape === 'hexagon' ? 6 : 3);
                    for (let j = 0; j < sides; j++) {
                        const angle = (j * 2 * Math.PI / sides) - (Math.PI / 2); 
                        const px = sw.x + Math.cos(angle) * sw.radius;
                        const py = sw.y + Math.sin(angle) * sw.radius;
                        if (j === 0) this.ctx.moveTo(px, py); else this.ctx.lineTo(px, py);
                    }
                    this.ctx.closePath();
                }

                this.ctx.strokeStyle = sw.color;
                this.ctx.lineWidth = Math.max(1, sw.thickness * sw.life); 
                this.ctx.globalAlpha = Math.max(0, sw.life);
                this.ctx.shadowBlur = 20; this.ctx.shadowColor = sw.color;
                this.ctx.stroke(); this.ctx.shadowBlur = 0;
            }
        }

        if (this.screenFlash > 0 && !isRinging) {
            this.ctx.fillStyle = `rgba(200, 240, 255, ${this.screenFlash})`;
            this.ctx.globalCompositeOperation = 'screen';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.screenFlash -= 0.02; 
            this.ctx.globalCompositeOperation = 'lighter';
        }

        this.ctx.globalAlpha = 1.0;
        this.ctx.globalCompositeOperation = 'source-over';

        const clockEl = document.getElementById('visClock');
        let matrixFloor = this.canvas.height * 0.8; 
        if (clockEl) { const rect = clockEl.getBoundingClientRect(); matrixFloor = rect.top - 5; }

        const MAX_LOOKAHEAD_MS = 2 * 60 * 60 * 1000; 
        const blockWidth = Math.min(420, (this.canvas.width * 0.94) / 3); 
        const minGap = 20; const laneGap = 25; 
        const centerX = this.canvas.width / 2;
        const laneXs = [centerX - (blockWidth * 1.5) - laneGap, centerX - (blockWidth / 2), centerX + (blockWidth / 2) + laneGap];

        const matrixWidth = (blockWidth * 3) + (laneGap * 2) + 60; 
        const matrixX = centerX - (matrixWidth / 2);
        const matrixTop = -50; 

        this.ctx.beginPath();
        this.ctx.moveTo(matrixX, matrixTop); this.ctx.lineTo(matrixX, matrixFloor);          
        this.ctx.lineTo(matrixX + matrixWidth, matrixFloor); this.ctx.lineTo(matrixX + matrixWidth, matrixTop);    
        
        this.ctx.strokeStyle = isRinging ? 'rgba(15, 23, 42, 0.2)' : 'rgba(0, 240, 255, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = isRinging ? 'transparent' : 'rgba(0, 240, 255, 0.8)';
        this.ctx.shadowBlur = isRinging ? 0 : 15;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; 

        let laneLowestY = [matrixFloor + minGap, matrixFloor + minGap, matrixFloor + minGap]; 
        let currentIds = [];

        this.alarms.forEach(occ => {
            const diffMs = occ.date - now;
            if (diffMs > MAX_LOOKAHEAD_MS || diffMs < -5000) return;
            const uniqueId = `alarm-${occ.alarm.id}-${occ.date.getTime()}`;
            currentIds.push(uniqueId);
            if (this.laneMap[uniqueId] === undefined) { this.laneMap[uniqueId] = this.nextLaneIndex; this.nextLaneIndex = (this.nextLaneIndex + 1) % 3; }
        });

        for (let id in this.laneMap) { if (!currentIds.includes(id)) delete this.laneMap[id]; }

        this.alarms.forEach(occ => {
            const diffMs = occ.date - now;
            if (diffMs > MAX_LOOKAHEAD_MS || diffMs < -5000) return;
            
            let thisBlockIsRinging = diffMs <= 0 && diffMs > -5000; 
            if (thisBlockIsRinging && isRinging) return;

            const uniqueId = `alarm-${occ.alarm.id}-${occ.date.getTime()}`;
            const lane = this.laneMap[uniqueId];
            const x = laneXs[lane];

            this.ctx.font = 'bold 22px monospace';
            let label = occ.alarm.label || 'ALARM';
            let words = label.split(' '); let line = ''; let lines = [];
            let maxTextWidth = blockWidth - 30; 
            
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                let metrics = this.ctx.measureText(testLine);
                if (metrics.width > maxTextWidth && n > 0) { lines.push(line.trim()); line = words[n] + ' '; } 
                else { line = testLine; }
            }
            lines.push(line.trim());
            if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].substring(0, lines[2].length - 3) + '...'; }

            const blockHeight = 115 + (lines.length * 25);
            const stepMs = 30000; 
            let steppedDiffMs = Math.ceil(diffMs / stepMs) * stepMs;
            if (steppedDiffMs < 0) steppedDiffMs = 0;

            let percentUp = steppedDiffMs / MAX_LOOKAHEAD_MS;
            let idealBottomY = matrixFloor - Math.max(0, percentUp) * (matrixFloor - 50);
            let actualBottomY = Math.min(idealBottomY, laneLowestY[lane] - minGap);
            let y = actualBottomY - blockHeight;
            laneLowestY[lane] = y;

            let isCritical = diffMs < 5 * 60 * 1000;
            let isSoon = diffMs < 30 * 60 * 1000;
            let breathePhase = (Math.sin(time / 400) + 1) / 2; 
            let isPeak = breathePhase > 0.8; 
            
            let mainColor = isRinging ? '#94a3b8' : (isCritical ? (isPeak ? '#ffffff' : '#00f0ff') : (isSoon ? '#facc15' : '#00f0ff'));
            let shadowColor = isRinging ? 'transparent' : (isCritical ? `rgba(255, 255, 255, ${0.4 + breathePhase * 0.6})` : (isSoon ? 'rgba(250, 204, 21, 0.4)' : 'rgba(0, 240, 255, 0.4)'));
            let fillColor = isRinging ? 'rgba(15, 23, 42, 0.05)' : (isCritical ? `rgba(255, 255, 255, ${0.1 + breathePhase * 0.9})` : 'rgba(15, 23, 42, 0.6)');
            let textColor = isRinging ? '#94a3b8' : (isCritical && isPeak ? '#020617' : '#ffffff');
            
            this.ctx.beginPath();
            if (this.ctx.roundRect) this.ctx.roundRect(x, y, blockWidth, blockHeight, 8); else this.ctx.rect(x, y, blockWidth, blockHeight);
            
            this.ctx.fillStyle = fillColor; this.ctx.fill();
            this.ctx.strokeStyle = mainColor; this.ctx.lineWidth = 2;
            this.ctx.shadowColor = shadowColor; this.ctx.shadowBlur = isRinging ? 0 : (isCritical ? 15 + (breathePhase * 25) : 15);
            this.ctx.stroke(); this.ctx.shadowBlur = 0;

            const h = Math.floor(Math.max(0, diffMs) / 3600000).toString().padStart(2, '0');
            const m = Math.floor((Math.max(0, diffMs) % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((Math.max(0, diffMs) % 60000) / 1000).toString().padStart(2, '0');

            this.ctx.textAlign = 'center'; this.ctx.fillStyle = textColor;
            if (!isRinging && (!isCritical || !isPeak)) { this.ctx.shadowColor = mainColor; this.ctx.shadowBlur = 10; }
            
            this.ctx.font = 'bold 22px monospace'; let startY = y + 35; 
            for(let k = 0; k < lines.length; k++) { this.ctx.fillText(lines[k], x + (blockWidth / 2), startY + (k * 26)); }

            this.ctx.fillStyle = textColor; this.ctx.font = 'bold 54px monospace';
            this.ctx.fillText(`${h}:${m}:${s}`, x + (blockWidth / 2), actualBottomY - 20);
            this.ctx.shadowBlur = 0; 
        });

        if (isRinging) {
            const alarm = this.activeRings[0];
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            
            const boxW = Math.min(1100, this.canvas.width * 0.95);
            const boxH = 400;
            const boxX = cx - boxW / 2;
            const boxY = cy - boxH / 2;

            let echoInterval = this.echoBurstCount < 3 ? 300 : 2000;
            
            if (time - this.lastEchoTime > echoInterval) {
                this.ringEchoes.push({
                    expand: 0,
                    speed: 4, 
                    thickness: 25, 
                    color: '#334155', 
                    life: 1.0,
                    decay: 0.008 
                });
                
                this.lastEchoTime = time;
                this.echoBurstCount++;
                
                if (this.echoBurstCount >= 4) {
                    this.echoBurstCount = 1; 
                }
            }

            for (let i = this.ringEchoes.length - 1; i >= 0; i--) {
                let e = this.ringEchoes[i];
                e.expand += e.speed; e.life -= e.decay; 
                if (e.life <= 0) { this.ringEchoes.splice(i, 1); continue; }
                
                this.ctx.beginPath();
                if (this.ctx.roundRect) this.ctx.roundRect(boxX - e.expand, boxY - e.expand, boxW + (e.expand * 2), boxH + (e.expand * 2), 16 + (e.expand * 0.05)); 
                else this.ctx.strokeRect(boxX - e.expand, boxY - e.expand, boxW + (e.expand * 2), boxH + (e.expand * 2));
                
                this.ctx.strokeStyle = e.color; 
                this.ctx.lineWidth = e.thickness; 
                this.ctx.globalAlpha = Math.max(0, e.life);
                this.ctx.stroke();
            }
            this.ctx.globalAlpha = 1.0; 

            this.ctx.fillStyle = '#0f172a'; 
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            this.ctx.shadowBlur = 30;
            
            this.ctx.beginPath();
            if (this.ctx.roundRect) this.ctx.roundRect(boxX, boxY, boxW, boxH, 16); else this.ctx.rect(boxX, boxY, boxW, boxH);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // --- 4. DYNAMIC FONT SCALING ENGINE ---
            this.ctx.fillStyle = '#ffffff';
            this.ctx.textAlign = 'center';
            
            let label = alarm.label || 'ALARM';
            let words = label.split(' ');
            let lines = [];
            let fontSize = 54;
            let lineHeight = 65;

            // Try different formats (Size, LineHeight, MaxLines Allowed)
            const formats = [
                { size: 90, lh: 100, maxLines: 1 },
                { size: 70, lh: 85, maxLines: 2 },
                { size: 54, lh: 65, maxLines: 3 }
            ];

            for (let format of formats) {
                this.ctx.font = `bold ${format.size}px monospace`;
                let currentLine = '';
                let testLines = [];

                for (let n = 0; n < words.length; n++) {
                    let testLine = currentLine + words[n] + ' ';
                    let metrics = this.ctx.measureText(testLine);
                    // Leave 100px padding so it doesn't touch the edges
                    if (metrics.width > boxW - 100 && n > 0) {
                        testLines.push(currentLine.trim());
                        currentLine = words[n] + ' ';
                    } else {
                        currentLine = testLine;
                    }
                }
                testLines.push(currentLine.trim());

                // If this format successfully fit the text within its max allowed lines, lock it in!
                if (testLines.length <= format.maxLines) {
                    fontSize = format.size;
                    lineHeight = format.lh;
                    lines = testLines;
                    break; 
                }
            }

            // Fallback: If it's incredibly long and exceeded 3 lines even at 54px, force it to 54px and truncate
            if (lines.length === 0 || lines.length > 3) {
                fontSize = 54;
                lineHeight = 65;
                this.ctx.font = `bold ${fontSize}px monospace`;
                let currentLine = '';
                lines = [];
                for (let n = 0; n < words.length; n++) {
                    let testLine = currentLine + words[n] + ' ';
                    let metrics = this.ctx.measureText(testLine);
                    if (metrics.width > boxW - 100 && n > 0) {
                        lines.push(currentLine.trim());
                        currentLine = words[n] + ' ';
                    } else {
                        currentLine = testLine;
                    }
                }
                lines.push(currentLine.trim());
                if (lines.length > 3) {
                    lines.length = 3;
                    lines[2] = lines[2].substring(0, lines[2].length - 3) + '...';
                }
            }

            // Render the final lines with the dynamically chosen font size
            this.ctx.font = `bold ${fontSize}px monospace`;
            const blockCenterY = boxY + 160; 
            let startY = blockCenterY - ((lines.length - 1) * (lineHeight / 2));
            
            for(let k = 0; k < lines.length; k++) {
                this.ctx.fillText(lines[k], cx, startY + (k * lineHeight));
            }

            // 5. Render Outlined STOP ALARM Button
            const btnW = 280;
            const btnH = 60;
            const btnX = cx - btnW / 2;
            const btnY = boxY + boxH - 90;

            this.ctx.strokeStyle = '#00f0ff'; 
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            if (this.ctx.roundRect) this.ctx.roundRect(btnX, btnY, btnW, btnH, 8); else this.ctx.strokeRect(btnX, btnY, btnW, btnH);
            this.ctx.stroke();

            this.ctx.fillStyle = '#00f0ff';
            this.ctx.font = 'bold 26px monospace';
            this.ctx.fillText("STOP ALARM", cx, btnY + 40);
        }
    }

    destroy() { 
        this.particles = [];
        this.shockwaves = [];
        this.swimmers = [];
        this.ripples = [];
        this.ringEchoes = [];
        this.stopRing();
    }
}