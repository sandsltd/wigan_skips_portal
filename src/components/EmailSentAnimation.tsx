'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface EmailSentAnimationProps {
  size?: number;
}

export default function EmailSentAnimation({ size = 100 }: EmailSentAnimationProps) {
  return (
    <div style={{ width: size, height: size }}>
      <DotLottieReact
        src="/email-sent.lottie"
        autoplay
        loop
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
