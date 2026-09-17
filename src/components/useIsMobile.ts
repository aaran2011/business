import { useEffect, useState } from 'react'

/**
 * The phone layout switch.
 *
 * At or below this width the game uses its dedicated phone screen —
 * `MobileBoard` and the phone header, leaderboard and turn panel. Above it,
 * the square board and everything around it render exactly as they always
 * have. The stylesheet's phone section uses the SAME number; change one and
 * change the other.
 *
 * 600px covers every phone held upright, the iPhone 12 mini (375px) being the
 * narrowest one designed for, while leaving tablets on the full board.
 */
export const MOBILE_MAX_WIDTH = 600
const QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = () => setMobile(mql.matches)
    mql.addEventListener('change', onChange)
    onChange()
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return mobile
}
