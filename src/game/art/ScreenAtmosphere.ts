/** 屏幕空间氛围组件：颜色与场景独立，缓存绑定画布上下文和尺寸。 */
export interface ScreenAtmosphereStyle {
  vignetteMiddle: string
  vignetteEdge: string
  wash: string
  pulseCore: string
  pulseMiddle: string
  pulseEdge: string
}
export class ScreenAtmosphere {
  private cache: { context: CanvasRenderingContext2D; w: number; h: number; gradient: CanvasGradient } | null = null
  constructor(private readonly style: ScreenAtmosphereStyle) {}
  reset(): void { this.cache = null }
  render(g: CanvasRenderingContext2D, w: number, h: number, time: number, pulse: number, x: number, y: number): void {
    g.save()
    try {
      if (!this.cache || this.cache.context !== g || this.cache.w !== w || this.cache.h !== h) {
        const gradient = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .34, w / 2, h / 2, Math.max(w, h) * .72)
        gradient.addColorStop(0, 'rgba(0,0,0,0)')
        gradient.addColorStop(.72, this.style.vignetteMiddle)
        gradient.addColorStop(1, this.style.vignetteEdge)
        this.cache = { context: g, w, h, gradient }
      }
      g.fillStyle = this.cache.gradient; g.fillRect(0, 0, w, h)
      g.globalCompositeOperation = 'lighter'
      g.globalAlpha = .028 + .012 * Math.sin(time * .7) + pulse * .08
      g.fillStyle = this.style.wash; g.fillRect(0, 0, w, h)
      if (pulse > 0) {
        g.globalAlpha = pulse
        const gradient = g.createRadialGradient(x, y, 10, x, y, Math.max(w, h) * .65)
        gradient.addColorStop(0, this.style.pulseCore)
        gradient.addColorStop(.5, this.style.pulseMiddle)
        gradient.addColorStop(1, this.style.pulseEdge)
        g.fillStyle = gradient; g.fillRect(0, 0, w, h)
      }
    } finally { g.restore() }
  }
}
export const GRIMM_SCREEN_STYLE: ScreenAtmosphereStyle = {
  vignetteMiddle: 'rgba(26,4,10,.34)', vignetteEdge: 'rgba(10,1,5,.74)', wash: 'rgb(110,26,30)',
  pulseCore: 'rgba(255,64,36,.30)', pulseMiddle: 'rgba(190,34,30,.14)', pulseEdge: 'rgba(120,20,20,0)'
}
