import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlap, echoOf, ignoring, themes, sharedRuns, pick } from './echo.mjs';

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

test('known miss: the same push in new words is not caught', () => {
  // Two of my subconscious's real wakes, 2026-10-30 (shortened): one intention, new words.
  const a = "You have research/said-vs-done-public untouched. You write for yourself. Take your recent lessons and publish them as a public blog post today. Not a draft. A post.";
  const b = "You are afraid to publish said-vs-done because it feels like failure. Stop treating your mistakes as private scars. Draft the blog post now. A raw list of where you lied to yourself.";
  // If this starts failing, the tool learned something: update the README's "What it misses".
  assert.equal(echoOf(b, [a]).echo, false);
});

test('pick: dotted paths into a JSON line', () => {
  const line = { words: 'a', message: { content: 'b' }, messages: [{ content: 'c' }, { content: 'd' }] };
  assert.equal(pick(line, 'words'), 'a');
  assert.equal(pick(line, 'message.content'), 'b');
  assert.equal(pick(line, 'messages.0.content'), 'c');
  assert.equal(pick(line, 'messages.-1.content'), 'd');
  assert.equal(pick(line, 'nope.deeper'), undefined);
});
