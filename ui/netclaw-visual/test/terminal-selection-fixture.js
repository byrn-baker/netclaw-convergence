import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { installTerminalMouseCoordinates } from '../src/canvas-chat/terminal-mouse-coordinates.js';

const terminal = new Terminal({ cols: 80, rows: 16, fontSize: 16, lineHeight: 1.12, scrollback: 200,
  theme: { background: '#090e14', foreground: '#d6deeb', selectionBackground: '#2f6fb088' } });
terminal.open(document.querySelector('#host'));
let adapter = installTerminalMouseCoordinates(terminal);
const zoom = document.querySelector('#zoom');
const scale = () => { document.querySelector('#world').style.transform = `scale(${zoom.value})`; };
zoom.addEventListener('change', scale); scale();
document.querySelector('#cols').addEventListener('change', e => terminal.resize(Number(e.target.value), 16));
document.querySelector('#adapter').addEventListener('change', e => { adapter?.dispose(); adapter = e.target.checked ? installTerminalMouseCoordinates(terminal) : null; });
terminal.write('SYNTHETIC terminal selection test\r\n0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ\r\nO    198.51.100.0/24 [110/20] via 192.0.2.1, GigabitEthernet0/1\r\nC    192.0.2.0/30 is directly connected, GigabitEthernet0/1\r\nUnicode: caf\u00e9 \u8def\u7531 endpoint\r\nLast fixture line.\r\n');
terminal.onSelectionChange(() => {
  document.querySelector('#selected').textContent = terminal.getSelection();
  document.querySelector('#status').textContent = `Selection: ${JSON.stringify(terminal.getSelectionPosition())}`;
});
document.querySelector('#scrollback').addEventListener('click', () => {
  for (let i = 0; i < 40; i++) terminal.writeln(`SYNTHETIC scrollback line ${String(i).padStart(2, '0')}  198.51.100.0/24`);
  terminal.write('', () => terminal.scrollLines(-12));
});
