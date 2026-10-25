/** 格林试炼节奏集中配置；弹幕、预警与实际击发共用时间参数。 */
export const GRIMM_BALANCE = {
  survival: {
    duration: 24,
    beat: .64,
    counts: [12, 14, 16],
    speeds: [180, 215, 245],
    riftTimes: [10.8, 14.8, 18, 21.2],
    riftWarning: .8,
    riftPauseBefore: .12,
    riftPauseAfter: .85,
    gapHalfAngle: .18,
    seedSplitAt: 1.35,
    seedShotSpeed: 210
  },
  laser: {
    warning: .26,
    dualWarning: .46,
    step: .065,
    dualStep: .085,
    active: .09,
    groupOffset: .22,
    hintDuration: .11
  }
} as const
