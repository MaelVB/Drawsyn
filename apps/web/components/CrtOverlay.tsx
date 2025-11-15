'use client';

import { useEffect, useMemo } from 'react';
import { useEffectsStore } from '@/stores/effects-store';

interface CrtOverlayProps {
  forceSquareMask?: boolean;
}

export default function CrtOverlay({ forceSquareMask = false }: CrtOverlayProps) {
  const { crtActive, crtSeed, crtExpiresAt, stopCrtEffect } = useEffectsStore((state) => ({
    crtActive: state.crtActive,
    crtSeed: state.crtSeed,
    crtExpiresAt: state.crtExpiresAt,
    stopCrtEffect: state.stopCrtEffect,
  }));

  useEffect(() => {
    if (!crtActive || !crtExpiresAt) return;
    const timeout = window.setTimeout(() => {
      stopCrtEffect();
    }, Math.max(0, crtExpiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [crtActive, crtExpiresAt, stopCrtEffect]);

  const flickerDelay = useMemo(() => {
    if (!crtActive) return 0;
    const seed = crtSeed || Math.random();
    return (seed % 0.35) + 0.05;
  }, [crtActive, crtSeed]);

  if (!crtActive) {
    return null;
  }

  return (
    <>
      <div
        data-ds-crt
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.45) 80%), repeating-linear-gradient(to bottom, rgba(255,255,255,0.09) 0px, rgba(255,255,255,0.09) 1px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 3px)',
          mixBlendMode: 'overlay',
          opacity: 0.65,
          maskImage: forceSquareMask ? 'radial-gradient(circle at center, rgba(0,0,0,1) 62%, rgba(0,0,0,0.4) 78%, rgba(0,0,0,0) 100%)' : undefined,
          animation: `ds-crt-flicker 160ms steps(2, end) infinite ${flickerDelay}s`,
        }}
      />
      <div
        data-ds-crt
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.25) 100%)',
          opacity: 0.75,
          mixBlendMode: 'multiply',
        }}
      />
      <div
        data-ds-crt
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.08) 50%, transparent 100%)',
          opacity: 0.4,
          animation: `ds-crt-roll 4.4s linear infinite ${flickerDelay}s`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}
