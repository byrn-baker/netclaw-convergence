import importlib.util
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[2]


def load(server):
    spec=importlib.util.spec_from_file_location(server,ROOT/'mcp-servers'/server/'verdict.py');obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj


@pytest.mark.parametrize('messages',[
 ['Interface Ethernet1 is inactive, expected active'],
 ['BGP peer is not configured, expected established'],
 ['Feature is not inactive'],
 ['Unsupported transceiver detected'],
 ['BGP inactive','NTP synchronization failed'],
 ['Expected invalid input rejection, command was accepted'],
])
def test_anta_does_not_hide_genuine_or_mixed_failures(messages):
    obj=load('anta-mcp');assert obj.classify('failure',messages)[0]==obj.FAIL


@pytest.mark.parametrize('messages',[["'show bgp summary vrf all' failed on veos1: BGP inactive"],['Invalid input']])
def test_anta_known_command_unavailable(messages):
    obj=load('anta-mcp');assert obj.classify('failure',messages)[0]==obj.NOT_APPLICABLE


@pytest.mark.parametrize('power,state',[('PoweringOn','POWERING_ON'),('PoweringOff','POWERING_OFF'),('On','POWERED_ON'),('Off','POWERED_OFF')])
def test_redfish_transitions_are_not_finished_states(power,state):
    result=load('redfish-mcp').host_verdict(power,'OK')
    assert result['host_state']==state
    if power.startswith('Powering'):assert 'transition' in result['means'].lower()
