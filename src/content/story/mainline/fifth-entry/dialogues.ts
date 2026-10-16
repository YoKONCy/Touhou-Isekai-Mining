import { sequence } from '../../sequence'
import type { DialogueTree } from '../../../../game/dialogue/types'

export const FIFTH_TREES = {
  approach: sequence('touhou:fifth_approach', 'story.fifth.approach', ['narration', 'hero', 'narration']),
  vista: sequence('touhou:fifth_vista', 'story.fifth.vista', ['narration', 'narration', 'hero', 'narration', 'hero']),
  report: sequence('touhou:fifth_report', 'story.fifth.report', [
    'reimu', 'hero', 'rumia', 'hero', 'hero', 'reimu', 'hero', 'reimu',
    'hero', 'hero', 'reimu', 'hero', 'reimu', 'hero', 'rumia'
  ]),
  empty: sequence('touhou:fifth_empty', 'story.fifth.empty', ['hero', 'rumia', 'hero', 'rumia', 'hero']),
  meat: sequence('touhou:fifth_meat', 'story.fifth.meat', [
    'hero', 'narration', 'rumia', 'hero', 'rumia', 'hero', 'rumia', 'hero',
    'narration', 'reimu', 'rumia', 'hero'
  ])
}

FIFTH_TREES.approach.nodes.s2.portraitEmotion = 'question'
FIFTH_TREES.vista.nodes.s3.portraitEmotion = 'shock'
FIFTH_TREES.vista.nodes.s5.portraitEmotion = 'think'
for (const id of ['s6', 's8', 's11', 's13']) FIFTH_TREES.report.nodes[id].portraitEmotion = 'think'
for (const id of ['s3', 's15']) FIFTH_TREES.report.nodes[id].portraitEmotion = 'hungry'
for (const id of ['s4', 's9', 's12']) FIFTH_TREES.report.nodes[id].portraitEmotion = 'question'
for (const id of ['s3', 's5', 's7', 's11']) FIFTH_TREES.meat.nodes[id].portraitEmotion = 'hungry'
FIFTH_TREES.meat.nodes.s4.portraitEmotion = 'rant'
FIFTH_TREES.meat.nodes.s6.portraitEmotion = 'dead'
FIFTH_TREES.meat.nodes.s8.portraitEmotion = 'question'
FIFTH_TREES.meat.nodes.s10.portraitEmotion = 'think'
FIFTH_TREES.meat.nodes.s12.portraitEmotion = 'rant'

/** 延后带肉只补问肉与验肉，不重复回营报告。 */
export const FIFTH_MEAT_LATER: DialogueTree = {
  id: 'touhou:fifth_meat_later', start: 'ask',
  nodes: {
    ...FIFTH_TREES.meat.nodes,
    ask: { id: 'ask', text: 'story.fifth.meat.ask', speaker: 'story.speaker.rumia', portraitEmotion: 'hungry', next: 's1' }
  }
}
