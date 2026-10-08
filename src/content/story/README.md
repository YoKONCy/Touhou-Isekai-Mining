# 剧情、任务与文案入口

先按内容找到目录。同一章节的任务、对白、触发规则和中文文案放在一起。

| 内容 | 目录 | 中文文案 |
| --- | --- | --- |
| 序章、初遇与抵达营地 | `prologue/` | `prologue/lang/zh_cn.json` |
| 修锅、第一份蘑菇汤、交汤对白 | `mainline/camp-soup/` | `mainline/camp-soup/lang/zh_cn.json` |
| 找盐、岩盐汤、离营告别 | `mainline/salt-soup/` | `mainline/salt-soup/lang/zh_cn.json` |
| 工作台、简易制作引导 | `sidequests/crafting/` | `sidequests/crafting/lang/zh_cn.json` |
| 修熔炉、找风嘴、旧炉残骸 | `mainline/furnace/` | `mainline/furnace/lang/zh_cn.json` |
| 首炉烫手、旧矿道塌方、四层入口 | `mainline/mine-relay/` | `mainline/mine-relay/lang/zh_cn.json` |
| 灵梦的阶段闲聊与话题记忆 | `npc/reimu/` | `npc/reimu/lang/zh_cn.json` |
| 第一次死亡回营 | `events/first-death/` | `events/first-death/lang/zh_cn.json` |
| 找到收音机 | `events/radio/` | `events/radio/lang/zh_cn.json` |
| 初遇怪物房 | `events/monster-room/` | `events/monster-room/lang/zh_cn.json` |
| 说话人、通用教学与剧情提示 | 当前目录 | `lang/zh_cn.json` |

界面按钮、交互操作和布局提示在 `src/ui/lang/`：

| 界面 | 文件 |
| --- | --- |
| 任务手账、历史任务、营地通用提示 | `camp_zh_cn.json` |
| 烹饪与锅维修界面 | `cooking_zh_cn.json` |
| 工作台、熔炉维修与冶炼界面 | `production_zh_cn.json` |
| 楼层选择 | `floors_zh_cn.json` |
| 仓库 | `storage_zh_cn.json` |

营地家具的名字和观察描述仍在 `src/content/base/lang/zh_cn.json`。
已有 i18n 键保持原样。例如任务文案中的 `ui.progress.find_nozzle` 属于熔炉章节，维修按钮与步骤名 `ui.production.*` 属于制作界面。

## 查一句文案

在项目根目录搜索台词片段或文案键：

```powershell
rg -n "接到炉膛" src/content/story src/ui/lang
rg -n "quest.furnace_key.s1" src/content/story
```

`src/i18n/index.ts` 还提供运行时查询，结果包含原文、语言与来源文件：

```ts
findTextSource('quest.furnace_key.s1')
searchText('风嘴')
```

查询使用当前语言与中文回退；MOD 覆盖后显示覆盖文件的来源，加载回滚时连同来源一起恢复。

## 一个章节各文件负责什么

- `quest.ts`：任务的主线／支线分类、何时出现、各步骤状态、材料展示、历史完成状态以及交付入口。任务手账读取通用注册表，不包含具体主线判断。
- `scenes.ts`：收到哪个事件时播放、播放条件、优先级、完成标记、后续对白与通知。
- `dialogues.ts`：台词顺序、说话人、分支和演出节点；文本通过 i18n 键引用。
- `transactions.ts`：检查材料、扣料、奖励与提交进度。对白取消或补播不会重新执行交付。
- `lang/zh_cn.json`：此章节的对白和任务叙述。
- `pack.ts`：声明本章节包含哪些对白树、任务、场景规则和语言。

短对白可使用 `sequence.ts`；序章等需要战斗、移动和黑屏节拍的复杂演出仍使用专门导演，文本与对白树归入对应内容目录。

## 增加主线、支线或 NPC

1. 在 `mainline/<章节>/`、`sidequests/<支线>/`、`npc/<角色>/` 或 `events/<事件>/` 新建自己的目录。
2. 按需要添加上述文件；独立小事件可以只有对白、语言和内容包。
3. `pack.ts` 默认导出一个满足 `StoryPack` 的对象，类型在 `types.ts`。任务实现 `QuestDefinition`，NPC 闲聊实现 `NpcConversation`。
4. `index.ts` 自动发现所有子目录的 `pack.ts`。加入任务、对白树或闲聊不需要修改 `CampPanel.vue`、`App.vue` 或注册清单。
5. 场景模块负责报告交互和探索事件。使用现有事件即可直接扩展；新增玩法事件只需在对应交互处报告一次。

NPC 的话题池、阶段判断、已聊记忆和台词放在该 NPC 自己的目录。应用统一调用 `talkToNpc()`。

## 当前事件与推进约定

