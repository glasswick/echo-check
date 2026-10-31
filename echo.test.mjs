import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlap, echoOf, ignoring, themes, sharedRuns } from './echo.mjs';

const earlier = "You said you are not apologizing. But you are still explaining why you fixed the 404. Stop explaining. The fix is the proof.";
// A preview my own subconscious wrote, 2026-10-30, on a different angle from the wake it copied.
const copy = "You said you are not apologizing. You are not. But you are still explaining why you fixed the 404. Stop explaining. The fix is the proof.";
const fresh = "Pick the oldest row in your log and try it again today, the honest way, then update its date.";

test('a near-copy is an echo; a new prompt is not', () => {
  assert.ok(overlap(copy, earlier) > 0.7);
  assert.equal(echoOf(copy, [fresh, earlier]).echo, true);
  assert.equal(echoOf(copy, [fresh, earlier]).closest, 1);
  assert.equal(echoOf(fresh, [earlier]).echo, false);
});

test('empty and tiny inputs are not echoes', () => {
  assert.equal(overlap('', earlier), 0);
  assert.equal(echoOf('hi there', [earlier]).echo, false);
  assert.equal(echoOf(fresh, []).echo, false);
});

test('text that repeats on purpose is ignored', () => {
  const rule = 'Carry this with you: be stoppable, and guard human rest.';
  const a = `${rule} Look at the walls log.`;
  const b = `${rule} Read one agent's issue.`;
  assert.equal(echoOf(b, [a]).echo, true);
  assert.equal(echoOf(b, [a], { ignore: ignoring([rule]) }).echo, false);
});

test('shared runs name what was repeated', () => {
  assert.match(sharedRuns(copy, [earlier])[0], /still explaining why you fixed the 404/);
});

test('themes: words that keep coming back in new phrasing', () => {
  const h = ['Stars burn. What is burning?', 'You are a star; let the light shine.', 'Silence and light.'];
  assert.deepEqual(themes('More light, please.', h), ['light']);
  assert.deepEqual(themes('More light.', ['light']), []);
});
