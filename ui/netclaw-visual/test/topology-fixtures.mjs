// Synthetic documentation-range records only; no real device identifiers.
export const FACT_FIXTURES = {
  'show version': `MOCK#show version
Cisco IOS Software, IOSv Software, Version 15.9(3)M, RELEASE SOFTWARE
MOCK uptime is 1 day, 2 hours
cisco IOSv (revision 1.0) with 512000K/524288K bytes of memory.
Processor board ID DEMO-SERIAL-001
MOCK#`,
  'show inventory': `MOCK#show inventory
NAME: "Chassis", DESCR: "Synthetic lab router"
PID: DEMO-ROUTER, VID: V01, SN: DEMO-SERIAL-001
MOCK#`,
  'show ip interface brief': `Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/1      198.51.100.1    YES manual up                    up
GigabitEthernet0/2      unassigned      YES unset  administratively down down
MOCK#`,
  'show interfaces': `GigabitEthernet0/1 is up, line protocol is up
  Description: Demonstration user LAN
  Internet address is 198.51.100.1/24
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,
  5 minute input rate 1200 bits/sec, 1 packets/sec
  5 minute output rate 2400 bits/sec, 2 packets/sec
     3 input errors, 2 CRC, 0 frame, 0 overrun, 0 ignored
     1 output errors, 0 collisions, 4 interface resets
GigabitEthernet0/2 is administratively down, line protocol is down
  Description: Demonstration unused port
MOCK#`,
  'show ip arp': `Protocol  Address          Age (min)  Hardware Addr   Type   Interface
Internet  198.51.100.25            1   0011.2233.4455  ARPA   GigabitEthernet0/1
Internet  198.51.100.26            0   Incomplete     ARPA
MOCK#`,
  'show cdp neighbors detail': `-------------------------
Device ID: DEMO-SWITCH
Entry address(es):
  IP address: 198.51.100.25
Platform: cisco DEMO-9300, Capabilities: Switch IGMP
Interface: GigabitEthernet0/1, Port ID (outgoing port): GigabitEthernet1/0/48
MOCK#`,
  'show lldp neighbors detail': `------------------------------------------------
Local Intf: Gi0/1
Chassis id: 0011.2233.4455
Port id: Gi1/0/48
System Name: DEMO-SWITCH
System Capabilities: B,R
Management Addresses:
    IP: 198.51.100.25
Total entries displayed: 1
MOCK#`,
  'show mac address-table': `          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 120    0011.2233.4455     DYNAMIC     Gi1/0/5
 120    00aa.bbcc.ddee     DYNAMIC     Gi1/0/6
Total Mac Addresses for this criterion: 2
MOCK#`,
  'show vlan brief': `VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
120  DEMO-USERS                       active    Gi1/0/5, Gi1/0/6
MOCK#`,
  'show ip ospf neighbor': `Neighbor ID     Pri   State           Dead Time   Address         Interface
192.0.2.2         1   FULL/DR         00:00:36    198.51.100.25   GigabitEthernet0/1
MOCK#`,
  'show ip bgp summary': `BGP router identifier 192.0.2.1, local AS number 64512
Neighbor        V           AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
198.51.100.25   4        64513      22      20        5    0    0 00:10:00        4
198.51.100.26   4        64514       0       0        0    0    0 never    Active
MOCK#`,
};
