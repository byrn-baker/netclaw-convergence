'use strict';
const express = require('express');
const router = express.Router();
const { LOKI_URL, promqlLabelValue } = require('../lib/config');

async function metric(query) {
  const r = await fetch(`${LOKI_URL}/loki/api/v1/query?${new URLSearchParams({query})}`, {signal: AbortSignal.timeout(10000)});
  if (!r.ok) throw new Error(`Log store HTTP ${r.status}`);
  const data = await r.json();
  if (data.status !== 'success') throw new Error('Log query failed');
  return data.data.result;
}
const scalar = rows => rows.length ? Number(rows[0].value[1]) : 0;

router.get('/', async (req, res) => {
  const site = promqlLabelValue(req.site);
  const source = `{job="device-syslog",site="${site}"} | json | attributes_appname="filterlog"`;
  const blocked = `${source} | attributes_action="block"`;
  try {
    const [coverage, day, hour, top] = await Promise.all([
      metric(`sum(count_over_time(${source} [15m]))`),
      metric(`sum(count_over_time(${blocked} [24h]))`),
      metric(`sum(count_over_time(${blocked} [1h]))`),
      metric(`topk(5, sum by (attributes_src_ip) (count_over_time(${blocked} | attributes_src_ip!="" [1h])))`),
    ]);
    const observed = scalar(coverage) > 0;
    res.json({site: req.site, status: observed ? 'active' : 'unknown',
      source: 'Structured firewall logs', observedWindow: '15m',
      reason: observed ? undefined : 'No recent firewall logs; security visibility is unknown',
      blockedConnections: {last24h: observed ? scalar(day) : null, lastHour: observed ? scalar(hour) : null},
      topSources: top.map(r => ({ip: r.metric.attributes_src_ip, count: Number(r.value[1]), classification: 'unclassified'})).sort((a, b) => b.count - a.count),
      // Firewall drops alone are not evidence that an intrusion was detected.
      intrusionDetection: {status: 'not_configured', reason: 'No validated IDS sensor feed configured'},
    });
  } catch (err) {
    res.json({site: req.site, status: 'unavailable', unavailable: true, reason: err.message,
      blockedConnections: {last24h: null, lastHour: null}, topSources: []});
  }
});
module.exports = router;
