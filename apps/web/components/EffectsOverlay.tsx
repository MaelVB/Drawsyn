 'use client';

import React, { CSSProperties, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useEffectsStore } from '@/stores/effects-store';

type ConfettiStyle = CSSProperties & Record<string, string | number>;

interface ConfettiSets {
  rain: ConfettiPiece[];
  left: ConfettiBurstPiece[];
  right: ConfettiBurstPiece[];
}

interface ConfettiPiece {
  id: string;
  left: number;
  delay: number;
  duration: number;
  hue: number;
  drift: number;
  size: number;
}

interface ConfettiBurstPiece {
  id: string;
  delay: number;
  duration: number;
  hue: number;
  spreadX: number;
  spreadY: number;
  size: number;
}

export default function EffectsOverlay() {
  const {
    hurryActive,
    partyActive,
    partySeed,
    partyExpiresAt,
    stopPartyEffect,
  } = useEffectsStore((s) => ({
    hurryActive: s.hurryActive,
    partyActive: s.partyActive,
    partySeed: s.partySeed,
    partyExpiresAt: s.partyExpiresAt,
    stopPartyEffect: s.stopPartyEffect,
  }));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiIntervalRef = useRef<number | null>(null);
  const confettiTimerRef = useRef<number | null>(null);
  const snowIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!partyActive || !partyExpiresAt) return;
    const remaining = Math.max(0, partyExpiresAt - Date.now());

    // create a canvas-confetti instance attached to our canvas
    const myConfetti = confetti.create(canvasRef.current ?? undefined, {
      resize: true,
      useWorker: true
    });

    // School pride palette (vivid)
    const prideColors = ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'];

    const start = Date.now();

    // Helper: continuous burst from a side origin
    const fireSide = (side: 'left' | 'right') => {
      const x = side === 'left' ? 0 : 1;
      // multiple smaller shots to create a steady stream
      myConfetti({
        particleCount: 12,
        angle: side === 'left' ? 20 : 160,
        spread: 40,
        startVelocity: 45,
        ticks: 360,
        gravity: 0.6,
        decay: 0.92,
        origin: { x, y: 0.35 },
        scalar: 1.1,
        colors: prideColors
      });

      myConfetti({
        particleCount: 8,
        angle: side === 'left' ? 10 : 170,
        spread: 20,
        startVelocity: 30,
        ticks: 340,
        gravity: 0.5,
        decay: 0.94,
        origin: { x, y: 0.25 },
        scalar: 0.9,
        colors: prideColors
      });
    };

    // initial simultaneous bursts
    fireSide('left');
    fireSide('right');

    // interval: fire both sides at a steady cadence for the remaining duration
    const cadenceMs = 180; // cadence between shots; adjust for density
    confettiIntervalRef.current = window.setInterval(() => {
      fireSide('left');
      fireSide('right');
      // stop early if time passed
      if (Date.now() - start > remaining) {
        if (confettiIntervalRef.current) {
          window.clearInterval(confettiIntervalRef.current);
          confettiIntervalRef.current = null;
        }
      }
    }, cadenceMs);

    // Snow effect: gentle, white/blue flakes falling continuously
    const fireSnow = () => {
      // multiple tiny groups across the top to simulate snowfall
      for (let i = 0; i < 6; i++) {
        myConfetti({
          // flocons plus visibles et variés
          particleCount: 4 + Math.floor(Math.random() * 6),
          // angle 270 = vers le bas (canvas-confetti: 90 = haut, 270 = bas)
          angle: 270 + (Math.random() - 0.5) * 20,
          // dispersion latérale pour couvrir l'écran
          spread: 40 + Math.random() * 30,
          // vitesse initiale faible vers le bas (douce descente)
          startVelocity: 2 + Math.random() * 2,
          ticks: 420, // durer longtemps à l'écran
          gravity: 0.18 + Math.random() * 0.07, // accélération douce
          decay: 0.996,
          drift: (Math.random() - 0.5) * 0.8, // léger mouvement horizontal
          // démarrer juste dans le viewport
          origin: { x: Math.random(), y: -0.6 },
          // taille modérée pour ressembler à des flocons
          scalar: 0.7 + Math.random() * 0.7,
          colors: ['#FFD700', '#FFED00', '#E6C619', '#FFFFFF'],
          shapes: ['circle']
        });
      }
    };

    const snowCadence = 160; // ms between snow shots
    // fire an immediate snow burst so it's visible right away
    fireSnow();
    snowIntervalRef.current = window.setInterval(() => {
      fireSnow();
      if (Date.now() - start > remaining) {
        if (snowIntervalRef.current) {
          window.clearInterval(snowIntervalRef.current);
          snowIntervalRef.current = null;
        }
      }
    }, snowCadence);

    // ensure we stop the effect and cleanup at partyExpiresAt
    confettiTimerRef.current = window.setTimeout(() => {
      if (confettiIntervalRef.current) {
        window.clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
      }
      if (snowIntervalRef.current) {
        window.clearInterval(snowIntervalRef.current);
        snowIntervalRef.current = null;
      }
      // final synchronized big burst on both sides
      myConfetti({ particleCount: 620, ticks: 420, spread: 100, startVelocity: 60, origin: { x: 0.06, y: 0.35 }, colors: prideColors });
      myConfetti({ particleCount: 620, ticks: 420, spread: 100, startVelocity: 60, origin: { x: 0.94, y: 0.35 }, colors: prideColors });
      
      myConfetti({ particleCount: 620, ticks: 420, spread: 100, startVelocity: 60, origin: { x: 0.06, y: 0.55 }, colors: prideColors });
      myConfetti({ particleCount: 620, ticks: 420, spread: 100, startVelocity: 60, origin: { x: 0.94, y: 0.55 }, colors: prideColors });
      // small farewell snowfall
      for (let i = 0; i < 8; i++) {
        setTimeout(() => fireSnow(), i * 120);
      }
      stopPartyEffect();
    }, remaining);

    return () => {
      if (confettiIntervalRef.current) {
        window.clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
      }
      if (snowIntervalRef.current) {
        window.clearInterval(snowIntervalRef.current);
        snowIntervalRef.current = null;
      }
      if (confettiTimerRef.current) {
        window.clearTimeout(confettiTimerRef.current);
        confettiTimerRef.current = null;
      }
    };
  }, [partyActive, partyExpiresAt, stopPartyEffect, partySeed]);

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2000,
        overflow: 'hidden',
      }}
    >
      {/* Urgent timer flash (<= 5s) */}
      {hurryActive && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '18vw',
              background: 'linear-gradient(to right, rgba(255,0,0,0.75), rgba(255,0,0,0.3), rgba(255,0,0,0))',
              animation: 'ds-hurry-pulse 900ms ease-in-out infinite',
              willChange: 'opacity',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '18vw',
              background: 'linear-gradient(to left, rgba(255,0,0,0.75), rgba(255,0,0,0.3), rgba(255,0,0,0))',
              animation: 'ds-hurry-pulse 900ms ease-in-out infinite',
              willChange: 'opacity',
            }}
          />
        </>
      )}

      {/* Canvas pour confettis (utilise canvas-confetti pour realistic / school-pride) */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  );
}

