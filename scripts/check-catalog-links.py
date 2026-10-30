#!/usr/bin/env python3
"""Bounded, credential-free public catalog link checks. No install/device calls."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import ipaddress
import json
from pathlib import Path
import socket
import subprocess
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def public_url(url):
    p = urlsplit(url)
    if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None, 443):
        return False
    try:
        addresses = socket.getaddrinfo(p.hostname, 443, type=socket.SOCK_STREAM)
        return bool(addresses) and all(ipaddress.ip_address(a[4][0]).is_global for a in addresses)
    except (ValueError, OSError):
        return False


class Redirect(urllib.request.HTTPRedirectHandler):
    max_redirections = 3
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not public_url(newurl):
            raise ValueError('nonpublic_redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def check_link(url):
    if not public_url(url):
        return {'url': url, 'state': 'needs_review', 'code': 'unresolved_or_nonpublic'}
    try:
        # Do not inherit proxy credentials or credential-bearing URL handlers.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), Redirect())
        request = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'NetClaw-catalog-link-check/1'})
        with opener.open(request, timeout=8) as response:
            return {'url': url, 'state': 'verified', 'code': response.status}
    except urllib.error.HTTPError as exc:
        state = 'dead' if exc.code in (404, 410) else 'needs_review'
        return {'url': url, 'state': state, 'code': exc.code}
    except Exception:
        return {'url': url, 'state': 'needs_review', 'code': 'network_or_tls'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--ids', default='')
    parser.add_argument('--syntax-only', action='store_true')
    parser.add_argument('--base-ref', help='PR base commit: check newly introduced public URLs only')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'config/components/catalog.json').read_text())
    ids = set(filter(None, args.ids.split(',')))
    urls = sorted({l['target'] for e in [*catalog['components'], *catalog['skills'], *catalog['choices']]
                   if not ids or e['id'] in ids for l in e['links'] if l['target'].startswith('https://')})
    if args.base_ref:
        if not re.fullmatch(r'[a-f0-9]{40}',args.base_ref):parser.error('base-ref must be a full commit ID')
        prior=subprocess.run(['git','show',args.base_ref+':config/components/catalog.json'],cwd=ROOT,capture_output=True,timeout=10)
        if prior.returncode==0:
            old=json.loads(prior.stdout)
            old_urls={l['target'] for group in ('components','skills','choices') for e in old[group] for l in e['links'] if l['target'].startswith('https://')}
            urls=[u for u in urls if u not in old_urls]
        else:
            # A newly introduced catalog has no baseline; verify the entire set.
            exists=subprocess.run(['git','cat-file','-e',args.base_ref+'^{commit}'],cwd=ROOT,capture_output=True,timeout=10)
            if exists.returncode:parser.error('base commit unavailable; fetch PR base before checking')
    if args.syntax_only:
        if any(not urlsplit(u).hostname or urlsplit(u).username or urlsplit(u).password for u in urls):
            return 1
        print(f'External link syntax: PASS ({len(urls)} URLs; no network requests)')
        return 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(check_link, urls))
    report = {'schema': 1, 'scope':'changed' if args.base_ref else 'all', 'results': results}
    if args.output:
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    counts = {state: sum(r['state'] == state for r in results) for state in ('verified', 'dead', 'needs_review')}
    print(json.dumps(counts))
    return 1 if counts['dead'] else 0


if __name__ == '__main__':
    sys.exit(main())
