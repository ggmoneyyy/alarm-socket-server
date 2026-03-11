export default class TetrisVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.sparks = [];
        this.lastFireworkSec = -1;
        this.pulseIntensity = 0;
    }

    init() {
        this.particles = [];
        this.sparks = [];
        const numParticles = window.innerWidth < 768 ? 200 : 500; 
        const colors = ['#0ea5e9', '#2dd4bf', '#3b82f6', '#8b5cf6', '#10b981'];
        
        for (let i = 0; i < numParticles; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 1,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: (Math.random() - 1) * 0.5 - 0.1, 
                color: colors[Math.floor(Math.random() * colors.length)],
                baseOpacity: Math.random() * 0.15 + 0.1, 
                flashGroup: i % 5 
            });
        }
    }

    spawnDynamicBurst() {
        const originX = Math.random() * (this.canvas.width * 0.8) + (this.canvas.width * 0.1);
        const originY = Math.random() * (this.canvas.height * 0.6) + (this.canvas.height * 0.2); 
        const numSparks = window.innerWidth < 768 ? 100 : 250; 
        const colors = ['#0ea5e9', '#2dd4bf', '#3b82f6', '#8b5cf6', '#10b981', '#ffffff']; 
        const burstColor1 = colors[Math.floor(Math.random() * colors.length)];
        const burstColor2 = colors[Math.floor(Math.random() * colors.length)];
        const flowDirection = (Math.random() - 0.5) * 2; 

        for (let i = 0; i < numSparks; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 12 + 3; 
            this.sparks.push({
                x: originX + (Math.random() - 0.5) * 40,
                y: originY + (Math.random() - 0.5) * 40,
                angle: angle,
                speed: speed,
                curve: (Math.random() * 0.05 + 0.01) * flowDirection,
                color: Math.random() > 0.3 ? burstColor1 : burstColor2, 
                size: Math.random() * 2.5 + 1,
                life: 1.0, 
                decay: Math.random() * 0.001 + 0.003 
            });
        }
    }

    render(now) {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'lighter';
        
        const time = Date.now();
        const currentSec = now.getSeconds();
        const currentMs = now.getMilliseconds();
        
        this.pulseIntensity = Math.sin(Math.PI * currentMs / 1000); 
        
        if (currentSec % 5 === 0 && currentSec !== this.lastFireworkSec && currentMs < 100) {
            this.spawnDynamicBurst(); 
            this.lastFireworkSec = currentSec;
        }
        
        let activeGroup = currentSec % 5;

        this.particles.forEach(p => {
            p.x += p.speedX; p.y += p.speedY;
            p.x += Math.sin(time * 0.001 + p.y * 0.01) * 0.3;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            
            let currentOpacity = p.baseOpacity;
            if (p.flashGroup === activeGroup) currentOpacity += this.pulseIntensity * 0.8; 
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = Math.min(1, Math.max(0, currentOpacity));
            this.ctx.fill();
        });
        
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            let s = this.sparks[i];
            s.angle += s.curve;
            s.x += Math.cos(s.angle) * s.speed;
            s.y += Math.sin(s.angle) * s.speed;
            s.speed *= 0.985; s.y -= 0.3; s.life -= s.decay;
            
            if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
            
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fillStyle = s.color;
            this.ctx.globalAlpha = Math.min(1, Math.max(0, s.life * 0.8));
            this.ctx.fill();
        }
    }
}