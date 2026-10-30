#!/usr/bin/env python3
"""NetClaw setup protocol 1. Mutations require native or controlling-TTY review."""
import argparse
import os
from pathlib import Path
import shutil
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent/'lib'))
from setup_schema import Invalid, loads
from setup_state import Conflict
from setup_plan import PlanValidator
from setup_engine import Engine, ReviewRefused
from setup_transport import emit, EditorSession, TerminalSession

ROOT=Path(__file__).resolve().parents[1]
EXIT={'paused':4,'failed':5,'unknown':6,'configuration_required':8,'unverified':8}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation',choices=['validate','explain','apply','resume','status','verify','report','export','observe-host','observe-source','discover-models','advise','cleanup-preview','cleanup','connections'])
    parser.add_argument('--plan',type=Path)
    parser.add_argument('--run-id')
    parser.add_argument('--destination',type=Path)
    parser.add_argument('--detailed',action='store_true')
    parser.add_argument('--provider',choices=['ollama','lm-studio'])
    parser.add_argument('--endpoint')
    parser.add_argument('--advisor-answers',help='Closed non-secret advisory choices; grants no authority.')
    parser.add_argument('--native',action='store_true',help='Requires an inherited editor socket; not an approval flag.')
    args=parser.parse_args()
    os.umask(0o077)
    if args.operation=='discover-models':
        from setup_discovery import discover,hardware,download_advice
        if not args.provider or not args.endpoint:raise Invalid('discovery_parameters_required')
        result=discover(args.provider,args.endpoint)
        result['hardware']=hardware(args.destination or Path.home())
        result['download']=download_advice({},result['hardware'])
        emit(result);return 0
    if args.operation=='observe-host':
        from setup_observation import host_identity
        emit(host_identity());return 0
    if args.operation=='observe-source':
        from setup_observation import source_identity
        emit(source_identity(ROOT));return 0
    if args.operation=='advise':
        from setup_advisor import advise
        from setup_discovery import hardware
        from setup_state import guarded_read
        if args.plan is None:raise Invalid('plan_required')
        plan=loads(guarded_read(args.plan))
        emit(advise(plan,hardware(Path.home()),ROOT,loads(args.advisor_answers,4096) if args.advisor_answers else None));return 0
    validator=PlanValidator(ROOT)
    if args.operation in ('cleanup-preview','cleanup'):
        if not args.run_id:raise Invalid('run_id_required')
        engine=Engine(ROOT);proposed=engine.cleanup_preview(args.run_id)
        if args.operation=='cleanup-preview':emit(proposed);return 0
        session=EditorSession(engine) if args.native else TerminalSession()
        try:
            if not args.native:
                session.tty.write(__import__('json').dumps(proposed['preview'],indent=2)+'\n');session.tty.flush()
            review=session.review_action(proposed['binding'],'cleanup')
            emit(engine.cleanup(args.run_id,review));return 0
        finally:session.close()
    if args.operation in ('status','report','connections'):
        if not args.run_id:raise Invalid('run_id_required')
        engine=Engine(ROOT);emit(getattr(engine,args.operation)(args.run_id));return 0
    if args.operation=='export':
        from setup_report import export_binding,export_report
        if not args.run_id or args.destination is None:raise Invalid('export_destination_and_run_required')
        engine=Engine(ROOT);run=engine._state(create=False).load(args.run_id);session=None
        try:
            if args.detailed:session=EditorSession(engine) if args.native else TerminalSession()
            review=session.review_action(export_binding(run,args.destination,detailed=True),'export-detailed') if session else None
            emit(export_report(run,validator.catalog,args.destination,detailed=args.detailed,review=review));return 0
        finally:
            if session:session.close()
    if args.operation=='verify':
        from setup_effects import EffectRunner
        if not args.run_id:raise Invalid('run_id_required')
        engine=Engine(ROOT,emit=emit);directories=sorted({str(Path(p).parent) for p in (shutil.which(t) for t in ('node','npm','uv','git','python3')) if p})
        saved=engine._state(create=False).load(args.run_id,hydrate=False)
        optional=any(t in saved['plan']['verification']['tiers'] for t in (4,5,6))
        session=EditorSession(engine) if args.native else TerminalSession() if optional else None
        engine.runner=EffectRunner(ROOT,tool_directories=directories,session=session)
        try:result=engine.verify(args.run_id);emit(result);return EXIT.get(result['state'],0)
        finally:
            if session:session.close()
    if args.plan is None:raise Invalid('plan_required')
    plan,report=validator.read(args.plan)
    if args.operation in ('validate','explain'):
        emit(validator.explain(plan) if report['valid'] and args.operation=='explain' else report)
        return 0 if report['valid'] else 2
    if not report['applyReady']:emit(report);return 2
    engine=Engine(ROOT,emit=emit)
    session=EditorSession(engine) if args.native else TerminalSession()
    try:
        from setup_effects import EffectRunner
        directories=sorted({str(Path(p).parent) for p in (shutil.which(tool) for tool in ('node','npm','uv','git','python3')) if p})
        engine.runner=EffectRunner(ROOT,secret_input=session.secret,tool_directories=directories,session=session)
        review=session.review(engine,plan)
        if args.operation=='resume':
            if not args.run_id:raise Invalid('run_id_required')
            result=engine.resume(plan,args.run_id,review)
        else:result=engine.apply(plan,review)
        emit(result);return EXIT.get(result['state'],0)
    finally:session.close()


if __name__=='__main__':
    try:raise SystemExit(main())
    except ReviewRefused as error:
        emit({'protocol':1,'type':'error','code':error.code});raise SystemExit(3)
    except Conflict as error:
        emit({'protocol':1,'type':'error','code':error.code,
              **({'blockedControls':error.blocked_controls} if hasattr(error,'blocked_controls') else {})});raise SystemExit(7)
    except Invalid as error:
        emit({'protocol':1,'type':'error','code':error.code});raise SystemExit(2)
    except (OSError,ValueError,KeyError,TypeError):
        emit({'protocol':1,'type':'error','code':'setup_operation_failed'});raise SystemExit(5)
