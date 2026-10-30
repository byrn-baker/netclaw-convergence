#!/usr/bin/env python3
"""Fixed on-demand launcher bound to this installation's native manager."""
import argparse
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_member_start import start
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--home',required=True,type=Path)
    args=parser.parse_args()
    try:start(args.home,ROOT)
    except Exception:sys.exit(8)
