"""
Smoke tests for GNS3 MCP Server.

These tests verify basic functionality without requiring a live GNS3 server.
For live integration tests, set GNS3_URL, GNS3_USER, GNS3_PASSWORD environment variables.
"""

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestGNS3ErrorHandling:
    """Test error handling utilities."""

    def test_gns3_error_to_dict(self):
        """Test GNS3Error serialization."""
        from gns3_mcp_server import GNS3Error

        error = GNS3Error("GNS3_NOT_FOUND", "Project not found", 404)
        result = error.to_dict()

        assert result["success"] is False
        assert result["error"] == "Project not found"
        assert result["error_code"] == "GNS3_NOT_FOUND"
        assert result["status_code"] == 404

    def test_success_response_with_data(self):
        """Test success_response helper with data."""
        from gns3_mcp_server import success_response

        result = json.loads(success_response(
            data={"project_id": "abc123", "name": "test"},
            message="Project created",
            count=1
        ))

        assert result["success"] is True
        assert result["data"]["project_id"] == "abc123"
        assert result["message"] == "Project created"
        assert result["count"] == 1

    def test_success_response_minimal(self):
        """Test success_response with minimal args."""
        from gns3_mcp_server import success_response

        result = json.loads(success_response())

        assert result["success"] is True
        assert "data" not in result
        assert "message" not in result

    def test_error_response_from_gns3_error(self):
        """Test error_response with GNS3Error."""
        from gns3_mcp_server import GNS3Error, error_response

        error = GNS3Error("GNS3_AUTH_FAILED", "Invalid credentials", 401)
        result = json.loads(error_response(error))

        assert result["success"] is False
        assert result["error_code"] == "GNS3_AUTH_FAILED"
        assert result["status_code"] == 401

    def test_error_response_from_generic_exception(self):
        """Test error_response with generic Exception."""
        from gns3_mcp_server import error_response

        error = Exception("Something went wrong")
        result = json.loads(error_response(error))

        assert result["success"] is False
        assert result["error"] == "Something went wrong"
        assert result["error_code"] == "GNS3_SERVER_ERROR"


class TestNameResolution:
    """Test name-to-UUID resolution helpers."""

    def test_is_uuid_valid(self):
        """Test _is_uuid with valid UUID."""
        from gns3_mcp_server import _is_uuid

        assert _is_uuid("550e8400-e29b-41d4-a716-446655440000") is True
        assert _is_uuid("550e8400e29b41d4a716446655440000") is False  # API IDs use canonical hyphens

    def test_is_uuid_invalid(self):
        """Test _is_uuid with invalid input."""
        from gns3_mcp_server import _is_uuid

        assert _is_uuid("my-project") is False
        assert _is_uuid("not-a-uuid") is False
        assert _is_uuid("") is False


class TestInterfaceParsing:
    @pytest.mark.parametrize('name,expected', [
        ('eth0', (0, 0)), ('eth1', (0, 1)), ('Ethernet0', (0, 0)),
        ('Gi0/0', (0, 0)), ('GigabitEthernet1/2', (1, 2)),
        ('Fa0/0', (0, 0)), ('FastEthernet1/2', (1, 2)),
        ('0/3', (0, 3)), ('port4', (0, 4)),
    ])
    def test_adapter_and_port(self, name, expected):
        from gns3_mcp_server import parse_interface
        assert parse_interface(name) == expected

    @pytest.mark.parametrize('name', ['unknown', 'invalid', '', 'g0/2', 'eth-1'])
    def test_invalid_interface_rejected(self, name):
        from gns3_mcp_server import parse_interface, GNS3Error
        with pytest.raises(GNS3Error) as error:
            parse_interface(name)
        assert error.value.error_code == 'GNS3_VALIDATION'


