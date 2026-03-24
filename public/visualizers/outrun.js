export default class OutrunVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.alarms = [];
        this.activeRings = [];
        this.ringClickListener = null;
        
        this.hasReceivedData = false;
        
        // Animation states
        this.gridOffset = 0;
        this.lastDisplayAlarm = null; 
    }

    init() {
        this.alarms = [];
        this.activeRings = [];
        this.gridOffset = 0;
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

    drawNeonText(text, x, y, size, color, glowColor, align = 'left') {
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'top';
        this.ctx.font = `${size}px "Press Start 2P", "VT323", monospace`;
        
        // Glow effect
        this.ctx.shadowColor = glowColor;
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x, y);
        
        // Second pass for intense core
        this.ctx.shadowBlur = 5;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(text, x, y);
        
        // Reset shadow so it doesn't break other drawings
        this.ctx.shadowBlur = 0;
    }

    getWrappedLines(text, maxWidth) {
        let words = text.split(' ');
        let lines = [];
        let currentLine = words[0] || '';

        for (let i = 1; i < words.length; i++) {
            let word = words[i];
            this.ctx.font = `32px "Press Start 2P", monospace`; // Base measurement
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
        const horizonY = h * 0.45;
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

        // --- 1. BACKGROUND (Sky & Stars) ---
        // Deep synthwave purple gradient
        let skyGrad = this.ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, '#090014');
        skyGrad.addColorStop(1, '#2c003e');
        this.ctx.fillStyle = skyGrad;
        this.ctx.fillRect(0, 0, w, horizonY);

        // --- 2. RETRO SUN ---
        const sunRadius = Math.min(w, h) * 0.15;
        let sunGrad = this.ctx.createLinearGradient(0, horizonY - sunRadius * 2, 0, horizonY);
        sunGrad.addColorStop(0, '#ffd700'); // Yellow top
        sunGrad.addColorStop(0.5, '#ff8c00'); // Orange mid
        sunGrad.addColorStop(1, '#ff007f'); // Pink bottom

        this.ctx.save();
        this.ctx.fillStyle = sunGrad;
        this.ctx.beginPath();
        this.ctx.arc(cx, horizonY, sunRadius, Math.PI, 0); // Semicircle above horizon
        this.ctx.fill();
        
        // Classic horizontal cutouts in the sun
        this.ctx.globalCompositeOperation = 'destination-out';
        for(let i = 0; i < 6; i++) {
            let sliceY = horizonY - (i * i * 3) - 5;
            let sliceH = 2 + i * 1.5;
            this.ctx.fillRect(cx - sunRadius, sliceY, sunRadius * 2, sliceH);
        }
        this.ctx.restore();

        // --- 3. PSEUDO-3D GRID (The Highway) ---
        this.ctx.fillStyle = '#050011'; // Dark ground
        this.ctx.fillRect(0, horizonY, w, h - horizonY);

        this.ctx.strokeStyle = '#ff007f'; // Neon Pink Grid
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#ff007f';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();

        // Radiating Vertical Lines
        const numVerticals = 30;
        for (let i = -numVerticals; i <= numVerticals; i++) {
            let startX = cx + (i * (w / 10)); // Spread at the bottom
            this.ctx.moveTo(cx, horizonY);
            this.ctx.lineTo(startX, h);
        }
        this.ctx.stroke();

        // Moving Horizontal Lines (Exponential curve for fake 3D)
        // If ringing, hit warp speed!
        const baseSpeed = 0.008;
        const currentSpeed = isRinging ? 0.08 : baseSpeed;
        
        this.gridOffset += currentSpeed;
        if (this.gridOffset >= 1) this.gridOffset -= 1;

        this.ctx.beginPath();
        this.ctx.strokeStyle = '#00f0ff'; // Neon Cyan horizontal lines
        this.ctx.shadowColor = '#00f0ff';
        
        const numHorizontals = 20;
        for (let i = 0; i < numHorizontals; i++) {
            // The magic formula: pow() pushes lines exponentially towards the bottom
            let z = i + this.gridOffset;
            let lineY = horizonY + Math.pow(z, 2.5) * (h * 0.0005); 
            
            if (lineY <= h) {
                this.ctx.moveTo(0, lineY);
                this.ctx.lineTo(w, lineY);
            }
        }
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; // Reset glow

        // --- 4. HORIZON GLOW ---
        let horizonGrad = this.ctx.createLinearGradient(0, horizonY - 20, 0, horizonY + 20);
        horizonGrad.addColorStop(0, 'rgba(255, 0, 127, 0)');
        horizonGrad.addColorStop(0.5, 'rgba(255, 0, 127, 0.8)');
        horizonGrad.addColorStop(1, 'rgba(255, 0, 127, 0)');
        this.ctx.fillStyle = horizonGrad;
        this.ctx.fillRect(0, horizonY - 20, w, 40);

        // --- 5. TEXT DISPLAY OVERLAYS ---
        // Center the text block in the upper sky
        if (displayAlarm) {
            const hrs = Math.floor(remaining / 3600000).toString().padStart(2, '0');
            const mins = Math.floor((remaining % 3600000) / 60000).toString().padStart(2, '0');
            const secs = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');

            // Draw the time massive and central
            const clockText = `${hrs}:${mins}:${secs}`;
            this.ctx.font = `120px "Press Start 2P", monospace`;
            const clockWidth = this.ctx.measureText(clockText).width;
            this.drawNeonText(clockText, cx - clockWidth/2, h * 0.1, 120, '#00f0ff', '#00f0ff');

            // Draw the Label below it
            this.ctx.font = `32px "Press Start 2P", monospace`;
            let label = (displayAlarm.alarm.label || 'ALARM').toUpperCase();
            const labelWidth = this.ctx.measureText(label).width;
            this.drawNeonText(label, cx - labelWidth/2, h * 0.1 + 140, 32, '#ff007f', '#ff007f');
            
            // Queue system tucked in the bottom left
            let upNextAlarm = isRinging ? visibleAlarms[0] : visibleAlarms[1];
            if (upNextAlarm) {
                const nd = new Date(upNextAlarm.date);
                const nh = nd.getHours().toString().padStart(2, '0');
                const nm = nd.getMinutes().toString().padStart(2, '0');
                
                let nextLabel = `[${nh}:${nm}] ${(upNextAlarm.alarm.label || 'ALARM').toUpperCase()}`;
                this.drawNeonText("UP NEXT:", 30, h - 80, 20, '#ffd700', '#ffd700');
                this.drawNeonText(nextLabel, 30, h - 40, 24, '#ffffff', '#00f0ff');
            }
        } else {
            const noAlarms = "NO UPCOMING EVENTS";
            this.ctx.font = `40px "Press Start 2P", monospace`;
            const naWidth = this.ctx.measureText(noAlarms).width;
            this.drawNeonText(noAlarms, cx - naWidth/2, h * 0.2, 40, '#00f0ff', '#00f0ff');
        }

        // --- 6. MODAL (WHEN RINGING) ---
        if (showModal) {
            if (!this.ringClickListener) {
                this.ringClickListener = () => window.stopAlarm();
                setTimeout(() => {
                    document.addEventListener('click', this.ringClickListener);
                    this.canvas.style.cursor = 'pointer';
                }, 50);
            }

            const alarm = this.activeRings[0];
            
            // Darken background slightly
            this.ctx.fillStyle = 'rgba(5, 0, 17, 0.7)';
            this.ctx.fillRect(0, 0, w, h);

            const boxW = Math.min(800, w * 0.8);
            const boxH = 300;
            const boxX = cx - boxW / 2;
            const boxY = (h / 2) - boxH / 2;

            // Synthwave modal box
            this.ctx.fillStyle = '#0b001a';
            this.ctx.fillRect(boxX, boxY, boxW, boxH);
            this.ctx.strokeStyle = '#ff007f';
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = '#ff007f';
            this.ctx.shadowBlur = 15;
            this.ctx.strokeRect(boxX, boxY, boxW, boxH);
            this.ctx.shadowBlur = 0;

            let label = (alarm.label || 'ALARM').toUpperCase();
            this.drawNeonText(label, cx, boxY + 80, 40, '#ffffff', '#00f0ff', 'center');

            const pulse = Math.floor(now.getTime() / 250) % 2 === 0;
            const btnText = pulse ? "> STOP ALARM <" : "  STOP ALARM  ";
            this.drawNeonText(btnText, cx, boxY + 200, 30, '#ffd700', '#ffd700', 'center');
        }
    }

    destroy() { 
        this.stopRing();
    }
}