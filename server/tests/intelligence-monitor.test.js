import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMonitorAlerts, transitionMonitorAlert, validateMonitorAlert } from '../intelligence-monitor.js';

test('monitor alert merge deduplicates repeated results and preserves analyst state',()=>{
 const first=mergeMonitorAlerts([], [{id:'a',title:'Port closure',url:'https://example.com/a',matchedQuery:'port'}],1000);
 assert.equal(first.created,1);
 const reviewed=transitionMonitorAlert(first.alerts[0],'ACKNOWLEDGED','analyst','Reviewed source');
 const next=mergeMonitorAlerts([reviewed],[{id:'a',title:'Port closure updated',url:'https://example.com/a'}],2000);
 assert.equal(next.created,0);
 assert.equal(next.alerts[0].status,'ACKNOWLEDGED');
 assert.equal(next.alerts[0].lastSeenAt,2000);
});

test('monitor alert lifecycle records transitions and rejects invalid states',()=>{
 const alert=validateMonitorAlert({id:'a',title:'New signal'});
 const investigating=transitionMonitorAlert(alert,'INVESTIGATING','analyst','Checking corroboration');
 assert.equal(investigating.status,'INVESTIGATING');
 assert.equal(investigating.history.length,1);
 assert.throws(()=>transitionMonitorAlert(investigating,'INVALID','analyst'));
});

test('closed alerts cannot be silently reopened',()=>{
 const closed=transitionMonitorAlert(validateMonitorAlert({id:'a'}),'CLOSED','analyst');
 assert.throws(()=>transitionMonitorAlert(closed,'NEW','analyst'),/reopened explicitly/);
});
