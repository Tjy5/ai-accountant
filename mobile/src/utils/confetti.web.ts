import confetti from 'canvas-confetti';

export const triggerConfetti = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
  });
};

