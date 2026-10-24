#!/usr/bin/env python3
"""Authenticated EVE ingestion; one process owns the durable SQLite outbox."""
import asyncio
from contextlib import asynccontextmanager
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
import shutil
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import httpx

from store import Store

log = logging.getLogger('ids-ingest')


def create_app(config, store, client_factory=httpx.AsyncClient):
    sensors = config['sensors']
    if len({s['id'] for s in sensors}) != len(sensors):
        raise ValueError('Sensor IDs must be unique')
    hashes = [s['token_sha256'] for s in sensors] + [config['status_token_sha256']]
    if len(set(hashes)) != len(hashes) or any(len(h) != 64 for h in hashes):
        raise ValueError('Unique SHA-256 token hashes required')

    async def deliver():
        last_prune = 0
        retry_at = {'log': 0, 'case': 0}
        backoff = {'log': 1, 'case': 1}
        async with client_factory(timeout=15) as client:
            while True:
                for target in ('log', 'case'):
                    if time.monotonic() < retry_at[target]:
                        continue
                    rows = store.pending(target)
                    if not rows:
                        continue
                    try:
                        if target == 'log':
                            streams = {}
                            for row in rows:
                                key = (row['site'], row['sensor'], row['kind'])
                                streams.setdefault(key, []).append([str(row['received_ns']), row['payload']])
                            payload = {'streams': [{'stream': {'job': 'ids-eve', 'site': key[0],
                                'sensor': key[1], 'event_type': key[2]}, 'values': values}
                                for key, values in streams.items()]}
                            response = await client.post(config['loki_url'].rstrip('/')+'/loki/api/v1/push', json=payload)
                            response.raise_for_status()
                            store.acknowledge('log', [r['id'] for r in rows])
                        else:
                            for row in rows:
                                response = await client.post(config['receiver_url'],
                                    headers={'Authorization': 'Bearer '+config['receiver_token']},
                                    json=json.loads(row['case_payload']))
                                response.raise_for_status()
                                if response.json().get('status') != 'accepted':
                                    raise RuntimeError('Case receiver did not acknowledge durable acceptance')
                                store.acknowledge('case', [row['id']])
                        backoff[target] = 1
                    except Exception as exc:
                        # Exception messages can contain URLs; log only type/status.
                        status = getattr(getattr(exc, 'response', None), 'status_code', None)
                        log.warning('%s delivery failed (%s, HTTP %s); retaining batch; retry in %ss',
                                    target, type(exc).__name__, status, backoff[target])
                        retry_at[target] = time.monotonic()+backoff[target]
                        backoff[target] = min(60, backoff[target]*2)
                if time.time()-last_prune > 3600:
                    store.prune()
                    last_prune = time.time()
                await asyncio.sleep(0.2)

    @asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(deliver())
        yield
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    def token_hash(request):
        header = request.headers.get('authorization', '')
        return hashlib.sha256(header[7:].encode()).hexdigest() if header.startswith('Bearer ') else ''

    @app.get('/healthz')
    async def health():
        return {'status': 'ok'}

    @app.get('/v1/status')
    async def status(request: Request, site: str):
        if not hmac.compare_digest(token_hash(request), config['status_token_sha256']):
            return JSONResponse({'error': 'Unauthorized'}, status_code=401)
        return store.status(sensors, site)

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
    store = Store(str(Path(config['state_dir'])/'eve.sqlite'), config.get('queue_capacity', 250000))
    return create_app(config, store)
