#!/usr/bin/env python3
"""Authenticated EVE ingestion; one process owns the durable SQLite outbox."""
import asyncio
from contextlib import asynccontextmanager
import hashlib
import hmac
import json
import logging
import math
import os
from pathlib import Path
import shutil
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse
import httpx

from store import Store
from telemetry import archive_body, render_metrics
from ip_context import IPContext

log = logging.getLogger('ids-ingest')


def create_app(config, store, client_factory=httpx.AsyncClient):
    sensors = config['sensors']
    if len({s['id'] for s in sensors}) != len(sensors):
        raise ValueError('Sensor IDs must be unique')
    hashes = [s['token_sha256'] for s in sensors] + [config['status_token_sha256']]
    if len(set(hashes)) != len(hashes) or any(len(h) != 64 for h in hashes):
        raise ValueError('Unique SHA-256 token hashes required')

    if config.get('victorialogs_url'):
        store.enable_archive()

    async def deliver(target):
        backoff = 1
        async with client_factory(timeout=15) as client:
            while True:
                try:
                    if target == 'archive':
                        store.schedule_backfill()
                    rows = store.pending(target, limit=128 if target == 'case' else 512)
                    if not rows:
                        await asyncio.sleep(0.2)
                        continue
                    if target == 'log':
                        streams = {}
                        for row in rows:
                            key = (row['site'], row['sensor'], row['kind'])
                            record = json.loads(row['payload'])
                            if row.get('ip_context'):
                                record['netclaw_ip_context'] = json.loads(row['ip_context'])
                            streams.setdefault(key, []).append([str(row['received_ns']), json.dumps(record)])
                        payload = {'streams': [{'stream': {'job': 'ids-eve', 'site': key[0],
                            'sensor': key[1], 'event_type': key[2]}, 'values': values}
                            for key, values in streams.items()]}
                        response = await client.post(config['loki_url'].rstrip('/')+'/loki/api/v1/push', json=payload)
                        response.raise_for_status()
                        store.acknowledge(target, [r['id'] for r in rows])
                    elif target == 'archive':
                        response = await client.post(config['victorialogs_url'].rstrip('/')+'/insert/elasticsearch/_bulk',
                            params={'_stream_fields': 'job,site,sensor,event_type'},
                            headers={'Content-Type': 'application/x-ndjson'}, content=archive_body(rows))
                        response.raise_for_status()
                        ack = response.json()
                        items = ack.get('items', [])
                        if (ack.get('errors') is not False or len(items) != len(rows) or
                            any(not 200 <= item.get('create', {}).get('status', 0) < 300 for item in items)):
                            raise RuntimeError('VictoriaLogs did not acknowledge complete batch')
                        store.acknowledge(target, [r['id'] for r in rows])
                    else:
                        payload = {'version': '4', 'status': 'firing', 'receiver': 'suricata',
                            'alerts': [alert for row in rows for alert in json.loads(row['case_payload'])['alerts']]}
                        response = await client.post(config['receiver_url'],
                            headers={'Authorization': 'Bearer '+config['receiver_token']}, json=payload)
                        response.raise_for_status()
                        ack = response.json()
                        if ack.get('status') != 'accepted' or ack.get('alerts_received') != len(payload['alerts']):
                            raise RuntimeError('Case receiver did not acknowledge the complete batch')
                        # Partial receiver admission is safe to replay: its
                        # fingerprint/start/status job keys are durable dedup.
                        store.acknowledge(target, [row['id'] for row in rows])
                    backoff = 1
                    await asyncio.sleep(0.05)
                except Exception as exc:
                    # Exception messages can contain URLs; log only type/status.
                    status = getattr(getattr(exc, 'response', None), 'status_code', None)
                    log.warning('%s delivery failed (%s, HTTP %s); retaining batch; retry in %ss',
                                target, type(exc).__name__, status, backoff)
                    await asyncio.sleep(backoff)
                    backoff = min(60, backoff*2)

    async def prune():
        while True:
            more = store.prune()
            await asyncio.sleep(0.2 if more else 3600)

    @asynccontextmanager
    async def lifespan(app):
        targets = ['log', 'case'] + (['archive'] if store.archive_enabled else [])
        tasks = [asyncio.create_task(deliver(target)) for target in targets]
        tasks.append(asyncio.create_task(prune()))
        yield
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    def token_hash(request):
        header = request.headers.get('authorization', '')
        return hashlib.sha256(header[7:].encode()).hexdigest() if header.startswith('Bearer ') else ''

    @app.get('/healthz')
    async def health():
        return {'status': 'ok'}

    @app.get('/metrics', response_class=PlainTextResponse)
    async def metrics(request: Request):
        if not hmac.compare_digest(token_hash(request), config['status_token_sha256']):
            return JSONResponse({'error': 'Unauthorized'}, status_code=401)
        return PlainTextResponse(render_metrics(store, sensors),
                                 media_type='text/plain; version=0.0.4; charset=utf-8')

    @app.get('/v1/status')
    async def status(request: Request, site: str):
        if not hmac.compare_digest(token_hash(request), config['status_token_sha256']):
            return JSONResponse({'error': 'Unauthorized'}, status_code=401)
        data = store.status(sensors, site)
        if store.enricher:
            data['ipEnrichment'] = store.enricher.status()
        return data

    @app.post('/v1/eve')
    async def ingest(request: Request):
        supplied = token_hash(request)
        sensor = next((s for s in sensors if hmac.compare_digest(supplied, s['token_sha256'])), None)
        if sensor is None:
            return JSONResponse({'error': 'Unauthorized'}, status_code=401)
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 1048576:
                return JSONResponse({'error': 'Batch exceeds 1 MiB'}, status_code=413)
        try:
            payload = json.loads(body, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Invalid number')))
            events, heartbeat = payload.get('events'), payload.get('heartbeat')
            if not isinstance(events, list) or len(events) > 256 or not isinstance(heartbeat, dict):
                raise ValueError('events array (up to 256) and heartbeat object required')
            if type(heartbeat.get('capture_running')) is not bool:
                raise ValueError('capture_running must be boolean')
            for key in ('rules_count', 'rules_checked_at'):
                if type(heartbeat.get(key)) not in (int, float) or heartbeat[key] < 0:
                    raise ValueError(f'{key} must be a nonnegative number')
            if heartbeat['rules_checked_at'] > time.time()+300:
                raise ValueError('Rule timestamp is ahead of the receiver clock')
            probe = heartbeat.get('capture_probe', {})
            if not isinstance(probe, dict) or not isinstance(probe.get('sources', {}), dict):
                raise ValueError('Invalid capture probe')
            if len(probe.get('sources', {})) > 32:
                raise ValueError('Too many capture sources')
            def valid_stamp(value):
                return type(value) in (int, float) and math.isfinite(value) and 0 <= value <= time.time()+300
            if not valid_stamp(probe.get('checkedAt', 0)):
                raise ValueError('Invalid capture probe timestamp')
            for source in probe.get('sources', {}).values():
                if not isinstance(source, dict) or not valid_stamp(source.get('lastSeen', 0)):
                    raise ValueError('Invalid capture source timestamp')
                if type(source.get('packets')) is not int or source['packets'] < 0:
                    raise ValueError('Invalid capture source packet count')
                vlans = source.get('vlans', {})
                if not isinstance(vlans, dict) or len(vlans) > 4095:
                    raise ValueError('Invalid capture source VLANs')
                if any(not key.isdigit() or not 0 <= int(key) <= 4094 or not valid_stamp(value) for key, value in vlans.items()):
                    raise ValueError('Invalid capture source VLAN observation')
            if shutil.disk_usage(config['state_dir']).free < 512*1024*1024:
                raise OverflowError('Receiver disk reserve reached')
            accepted = store.accept(sensor, events, heartbeat)
        except (ValueError, TypeError, AttributeError, KeyError) as exc:
            return JSONResponse({'error': str(exc)}, status_code=400)
        except OverflowError:
            return JSONResponse({'error': 'Backpressure; retain and retry batch'}, status_code=503)
        return {'status': 'accepted', 'received': len(events), 'inserted': accepted}

    return app


def configured_app():
    config = json.loads(Path(os.environ['IDS_CONFIG_FILE']).read_text())
    Path(config['state_dir']).mkdir(parents=True, exist_ok=True, mode=0o700)
    store = Store(str(Path(config['state_dir'])/'eve.sqlite'), config.get('queue_capacity', 250000),
                  enricher=IPContext(config.get('ip_enrichment')))
    return create_app(config, store)
