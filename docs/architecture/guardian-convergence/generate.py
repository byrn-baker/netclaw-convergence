#!/usr/bin/env python3
"""Generate editable SVG engineering diagrams of the verified 2026-10-24 deployment.

No network calls or service mutations. Render SVG to PNG/PDF separately.
"""
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
C = dict(ink='#152b44', muted='#53677e', border='#c7d3e0', bg='#f7f9fc',
         teal='#007f83', blue='#2864ba', orange='#bd5c15', purple='#7950aa',
         model='#66748c', white='#ffffff')


class Diagram:
    def __init__(self, height, title, subtitle, sheet):
        self.height, self.parts, self.labels = height, [], []
        self.parts.append(f'''<svg xmlns="http://www.w3.org/2000/svg" width="2440" height="{height}" viewBox="0 0 2440 {height}" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}</desc>
<defs>''')
        for name in ['teal', 'blue', 'orange', 'purple', 'model', 'ink']:
            self.parts.append(f'<marker id="a-{name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{C[name]}"/></marker>')
        self.parts.append('''</defs><style>
text{font-family:"DejaVu Sans",sans-serif;fill:#152b44} .body{font-size:20px}
.code{font-family:"DejaVu Sans Mono",monospace;font-size:17px}
.edge-label{font-size:18px;font-weight:600;paint-order:stroke;stroke:#f7f9fc;stroke-width:8px;stroke-linejoin:round}
</style>''')
        self.rect(0, 0, 2440, height, C['bg'], stroke='none', radius=0)
        self.rect(0, 0, 2440, 132, C['ink'], stroke='none', radius=0)
        self.text(60, 53, title, size=39, color='white', weight=700)
        self.text(60, 98, subtitle, size=21, color='#c4d3e3')
        self.text(2368, 54, sheet, size=19, color='#c4d3e3', anchor='end')

    def rect(self, x, y, w, h, fill='white', stroke=None, radius=12, dash=None):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{C.get(fill,fill)}" stroke="{C.get(stroke,stroke) if stroke else C["border"]}" stroke-width="1.6"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>')

    def text(self, x, y, value, size=20, color='ink', weight=400, anchor='start', klass='', rotate=None):
        transform = f' transform="rotate({rotate} {x} {y})"' if rotate else ''
        self.parts.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{C.get(color,color)}" style="fill:{C.get(color,color)}" font-weight="{weight}" text-anchor="{anchor}" class="{klass}"{transform}>{escape(value)}</text>')

    def zone(self, x, y, w, h, title, subtitle, fill, dash=None):
        self.rect(x, y, w, h, fill, radius=18, dash=dash)
        self.text(x+26, y+36, title, size=23, weight=700)
        self.text(x+26, y+67, subtitle, size=17, color='muted')

    def card(self, x, y, w, h, title, lines, color='blue', tag=None, title_size=24):
        self.rect(x, y, w, h)
        self.rect(x, y, 6, h, C[color], stroke='none', radius=0)
        self.text(x+22, y+36, title, size=title_size, weight=700)
        start = y+70
        for i, line in enumerate(lines):
            code = isinstance(line, tuple)
            self.text(x+22, start+i*28, line[0] if code else line, size=17 if code else 20, color='muted' if code else 'ink', klass='code' if code else '')
        if tag:
            self.text(x+w-20, y+32, tag, size=14, color=color, weight=700, anchor='end')

    def edge(self, path, color, label=None, x=0, y=0, dash=None, both=False, rotate=None):
        self.parts.append(f'<path d="{path}" fill="none" stroke="{C[color]}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#a-{color})"'+(f' marker-start="url(#a-{color})"' if both else '')+(f' stroke-dasharray="{dash}"' if dash else '')+'/>')
        if label:
            self.labels.append((x, y, label, color, rotate))

    def legend(self, y):
        for x, color, label in [(65,'teal','Telemetry / observation'), (515,'orange','Automatic investigation'), (1020,'blue','Read / query path'), (1450,'purple','Case lifecycle / operator feedback'), (2100,'model','Model inference')]:
            self.parts.append(f'<path d="M{x} {y} h42" stroke="{C[color]}" stroke-width="3" marker-end="url(#a-{color})"/>')
            self.text(x+55, y+6, label, size=17, color=color, weight=600)

    def save(self, filename):
        for x,y,value,color,rotate in self.labels:
            self.text(x,y,value,size=18,color=color,weight=600,klass='edge-label',rotate=rotate)
        self.parts.append('</svg>')
        (HERE/filename).write_text('\n'.join(self.parts)+'\n')


