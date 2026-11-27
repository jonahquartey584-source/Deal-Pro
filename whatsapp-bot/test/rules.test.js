import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, isQuietTime, inList } from '../src/rules.js';
import { pairsFrom } from '../src/style.js';

const base = {
  mode: 'auto', replyToGroups: false, youTakeOverMinutes: 15, maxRepliesPerChatPerHour: 20,
  quietHours: { enabled: true, start: '23:00', end: '07:30' },
  excludeList: ['Mum', '+44 7700 900111'], blockList: ['447700900222'],
};
const noon = new Date(2026, 0, 1, 12, 0);
const someone = { number: '447700900333', name: 'Sarah' };
const d = (o = {}) => decide({ config: base, person: someone, isGroup: false, now: noon, ...o }).action;

test('people match by number in any format, or by saved name', () => {
  assert.ok(inList({ number: '447700900111@c.us' }, base.excludeList));
  assert.ok(inList({ number: '1', name: 'mum' }, base.excludeList));
  assert.ok(!inList({ number: '447700900999', name: 'Dad' }, base.excludeList));
});
test('quiet hours across midnight', () => {
  assert.ok(isQuietTime(base.quietHours, new Date(2026, 0, 1, 23, 30)));
  assert.ok(isQuietTime(base.quietHours, new Date(2026, 0, 1, 6, 0)));
  assert.ok(!isQuietTime(base.quietHours, noon));
});
test('everyone is automated by default', () => assert.equal(d(), 'ai'));
test('groups and blocked people are ignored', () => {
  assert.equal(d({ isGroup: true }), 'ignore');
  assert.equal(d({ person: { number: '447700900222' } }), 'ignore');
});
test('excluded people are forwarded, not answered', () => {
  assert.equal(d({ person: { number: '0', name: 'Mum' } }), 'forward');
});
test('bot steps back while you are chatting yourself', () => {
  assert.equal(d({ youRepliedAt: new Date(noon - 5 * 60_000) }), 'ignore');
  assert.equal(d({ youRepliedAt: new Date(noon - 60 * 60_000) }), 'ai');
});
test('after "hold on", further messages wait for you', () => assert.equal(d({ waitingOnYou: true }), 'forward'));
test('paused, rate-limited and quiet hours forward', () => {
  assert.equal(decide({ config: { ...base, mode: 'off' }, person: someone, isGroup: false, now: noon }).action, 'forward');
  assert.equal(d({ repliesLastHour: 20 }), 'forward');
  assert.equal(d({ now: new Date(2026, 0, 1, 2, 0) }), 'forward');
});
test('learning pairs their message with your reply', () => {
  const m = (fromMe, body, type = 'chat') => ({ fromMe, body, type });
  const pairs = pairsFrom([m(false, 'u coming?'), m(true, 'yeah'), m(true, '10 mins'), m(false, 'pic', 'image'), m(false, 'ok'), m(true, '🤖 bot note'), m(true, 'safe')]);
  assert.deepEqual(pairs, [
    { them: 'u coming?', me: 'yeah\nME: 10 mins' },
    { them: 'ok', me: 'safe' },
  ]);
});
