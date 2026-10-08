# 第四层角色外观

入口为 `vanilla/fourthFloor.ts`。外观索引登记角色绘制函数与立绘，接收项目共用的 `PlayerPose`，不再声明未被游戏播放的整帧图集路径。普通角色使用四向行走；毛玉酱 BOSS 日常保持正面，移动使用 >w< 与微倾，螺旋甩手技能短暂侧身后回正。

可选参数包括表情 `expression`、束缚 `bound`、超载强度 `overload`、聚气 `cast` 与战败垂翼 `wingDroop`。第四层首领实体与救援导演已接入；战败后变回毛玉，随露米娅回营。普通人形仍留给后续醒来剧情。

毛玉酱运行资源为 `public/characters/kedama-girl/character-parts.png`，头部、身体与翅膀由骨骼入口连续绘制。完整帧展示位于 `art-studies/kedama-girl/frame-atlas.png` 与 `boss-frame-atlas.png`，不参与游戏加载。

毛玉酱普通与 BOSS 立绘分别为 `portrait.png` 和 `portrait-boss.png`，已登记在外观索引和对话立绘解析器中。毛玉酱本人的 Sprite 保持闭嘴，头饰与毛玉小怪保留囧脸。

露米娅确认样板位于 `art-studies/rumia/approved/`，历史候选位于 `art-studies/rumia/archive/`。`drawRumiaRig` 已接入 `rumiaRuntime.ts`，按正式头部裁片与原 C 版骨骼衣身组合；立绘使用用户提供的参考原图去除青边后的正式资源。所有运行图片均位于 `public/characters/rumia/`。

参考原图集中于 `art-studies/references/`，画风及部件规范见 `src/game/art/STYLE_GUIDE.md`。
