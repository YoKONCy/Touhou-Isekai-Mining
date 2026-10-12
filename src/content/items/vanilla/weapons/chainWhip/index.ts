import { svgIcon, type ItemDef } from '../../../types'
import { CHAIN_WHIP_ID } from '../../ids'
import whip from '../whip'
import { drawChainWhip, drawChainGrip } from './appearance'
import { chainIdleAim, chainIdleGrip } from './motion'

/** 链鞭独立编排待机收链握持，攻击曲线、扫掠判定及出招动作沿用皮鞭模组。 */
const chainWhip: ItemDef = {
  ...whip,
  id: CHAIN_WHIP_ID,
  grade: 1,
  combat: { ...whip.combat, penetration: 2, critChance: .04 },
  melee: { ...whip.melee!, damage: 22, windup: .15, active: .26, recover: .36 },
  weapon: { ...whip.weapon, drawHeld: drawChainGrip, drawCurve: drawChainWhip, idleAim: chainIdleAim, supportGrip: chainIdleGrip },
  color: '#7f8d9e', hi: '#dae0dc', text: '#d4d9df',
  tags: [...(whip.tags ?? []), 'chain'],
  icon: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke-linecap="round">
    <path d="M21 43Q19 31 29 22T43 12Q55 11 50 25T40 40Q38 48 50 48" stroke="#30313e" stroke-width="5"/>
    <path d="M21 43Q19 31 29 22T43 12Q55 11 50 25T40 40Q38 48 50 48" stroke="#8596a8" stroke-width="2"/>
    <g stroke="#d2d9d9" stroke-width="1.6">
      <ellipse cx="21" cy="40" rx="2.4" ry="4"/>
      <ellipse cx="22" cy="33" rx="2.3" ry="4" transform="rotate(16 22 33)"/>
      <ellipse cx="26" cy="27" rx="2.4" ry="4" transform="rotate(39 26 27)"/>
      <ellipse cx="31" cy="21" rx="2.4" ry="4" transform="rotate(42 31 21)"/>
      <ellipse cx="37" cy="16" rx="2.4" ry="4" transform="rotate(52 37 16)"/>
      <ellipse cx="44" cy="13" rx="2.4" ry="4" transform="rotate(82 44 13)"/>
      <ellipse cx="50" cy="17" rx="2.2" ry="4"/>
      <ellipse cx="49" cy="24" rx="2.2" ry="4" transform="rotate(18 49 24)"/>
      <ellipse cx="46" cy="31" rx="2.2" ry="4" transform="rotate(25 46 31)"/>
      <ellipse cx="42" cy="37" rx="2.2" ry="4" transform="rotate(30 42 37)"/>
      <ellipse cx="41" cy="44" rx="2.2" ry="4" transform="rotate(-27 41 44)"/>
      <ellipse cx="47" cy="48" rx="2.2" ry="4" transform="rotate(80 47 48)"/>
    </g>
    <path d="M20 43L9 56" stroke="#28232c" stroke-width="9"/>
    <path d="M20 43L9 56" stroke="#6d4b3d" stroke-width="6"/>
    <path d="M15 46L19 49M12 50L16 53M9 54L13 57" stroke="#b2946b" stroke-width="1.2"/>
    <path d="M18 42L23 46M7 55L12 59" stroke="#c4cdd0" stroke-width="2.5"/>
  </g></svg>`)
}

export default chainWhip
