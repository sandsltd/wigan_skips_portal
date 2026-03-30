'use client';

import { motion } from 'framer-motion';
import { useBusinessConfig } from '@/lib/BusinessConfigContext';

const shapes = [
  { size: 300, x: '10%', y: '20%', delay: 0, duration: 20 },
  { size: 200, x: '80%', y: '10%', delay: 2, duration: 25 },
  { size: 150, x: '70%', y: '70%', delay: 1, duration: 18 },
  { size: 250, x: '5%', y: '75%', delay: 3, duration: 22 },
  { size: 100, x: '50%', y: '50%', delay: 0.5, duration: 30 },
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function FloatingShapes() {
  const config = useBusinessConfig();
  const color = config.primaryColor;

  if (!color) return null;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {shapes.map((shape, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: shape.size,
            height: shape.size,
            left: shape.x,
            top: shape.y,
            background: i % 2 === 0
              ? `radial-gradient(circle, ${hexToRgba(color, 0.08)} 0%, transparent 70%)`
              : `radial-gradient(circle, ${hexToRgba(color, 0.06)} 0%, transparent 70%)`,
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [0.8, 1.1, 0.9, 1],
            opacity: [0.3, 0.6, 0.4, 0.5],
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
          }}
          transition={{
            duration: shape.duration,
            delay: shape.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
