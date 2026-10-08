import type { FourthCharacterExpression } from './fourthFloorCharacters'

/** 采用用户提供的 Edit 参考，头部与身体部件共用一个静态图集。 */
export const kedamaHeadAtlas = { width: 160, height: 160, columns: 6, rows: 3, scale: 4 } as const
export const kedamaHeadExpressions: readonly FourthCharacterExpression[] = ['neutral', 'happy', 'hungry', 'scared', 'hurt', 'sleeping']
export const kedamaBodyParts = { front: 0, side: 1, back: 2, upperArm: 3, lowerArm: 4, thigh: 5, shin: 6, shoe: 7, sideShoe: 8, wing: 9 } as const
export const kedamaBodyAtlas = { top: 480, width: 64, height: 96, columns: 6, scale: 2 } as const
