import importlib.util
import json
from pathlib import Path
import socket
import struct
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("collector", Path(__file__).parents[1] / "collector.py")
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def packet(version=4, protocol=6, flags=2, options=0, payload=b"PRIVATE-APPLICATION-PAYLOAD"):
    if protocol == 6:
        transport = struct.pack("!HHII", 1234, 443, 0, 0) + bytes((0x50, flags)) + b"\0" * 6
    elif protocol == 17:
        transport = struct.pack("!HHHH", 1234, 53, 8 + len(payload), 0)
    else:
        transport = b"\x08\0\0\0"
    if version == 4:
        header = struct.pack("!BBHHHBBH4s4s", 0x45 + options // 4, 0,
                             20 + options + len(transport) + len(payload), 0, 0, 64, protocol, 0,
                             socket.inet_aton("10.0.0.2"), socket.inet_aton("1.1.1.1")) + b"\0" * options
    else:
        header = struct.pack("!IHBB16s16s", 6 << 28, len(transport) + len(payload), protocol, 64,
                             socket.inet_pton(socket.AF_INET6, "2001:db8::2"),
                             socket.inet_pton(socket.AF_INET6, "2001:db8::1"))
    return b"\0" * 12 + struct.pack("!H", 0x0800 if version == 4 else 0x86DD) + header + transport + payload


def execute_filter(code, data, index=7, direction=0, random=0):
    """Tiny independent cBPF interpreter for exactly the opcodes the filter uses."""
    a, x, pc = 0, 0, 0
    ancillary = {0xFFFFF004: direction, 0xFFFFF008: index, 0xFFFFF038: random}
    while pc < len(code):
        op, jt, jf, k = code[pc]
        pc += 1
        if op in (0x20, 0x28, 0x30, 0x50, 0xB1):
            if op == 0x20 and k in ancillary:
                a = ancillary[k]
                continue
            offset = k + (x if op == 0x50 else 0)
            size = {0x20: 4, 0x28: 2, 0x30: 1, 0x50: 1, 0xB1: 1}[op]
            if offset + size > len(data):
                return 0
            value = int.from_bytes(data[offset:offset + size], "big")
            if op == 0xB1:
                x = (value & 15) * 4
            else:
                a = value
        elif op in (0x15, 0x35, 0x45):
            truth = {0x15: a == k, 0x35: a >= k, 0x45: bool(a & k)}[op]
            pc += jt if truth else jf
        elif op == 0x05:
            pc += k
        elif op == 0x54:
            a &= k
        elif op == 0x04:
            a += k
        elif op == 0x87:
            a = x
        elif op == 0x06:
            return min(k, len(data))
        elif op == 0x16:
            return min(a, len(data))
        else:
            raise AssertionError(op)
    raise AssertionError("no return")


class PacketTests(unittest.TestCase):
    def test_header_only_capture_all_supported_protocols(self):
        code = c.capture_filter([7])
        for version, protocol, options, expected in ((4, 6, 0, 48), (4, 6, 40, 88),
                                                    (4, 17, 0, 38), (4, 1, 0, 34),
                                                    (6, 6, 0, 68), (6, 17, 0, 58), (6, 58, 0, 54)):
            with self.subTest(version=version, protocol=protocol, options=options):
                data = packet(version, protocol, options=options)
                size = execute_filter(code, data)
                self.assertEqual(size, expected)
                self.assertNotIn(b"PRIVATE", data[:size])
                result = c.parse_packet(data[:size])
                self.assertIsNotNone(result)
                self.assertNotIn("PRIVATE", json.dumps(result))
                self.assertEqual(result["ip_version"], version)

    def test_sampling_and_direction_and_interface(self):
        code = c.capture_filter([7])
        for version, protocol in ((4, 17), (4, 1), (6, 17), (6, 58)):
            data = packet(version, protocol)
            self.assertEqual(sum(bool(execute_filter(code, data, random=n)) for n in range(256)), 4)
        for flags in (0, 0x10, 0x12):
            self.assertEqual(execute_filter(code, packet(flags=flags)), 0)
        self.assertEqual(execute_filter(code, packet(), direction=4), 0)
        self.assertEqual(execute_filter(code, packet(), index=8), 0)
        self.assertEqual(execute_filter(c.capture_filter([]), packet()), 0)

    def test_fragment_extension_vlan_and_truncation_rejected(self):
        code = c.capture_filter([7])
        for offset, value in ((20, b"\x20\0"), (20, b"\0\x01"), (12, b"\x81\0")):
            data = bytearray(packet())
            data[offset:offset + 2] = value
            self.assertEqual(execute_filter(code, data), 0)
            self.assertIsNone(c.parse_packet(data))
        data = bytearray(packet(version=6))
        data[20] = 0
        self.assertEqual(execute_filter(code, data), 0)
        self.assertIsNone(c.parse_packet(data))
        self.assertIsNone(c.parse_packet(packet()[:40]))
        self.assertLess(len(c.capture_filter(range(1, c.MAX_NICS + 1))), 4096)


