import { svgIcon } from '../../../types'

/** 图标与手持器型统一：倒钩焰刃、暗紫护手、玫红晶核和金色刃棱。 */
export const DOOMSDAY_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84">' +
  '<defs><linearGradient id="doom-blade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffcca0"/><stop offset=".3" stop-color="#ee80af"/><stop offset=".5" stop-color="#8d258e"/><stop offset=".7" stop-color="#da409d"/><stop offset="1" stop-color="#40164f"/></linearGradient><linearGradient id="doom-guard" x2="1" y2="1"><stop stop-color="#854197"/><stop offset=".5" stop-color="#21152e"/><stop offset="1" stop-color="#603170"/></linearGradient></defs>' +
  '<g transform="translate(14 69) rotate(-45) scale(1.06)">' +
  '<path d="M8 -3 14 -5 12 -9 21 -5 25 -7 24 -11 32 -6 39 -8 38 -12 46 -7 52 -6 59 -3 66 -1 70 0 60 2 55 5 51 4 48 8 43 5 38 6 34 10 32 5 27 7 24 5 19 9 18 4 12 5Z" fill="url(#doom-blade)" stroke="#301231" stroke-width="1.4"/>' +
  '<path d="M9 -2 29 -4 47 -3 69 0 40 1 20 4Z" fill="#ffb1cc"/>' +
  '<path d="m13 -7 9 3 3 -4 m1 0 7 4 7 -4 m0 -1 7 4 20 4.5" fill="none" stroke="#ffe0ae" stroke-width="1.3"/>' +
  '<path d="m15 7 4 -4 5 -2 m1 5 4 -4 5 -2 m1 5 4 -4 5 -2" fill="none" stroke="#76256f"/>' +
  '<path d="M-10 -2H6V2H-10Z" fill="#24152e" stroke="#140e1b"/>' +
  '<path d="M-3 -3 0 -8 -2 -14 4 -10 7 -4 11 -7 9 0 11 6 7 4 4 10 -2 13 0 7 -4 4 -9 6 -6 0 -10 -5Z" fill="url(#doom-guard)" stroke="#140e20" stroke-width="1.2"/>' +
  '<path d="m-2 -11 5 4 2 5 m-10 5 6 4 2 2" fill="none" stroke="#aa58bc"/>' +
  '<path d="M0 -3 3 0 0 3 -2 0Z" fill="#fa81d1"/>' +
  '</g></svg>'
)
