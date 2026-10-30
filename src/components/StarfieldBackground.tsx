import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  twinkleSpeed: number;
  color: string;
  isStar: boolean;
  angle: number;
  spinSpeed: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  active: boolean;
}

export const StarfieldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates for gentle interactive gravitational sway
    let mouse = { x: -1000, y: -1000, vx: 0, vy: 0, lastX: 0, lastY: 0 };
    let hasMouseMoved = false;

    // Palette of vibrant cosmic/starlight particle colors
    const colors = [
      'rgba(99, 102, 241, ', // Indigo
      'rgba(14, 165, 233, ', // Sky cyan
      'rgba(244, 63, 94, ',  // Rose
      'rgba(245, 158, 11, ', // Amber gold
      'rgba(168, 85, 247, ', // Purple
      'rgba(16, 185, 129, ', // Emerald
    ];

    // Initialize 85 particles
    const particleCount = Math.min(85, Math.floor((width * height) / 12000));
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const isStar = Math.random() > 0.45;
      const baseAlpha = 0.25 + Math.random() * 0.55;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        // Particles fall gently downwards with varied speeds
        vy: 0.35 + Math.random() * 0.75,
        size: isStar ? 1.6 + Math.random() * 2.8 : 1.0 + Math.random() * 2.2,
        alpha: baseAlpha,
        baseAlpha,
        twinkleSpeed: 0.015 + Math.random() * 0.03,
        color: colors[Math.floor(Math.random() * colors.length)],
        isStar,
        angle: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.02,
      });
    }

    // Occasional falling shooting stars
    const shootingStars: ShootingStar[] = [];
    let nextShootingStarTime = Date.now() + 2000 + Math.random() * 3000;

    const spawnShootingStar = () => {
      shootingStars.push({
        x: Math.random() * (width * 0.8),
        y: Math.random() * (height * 0.3),
        length: 70 + Math.random() * 80,
        speed: 7 + Math.random() * 5,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2, // ~45 degree diagonal fall
        opacity: 0.85,
        active: true,
      });
      nextShootingStarTime = Date.now() + 4000 + Math.random() * 5000;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.vx = e.clientX - mouse.lastX;
      mouse.vy = e.clientY - mouse.lastY;
      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      hasMouseMoved = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
        hasMouseMoved = true;
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Draw 4-pointed shimmering star
    const drawStar = (
      cx: number,
      cy: number,
      spikes: number,
      outerRadius: number,
      innerRadius: number,
      color: string,
      alpha: number,
      rot: number
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      let rotStep = Math.PI / spikes;
      let x = 0;
      let y = 0;

      for (let i = 0; i < spikes; i++) {
        x = Math.cos(i * 2 * rotStep) * outerRadius;
        y = Math.sin(i * 2 * rotStep) * outerRadius;
        ctx.lineTo(x, y);
        x = Math.cos((i * 2 + 1) * rotStep) * innerRadius;
        y = Math.sin((i * 2 + 1) * rotStep) * innerRadius;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = color + alpha + ')';
      ctx.fill();

      // Subtle glow at center
      ctx.beginPath();
      ctx.arc(0, 0, innerRadius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color + alpha * 0.7 + ')';
      ctx.fill();

      ctx.restore();
    };

    // Main animation loop
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // Spawn shooting star periodically
      if (now > nextShootingStarTime) {
        spawnShootingStar();
      }

      // Update and draw shooting stars
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        if (!s.active) {
          shootingStars.splice(i, 1);
          continue;
        }

        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.opacity -= 0.012;

        if (s.opacity <= 0 || s.x > width + 100 || s.y > height + 100) {
          s.active = false;
        } else {
          // Draw gradient meteor streak
          const tailX = s.x - Math.cos(s.angle) * s.length;
          const tailY = s.y - Math.sin(s.angle) * s.length;

          const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
          grad.addColorStop(0, `rgba(255, 255, 255, ${s.opacity})`);
          grad.addColorStop(0.2, `rgba(129, 140, 248, ${s.opacity * 0.8})`);
          grad.addColorStop(1, 'rgba(129, 140, 248, 0)');

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(tailX, tailY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Bright glowing head
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
          ctx.shadowColor = '#6366f1';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        }
      }

      // Update and draw falling stars / particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Fall downwards
        p.y += p.vy;
        p.x += p.vx + Math.sin(now * 0.001 + i) * 0.2; // Gentle horizontal sway
        p.angle += p.spinSpeed;

        // Twinkle pulsating alpha
        p.alpha = p.baseAlpha + Math.sin(now * p.twinkleSpeed) * 0.22;
        if (p.alpha < 0.1) p.alpha = 0.1;

        // Interactive mouse interaction: gently deflect or attract when cursor gets close
        if (hasMouseMoved) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 130;

          if (dist < maxDist && dist > 1) {
            const force = (1 - dist / maxDist) * 1.5;
            // Push particle gently away from moving cursor
            p.x -= (dx / dist) * force;
            p.y -= (dy / dist) * force;
            // Boost brightness on interaction
            p.alpha = Math.min(1.0, p.alpha + 0.35);
          }
        }

        // Wrap around screen boundaries smoothly
        if (p.y > height + 20) {
          p.y = -15;
          p.x = Math.random() * width;
        } else if (p.y < -20) {
          p.y = height + 10;
        }
        if (p.x > width + 20) {
          p.x = -10;
        } else if (p.x < -20) {
          p.x = width + 10;
        }

        // Draw particle based on type
        if (p.isStar) {
          // 4-pointed shimmering star
          drawStar(p.x, p.y, 4, p.size * 2.2, p.size * 0.55, p.color, p.alpha, p.angle);
        } else {
          // Soft glowing circular stardust orb
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color + p.alpha + ')';
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};
