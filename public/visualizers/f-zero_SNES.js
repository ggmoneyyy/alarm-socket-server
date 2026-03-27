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
        
        this.trackHeading = 0; 

        this.startupSound = new Audio('visualizers/sounds/f-zero_startup.mp3');
        this.startupSound.loop = false;

        this.bgMusic = new Audio('visualizers/sounds/bg_music.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.3; 
        this.isMusicPlaying = false; 
        this.wasMusicPlayingBeforeAlarm = false;
        this.musicBtn = null;

        this.sprites = { 
            player: new Image(), 
            opp1: new Image(), 
            opp2: new Image(), 
            opp3: new Image(), 
            shadow: new Image(),
            skybox: new Image(),
            trackStraight: new Image()
        };
        this.sprites.player.src = 'visualizers/sprites/player.png';
        this.sprites.opp1.src = 'visualizers/sprites/opponent1.png';
        this.sprites.opp2.src = 'visualizers/sprites/opponent2.png';
        this.sprites.opp3.src = 'visualizers/sprites/opponent3.png';
        this.sprites.shadow.src = 'visualizers/sprites/shadow.png'; 
        this.sprites.skybox.src = 'visualizers/sprites/skybox.png'; 
        this.sprites.trackStraight.src = 'visualizers/sprites/track_straight.png'; 
    }

    createMusicToggle() {
        if (this.musicBtn) return;
        this.musicBtn = document.createElement('button');
        
        // Boosted z-index to 9999 to guarantee it sits above the canvas
        this.musicBtn.style.cssText = 'position: absolute; top: 70px; right: 20px; width: 44px; height: 44px; border-radius: 50%; background: rgba(0,0,0,0.6); border: 2px solid #e6c835; color: #e6c835; cursor: pointer; opacity: 0.4; transition: opacity 0.2s, transform 0.1s; display: flex; justify-content: center; align-items: center; z-index: 9999; padding: 0; outline: none;';
        
        this.musicBtn.onmouseenter = () => this.musicBtn.style.opacity = '1.0';
        this.musicBtn.onmouseleave = () => this.musicBtn.style.opacity = '0.4';
        this.musicBtn.onmousedown = () => this.musicBtn.style.transform = 'scale(0.9)';
        this.musicBtn.onmouseup = () => this.musicBtn.style.transform = 'scale(1)';

        this.updateMusicIcon();

        this.musicBtn.onclick = () => {
            this.isMusicPlaying = !this.isMusicPlaying;
            this.updateMusicIcon();
            
            if (this.activeRings.length > 0) {
                this.wasMusicPlayingBeforeAlarm = this.isMusicPlaying;
            } else {
                if (this.isMusicPlaying) {
                    this.bgMusic.play().catch(e => { console.log("BG Music play failed:", e); this.isMusicPlaying = false; this.updateMusicIcon(); });
                } else {
                    this.bgMusic.pause();
                }
            }
        };

        // --- FIXED: Anchor to the visualizer container instead of the whole page ---
        if (this.canvas && this.canvas.parentElement) {
            // Force the parent to be the relative anchor point so 'top: 70px, right: 20px' behaves correctly
            if (window.getComputedStyle(this.canvas.parentElement).position === 'static') {
                this.canvas.parentElement.style.position = 'relative';
            }
            this.canvas.parentElement.appendChild(this.musicBtn);
        } else {
            // Fallback just in case
            document.body.appendChild(this.musicBtn);
        }
    }

    updateMusicIcon() {
        if (!this.musicBtn) return;
        if (this.isMusicPlaying) {
            this.musicBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
        } else {
            this.musicBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"/></svg>`;
        }
    }

    init() {
        this.alarms = []; this.activeRings = []; this.position = 0; this.hasReceivedData = false;
        this.lastDisplayAlarm = null; this.isPassing = false; this.passedAlarm = null;
        this.passingStartTime = 0; this.lastFrameTime = 0;
        this.trackScroll = 0; 
        this.trackHeading = 0; 

        this.startupSound.currentTime = 0; 
        this.startupSound.play().catch(e => console.log("Browser autoplay policy prevented the startup sound:", e));

        this.createMusicToggle();
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
        if (this.activeRings.length === 0) {
            this.wasMusicPlayingBeforeAlarm = this.isMusicPlaying;
            if (this.isMusicPlaying) this.bgMusic.pause();
        }
        this.activeRings.push(alarm); 
    }

    stopRing() {
        if (this.activeRings.length > 0) {
            const stoppedAlarm = this.activeRings[0];
            const currentOcc = this.alarms.find(o => String(o.alarm.id) === String(stoppedAlarm.id)) || { alarm: stoppedAlarm };
            
            this.isPassing = true;
            this.passedAlarm = currentOcc;
            this.passingStartTime = Date.now();
        }

        this.activeRings = [];
        if (this.ringClickListener) {
            document.removeEventListener('click', this.ringClickListener);
            this.ringClickListener = null;
            this.canvas.style.cursor = 'default';
        }

        if (this.wasMusicPlayingBeforeAlarm) {
            this.bgMusic.play().catch(e => console.log("Audio resume failed:", e));
            this.wasMusicPlayingBeforeAlarm = false; 
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

    drawSkyboxSprite(horizonY, w, driftOffset) {
        const sky = this.sprites.skybox; 
        if (!sky || !sky.complete || sky.naturalWidth === 0) return;
        
        const scale = horizonY / sky.naturalHeight;
        const scaledWidth = sky.naturalWidth * scale;
        
        const panSpeed = 1.2; 
        let panX = (driftOffset * panSpeed) % scaledWidth;
        if (panX > 0) panX -= scaledWidth; 
        
        this.bCtx.drawImage(sky, panX, 0, scaledWidth, horizonY);
        this.bCtx.drawImage(sky, panX + scaledWidth, 0, scaledWidth, horizonY);
    }

    drawMode7TrackTexture(horizonY, w, h, isFast, trackCurve) {
        this.bCtx.fillStyle = '#091326'; 
        this.bCtx.fillRect(0, horizonY, w, h - horizonY);

        const trk = this.sprites.trackStraight;
        if (!trk || !trk.complete || trk.naturalWidth === 0) return;

        const drawH = h - horizonY;
        const scanlineH = 1; 
        
        const speed = isFast ? 100 : 25;
        this.trackScroll = (this.trackScroll || 0) + speed;
        const scrollOffset = this.trackScroll;

        const camH = 30; 
        const farDstW = 505;  
        const nearDstW = 13100; 

        for (let y = 0; y < drawH; y += scanlineH) {
            let sy = Math.max(1, y);

            let z = camH / (sy / drawH); 
            let texY = Math.floor(scrollOffset - z * 2.0) % trk.naturalHeight;
            if (texY < 0) texY += trk.naturalHeight;
            
            let t = sy / drawH; 
            let dstW = farDstW + t * (nearDstW - farDstW);
            
            let curveOffset = trackCurve * Math.pow(1 - t, 2) * (w * 0.70);
            let dstX = ((w - dstW) / 2) + curveOffset;

            this.bCtx.drawImage(
                trk,
                0, texY, trk.naturalWidth, 1, 
                dstX, horizonY + y, dstW, scanlineH + 0.5 
            );
        }

        let grad = this.bCtx.createLinearGradient(0, horizonY, 0, horizonY + 25);
        grad.addColorStop(0, 'rgba(9, 19, 38, 1.0)'); 
        grad.addColorStop(1, 'rgba(9, 19, 38, 0.0)'); 
        this.bCtx.fillStyle = grad;
        this.bCtx.fillRect(0, horizonY, w, 25);
    }

    drawSpriteWithLean(ctx, img, x, y, scale, leanAmount) {
        if (!img || !img.complete || img.naturalWidth === 0) return;

        let frames = 1;
        let frameW = img.naturalWidth;
        let frameIndex = 0;

        if (img.naturalWidth >= img.naturalHeight * 4.5) {
            frames = 5;
            frameW = img.naturalWidth / 5;
            let leanOffset = Math.round(leanAmount * 2); 
            frameIndex = 2 + leanOffset; 
            frameIndex = Math.max(0, Math.min(4, frameIndex)); 
        }

        const cx = Math.round(frameW * scale); 
        const cy = Math.round(img.naturalHeight * scale);
        
        ctx.save(); 
        ctx.imageSmoothingEnabled = false; 
        ctx.drawImage(img, frameIndex * frameW, 0, frameW, img.naturalHeight, Math.round(x - cx/2), Math.round(y - cy/2), cx, cy);
        ctx.restore();
    }

    drawShadow(x, y, scale, leanAmount = 0) {
        this.drawSpriteWithLean(this.ctx, this.sprites.shadow, x, y, scale, leanAmount);
    }

    drawPlayer(now, x, y, scale, leanAmount) {
        this.drawSpriteWithLean(this.ctx, this.sprites.player, x, y, scale, leanAmount);
    }
    
    drawOpponent(type, x, y, scale, alarmOcc, leanAmount) {
        this.drawSpriteWithLean(this.ctx, this.sprites[type], x, y, scale, leanAmount);

        if (alarmOcc) {
            const img = this.sprites[type];
            const cy = (img && img.complete) ? Math.round(img.naturalHeight * scale) : 0;

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
            this.ctx.font = `${baseFontSize}px "Press Start 2P"`;
            lines.forEach(l => { const w = this.ctx.measureText(l).width; if (w > longestLineWidth) longestLineWidth = w; });
            
            this.ctx.font = `${countdownFontSize}px "Press Start 2P"`;
            const countdownWidth = this.ctx.measureText(countdown).width;
            
            const boxW = Math.max(longestLineWidth, countdownWidth) + (boxPadding * 2);
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
        const vw = this.vw; const vh = this.vh; 
        const nw = this.canvas.width; const nh = this.canvas.height; const ncx = nw / 2;
        const elevenHoursMs = 11 * 60 * 60 * 1000; const windowMs = 1.5 * 60 * 60 * 1000; 

        const vHorizon = vh * 0.22; 
        const nHorizon = nh * 0.22; 
        
        const isRinging = this.activeRings.length > 0;
        
        const visibleAlarms = this.alarms.filter(occ => {
            const isPassingNow = this.isPassing && this.passedAlarm && String(this.passedAlarm.alarm.id) === String(occ.alarm.id);
            return !isPassingNow && (occ.date - nowTime) <= elevenHoursMs;
        });
        const carAlarms = visibleAlarms.filter(occ => (occ.date - nowTime) <= windowMs);
        
        this.position += this.isPassing ? 4.5 : 1.2;

        let wave = Math.sin(this.position * 0.002) + Math.sin(this.position * 0.0035); 
        let rawCurve = 0;
        if (wave > 0.8) rawCurve = wave - 0.8;
        else if (wave < -0.8) rawCurve = wave + 0.8;
        const trackCurve = rawCurve * 0.35; 

        this.trackHeading += trackCurve * 2.5;

        const citySway = -this.trackHeading + Math.sin(this.position * 0.05) * (vw * 0.005);
        
        this.drawSkyboxSprite(vHorizon, vw, citySway);
        this.drawMode7TrackTexture(vHorizon, vw, vh, this.isPassing, trackCurve);

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
        
        const driftX = Math.floor((Math.sin(this.position * 0.05) * (nw * 0.02)) / pixelStep) * pixelStep;

        let renderQueue = [];
        const scaledHoverBaseY = -8 * (nh / 900); 

        const farDstW = 505;  
        const nearDstW = 13100; 
        const roadPct = 0.06;

        const baseTrackLean = trackCurve * 2.5;
        const playerLean = baseTrackLean + (Math.cos(this.position * 0.05) * 0.6);

        renderQueue.push({ z: 100, y: carBaseY, draw: () => {
            const pImg = this.sprites.player;
            if (pImg.complete) {
                this.drawShadow(ncx + driftX, carBaseY + (pImg.naturalHeight * userScale) / 2 + scaledHoverBaseY, userScale, playerLean);
            }
            this.drawPlayer(nowTime / 1000, ncx + driftX, carBaseY, userScale, playerLean);
        }});

        carAlarms.forEach((occ, index) => {
            const timeDiff = occ.date - nowTime;
            let trackYPct = Math.pow(1 - Math.max(0, timeDiff / windowMs), 5.0); 
            const carY = Math.floor((nHorizon + trackYPct * (carBaseY - nHorizon)) / pixelStep) * pixelStep;
            
            const currentDstW = farDstW + trackYPct * (nearDstW - farDstW);
            const trackWidthAtY = currentDstW * roadPct; 

            const id = String(occ.alarm.id || "temp");
            const carData = this.spriteMap[id] || { type: 'opp1', laneDir: 1 };
            let avoidance = trackYPct > 0.7 ? (trackYPct - 0.7) * 3.33 * (nw * 0.12) * carData.laneDir : 0;
            
            const curveOffset = trackCurve * Math.pow(1 - trackYPct, 2) * (nw * 0.70);
            const carXOffset = Math.floor(((trackWidthAtY * 0.5) * carData.laneDir + Math.sin(this.position * 0.08 + index * 4) * (trackWidthAtY * 0.1) + avoidance + curveOffset) / pixelStep) * pixelStep; 
            
            const oppLean = baseTrackLean + Math.cos(this.position * 0.08 + index * 4) * 0.6;

            renderQueue.push({ z: 10, y: carY, draw: () => {
                const carScale = (userScale * 0.1) + ((userScale * 0.9) * trackYPct);
                const oppImg = this.sprites[carData.type];
                if (oppImg && oppImg.complete) {
                    this.drawShadow(ncx + carXOffset, carY + (oppImg.naturalHeight * carScale) / 2 + scaledHoverBaseY * (carScale / userScale), carScale, oppLean);
                }
                this.drawOpponent(carData.type, ncx + carXOffset, carY, carScale, occ, oppLean);
            }});
        });

        if (isRinging && !this.isPassing) {
            this.activeRings.forEach((ringAlarm, index) => {
                const id = String(ringAlarm.id || "temp");
                const carData = this.spriteMap[id] || { type: 'opp1', laneDir: 1 };
                
                const trackYPct = 1.0; 
                const carY = Math.floor((nHorizon + trackYPct * (carBaseY - nHorizon)) / pixelStep) * pixelStep;
                
                const currentDstW = farDstW + trackYPct * (nearDstW - farDstW);
                const trackWidthAtY = currentDstW * roadPct; 
                
                const curveOffset = trackCurve * Math.pow(1 - trackYPct, 2) * (nw * 0.70);
                const carXOffset = Math.floor(((trackWidthAtY * 0.5) * carData.laneDir + Math.sin(this.position * 0.08 + index * 4) * (trackWidthAtY * 0.1) + curveOffset) / pixelStep) * pixelStep; 
                
                const oppLean = baseTrackLean + Math.cos(this.position * 0.08 + index * 4) * 0.6;

                renderQueue.push({ z: 50, y: carY, draw: () => {
                    const carScale = (userScale * 0.1) + ((userScale * 0.9) * trackYPct);
                    const oppImg = this.sprites[carData.type];
                    if (oppImg && oppImg.complete) {
                        this.drawShadow(ncx + carXOffset, carY + (oppImg.naturalHeight * carScale) / 2 + scaledHoverBaseY * (carScale / userScale), carScale, oppLean);
                    }
                    this.drawOpponent(carData.type, ncx + carXOffset, carY, carScale, null, oppLean); 
                }});
            });
        }
        
        if(this.isPassing && this.passedAlarm) {
            const passingPct = (Date.now() - this.passingStartTime) / 1000; 
            
            if (passingPct > 1) {
                this.isPassing = false;
                this.passedAlarm = null;
            } else {
                const id = String(this.passedAlarm.alarm.id || "temp");
                const passCarData = this.spriteMap[id] || { type: 'opp1', laneDir: 1 };
                
                const easeIn = passingPct * passingPct; 
                
                const passingTrackYPct = 1.0 + (easeIn * 1.5);
                const passY = Math.floor((nHorizon + passingTrackYPct * (carBaseY - nHorizon)) / pixelStep) * pixelStep;
                
                const passDstW = farDstW + passingTrackYPct * (nearDstW - farDstW);
                const trackWidthAtY = passDstW * roadPct;
                
                const curveOffset = trackCurve * Math.pow(1 - passingTrackYPct, 2) * (nw * 0.70);
                const passXOffset = Math.floor(((trackWidthAtY * 0.5) * passCarData.laneDir + Math.sin(this.position * 0.08) * (trackWidthAtY * 0.1) + curveOffset) / pixelStep) * pixelStep;
                const passX = ncx + passXOffset;
                
                const oppLean = baseTrackLean + Math.cos(this.position * 0.08) * 0.6;
                const passScale = userScale * passingTrackYPct;
                
                renderQueue.push({ z: 50, y: passY, draw: () => {
                    const passImg = this.sprites[passCarData.type];
                    if (passImg && passImg.complete) {
                        this.drawShadow(passX, passY + (passImg.naturalHeight * passScale) / 2 + scaledHoverBaseY * (passScale / userScale), passScale, oppLean);
                    }
                    this.drawOpponent(passCarData.type, passX, passY, passScale, null, oppLean);
                }});
            }
        }

        renderQueue.sort((a, b) => (a.z - b.z) || (a.y - b.y)).forEach(item => item.draw());

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

    destroy() { 
        this.startupSound.pause();
        this.startupSound.currentTime = 0;
        
        this.bgMusic.pause();
        this.bgMusic.currentTime = 0;
        if (this.musicBtn) {
            this.musicBtn.remove();
            this.musicBtn = null;
        }

        this.stopRing(); 
    }
}
