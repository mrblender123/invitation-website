'use client';

import { useEffect, useRef } from 'react';

const COLORS = ['#e0e0e0', '#d4af37', '#fdfbf7'];

class Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; color: string; alpha: number; decay: number;
  type: 'dot' | 'line';
  length: number; angle: number;

  constructor(x: number, y: number) {
    this.x = x; this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 1.2 + 0.3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 0.5;
    this.size = Math.random() * 1.5 + 0.5;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.alpha = 1;
    this.decay = Math.random() * 0.02 + 0.01;
    this.type = Math.random() > 0.6 ? 'line' : 'dot';
    this.length = Math.random() * 4 + 2;
    this.angle = angle;
  }

  update() {
    this.vx *= 0.96; this.vy *= 0.96;
    this.vy -= 0.01;
    this.x += this.vx; this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    if (this.type === 'dot') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = this.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.angle) * this.length, this.y + Math.sin(this.angle) * this.length);
      ctx.stroke();
    }
  }
}

export default function HeroHeading() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animatingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const spawnParticles = (count: number) => {
    const canvas = canvasRef.current;
    const heading = headingRef.current;
    if (!canvas || !heading) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = heading.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(new Particle(
        rect.left + Math.random() * rect.width,
        rect.top + Math.random() * rect.height,
      ));
    }
    if (!animatingRef.current) {
      animatingRef.current = true;
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particlesRef.current = particlesRef.current.filter(p => {
          p.update(); p.draw(ctx);
          return p.alpha > 0;
        });
        if (particlesRef.current.length > 0) {
          requestAnimationFrame(animate);
        } else {
          animatingRef.current = false;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };
      requestAnimationFrame(animate);
    }
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 10 }}
      />
      <h1
        ref={headingRef}
        onMouseEnter={() => spawnParticles(40)}
        onTouchStart={() => spawnParticles(20)}
        style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 'clamp(28px, 8.5vw, 76px)',
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          marginBottom: 24,
          color: '#d1d1d1',
          textAlign: 'center',
          cursor: 'default',
          userSelect: 'none',
          transition: 'color 0.3s ease',
          position: 'relative',
          zIndex: 2,
        }}
        onMouseOver={e => (e.currentTarget.style.color = '#fdfbf7')}
        onMouseOut={e => (e.currentTarget.style.color = '#d1d1d1')}
      >
        Invitations that leave<br />a lasting impression
      </h1>
    </>
  );
}
