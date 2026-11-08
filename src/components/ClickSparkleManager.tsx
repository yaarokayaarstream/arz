import React, { useEffect, useRef } from 'react';
import { soundService } from '../services/soundService';

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  rot: number;
  rotSpeed: number;
  shape: 'star' | 'circle' | 'diamond';
}

interface BlastRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export const ClickSparkleManager: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles: SparkleParticle[] = [];
    const rings: BlastRing[] = [];
    let isRunning = false;
    let animId: number;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const SPARKLE_COLORS = [
      '#fbbf24', // Amber gold
      '#6366f1', // Indigo
      '#06b6d4', // Cyan
      '#f43f5e', // Rose
      '#a855f7', // Purple
      '#10b981', // Emerald
      '#ffffff', // Pure white
    ];

    // Draw 4-pointed sparkle star on canvas
    const drawStar = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      r: number,
      rot: number,
      color: string,
      alpha: number
    ) => {
      c.save();
      c.translate(cx, cy);
      c.rotate(rot);
      c.fillStyle = color;
      c.globalAlpha = Math.max(0, alpha);
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        c.lineTo(Math.cos((i * Math.PI) / 2) * r, Math.sin((i * Math.PI) / 2) * r);
        c.lineTo(
          Math.cos((i * Math.PI) / 2 + Math.PI / 4) * (r * 0.28),
          Math.sin((i * Math.PI) / 2 + Math.PI / 4) * (r * 0.28)
        );
      }
      c.closePath();
      c.fill();
      c.restore();
    };

    // Draw diamond spark
    const drawDiamond = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      r: number,
      rot: number,
      color: string,
      alpha: number
    ) => {
      c.save();
      c.translate(cx, cy);
      c.rotate(rot);
      c.fillStyle = color;
      c.globalAlpha = Math.max(0, alpha);
      c.beginPath();
      c.moveTo(0, -r);
      c.lineTo(r * 0.6, 0);
      c.lineTo(0, r);
      c.lineTo(-r * 0.6, 0);
      c.closePath();
      c.fill();
      c.restore();
    };

    const loop = () => {
      if (particles.length === 0 && rings.length === 0) {
        ctx.clearRect(0, 0, width, height);
        isRunning = false;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Render expanding shockwave blast rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.radius += (ring.maxRadius - ring.radius) * 0.16 + 1.2;
        ring.alpha -= 0.045;

        if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
          rings.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = Math.max(0, ring.alpha);
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }

      // Render sparkle explosion particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92; // Air friction
        p.vy = p.vy * 0.92 + 0.08; // Mild gravity
        p.rot += p.rotSpeed;
        p.life--;
        p.alpha = p.life / p.maxLife;

        if (p.life <= 0 || p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        if (p.shape === 'star') {
          drawStar(ctx, p.x, p.y, p.size, p.rot, p.color, p.alpha);
        } else if (p.shape === 'diamond') {
          drawDiamond(ctx, p.x, p.y, p.size, p.rot, p.color, p.alpha);
        } else {
          ctx.save();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.65, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    const triggerBlastAt = (clientX: number, clientY: number) => {
      // 1. Play crystal melodic sparkle pop sound
      soundService.playSparkleChime();

      // 2. Add shockwave ripple blast ring
      rings.push({
        x: clientX,
        y: clientY,
        radius: 6,
        maxRadius: 36 + Math.random() * 16,
        alpha: 0.8,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
      });

      // 3. Spawn 18-24 radial burst sparkle particles
      const count = 18 + Math.floor(Math.random() * 8);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
        const speed = 2.8 + Math.random() * 5.2;
        const shapes: ('star' | 'circle' | 'diamond')[] = ['star', 'star', 'diamond', 'circle'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const maxLife = 22 + Math.floor(Math.random() * 16);

        particles.push({
          x: clientX,
          y: clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: shape === 'star' ? 4.5 + Math.random() * 4.5 : 2.5 + Math.random() * 3.5,
          color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
          alpha: 1.0,
          life: maxLife,
          maxLife,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.25,
          shape,
        });
      }

      // Start animation loop if not running
      if (!isRunning) {
        isRunning = true;
        animId = requestAnimationFrame(loop);
      }
    };

    // Global click/pointerdown event listener for buttons, icons, cards, and interactive elements
    const handlePointerDown = (e: PointerEvent) => {
      // Find if clicked element or its ancestors are interactive (button, a, input, select, icon, role="button", cursor-pointer)
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest(
        'button, a, input, select, [role="button"], .cursor-pointer, svg, [tabindex="0"]'
      );

      // Trigger sparkle blast on any interactive tap or anywhere on UI icons/buttons
      if (interactive || target.tagName === 'svg' || target.closest('svg') || target.tagName === 'BUTTON') {
        triggerBlastAt(e.clientX, e.clientY);
      } else {
        // Even for clicks on cards or tiles, trigger sparkle blast
        triggerBlastAt(e.clientX, e.clientY);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
    />
  );
};
