/**
 * Confetti Animation System
 * Lightweight particle-based celebration animation
 */

class ConfettiParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = Math.random() * -15 - 5;
        this.gravity = 0.5;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 10;
        this.size = Math.random() * 8 + 4;
        this.opacity = 1;

        // Random colors
        const colors = ['#4CAF50', '#2196F3', '#FFC107', '#F44336', '#9C27B0', '#FF9800'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.opacity -= 0.01;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }

    isDead() {
        return this.opacity <= 0 || this.y > window.innerHeight + 50;
    }
}

class ConfettiSystem {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationId = null;
    }

    init() {
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'confetti-canvas';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '9999';

        document.body.appendChild(this.canvas);

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext('2d');
    }

    createParticles(count = 100) {
        const centerX = window.innerWidth / 2;
        const topY = 0;

        for (let i = 0; i < count; i++) {
            const x = centerX + (Math.random() - 0.5) * 200;
            this.particles.push(new ConfettiParticle(x, topY));
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update();
            particle.draw(this.ctx);

            if (particle.isDead()) {
                this.particles.splice(i, 1);
            }
        }

        // Continue animation if particles exist
        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            this.cleanup();
        }
    }

    cleanup() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
    }

    trigger(count = 100) {
        this.init();
        this.createParticles(count);
        this.animate();
    }
}

// Global instance
let confettiSystem = null;

function triggerConfetti(count = 100) {
    if (confettiSystem) {
        confettiSystem.cleanup();
    }
    confettiSystem = new ConfettiSystem();
    confettiSystem.trigger(count);
}

// Export for use
if (typeof window !== 'undefined') {
    window.triggerConfetti = triggerConfetti;
}
