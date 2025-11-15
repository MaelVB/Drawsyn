'use client';

import React, { CSSProperties, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    if (!partyActive || !partyExpiresAt) return;
    const timeout = window.setTimeout(() => {
      stopPartyEffect();
    }, Math.max(0, partyExpiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [partyActive, partyExpiresAt, stopPartyEffect]);

  const confettiSets = useMemo<ConfettiSets | null>(() => {
    if (!partyActive) return null;
    const seed = partySeed || Math.random();
    return buildConfettiSets(seed);
  }, [partyActive, partySeed]);

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

      {/* Jour de fête confetti */}
      {partyActive && confettiSets && (
        <>
          <div style={{ position: 'absolute', inset: 0 }}>
            {confettiSets.rain.map((piece) => {
              const style: ConfettiStyle = {
                position: 'absolute',
                top: '-12vh',
                left: `${piece.left}%`,
                width: `${piece.size}px`,
                height: `${Math.max(6, piece.size * 0.6)}px`,
                borderRadius: '2px',
                background: `linear-gradient(180deg, hsl(${piece.hue}, 95%, 62%) 0%, hsl(${piece.hue}, 95%, 48%) 100%)`,
                transform: 'translateZ(0)',
                animation: `ds-confetti-fall ${piece.duration}s linear ${piece.delay}s forwards`,
                opacity: 0,
                '--confetti-drift': `${piece.drift}vw`,
              };
              return <span key={piece.id} data-ds-confetti style={style} />;
            })}
          </div>

          <div style={{ position: 'absolute', top: '8vh', left: 0, width: '25vw', height: '70vh' }}>
            {confettiSets.left.map((piece) => {
              const style: ConfettiStyle = {
                position: 'absolute',
                left: 0,
                bottom: 0,
                width: `${piece.size}px`,
                height: `${Math.max(6, piece.size * 0.6)}px`,
                borderRadius: '2px',
                background: `linear-gradient(135deg, hsl(${piece.hue}, 95%, 62%) 0%, hsl(${piece.hue}, 95%, 47%) 100%)`,
                transform: 'translateZ(0)',
                animation: `ds-confetti-burst-left ${piece.duration}s cubic-bezier(0.25, 0.1, 0.25, 1) ${piece.delay}s forwards`,
                opacity: 0,
                '--burst-x': `${piece.spreadX}vw`,
                '--burst-y': `${piece.spreadY}vh`,
              };
              return <span key={piece.id} data-ds-confetti style={style} />;
            })}
          </div>

          <div style={{ position: 'absolute', top: '8vh', right: 0, width: '25vw', height: '70vh' }}>
            {confettiSets.right.map((piece) => {
              const style: ConfettiStyle = {
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: `${piece.size}px`,
                height: `${Math.max(6, piece.size * 0.6)}px`,
                borderRadius: '2px',
                background: `linear-gradient(225deg, hsl(${piece.hue}, 95%, 62%) 0%, hsl(${piece.hue}, 95%, 47%) 100%)`,
                transform: 'translateZ(0)',
                animation: `ds-confetti-burst-right ${piece.duration}s cubic-bezier(0.25, 0.1, 0.25, 1) ${piece.delay}s forwards`,
                opacity: 0,
                '--burst-x': `${piece.spreadX}vw`,
                '--burst-y': `${piece.spreadY}vh`,
              };
              return <span key={piece.id} data-ds-confetti style={style} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}

function buildConfettiSets(seed: number): ConfettiSets {
  const random = mulberry32(Math.floor(seed * 1_000_000));
  const rain: ConfettiPiece[] = Array.from({ length: 55 }, (_, index) => ({
    id: `rain-${index}`,
    left: random() * 100,
    delay: random() * 0.6,
    duration: 3.2 + random() * 1.8,
    hue: Math.floor(random() * 360),
    drift: random() * 6 - 3,
    size: 10 + random() * 8,
  }));

  const buildBurst = (prefix: string): ConfettiBurstPiece[] =>
    Array.from({ length: 24 }, (_, index) => ({
      id: `${prefix}-${index}`,
      delay: random() * 0.5,
      duration: 2.4 + random() * 1.2,
      hue: Math.floor(random() * 360),
      spreadX: 18 + random() * 24,
      spreadY: -10 + random() * 70,
      size: 9 + random() * 10,
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
