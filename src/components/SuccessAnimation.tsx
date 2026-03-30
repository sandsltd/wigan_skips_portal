'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface SuccessAnimationProps {
  size?: number;
}

export default function SuccessAnimation({ size = 120 }: SuccessAnimationProps) {
  return (
    <div style={{ width: size, height: size }}>
      <DotLottieReact
        src="/success.lottie"
        autoplay
        loop={false}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
