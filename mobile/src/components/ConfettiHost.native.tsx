import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { setNativeConfettiTrigger } from '../utils/confetti';

export function ConfettiHost() {
  const [burstId, setBurstId] = useState(0);
  const [visible, setVisible] = useState(false);
  const nextId = useRef(0);

  useEffect(() => {
    setNativeConfettiTrigger(() => {
      nextId.current += 1;
      setBurstId(nextId.current);
      setVisible(true);
    });

    return () => setNativeConfettiTrigger(null);
  }, []);

  if (!visible) return null;

  const { width } = Dimensions.get('window');

  return (
    <View pointerEvents="none" style={styles.container}>
      <ConfettiCannon
        key={burstId}
        count={120}
        origin={{ x: width / 2, y: 0 }}
        fadeOut
        onAnimationEnd={() => setVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});

