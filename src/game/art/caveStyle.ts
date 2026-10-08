import type { BiomeDef, BiomeFloorStyle, CaveSceneStyle } from '../../content/biomes/types'

/** 所有普通楼层与群系共享的材质底板；内容包通过数据产生变种。 */
export const CAVE_FLOOR_BASE: Readonly<BiomeFloorStyle> = {
  base: '#514b55', dark: '#2d2c3a', light: '#807887', dust: '#a18b73', detailDensity: .8
}
export const CAVE_SCENE_BASE: Readonly<CaveSceneStyle> = {
  wallTint: '#777086', tintStrength: .06, dampness: .08, vegetation: .14,
  deposits: .12, fungi: .03, boneFragments: 0, fogStrength: .42, deepHollow: false
}
export interface ResolvedCaveArt {
  /** 固定共用底板标识，便于验收新增楼层是否复用同一路径。 */
  template: 'mine'
  floor: BiomeFloorStyle
  scene: CaveSceneStyle
}

export function resolveCaveArt(biome?: Pick<BiomeDef, 'floorStyle' | 'sceneStyle' | 'floorArt'>, floor = 1): ResolvedCaveArt {
  const variation = biome?.floorArt?.[floor]
  const ground = { ...CAVE_FLOOR_BASE, ...biome?.floorStyle, ...variation?.floorStyle }
  const scene = { ...CAVE_SCENE_BASE, ...biome?.sceneStyle, ...variation?.sceneStyle }
  for (const key of ['tintStrength','dampness','vegetation','deposits','fungi','fogStrength'] as const) scene[key] = Math.max(0, Math.min(1, Number.isFinite(scene[key]) ? scene[key] : CAVE_SCENE_BASE[key]))
  scene.boneFragments = Math.max(0, Math.min(8, Math.floor(Number.isFinite(scene.boneFragments)?scene.boneFragments:0)))
  ground.detailDensity = Math.max(.2, Math.min(1.5, Number.isFinite(ground.detailDensity)?ground.detailDensity:CAVE_FLOOR_BASE.detailDensity))
  return { template: 'mine', floor: ground, scene }
}
