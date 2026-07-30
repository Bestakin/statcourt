import { useState, useEffect, useRef } from 'react'

// Animates a number counting up (or down) to its target value whenever
// the target changes. Used for the composite score so it feels alive
// instead of snapping instantly.
export default function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target)
  const startRef = useRef(target)
  const frameRef = useRef(null)

  useEffect(() => {
    const start = startRef.current
    const startTime = performance.now()

    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic, feels snappier than linear
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(start + (target - start) * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        startRef.current = target
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return value
}
