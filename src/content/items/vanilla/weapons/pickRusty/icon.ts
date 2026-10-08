/** 生锈铁镐：斜置长柄、楔形双端镐头，保留小尺寸下的清晰轮廓。 */
import { svgIcon } from '../../../types'

export const PICK_RUSTY_ICON = svgIcon(`<svg viewBox="0 0 48 48" width="100%" height="100%" shape-rendering="geometricPrecision">
  <!-- 柄先画，镐头覆盖连接处，避免木柄穿过刃面。 -->
  <path d="M10 42L14 43L30 17L26 15Z" fill="#855b35" stroke="#302922" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M11.4 41L27 16" stroke="#c29962" stroke-width="1.4"/>
  <path d="M16 35L18 30M21 26L23 23" stroke="#583d29" stroke-width="1"/>
  <path d="M10 40L13 42" stroke="#bc9563" stroke-width="1.5"/>
  <!-- 非对称锻铁镐头：左端尖弯，右端为稍钝的凿口。 -->
  <path d="M5 20Q12 7 25 9Q35 10 43 23L39 25Q32 17 25 16Q14 13 5 20Z" fill="#6d6255" stroke="#29282a" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M7 17Q15 8 25 10Q35 12 41 23L38 21Q30 13 25 13Q15 11 7 17Z" fill="#9b9586"/>
  <path d="M6 19Q14 13 22 14M33 17L40 24" fill="none" stroke="#c5c3ae" stroke-width="1.2"/>
  <path d="M16 11L21 10L23 13L19 14Z M30 13L34 14L36 18L32 17Z" fill="#945a37"/>
  <path d="M12 14L14 12M37 20L39 22" stroke="#72432e" stroke-width="1.8"/>
  <!-- 镐眼铁套与楔钉，紧扣柄头。 -->
  <path d="M24 11L30 14L28 20L22 17Z" fill="#554b40" stroke="#29282a" stroke-width="1.3"/>
  <path d="M24 11L30 14L29 16L23 13Z" fill="#b2a78e"/>
  <path d="M24 15L27 16" stroke="#a17447" stroke-width="1.5"/>
  <circle cx="26" cy="17" r="1" fill="#25262a"/>
</svg>`)
