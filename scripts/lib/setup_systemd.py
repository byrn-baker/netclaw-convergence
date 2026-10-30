"""Read the loaded unit's typed argv; never split systemctl display text.

Ubuntu 24.04's systemd 255 supports busctl JSON and ExecStartEx. GetUnit only
looks up an already loaded unit. No LoadUnit, activation, shell or runtime code.
"""
from pathlib import Path
import re
from setup_schema import loads
from setup_state import Conflict

BUS=['/usr/bin/busctl','--user','--json=short','--no-pager','--timeout=10']
DEST='org.freedesktop.systemd1'
SIGNATURE='a(sasasttttuii)'

def unit_path(unit):
    if not isinstance(unit,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.service',unit):
        raise Conflict('service_unit_invalid')
    return '/org/freedesktop/systemd1/unit/'+''.join(c if c.isalnum() else '_'+format(ord(c),'02x') for c in unit)

def observe_argv(call,item,*,allow_absent=False):
    unit=Path(item['file']).name;expected_path=unit_path(unit)
    expected=item['arguments'];flags=item.get('execFlags',[])
    if flags not in ([],['no-env-expand']) or not isinstance(expected,list) or not expected or not all(isinstance(a,str) and a and '\x00' not in a for a in expected):
        raise Conflict('service_argv_unverified')
    # Old definitions used environment expansion. A dollar in such a path
    # needs regeneration/review, not an assumption about its expanded value.
    if not flags and any('$' in a for a in expected):raise Conflict('service_argv_unverified')
    def read(args):
        result=call(args)
        if isinstance(result,dict):
            if result.get('returncode')!=0:raise Conflict('service_bus_unavailable')
            result=result['stdout']
        value=loads(result,65536)
        if not isinstance(value,dict) or set(value)!={'type','data'}:raise Conflict('service_bus_output_unknown')
        return value
    try:
        value=read(BUS+['call',DEST,'/org/freedesktop/systemd1',DEST+'.Manager','GetUnit','s',unit])
    except Conflict as error:
        if not allow_absent or error.code!='service_bus_unavailable':raise
        # Inactive on-demand units may be collected between systemctl show and
        # GetUnit. A failed query alone never proves absence. This exact-name,
        # read-only listing must successfully report no loaded unit or alias.
        absent=read(BUS+['call',DEST,'/org/freedesktop/systemd1',DEST+'.Manager',
                         'ListUnitsByPatterns','asas','0','1',unit])
        if absent!={'type':'a(ssssssouso)','data':[[]]}:
            raise Conflict('service_bus_unit_unknown') from None
        return False
    if value!={'type':'o','data':[expected_path]}:raise Conflict('service_bus_unit_changed')
    value=read(BUS+['get-property',DEST,expected_path,DEST+'.Service','ExecStartEx'])
    rows=value['data']
    if value['type']!=SIGNATURE or not isinstance(rows,list) or len(rows)!=1:raise Conflict('service_argv_unverified')
    row=rows[0]
    if not isinstance(row,list) or len(row)!=10 or row[:3]!=[expected[0],expected,flags] or any(type(v) is not int or v<0 or v>9007199254740991 for v in row[3:8]) or any(type(v) is not int or not -2147483648<=v<=2147483647 for v in row[8:]):
        raise Conflict('service_argv_unverified')
    if row[7]>4294967295:raise Conflict('service_argv_unverified')
    return True
