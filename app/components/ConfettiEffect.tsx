'use client';

import confetti from 'canvas-confetti';

export function fireConfetti(originX = 0.5, originY = 0.5) {
  // Subtle burst — small particle count, soft colors
  confetti({
    particleCount: 18,
    spread: 50,
    startVelocity: 14,
    ticks: 120,
    origin: { x: originX, y: originY },
    colors: ['#ffffff', '#d4d4d8', '#a1a1aa'],
    scalar: 0.55,
    gravity: 1.4,
    drift: 0,
    shapes: ['circle'],
    opacity: 0.6,
  });
}

export function fireConfettiFromElement(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  fireConfetti(x, y);
}
