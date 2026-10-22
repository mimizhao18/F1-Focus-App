import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the phone asks for less motion (Reduce Motion / Remove animations): skip or shorten animations. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}
