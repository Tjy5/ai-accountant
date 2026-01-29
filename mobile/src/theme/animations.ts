import { Easing } from 'react-native';

type EasingFunction = (value: number) => number;

export interface AnimationConfig {
  spring: {
    damping: number;
    stiffness: number;
    mass: number;
    overshootClamping: boolean;
    restDisplacementThreshold: number;
    restSpeedThreshold: number;
  };
  softSpring: {
    damping: number;
    stiffness: number;
    mass: number;
    overshootClamping: boolean;
    restDisplacementThreshold: number;
    restSpeedThreshold: number;
  };
  timing: {
    veryFast: number;
    fast: number;
    medium: number;
    slow: number;
    verySlow: number;
  };
  easing: {
    elastic: EasingFunction;
    easeOut: EasingFunction;
    easeInOut: EasingFunction;
    easeIn: EasingFunction;
  };
}

export const animations = {
  spring: {
    damping: 15,
    stiffness: 120,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
  },
  softSpring: {
    damping: 20,
    stiffness: 90,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
  },
  timing: {
    veryFast: 150,
    fast: 200,
    medium: 350,
    slow: 500,
    verySlow: 700,
  },
  easing: {
    elastic: Easing.elastic(1),
    easeOut: Easing.out(Easing.ease),
    easeInOut: Easing.inOut(Easing.ease),
    easeIn: Easing.in(Easing.ease),
  },
} satisfies AnimationConfig;
