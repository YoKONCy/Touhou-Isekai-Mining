import type { DialogueTree } from '../../../../game/dialogue/types'

export const FIRST_DEATH_TREE = 'touhou:first_death'
export const firstDeathTree: DialogueTree = {
  id: FIRST_DEATH_TREE,
  start: 'wake',
  nodes: {
    wake: { id: 'wake', speaker: 'story.speaker.reimu', text: 'story.first_death.wake' },
    pain: { id: 'pain', speaker: 'story.speaker.hero', text: 'story.first_death.pain', next: 'where' },
    where: { id: 'where', speaker: 'story.speaker.hero', text: 'story.first_death.where', next: 'back' },
    back: { id: 'back', speaker: 'story.speaker.hero', text: 'story.first_death.back', next: 'lucky' },
    lucky: { id: 'lucky', speaker: 'story.speaker.reimu', text: 'story.first_death.lucky', next: 'noise' },
    noise: { id: 'noise', speaker: 'story.speaker.reimu', text: 'story.first_death.noise', next: 'found' },
    found: { id: 'found', speaker: 'story.speaker.reimu', text: 'story.first_death.found', next: 'treated' },
    treated: { id: 'treated', speaker: 'story.speaker.reimu', text: 'story.first_death.treated', next: 'silent' },
    silent: { id: 'silent', speaker: 'story.speaker.hero', text: 'story.first_death.silent', next: 'strange' },
    strange: { id: 'strange', narration: true, os: true, text: 'story.first_death.strange', next: 'end' },
    end: { id: 'end', narration: true, os: true, text: 'story.first_death.end' }
  }
}
