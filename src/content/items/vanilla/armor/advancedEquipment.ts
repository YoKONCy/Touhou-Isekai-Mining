import { svgIcon,type ItemDef } from '../../types'
import { MYSTERIOUS_AMULET_ID,KNIGHT_PLATE_ID } from '../ids'
import { MINE_BLESSINGS } from '../../../statuses/mineBlessings'

const amulet:ItemDef={
  id:MYSTERIOUS_AMULET_ID,kind:'armor',equipSlot:'trinket',grade:2,maxStack:1,tags:['trinket'],
  color:'#8d70af',hi:'#ddcbef',text:'#c8b3e1',mineRunBuffs:MINE_BLESSINGS,
  weapon:{skillDescriptions:{summaryKey:'skill.mysterious_amulet.summary',effects:MINE_BLESSINGS.map(effect=>({nameKey:effect.nameKey,descriptionKey:effect.descriptionKey}))}},
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M7 3Q9 19 21 22M41 3Q39 19 27 22" fill="none" stroke="#493e52" stroke-width="3"/><path d="M7 3Q9 18 21 21M41 3Q39 18 27 21" fill="none" stroke="#b8a6bb" stroke-width="1"/><path d="M21 19H27L29 25H19Z" fill="#b6a3bc" stroke="#453449"/><path d="M24 24L37 31L34 41L24 47L14 41L11 31Z" fill="#84718c" stroke="#372b43" stroke-width="1.6"/><path d="M24 27L33 32L31 39L24 43L17 39L15 32Z" fill="#7853a4"/><path d="M24 27L21 34L15 32Z" fill="#d6b3ef"/><path d="M24 27L33 32L27 35L21 34Z" fill="#ac85d0"/><path d="M21 34L27 35L24 43L17 39Z" fill="#9270bc"/><path d="M33 32L31 39L24 43L27 35Z" fill="#4d326f"/><path d="M16 31L21 28M16 34V37M23 22H26" fill="none" stroke="#eee1f6" stroke-width="1"/><path d="M12 31L14 39M36 31L34 39M19 44L24 46L29 44" fill="none" stroke="#d6c4dc" stroke-width=".8"/></svg>')
}

const plate:ItemDef={
  id:KNIGHT_PLATE_ID,kind:'armor',equipSlot:'outfit',grade:2,maxStack:1,tags:['armor'],
  wearableAppearance:'knight_plate',
  color:'#7d899b',hi:'#d7dfe7',text:'#b9c7da',
  combat:{physicalResist:6,meleeWeaponDamageBonus:.1,projectileReductionRange:[3,5],moveSpeedMultiplier:.76,dodgeCooldownMultiplier:2.5},
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M16 7L19 3H29L32 7L31 16H17Z" fill="#a5adba" stroke="#343747" stroke-width="1.5"/><path d="M19 4Q24 9 29 4L28 10Q24 13 20 10Z" fill="#3e4252"/><path d="M15 8L7 9L2 17L4 23L13 21L16 16M33 8L41 9L46 17L44 23L35 21L32 16" fill="#8e9bac" stroke="#343747" stroke-width="1.5"/><path d="M7 10L3 17L12 16L15 9M34 9L36 16L45 17L41 10" fill="#c5cfdc"/><path d="M13 11L19 13H29L35 11L34 25L29 32H19L14 25Z" fill="#9faab9" stroke="#343747" stroke-width="1.5"/><path d="M14 12L19 14L24 17V30L19 29L16 24Z" fill="#d4dce4"/><path d="M24 17L33 12L32 25L28 30H24Z" fill="#7a869a"/><path d="M24 16V30M15 22L22 25M33 22L26 25" stroke="#4d566a" fill="none"/><path d="M17 29H31L33 34L32 38L35 43L27 46L24 41L21 46L13 43L16 38L15 34Z" fill="#8896a8" stroke="#343747" stroke-width="1.4"/><path d="M16 33L24 35L32 33M16 38L24 40L32 38M15 42L21 43M27 43L33 42" fill="none" stroke="#d3dce6" stroke-width="1"/><path d="M17 31H31" stroke="#c2ad7b" stroke-width="2"/><rect x="22" y="29.5" width="4" height="3" fill="#746448" stroke="#e2c995" stroke-width=".6"/></svg>')
}

export const advancedEquipment=[amulet,plate]
