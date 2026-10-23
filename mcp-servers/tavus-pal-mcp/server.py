#!/usr/bin/env python3
"""Local stdio-only MCP facade; no Tavus credential or public listener."""
import asyncio
from fastmcp import FastMCP
from core import query

mcp = FastMCP("NetClaw Pal")

@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def pal_query(question: str, session_id: str) -> dict:
    """Ask the isolated, all-tools-denied NetClaw companion. Results are local-only.

    The HUD authenticates and audits requests before invoking this local facade.
    This does not grant device, shell, MCP-fleet, memory or approval access.
    A configured model may incur its normal model usage cost.
    """
    return await asyncio.to_thread(query, question, session_id)

if __name__ == "__main__":
    mcp.run(transport="stdio")
