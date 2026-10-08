# 游戏角色运行资源

此目录只保存游戏实际加载的部件图集与立绘；参考原图、制作裁片和整帧展示图保存在 `art-studies/`。

- `player/character-parts.png`：哥哥的头部、衣身、手臂、腰胯与腿脚。
- `sister/character-parts.png`、`portrait.png`：妹妹的部件与对白立绘。
- `reimu/character-parts.png`：灵梦四向、表情、衣身、手臂与长发部件。
- `reimu/prayer-parts.png`：祈祷过场按需加载的专用闭眼头部与微像素合掌。
- `kedama-girl/character-parts.png`、`portrait.png`、`portrait-boss.png`：毛玉酱普通与 BOSS 共用部件，以及两种立绘。
- `kedama-girl/moving-head.png`：首领移动使用的 >w< 透明头图，保留正式头发、脸型与毛团头饰。
- `rumia/head-front.png`、`head-side.png`、`head-back.png`、`portrait.png`：露米娅确认的 C 版头部裁片与正式对白立绘，已用于四层救援与营地。

部件由骨骼绘制入口连续组合，游戏不播放 `sprite.png` 整帧图集。整帧导出现在位于各角色的 `art-studies/<角色>/frame-atlas.png`，毛玉酱另有 `boss-frame-atlas.png`。

露米娅旧图集已移除；运行入口使用上列资源，制作样板保留在 `art-studies/rumia/approved/`。