class TestTemplateFuzzyMatching:
    @pytest.mark.parametrize('query,expected', [('Cisco IOSv L2', ('1', 'Cisco IOSv L2')), ('iosv', ('1', 'Cisco IOSv L2')), ('ARISTA VEOS', ('3', 'Arista vEOS'))])
    def test_resolver(self, query, expected):
        from gns3_mcp_server import resolve_template_id
        import httpx
        client = MagicMock()
        client.get.return_value = httpx.Response(200, json=[
            {'template_id': '1', 'name': 'Cisco IOSv L2'},
            {'template_id': '2', 'name': 'Cisco IOSv L3'},
            {'template_id': '3', 'name': 'Arista vEOS'},
        ])
        assert resolve_template_id(client, query) == expected
        client.get.assert_called_once_with('/v3/templates')

    def test_no_match(self):
        from gns3_mcp_server import resolve_template_id, GNS3Error
        import httpx
        client = MagicMock()
        client.get.return_value = httpx.Response(200, json=[{'template_id': '1', 'name': 'Cisco IOSv'}])
        with pytest.raises(GNS3Error) as error:
            resolve_template_id(client, 'Juniper')
        assert error.value.status_code == 404


class TestGNS3ClientConfig:
    def test_client_initialization(self):
        from gns3_mcp_server import GNS3Client
        client = GNS3Client('http://test:3080/', 'testuser', 'testpass')
        try:
            assert client.base_url == 'http://test:3080'
            assert client.username == 'testuser'
            assert client.password == 'testpass'
            assert client.verify_ssl is True
        finally:
            client._client.close()

    def test_missing_credentials_rejected(self, monkeypatch):
        import gns3_mcp_server as server
        monkeypatch.setattr(server, 'client', None)
        monkeypatch.setattr(server, 'GNS3_USER', '')
        monkeypatch.setattr(server, 'GNS3_PASSWORD', '')
        with pytest.raises(server.GNS3Error) as error:
            server.get_client()
        assert error.value.error_code == 'GNS3_AUTH_FAILED'


class TestGAITLogging:
    """Test GAIT audit logging decorator."""

    def test_gait_decorator_logs_success(self):
        """Test GAIT decorator logs successful operations."""
        from gns3_mcp_server import with_gait_logging

        @with_gait_logging("test operation")
        def test_func():
            return "success"

        with patch("gns3_mcp_server.logger") as mock_logger:
            result = test_func()
            assert result == "success"
            assert mock_logger.info.call_count >= 2

    def test_gait_decorator_logs_failure(self):
        """Test GAIT decorator logs failed operations."""
        from gns3_mcp_server import with_gait_logging

        @with_gait_logging("failing operation")
        def failing_func():
            raise ValueError("Test error")

        with patch("gns3_mcp_server.logger") as mock_logger:
            with pytest.raises(ValueError):
                failing_func()
            mock_logger.error.assert_called_once()


class TestResponseFormat:
    """Test that all tools follow the JSON response contract."""

    def test_all_tools_registered(self):
        """Verify expected tools are registered with MCP server."""
        from gns3_mcp_server import mcp

        # Get registered tools
        import asyncio
        tools = asyncio.run(mcp.list_tools())

        # Expected tool names based on contracts
        expected_tools = [
            # Project lifecycle (9)
            "gns3_list_projects",
            "gns3_create_project",
            "gns3_get_project",
            "gns3_open_project",
            "gns3_close_project",
            "gns3_delete_project",
            "gns3_clone_project",
            "gns3_export_project",
            "gns3_import_project",
            # Node operations (8)
            "gns3_list_nodes",
            "gns3_create_node",
            "gns3_start_node",
            "gns3_stop_node",
            "gns3_suspend_node",
            "gns3_reload_node",
            "gns3_bulk_node_action",
            "gns3_get_node_console",
            # Link management (4)
            "gns3_list_links",
            "gns3_create_link",
            "gns3_delete_link",
            "gns3_isolate_node",
            # Packet capture (3)
            "gns3_start_capture",
            "gns3_stop_capture",
            "gns3_get_capture",
            # Snapshots (4)
            "gns3_list_snapshots",
            "gns3_create_snapshot",
            "gns3_restore_snapshot",
            "gns3_delete_snapshot",
            # Utility (2)
            "gns3_list_templates",
            "gns3_list_computes",
        ]

        # This test documents expected tools
        # Actual registration check depends on FastMCP implementation
        assert set(expected_tools) <= {tool.name for tool in tools}


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
