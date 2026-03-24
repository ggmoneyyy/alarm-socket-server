export default class FZeroVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.alarms = [];
        this.activeRings = [];
        this.ringClickListener = null;
        
        this.hasReceivedData = false;
        
        // Track the forward movement of the camera
        this.position = 0;
        this.lastDisplayAlarm = null; 
    }

    init() {
        this.alarms = [];
        this.activeRings = [];
        this.position = 0;
        this.hasReceivedData = false;
        this.lastDisplayAlarm = null;
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

    // Classic 16-bit UI Box with thick bevels
    drawSNESBox(x, y, w, h) {
        this.ctx.fillStyle = '#222222'; // Dark center
        this.ctx.fillRect(x, y, w, h);
        
        this.ctx.fillStyle = '#777777'; // Light grey top/left bevel
        this.ctx.fillRect(x, y, w, 6);
        this.ctx.fillRect(x, y, 6, h);
        
        this.ctx.fillStyle = '#000000'; // Black bottom/right bevel
        this.ctx.fillRect(x, y + h - 6, w, 6);
        this.ctx.fillRect(x + w - 6, y, 6, h);
    }

    // Heavy black border around text to ensure readability over the moving track
    drawRetroText(text, x, y, size, color, align = 'left') {
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'top';
        this.ctx.font = `${size}px "Press Start 2P", "VT323", monospace`;
        
        this.ctx.fillStyle = '#050505';
        this.ctx.fillText(text, x - 3, y);
        this.ctx.fillText(text, x + 3, y);
        this.ctx.fillText(text, x, y - 3);
        this.ctx.fillText(text, x, y + 3);
        this.ctx.fillText(text, x + 3, y + 3);
        
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

        const w = this.canvas.width;
        const h = this.canvas.height;
        const horizonY = h * 0.40;
        const cx = w / 2;

        const elevenHoursMs = 11 * 60 * 60 * 1000;
        const visibleAlarms = this.alarms.filter(occ => {
            return !this.activeRings.some(ring => ring.id === occ.alarm.id) && (occ.date - now) <= elevenHoursMs;
        });

        const isRinging = this.activeRings.length > 0;
        const showModal = isRinging; 

        let displayAlarm = visibleAlarms.length > 0 ? visibleAlarms[0] : null;
        if (isRinging) {
            displayAlarm = this.lastDisplayAlarm; 
        } else {
            this.lastDisplayAlarm = displayAlarm; 
        }

        let remaining = 0;
        if (displayAlarm && !isRinging) {
            remaining = Math.max(0, displayAlarm.date - now);
        }

        // --- 1. BACKGROUND (Sky & Distant Planet) ---
        let skyGrad = this.ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, '#4ca8d1'); // Bright blue high sky
        skyGrad.addColorStop(1, '#e6b873'); // Dusty peach horizon
        this.ctx.fillStyle = skyGrad;
        this.ctx.fillRect(0, 0, w, horizonY);

        // Distant mountains / City silhouettes
        this.ctx.fillStyle = '#846c5b'; 
        for (let b = 0; b < 60; b++) {
            let bx = b * (w / 60);
            // Use sine waves to create a jagged, natural looking horizon line
            let bh = 10 + Math.sin(b * 1.5) * 15 + Math.cos(b * 3.1) * 10;
            if (bh > 0) this.ctx.fillRect(bx, horizonY - bh, (w / 60) + 1, bh);
        }

        // --- 2. GROUND PLANE ---
        this.ctx.fillStyle = '#c28b51'; // Sand ocean desert color
        this.ctx.fillRect(0, horizonY, w, h - horizonY);

        // --- 3. MODE-7 3D TRACK RENDERING ---
        const baseSpeed = 0.4;
        const ringSpeed = 2.5; // Warp speed when alarm rings
        this.position += isRinging ? ringSpeed : baseSpeed;
        
        let offset = this.position % 1;
        let cycle = Math.floor(this.position);

        const trackTopW = w * 0.05; // Very narrow at the horizon
        const trackBotW = w * 2.5;  // Massively wide at the bottom to fill peripheral vision
        const drawH = h - horizonY;
        const numStripes = 40;
        
        // Draw back-to-front for proper painter's algorithm depth
        for (let i = numStripes; i >= 0; i--) {
            let val1 = i + offset; 
            let val2 = (i + 1) + offset;
            
            // The exponent (3) is the magic Mode-7 math that curves the linear strips into 3D perspective
            let pct1 = Math.pow(val1 / numStripes, 3);
            let pct2 = Math.pow(val2 / numStripes, 3);
            
            let y1 = horizonY + pct1 * drawH;
            let y2 = horizonY + pct2 * drawH;
            
            let w1 = trackTopW + pct1 * (trackBotW - trackTopW);
            let w2 = trackTopW + pct2 * (trackBotW - trackTopW);
            
            // Determine if this specific physical strip of track is dark or light
            let isDark = (Math.abs(i - cycle) % 2) === 0; 
            
            // Draw Main Asphalt
            this.ctx.fillStyle = isDark ? '#49495e' : '#5e5e78'; 
            this.ctx.beginPath();
            this.ctx.moveTo(cx - w1/2, y1);
            this.ctx.lineTo(cx + w1/2, y1);
            this.ctx.lineTo(cx + w2/2, y2);
            this.ctx.lineTo(cx - w2/2, y2);
            this.ctx.fill();
            
            // Draw Guardrails (Flashing Yellow & Red)
            let railW1 = Math.max(3, 25 * pct1);
            let railW2 = Math.max(3, 25 * pct2);
            
            // Left Guardrail
            this.ctx.fillStyle = isDark ? '#d12e2e' : '#e6c835'; 
            this.ctx.beginPath();
            this.ctx.moveTo(cx - w1/2, y1);
            this.ctx.lineTo(cx - w1/2 - railW1, y1);
            this.ctx.lineTo(cx - w2/2 - railW2, y2);
            this.ctx.lineTo(cx - w2/2, y2);
            this.ctx.fill();
            
            // Right Guardrail
            this.ctx.fillStyle = isDark ? '#e6c835' : '#d12e2e'; 
            this.ctx.beginPath();
            this.ctx.moveTo(cx + w1/2, y1);
            this.ctx.lineTo(cx + w1/2 + railW1, y1);
            this.ctx.lineTo(cx + w2/2 + railW2, y2);
            this.ctx.lineTo(cx + w2/2, y2);
            this.ctx.fill();
        }

        // --- 4. HUD / UI OVERLAYS ---
        if (displayAlarm) {
            const hrs = Math.floor(remaining / 3600000).toString().padStart(2, '0');
            const mins = Math.floor((remaining % 3600000) / 60000).toString().padStart(2, '0');
            const secs = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');

            const pad = 30;
            
            // Top HUD (Current Alarm)
            this.drawSNESBox(pad, pad, 380, 160);
            this.drawRetroText("TIME REMAINING", pad + 20, pad + 20, 20, '#e6c835'); // Gold header
            this.drawRetroText(`${hrs}:${mins}:${secs}`, pad + 20, pad + 60, 50, '#ffffff');
            
            let label = (displayAlarm.alarm.label || 'ALARM').toUpperCase();
            this.ctx.font = `20px "Press Start 2P", monospace`;
            if (this.ctx.measureText(label).width > 340) {
                label = label.substring(0, 15) + "...";
            }
            this.drawRetroText(label, pad + 20, pad + 120, 20, '#4ca8d1'); // Blue label

            // Standings HUD (Up Next)
            let upNextAlarm = isRinging ? visibleAlarms[0] : visibleAlarms[1];
            if (upNextAlarm) {
                const nd = new Date(upNextAlarm.date);
                const nh = nd.getHours().toString().padStart(2, '0');
                const nm = nd.getMinutes().toString().padStart(2, '0');
                
                this.drawSNESBox(w - 380 - pad, pad, 380, 120);
                this.drawRetroText("NEXT RANK", w - 360 - pad, pad + 20, 20, '#e6c835');
                
                let nextLabel = `[${nh}:${nm}] ${(upNextAlarm.alarm.label || 'ALARM').toUpperCase()}`;
                this.ctx.font = `20px "Press Start 2P", monospace`;
                if (this.ctx.measureText(nextLabel).width > 340) {
                    nextLabel = nextLabel.substring(0, 15) + "...";
                }
                this.drawRetroText(nextLabel, w - 360 - pad, pad + 70, 20, '#ffffff');
            }
        } else {
            this.drawSNESBox(cx - 250, 50, 500, 100);
            this.drawRetroText("NO UPCOMING EVENTS", cx, 85, 24, '#ffffff', 'center');
        }

        // --- 5. MODAL (WHEN RINGING) ---
        if (showModal) {
            if (!this.ringClickListener) {
                this.ringClickListener = () => window.stopAlarm();
                setTimeout(() => {
                    document.addEventListener('click', this.ringClickListener);
                    this.canvas.style.cursor = 'pointer';
                }, 50);
            }

            const alarm = this.activeRings[0];
            
            const boxW = Math.min(800, w * 0.8);
            const boxH = 300;
            const boxX = cx - boxW / 2;
            const boxY = (h / 2) - boxH / 2;

            this.drawSNESBox(boxX, boxY, boxW, boxH);

            let label = (alarm.label || 'ALARM').toUpperCase();
            this.drawRetroText(label, cx, boxY + 80, 40, '#ffffff', 'center');

            const pulse = Math.floor(now.getTime() / 250) % 2 === 0;
            const btnText = pulse ? "► STOP ALARM ◄" : "  STOP ALARM  ";
            this.drawRetroText(btnText, cx, boxY + 200, 30, '#e6c835', 'center');
        }
    }

    destroy() { 
        this.stopRing();
    }
}