def architecture():
    d=Diagram(2150,'GUARDIAN / CONVERGENCE — CURRENT ARCHITECTURE',
              'NetClaw host 192.168.3.252  •  Docker Compose + systemd  •  Verified 24 Oct 2026', 'SHEET 01 / 02')
    d.text(60,164,'OPERATOR ACCESS',size=18,weight=700,color='muted')
    d.text(1640,164,'MANAGED ENVIRONMENT',size=18,weight=700,color='muted')
    d.zone(60,385,670,1310,'OBSERVABILITY + CASE DATA','Docker Compose: netclaw-convergence','#edf5f6')
    d.zone(800,385,740,1310,'NETCLAW CONTROL SERVICES','Host processes / systemd; existing NetClaw installation','#edf2f9')
    d.zone(1610,385,730,1310,'GUARDIAN EXECUTION PROFILE','Host worker; separate state, credentials and scoped tools','#f2eff8',dash='9 5')

    # Routes are drawn before cards. Crossings have no implicit junction.
    d.edge('M470 250 H520','blue','Same origin',445,182)
    d.edge('M960 250 H1010','blue','/api/*',958,182)
    d.edge('M1975 310 V345 H395 V455','teal','01  SNMP / syslog / UniFi / WAN probes',875,334)
    d.edge('M395 605 V630 H232 V665','teal','Metrics',170,648)
    d.edge('M395 630 H557 V665','teal','Logs',566,648)
    d.edge('M232 825 V885','teal','Alert rules',247,858)
    d.edge('M700 950 H770 V535 H835','orange','02  POST /webhook',405,936)
    d.edge('M1170 655 V715','orange','Enrich + evaluate',1186,690)
    d.edge('M1170 1015 V1115','orange','03  POST /hooks/alert (T2)',1187,1086)
    d.edge('M1170 1330 V1400','orange','04  n2n_route / n2n_task_wait via n2n-mcp',856,1376)
    d.edge('M1505 1475 H1575 V535 H1640','orange','05  iN2N: task dispatch / progress / result',1561,1230,rotate=-90,both=True)
    d.edge('M1975 615 V735','orange','Spawn model run per delegated task',1670,686)
    d.edge('M1975 935 V1045','blue','MCP tool calls / results',1992,995,both=True,dash='8 5')
    d.edge('M1975 1250 V1350','orange','Evidence → assessment',1992,1307)
    d.edge('M1010 655 V682 H785 V1200 H700','purple','Initial POST /api/events',838,678)
    d.edge('M1975 1545 V1600 H395 V1325','purple','06  PATCH same event ID: findings, root cause, status',850,1588)
    d.edge('M232 1325 V1420','purple','SQL case lifecycle',248,1380)
    d.edge('M232 1140 V1015','blue','Alert state',247,1100,dash='7 5')
    d.edge('M90 1205 H43 V745 H90','blue','PromQL reads',29,1110,dash='7 5',rotate=-90)
    d.edge('M1260 310 V365 H755 V1172 H700','blue','Convergence /api/home/* proxy; bearer added server-side',740,1075,rotate=-90)
    d.edge('M700 1280 H792 V1060 H835','purple','Need More + notes',600,1347,dash='8 5')
    d.edge('M1095 1060 H1140 V1115','purple',dash='8 5')
    d.edge('M1510 250 H1552 V1210 H1505','model','Chat / model controls → OpenClaw',1537,1030,dash='3 6',rotate=-90)
    d.edge('M1640 1148 H1590 V1645 H557 V1550','blue','07  Grafana queries via scoped MCP',885,1635,dash='8 5')
    d.edge('M1640 1190 H1580 V1672 H23 V775 H90','blue','Direct Prometheus MCP reads',870,1698,dash='8 5')
    d.edge('M2310 1150 H2355 V250 H2310','blue','Device APIs / CLI reads through MCP',2338,1100,dash='8 5',rotate=-90)
    d.edge('M557 1420 V1380 H717 V780 H700','blue','Metrics / logs',703,1113,dash='7 5',rotate=-90)
    d.edge('M717 850 H395 V795 H375','blue',dash='7 5')
    d.edge('M1505 1260 H1525 V1730 H1000 V1780','model','Luna alert / Sol chat',1095,1720,dash='3 6')
    d.edge('M2310 840 H2380 V1750 H1340 V1780','model','Sol worker / Luna fallback',1735,1740,dash='3 6')

    d.card(90,190,380,120,'Operator browser',['Chat · Convergence · Canvas',('Remote subnet → 192.168.3.252:3000',)],title_size=23)
    d.card(520,190,440,120,'New HUD UI',['Vite preview · host TCP :3000',('Convergence is inline; no legacy iframe',)],title_size=24)
    d.card(1010,190,500,120,'HUD API + Convergence proxy',['Loopback 127.0.0.1:3001',('/api/home/* · /api/models · /api/chat',)],title_size=24)
    d.card(1640,190,670,120,'Network devices + WAN targets',['pfSense · UniFi APs · campus switches', 'Device exporters / APIs / logs / reachability probes'],color='teal')
    d.card(90,455,610,150,'Collectors, exporters and probes',[
        'OTel: switch SNMP + device syslog TCP/UDP :1514',
        'Blackbox :9115 · UniFi :9899 · speedtest / Pushgateway',
        'OTel fans metrics to Prometheus / VictoriaMetrics'],color='teal')
    d.card(90,665,285,160,'Metrics stores',[
        'Prometheus :9090', 'VictoriaMetrics :8428', 'PromQL / time series'],color='teal',title_size=23)
    d.card(415,665,285,160,'Log stores',[
        'Loki :3100', 'VictoriaLogs :9428', 'Syslog / device evidence'],color='teal',title_size=23)
    d.card(90,885,610,130,'Alertmanager',['TCP :9093 · groups / deduplicates firing alerts',('Webhook → host alert-receiver :8099',)],color='teal')
    d.card(90,1140,610,185,'Convergence API',[
        'Host :3080 → container :3000',
        'Health / Wi-Fi / devices / alerts / diary / triage',
        'Case identity: site + event_id + alert fingerprint',
        'No LLM runs here; telemetry and case persistence'],color='purple')
    d.card(90,1420,285,130,'PostgreSQL',[
        'Internal Docker :5432', 'Events / notes / feedback'],color='purple',title_size=23)
    d.card(415,1420,285,130,'Grafana',[
        'Host :3300 → :3000', 'Queries metrics / logs'],color='blue',title_size=23)

    d.card(835,455,670,200,'Alert receiver',[
        'Host TCP :8099 · netclaw-alert-receiver.service',
        'POST /webhook → automatic-alert admission path',
        'Enrich from Nautobot / inventory + RAG prior cases',
        'Create / update initial case; send received notice',
        'Other endpoints: /reinvestigate and /snapshot'],color='orange')
    d.card(835,715,670,300,'Automatic investigation policy',[
        'Default T0: record / notify; no LLM investigation',
        'T2 allowlist:',
        ('WanHardDown',),
        ('SwitchLinkLost  [severity=critical]',),
        ('DeviceSnmpExporterDown',),
        '3 T2 admissions / hour · 30-minute duplicate TTL',
        'Concurrency 2 applies to receiver trigger handling',
        'Suppressed / over budget → diary; no backlog queue'],color='orange')
    d.rect(835,1035,260,50,'#f5eefa',stroke='purple',radius=8)
    d.text(848,1067,'Receiver /reinvestigate',size=19,color='purple',weight=600)
    d.card(835,1115,670,215,'OpenClaw Gateway',[
        'Host TCP :18789 · openclaw-gateway.service',
        'main / HUD chat: GPT-6.1 Sol',
        'alert / orchestrator: GPT-6 Luna',
        ('/hooks/alert → agent alert · deliver=false',),
        'main + alert share the Border OAuth credential store'],color='orange')
    d.card(835,1400,670,150,'iN2N Border / task broker',[
        'netclaw-mesh.service · loopback TCP :11790',
        'n2n-mcp is the Gateway’s tool-facing client',
        'Route → task ID → wait/progress → result'],color='orange')
    d.card(1640,455,670,160,'Guardian member daemon',[
        'netclaw-member-byrns-risk-guardian-claw.service',
        'Python iN2N worker; persistent Border connection',
        ('Identity: byrns-risk/guardian-claw',),
        'Idle daemon ≠ continuously running LLM'],color='orange')
    d.card(1640,735,670,200,'Scoped OpenClaw agent run',[
        'GPT-6.1 Sol · GPT-6 Luna fallback',
        ('openclaw agent --local --model <member-model>',),
        'Existing OpenClaw embedded tool runtime',
        'Own OAuth store / sessions / member environment',
        'No separate Guardian Gateway listener'],color='orange')
    d.card(1640,1045,670,205,'Eight scoped MCP integrations',[
        'prometheus-mcp · grafana-mcp · pyats-mcp',
        'pfsense-mcp · unifi-network',
        'greynoise-community-mcp · rag-mcp · memory-mcp',
        'Read evidence; compare prior cases; assess cause',
        'Investigation procedure: report, do not auto-remediate'],color='blue')
    d.card(1640,1350,670,195,'Investigation outcomes',[
        'Findings + evidence + root-cause classification',
        'PATCH original case → resolved or escalated',
        'Return task findings to the Border',
        'Discord findings via configured notification path',
        'POST /snapshot → RAG for future investigations'],color='purple')
    d.card(800,1780,740,145,'OpenAI — ChatGPT / Codex subscription',[
        'Same account allowance; separate Border / Guardian OAuth stores',
        'Subscription inference; no general OpenAI API key required',
        'Model calls are outbound; no network device changes implied'],color='model',title_size=24)
    d.legend(1978)
    d.text(60,2040,'READING NOTES',size=17,weight=700,color='muted')
    d.text(60,2074,'Need More uses /reinvestigate → /hooks/alert directly; automatic admission gates are not reapplied on that path.',size=19)
    d.text(60,2105,'Ports are host bindings unless marked internal/container. Dashed = query / feedback; dotted = model/control. Crossings are not junctions.',size=18,color='muted')
    d.text(2370,2130,'NETCLAW / CURRENT STATE / REV 1',size=15,color='muted',anchor='end')
    d.save('guardian-convergence-architecture.svg')


