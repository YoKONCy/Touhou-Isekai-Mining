import type { EnemyBodyPath } from '../types'

/** 同族三瓣软裙边，体型由资源各自选择。 */
export function slimeBodyPath(kind: 'blue' | 'red' | 'venom'): EnemyBodyPath {
  return (ctx, x, y, rx, ry) => {
    ctx.beginPath()
    if (kind === 'venom') {
      ctx.moveTo(x - rx * 1.07, y + ry * .24)
      ctx.bezierCurveTo(x - rx * 1.22, y - ry * .52, x - rx * .45, y - ry * .94, x + rx * .08, y - ry * .82)
      ctx.bezierCurveTo(x + rx * .7, y - ry * 1.05, x + rx * 1.15, y - ry * .28, x + rx * 1.08, y + ry * .35)
    } else if (kind === 'red') {
      ctx.moveTo(x - rx, y + ry * .3)
      ctx.bezierCurveTo(x - rx * 1.08, y - ry * .2, x - rx * .52, y - ry * 1.17, x, y - ry * 1.12)
      ctx.bezierCurveTo(x + rx * .55, y - ry * 1.17, x + rx * 1.05, y - ry * .12, x + rx, y + ry * .3)
    } else {
      ctx.moveTo(x - rx * 1.07, y + ry * .32)
      ctx.bezierCurveTo(x - rx * 1.17, y - ry * .39, x - rx * .6, y - ry, x - rx * .06, y - ry * .96)
      ctx.bezierCurveTo(x + rx * .62, y - ry * 1.03, x + rx * 1.16, y - ry * .38, x + rx * 1.07, y + ry * .32)
    }
    ctx.bezierCurveTo(x + rx * .95, y + ry * .87, x + rx * .5, y + ry * .9, x + rx * .36, y + ry * .69)
    ctx.bezierCurveTo(x + rx * .14, y + ry * .94, x - rx * .22, y + ry * .92, x - rx * .4, y + ry * .71)
    ctx.bezierCurveTo(x - rx * .7, y + ry * .91, x - rx * 1.06, y + ry * .75, x - rx * (kind === 'red' ? 1 : 1.07), y + ry * .3)
    ctx.closePath()
  }
}