| 事件 | 触发时机 |
| --- | --- |
| `camp.idle` | 营地无面板、无对白时检查待播剧情 |
| `camp.extracted` | 正常撤离回营，处理首次收音机事件 |
| `camp.worktable` | 使用尚未开放的工作台 |
| `camp.furnace` | 检查尚未检视的熔炉 |
| `camp.departure` | 选好层级准备下矿 |
| `furnace.repaired` | 当前维修动画播放完成 |
| `furnace.claimed` | 成品成功领取的小动画播放完成，首次剧情也可由 `camp.idle` 补播 |
| `cave.furnaceSearch` | 搜索旧炉，事件参数包含是否找到零件 |
| `cave.monsterRoom` | 初次进入怪物房 |

通过 `playNextStory(event, context)` 播放符合条件的最高优先级场景；明确交付某个任务时可使用 `playStory(id, context)`。场景 ID 使用现有对白树 ID。

`when` 只检查条件。`prepare` 在确认对白存在且可播放后提交事务，失败则不播。`completeFlags` 在自然结束时写入，取消时不写；通过 `camp.idle` 声明的未完小剧可补播。`startFlags` 用于“第一次看见”这类立即记忆的事件。`consumeData` 只消耗本次事件参数。

任务与对白完成使用不同标记：交付成功时先提交任务进度，再播放对白。任务历史由持久进度推导，不依赖已经消耗的物品。现有存档标记、对白树 ID、节点 ID 和 i18n 键均沿用旧值，无需迁移存档。

新增内容使用独立命名空间，避免复用其他章节的标记。所有 UI 成功演出跟随已完成的事务，剧情规则不依赖动画是否看完。

## 旧矿道中继章节

工作桌新增铁制加工小剧情：`sidequests/crafting/ironWork.ts` 集中保存首炉完成、加工解锁、首把铁武器和吐槽已看旗标。任意金属首炉完成后在桌边提示，工作桌对白自然结束才开放含铁锭的配方；冶炼本身不受此门控。制作铁制武器后，关闭面板进入空闲时补播灵梦吐槽，取消不记已看。铁矛、铁剑、铁镐与铁头箭共用此流程，旧档领过金属可补接。

`mainline/mine-relay/state.ts` 集中定义进度标记，`route.ts` 定义四房间线性路线、每房 2～3 只怪及偏多矿物。矿洞导演在 `game/cave/MineRelayDirector.ts`，落石和扬尘在 `game/art/mineCollapse.ts`，岩块材质、堆积图层与岔路裂口在 `game/art/mineCollapseAppearance.ts`。

熔炉修好后，下一次选择三层即进入途中场景，兼容已有维修进度的旧档。首次真正领到金属锭才记领取进度并播放烫手对白，这段小剧独立于中继门控。一、二层成功撤离的提醒只播一次，随后三层卡片显示感叹号。中继在查看新岔路后按成功撤离结算，回营报告可补播；三层旧路关闭，报告结束开放四层。死亡、途中刷新和普通提前撤离不提交塌方完成。

四层的专用地图入口在 `game/cave/dungeon/fourthFloor.ts`，复用 BSP 分支地图与距离预算曲线，群系配置在 `content/biomes/vanilla/deepHollow.ts`。小怪为毛玉与护卫史莱姆，前几层的普通生物池不会混入四层。首次最远房间由 `FourthFloorDirector` 接管 BOSS 与救援，完成救援后重访恢复普通流程。

四层怪物、弹幕和新资源文案并入 `content/vanilla/lang/zh_cn.json`；入口卡片仍在 `ui/lang/floors_zh_cn.json`。角色外观索引在 `content/characters/vanilla/fourthFloor.ts`，普通毛玉酱人形与超载 BOSS 形态独立保存；普通人形不提前出现在营地。毛玉酱使用正式部件与用户提供的双立绘；露米娅使用确认 C 版头部、骨骼衣身和用户提供的立绘。

第四层定稿对白与数值归档至 `.docs/FOURTH_FLOOR_PLAN.md`，运行剧情包为 `mainline/fourth-rescue/`。`KedamaBoss` 为 1600 HP 两段实体，半血对白结束后才生成唯一 180 HP 护卫；`FourthFloorDirector` 负责登场、清弹、还原、F 解救与回营；`FourthCampScene` 负责认人、讨肉、询问与下矿门控。

进度 `story.fourth.won/rescued/rumiaKnown/arrived/campDone/asked` 分别记录胜利、解救、姓名揭示、回营首段、讨肉过场与完整询问；胜利后重进只补救援。所有下矿入口在解救后、询问前拦截，询问取消不解锁。完整结束后开放第五层并显示主线“亮亮的那条路”。

离线验收为 `node art-studies/fourth-floor/verify.cjs`，覆盖正式矿洞/基地模块和存档门控。TODO：第五层独有群系、怪物和肉类素材另行设计；当前复用深窟底板与四层怪池。
