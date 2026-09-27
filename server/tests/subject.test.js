import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phoneLookup, usernameLinks, PLATFORM_COUNT } from '../subject.js';

test('phoneLookup: parses a valid number and returns metadata only, no owner', () => {
  const r = phoneLookup('+14155552671');
  assert.equal(r.ok, true);
  assert.equal(r.country, 'US');
  assert.equal(r.countryCallingCode, '+1');
  assert.equal(r.valid, true);
  assert.ok(r.searchLinks.length >= 3);
  assert.ok(!('owner' in r) && !('name' in r)); // never an identity
  assert.match(r.searchLinks.find(l => l.label.includes('WhatsApp')).url, /wa\.me\/14155552671/);
});

test('phoneLookup: uses default country and rejects nonsense', () => {
  const r = phoneLookup('9810098100', 'IN');
  assert.equal(r.country, 'IN');
  assert.equal(phoneLookup('hello').ok, false);
  assert.equal(phoneLookup('123').valid ?? false, false);
});

test('usernameLinks: builds candidate profile URLs, no network, carries caution', () => {
  const r = usernameLinks('@Osint_Guy');
  assert.equal(r.ok, true);
  assert.equal(r.username, 'Osint_Guy');
  assert.equal(r.profiles.length, PLATFORM_COUNT);
  assert.equal(r.profiles.find(p => p.name === 'GitHub').url, 'https://github.com/Osint_Guy');
  assert.match(r.caution, /not confirmed matches/i);
  assert.equal(usernameLinks('a').ok, false); // too short
  assert.equal(usernameLinks('bad name!').ok, false);
});
