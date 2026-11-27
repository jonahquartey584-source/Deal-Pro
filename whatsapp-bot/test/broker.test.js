import test from 'node:test';
import assert from 'node:assert/strict';
import { criteriaKey, isReady, packHtml } from '../src/broker.js';

test('a search only runs once strategy, areas and budget are known', () => {
  assert.ok(!isReady({ strategy: 'HMO', areas: 'Leeds' }, {}));
  assert.ok(isReady({ strategy: 'HMO', areas: 'Leeds', budget: '£150k' }, {}));
  assert.ok(isReady({ areas: 'Leeds' }, { broker: { requiredFields: ['areas'] } }));
});
test('criteria changes are noticed, small wording/case changes are not', () => {
  const a = { strategy: 'HMO', areas: 'Leeds', budget: '£150k' };
  assert.equal(criteriaKey(a), criteriaKey({ ...a, areas: ' leeds ', timeline: 'asap' }));
  assert.notEqual(criteriaKey(a), criteriaKey({ ...a, budget: '£200k' }));
});
test("the client's pack has no listing links; your copy does", () => {
  const data = { clientName: 'D', ownerName: 'J', details: { strategy: 'BTL' }, summary: 's', deals: [{ title: 't', area: 'a', price: '£1', strategy: 'BTL', keyFigures: [], whyItFits: 'w', watchOut: '', listingUrl: 'https://www.rightmove.co.uk/properties/1', source: 'Rightmove' }] };
  assert.ok(!packHtml(data).includes('rightmove.co.uk'));
  assert.ok(packHtml({ ...data, includeLinks: true }).includes('rightmove.co.uk'));
  assert.ok(!packHtml({ ...data, clientName: '<b>x</b>' }).includes('<b>x</b>'));
});
