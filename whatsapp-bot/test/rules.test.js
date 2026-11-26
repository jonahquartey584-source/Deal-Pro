import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, isQuietTime, matchKeyword, inList } from '../src/rules.js';

const base = {
  mode: 'draft', replyToGroups: false, cooldownMinutes: 30,
  ai: { enabled: true },
  quietHours: { enabled: true, start: '23:00', end: '07:30', message: 'night' },
  keywordReplies: [{ match: ['urgent'], reply: 'call me' }],
  vipList: ['+44 7700 900111'], blockList: ['447700900222'], allowList: [],
};
const noon = new Date(2026, 0, 1, 12, 0);

test('numbers match regardless of formatting', () => {
  assert.ok(inList('447700900111@c.us', base.vipList));
  assert.ok(!inList('447700900999', base.vipList));
});
test('quiet hours across midnight', () => {
  assert.ok(isQuietTime(base.quietHours, new Date(2026, 0, 1, 23, 30)));
  assert.ok(isQuietTime(base.quietHours, new Date(2026, 0, 1, 6, 0)));
  assert.ok(!isQuietTime(base.quietHours, noon));
});
test('keywords match whole words only', () => {
  assert.ok(matchKeyword('This is URGENT!', base.keywordReplies));
  assert.equal(matchKeyword('nonurgentness', base.keywordReplies), null);
});
test('decisions', () => {
  const d = (o) => decide({ config: base, number: '447700900333', isGroup: false, text: 'hi', now: noon, ...o }).action;
  assert.equal(d({ isGroup: true }), 'ignore');
  assert.equal(d({ number: '447700900222' }), 'ignore');
  assert.equal(d({ number: '447700900111' }), 'notify');
  assert.equal(d({ text: 'urgent pls' }), 'fixed');
  assert.equal(d({ now: new Date(2026, 0, 1, 2, 0) }), 'fixed');
  assert.equal(d({ lastAutoReplyAt: new Date(noon - 5 * 60_000) }), 'notify');
  assert.equal(d({}), 'ai');
  assert.equal(decide({ config: { ...base, mode: 'off' }, number: '1', isGroup: false, text: 'hi', now: noon }).action, 'notify');
  assert.equal(decide({ config: { ...base, allowList: ['999'] }, number: '1', isGroup: false, text: 'hi', now: noon }).action, 'notify');
});
