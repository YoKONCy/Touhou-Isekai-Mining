import type { MeleeMove,WeaponMotionView,WeaponTrailView } from '../content/items/types'
import type { PlayerPose } from './art/rig/skeleton'
import type { PlayerAppearance,PlayerCostume } from '../shared/playerAppearance'
import { withSimulationAppearance,withPlayerCostume } from '../shared/playerAppearance'
import { getItemDef } from '../shared/itemDefs'
import { drawPlayerRig,getPlayerHandAnchor,getPlayerSupportHandAnchor } from './art/rig/playerRig'
import { dirAngle } from './art/rig/skeleton'
import { drawRigWeapon } from './art/rig/weaponRig'
import { bakeSprite,drawSprite,type RasterSprite } from '../core/rendering/SpriteCache'

export interface MeleeEcho {
  x:number;y:number;angle:number;weaponId:string;age:number;activeDuration:number;duration:number
  /** 起手错开量归模拟时间管理，旧快照缺省立即挥出。 */
  delay?:number
  damage:number;magicPenetration:number;move:MeleeMove;hitIds:Set<string>
  pose:PlayerPose;motion:WeaponMotionView;appearance:PlayerAppearance;costume:PlayerCostume
}
const silhouettes=new WeakMap<MeleeEcho,{sprite:RasterSprite;frame:number}>()

/** 模拟只保存纯数据；黑影贴图延迟到首次绘制，兼容无头模拟和续战快照。 */
export function renderMeleeEcho(g:CanvasRenderingContext2D,echo:MeleeEcho):void {
  let cached=silhouettes.get(echo)
  if(!cached){cached={sprite:bakeSprite(-104,-108,208,188,()=>{},1.5),frame:-1};silhouettes.set(echo,cached)}
  const frame=Math.floor(echo.age*60)+(echo.motion.phase==='windup'?10000:echo.motion.phase==='recover'?20000:0)
  if(cached.frame!==frame){
    const c=cached.sprite.image.getContext('2d')!,resource=getItemDef(echo.weaponId).weapon,pose=echo.pose,motion=echo.motion
    c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.clearRect(0,0,c.canvas.width,c.canvas.height)
    c.setTransform(1.5,0,0,1.5,-cached.sprite.x*1.5,-cached.sprite.y*1.5)
    withSimulationAppearance(echo.appearance,()=>withPlayerCostume(echo.costume,()=>{
      drawPlayerRig(c,0,0,pose,{
        drawWeapon:w=>drawRigWeapon(w,echo.weaponId,{motion,mirrored:pose.dir==='right',thrust:resource?.thrust?.(motion)}),
        drawAccessory:resource?.drawAccessory?g=>resource.drawAccessory!(g,{...motion,x:pose.rootX,y:pose.rootY,bodyFacing:dirAngle(pose.dir),hand:getPlayerHandAnchor(0,0,pose),supportHand:getPlayerSupportHandAnchor(0,0,pose)}):undefined
      })
    }))
    c.globalCompositeOperation='source-in';c.fillStyle='#120b16';c.fillRect(-104,-108,208,188)
    cached.frame=frame
  }
  const appear=Math.min(1,echo.age/.025),fade=Math.min(1,(echo.duration-echo.age)/.16)
  g.save();g.translate(echo.x,echo.y);g.globalAlpha*=appear*fade*.55;drawSprite(g,cached.sprite);g.restore()
  const trail=getItemDef(echo.weaponId).weapon?.trail
  const elapsed=echo.age-(echo.delay??0)
  if(trail&&elapsed>=0&&elapsed<trail.duration){
    const view:WeaponTrailView={x:echo.x,y:echo.y,angle:echo.angle,segment:echo.motion.segment,age:elapsed,activeDuration:echo.activeDuration}
    g.save();g.globalAlpha*=.28*fade;trail.render(g,view);g.restore()
  }
}
