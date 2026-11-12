// Executar: cd backend && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FREE_MAX_DEVICES, maxDevicesFor, deviceLimitMessage } from '../services/plans.js';

test('planos: gratis com ate 3 aparelhos; premium sem limite pratico', () => {
    assert.equal(FREE_MAX_DEVICES, 3);
    assert.equal(maxDevicesFor('free'), 3);
    assert.equal(maxDevicesFor(undefined), 3);
    assert.ok(maxDevicesFor('premium') >= 999);
    assert.match(deviceLimitMessage(3), /3 aparelhos/);
    assert.match(deviceLimitMessage(1), /1 aparelho,/);
});
