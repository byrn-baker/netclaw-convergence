"""Equinix spec132: explicit tool catalog and externally verified change boundary."""
import base64
import hashlib
import json
import os
import re
import urllib.parse
import urllib.request

ENDPOINT = 'https://mcp.equinix.com/fabric'
BRIDGE = 'mcp-remote@0.14.3'
READS = set('''search_connections check_connection list_metros get_metro list_project
search_prices search_ports get_vlan_port search_routers list_router_packages
search_router_commands search_routes list_routing_protocols list_routing_protocol_actions
search_networks search_ip_blocks search_service_profiles get_service_profile
list_service_profile_metros search_service_tokens search_route_filters
list_route_filters_for_connection list_route_filter_connections
search_route_filter_attachments_for_fcr get_route_filter_changes list_route_filter_change
list_route_filter_rules get_route_filter_rule list_route_filter_rule_changes
get_route_filter_rule_change search_route_aggregations get_route_aggregation
list_route_aggregations_for_connection list_route_aggregation_connections
search_route_aggregation_attachments_for_fcr list_route_aggregation_changes
get_route_aggregation_change list_route_aggregation_rules get_route_aggregation_rule
list_route_aggregation_rule_changes get_route_aggregation_rule_change list_streams
get_stream get_stream_network_edge_device search_attached_assets
list_stream_attached_assets_by_type get_stream_attached_asset list_stream_subscriptions
get_stream_subscription list_stream_alert_rules get_stream_alert_rule
search_application_links get_application_link search_application_domains
get_application_domain search_application_services search_application_subscriptions
list_devices list_device_types list_accounts list_acls list_aclTemplates'''.split())
WRITES = set('''create_connection update_connection retry_connection create_port update_port
attach_physical_ports_to_lag create_router update_router create_router_command refresh_routes
create_routing_protocol update_routing_protocol replace_routing_protocol
create_routing_protocol_action create_network update_network add_ip_block_to_eia_service
create_service_profile update_service_profile replace_service_profile create_service_token
update_service_token create_route_filter update_route_filter attach_route_filter
create_route_filter_rule update_route_filter_rule create_route_aggregation
update_route_aggregation attach_route_aggregation create_route_aggregation_rule
update_route_aggregation_rule create_stream update_stream update_stream_network_edge_device
attach_stream_asset create_stream_subscription update_stream_subscription
create_stream_alert_rule replace_stream_alert_rule create_application_link
attach_application_domain_to_link attach_application_service_to_link create_application_domain
create_application_service create_application_subscription'''.split())


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=True, allow_nan=False).encode()).hexdigest()


def operation_digest(tool, arguments, baseline):
    return digest({'endpoint': ENDPOINT, 'tool': tool, 'arguments': arguments,
                   'baseline': baseline})


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def snow_get(table, query, fields):
    """Read-only verifier credentials; never follow a credential-bearing redirect."""
    url = os.environ.get('EQUINIX_SERVICENOW_URL', '')
    user = os.environ.get('EQUINIX_SERVICENOW_USERNAME', '')
    password = os.environ.get('EQUINIX_SERVICENOW_PASSWORD', '')
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or not user or not password:
        raise ValueError('ServiceNow verifier is not configured')
    params = urllib.parse.urlencode({'sysparm_query': query, 'sysparm_fields': fields,
                                    'sysparm_limit': 2, 'sysparm_display_value': 'false',
                                    'sysparm_exclude_reference_link': 'true'})
    request = urllib.request.Request(url.rstrip('/') + '/api/now/table/' + table + '?' + params,
        headers={'Accept': 'application/json', 'Authorization': 'Basic ' +
                 base64.b64encode((user + ':' + password).encode()).decode()})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
        return json.load(response)['result']


def verify_change(number, expected_digest, fetch=snow_get):
    if not isinstance(number, str) or not re.fullmatch(r'CHG[0-9]+', number):
        raise ValueError('Exact CHG number required')
    rows = fetch('change_request', 'number=' + number,
                 'number,approval,state,cmdb_ci,implementation_plan,backout_plan,test_plan,risk,impact')
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
        raise ValueError('Exact unique change record required')
    cr = rows[0]
    if cr.get('number') != number or cr.get('approval') != 'approved' or str(cr.get('state')).lower() not in {'-1', 'implement'}:
        raise ValueError('Change must be approved and in Implement')
    markers = re.findall(r'NETCLAW-EQUINIX-SHA256=([0-9a-f]{64})(?![0-9a-f])', str(cr.get('implementation_plan', '')))
    if expected_digest not in markers:
        raise ValueError('CR does not approve this exact operation and baseline digest')
    if any(cr.get(k) is None or not str(cr.get(k, '')).strip() for k in ('backout_plan', 'test_plan', 'risk', 'impact')):
        raise ValueError('CR requires rollback, verification, risk and impact')
    ci = cr.get('cmdb_ci')
    if not isinstance(ci, str) or not re.fullmatch(r'[0-9a-f]{32}', ci):
        raise ValueError('CR requires an affected CI sys_id')
    incidents = fetch('incident', 'active=true^priorityIN1,2^cmdb_ci=' + ci, 'number,priority')
    if not isinstance(incidents, list) or incidents:
        raise ValueError('Open P1/P2 incident or invalid incident response blocks execution')
    return number
