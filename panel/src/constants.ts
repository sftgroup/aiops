/**
 * Application-wide constants.
 *
 * Keys used for localStorage draft / task-state persistence.
 * (These are UI transient data, NOT security-sensitive; localStorage is acceptable.)
 */

/** localStorage key – pending generation task state */
export const LS_KEY = 'aiops_gen_task';

/** localStorage key – draft content (prompt, text, imageUrl) */
export const DRAFT_KEY = 'aiops_draft';