def sequence():
    d=Diagram(1810,'GUARDIAN / CONVERGENCE — INVESTIGATION SEQUENCE',
              'Automatic admission, delegated execution and the operator feedback loop  •  Current configured workflow', 'SHEET 02 / 02')
    cols=[(180,'Alertmanager','Docker :9093'),(590,'Alert receiver','Host :8099'),(1000,'OpenClaw / alert','Luna · Gateway :18789'),(1410,'Guardian worker','Sol · scoped profile'),(1820,'Case API + DB','Convergence :3080'),(2230,'Operator / HUD','UI :3000 → API :3001')]
    d.rect(60,325,2320,810,'#fff7ed',stroke='#efd9bf',radius=14)
    d.rect(60,1200,2320,365,'#f4effa',stroke='#dac9ec',radius=14)
    for x,title,sub in cols:
        d.rect(x-155,185,310,105,'white',radius=10)
        d.text(x,223,title,size=23,weight=700,anchor='middle')
        d.text(x,262,sub,size=16,color='muted',anchor='middle')
        d.parts.append(f'<path d="M{x} 291 V1555" stroke="#a9b8c9" stroke-width="1.6" stroke-dasharray="6 7"/>')
    d.text(85,360,'AUTOMATIC ALERT — POLICY-GATED',size=22,weight=700,color='orange')
    def msg(a,b,y,label,color='orange',dash=None):
        d.edge(f'M{a} {y} H{b}',color,label,(a+b)/2-130,y-12,dash=dash)
    msg(180,590,400,'01  POST /webhook')
    d.rect(475,440,1470,95,'#ffffff',stroke='orange',radius=8)
    d.text(500,474,'Admission branch: T0 / T1 → logged case + configured notification; stop before OpenClaw.',size=20,weight=600)
    d.text(500,510,'T2 allowlist + receiver budgets + duplicate/rate checks → continue below. No queued investigation backlog.',size=19,color='muted')
    msg(590,1820,575,'02  POST initial case · status=investigating · keep event_id','purple')
    msg(590,1000,650,'03  POST /hooks/alert')
    d.text(620,683,'Alert context + device context + prior-case hits + event_id',size=17,color='muted')
    msg(1000,1410,745,'04  n2n_route → task ID')
    d.text(1018,778,'Via n2n-mcp → Border :11790; wait repeatedly for task completion',size=17,color='muted')
    d.edge('M1410 820 H1530 V875 H1410','blue','05  Scoped evidence queries',1550,840,dash='8 5')
    d.text(1550,874,'Metrics / logs / device APIs / prior cases',size=18,color='muted')
    msg(1410,1820,930,'06  PATCH same event_id','purple')
    d.text(1428,963,'Findings + root cause + resolved / escalated',size=17,color='muted')
    msg(1410,1000,1015,'07  Task findings / terminal result','orange',dash='8 5')
    msg(2230,1820,1075,'08  GET diary / triage via HUD proxy','blue',dash='8 5')
    d.rect(85,1145,2270,40,'#edf5f6',stroke='#c5dadd',radius=6)
    d.text(105,1172,'Outcome side effects: Guardian sends Discord findings and requests /snapshot → RAG. Subsequent alerts can reuse the prior-case narrative.',size=19,color='teal')
    d.text(85,1237,'OPERATOR-REQUESTED FOLLOW-UP — DEDICATED PATH',size=22,weight=700,color='purple')
    msg(2230,1820,1290,'09  Need More + expert_feedback','purple')
    d.text(1760,1325,'POST /api/home/events/:id/reinvestigate via HUD API',size=17,color='muted')
    msg(1820,590,1378,'10  Reopen original case; POST receiver /reinvestigate','purple')
    msg(590,1000,1460,'11  POST /hooks/alert','purple')
    d.text(1025,1465,'Repeat steps 04–08 with the same case ID and operator notes.',size=19,color='purple')
    d.text(85,1530,'This route does not call the automatic T0/T1/T2 admission functions. Model work is explicitly requested by the operator.',size=19,color='purple')
    d.text(60,1625,'IDENTITY + AUTHENTICATION',size=18,weight=700,color='muted')
    d.text(60,1662,'Fingerprint groups the alert; event_id identifies the durable case; task_id identifies a delegated run; hook session key is fingerprint-based.',size=19)
    d.text(60,1694,'Upstream case-API bearer stays in the HUD proxy; hook bearer, iN2N member authentication and OAuth model auth are distinct.',size=19)
    d.text(60,1745,'Current receiver concurrency accounting ends after hook dispatch; it is not an end-to-end reservation for the worker’s entire run.',size=18,color='muted')
    d.text(60,1776,'Deployment bindings / model replies / member enrollment verified. Agent tool use, case completion and notifications follow the configured procedure.',size=18,color='muted')
    d.text(2380,1800,'NETCLAW / CURRENT STATE / REV 1',size=15,color='muted',anchor='end')
    d.save('guardian-convergence-sequence.svg')


if __name__=='__main__':
    architecture()
    sequence()
    print('Generated architecture and investigation sequence SVGs.')
