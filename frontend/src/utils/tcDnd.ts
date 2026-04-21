/**
 * Shared DataTransfer MIME type used when the user drags a TestCase card onto a
 * Segment tree node to reassign its path. Kept separate from Segment-to-Segment
 * drag so the two flows don't collide in the same drop handler.
 */
export const TC_DND_MIME = 'application/x-myatlas-test-case';
