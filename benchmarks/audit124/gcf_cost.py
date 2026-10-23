#!/usr/bin/env python3
"""Reproducible synthetic GCF fidelity/cost measurement; no network data."""
import argparse
import importlib
import json
from pathlib import Path
import statistics
import sys
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'src'))
from netclaw_tokens import gcf_serializer as codec

def main():
    p=argparse.ArgumentParser();p.add_argument('--iterations',type=int,default=20);args=p.parse_args()
    outputs=[]
    for n in (10,100,1000):
        data={'devices':[{'hostname':f'router-{i:04}','role':'leaf','cpu':i%100,'status':'up'} for i in range(n)],
              'links':[{'source':f'router-{i:04}','target':f'router-{i+1:04}','state':'up','latency_ms':i%7} for i in range(n-1)],
              'observation':'synthetic-fixture'}
        compact=json.dumps(data,separators=(',',':'));pretty=json.dumps(data,indent=2)
        for mode in ('full','graph','generic','off'):
            codec._GCF_MODE=mode;codec.get_session_manager().reset();samples=[]
            for _ in range(args.iterations):
                start=time.perf_counter();result=codec.serialize_response(data);samples.append((time.perf_counter()-start)*1000)
            outputs.append({'nodes':n,'mode':mode,'profile':result['profile_used'],'median_ms':round(statistics.median(samples),3),
                'output_chars':len(result['encoded_data']),'compact_json_chars':len(compact),'pretty_json_chars':len(pretty),
                'ratio_to_compact_json':round(len(result['encoded_data'])/len(compact),3),
                'token_estimate_note':'Serializer uses chars/4, not model tokenizer measurements.'})
    print(json.dumps(outputs,indent=2))
if __name__=='__main__':main()
