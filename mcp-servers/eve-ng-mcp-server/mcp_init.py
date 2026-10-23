"""Shared FastMCP instance — imported by all tools_*.py modules."""

from fastmcp_tasks import TasksExtension
from fastmcp import FastMCP

mcp = FastMCP("EVE-NG MCP Server")
mcp.add_extension(TasksExtension(name="netclaw-eve-ng-mcp-server", concurrency=1))

from functools import wraps
from fastmcp.utilities.async_utils import call_sync_fn_in_threadpool


def _task_tool(fn):
    """Register a threaded MCP task while preserving the direct Python callable."""
    @wraps(fn)
    async def run(*args, **kwargs):
        return await call_sync_fn_in_threadpool(fn, *args, **kwargs)
    mcp.tool(task=True)(run)
    return fn
