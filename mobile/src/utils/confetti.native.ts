type NativeConfettiTrigger = () => void;

let nativeConfettiTrigger: NativeConfettiTrigger | null = null;

export function setNativeConfettiTrigger(trigger: NativeConfettiTrigger | null) {
  nativeConfettiTrigger = trigger;
}

export const triggerConfetti = () => {
  nativeConfettiTrigger?.();
};