class StateTests(unittest.TestCase):
    binding = (6001, "1c106ad4-85ae-4dac-90b6-91d5e0a44cc2", "tap6001i0", 7, "hash", 999)

    def test_lifecycle_discards_uuid_config_index_and_pid_changes(self):
        for position, replacement in ((0, 6002), (1, None), (2, "tap6001i1"), (3, 8), (4, "changed"), (5, 1000)):
            window = c.Window()
            window.add(self.binding, c.parse_packet(packet()), 100, 1)
            changed = list(self.binding)
            changed[position] = replacement
            self.assertEqual(window.reconcile({changed[3]: tuple(changed)}), [])
            self.assertEqual(window.discarded, 1)
        window = c.Window()
        window.add(self.binding, c.parse_packet(packet()), 100, 1)
        self.assertEqual(len(window.reconcile({7: self.binding})), 1)

    def test_flow_and_rate_bounds_report_loss(self):
        window = c.Window()
        parsed = c.parse_packet(packet())
        for port in range(c.MAX_CONNECTIONS + 10):
            window.add(self.binding, {**parsed, "src_port": port}, 100, 1)
        self.assertEqual(len(window.flows), c.MAX_CONNECTIONS)
        self.assertEqual(window.discarded, 10)
        window = c.Window()
        for _ in range(c.MAX_RATE + 5):
            window.add(self.binding, parsed, 100, 1)
        self.assertEqual(window.discarded, 5)
        self.assertEqual(next(iter(window.flows.values()))["packet_count"], c.MAX_RATE)

    def test_inventory_running_stopped_and_snapshot_sections(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            conf, sys, run, proc = [root / p for p in ("conf", "sys", "run", "proc")]
            for path in (conf, sys, run, proc):
                path.mkdir()
            (conf / "6001.conf").write_text("name: SECRET\nsmbios1: uuid=" + self.binding[1] +
                "\nnet0: virtio=AA:BB:CC:DD:EE:FF,bridge=vmbr0,tag=12\n[old]\nnet0: e1000=FF:FF:FF:FF:FF:FF\n")
            (conf / "6002.conf").write_text("memory: 1024\n")
            (run / "6001.pid").write_text("999")
            (proc / "999").mkdir()
            (proc / "999" / "comm").write_text("kvm\n")
            interface = sys / "tap6001i0"
            (interface / "statistics").mkdir(parents=True)
            (interface / "ifindex").write_text("7")
            for field in ("rx_bytes", "tx_bytes", "rx_packets", "tx_packets"):
                (interface / "statistics" / field).write_text("50")
            vms, bindings, errors = c.inventory(conf, sys, run, proc)
            self.assertEqual(errors, [])
            self.assertEqual(vms[0]["power_state"], "running")
            self.assertEqual(vms[1]["power_state"], "stopped")
            self.assertEqual(vms[0]["nics"][0]["mac"], "aa:bb:cc:dd:ee:ff")
            self.assertEqual(vms[0]["nics"][0]["rx_packets"], 50)
            self.assertEqual(bindings[7][:4], self.binding[:4])
            self.assertNotIn("SECRET", json.dumps(vms))
            (conf / "6002.conf").write_bytes(b"x" * (c.MAX_CONFIG + 1))
            self.assertFalse(c.inventory(conf, sys, run, proc)[1])
            self.assertTrue(c.inventory(conf, sys, run, proc)[2])

    def test_atomic_output_mode_and_size(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.json"
            c.write_snapshot(path, {"sequence": 1})
            c.write_snapshot(path, {"sequence": 2})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(path.read_bytes()), {"sequence": 2})
            self.assertFalse(path.with_suffix(".tmp").exists())
            with self.assertRaises(ValueError):
                c.write_snapshot(path, {"too_big": "x" * c.MAX_SNAPSHOT})
            self.assertEqual(json.loads(path.read_bytes()), {"sequence": 2})


if __name__ == "__main__":
    unittest.main()
