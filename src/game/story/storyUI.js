/**
 * The story's UI classes (the journal, emote bubbles, the end card), handed to `UI.useStoryUI` by
 * the Game when a level or campaign has a story — imported here, in the story chunk, so a level
 * without a story loads none of them (docs/architecture/modules/ui.md §11).
 */
import { Journal } from '../../engine/ui/Journal.js';
import { Emotes } from '../../engine/ui/Emotes.js';
import { EndCard } from '../../engine/ui/EndCard.js';

/** @returns {{ Journal: typeof Journal, Emotes: typeof Emotes, EndCard: typeof EndCard }} */
export function storyUIClasses() {
  return { Journal, Emotes, EndCard };
}