function buildConfettiSets(seed: number): ConfettiSets {
  const random = mulberry32(Math.floor(seed * 1_000_000));
  // Augmenter fortement la densité et prolonger les durées pour rendre l'écran difficilement lisible
  const rain: ConfettiPiece[] = Array.from({ length: 180 }, (_, index) => ({
    id: `rain-${index}`,
    left: random() * 100,
    // lancer presque simultanément (petit jitter)
    delay: random() * 0.25,
    // longue durée pour couvrir ~10s
    duration: 8 + random() * 3,
    hue: Math.floor(random() * 360),
    // plus de dérive horizontale
    drift: random() * 10 - 5,
    // tailles variées
    size: 8 + random() * 12,
  }));

  const buildBurst = (prefix: string): ConfettiBurstPiece[] =>
    // augmenter le nombre de particules côté et prolonger la durée
    Array.from({ length: 60 }, (_, index) => ({
      id: `${prefix}-${index}`,
      delay: random() * 0.25,
      duration: 7 + random() * 3,
      hue: Math.floor(random() * 360),
      spreadX: 24 + random() * 36,
      spreadY: -10 + random() * 100,
      size: 10 + random() * 14,
    }));

  return {
    rain,
    left: buildBurst('left'),
    right: buildBurst('right'),
  };
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
