"""Scoped case interface for investigators without shell or arbitrary HTTP access."""
import os
import uuid
import httpx
from fastmcp import FastMCP
mcp=FastMCP('convergence-case-mcp')
BASE=(os.getenv('CONVERGENCE_API_URL') or os.getenv('HOME_API_URL') or os.getenv('NETWORK_GUARDIAN_URL','')).rstrip('/')
TOKEN=os.getenv('CONVERGENCE_API_TOKEN') or os.getenv('HOME_API_TOKEN') or os.getenv('NETWORK_GUARDIAN_TOKEN','')
SITE=os.getenv('GUARDIAN_DEFAULT_SITE','home')

async def request(method, event_id, body=None):
    event_id=str(uuid.UUID(event_id))
    if not BASE or not TOKEN: raise ValueError('Case interface is not configured')
    async with httpx.AsyncClient(timeout=15) as client:
        r=await client.request(method,f'{BASE}/api/events/{event_id}',params={'site':SITE},
            headers={'Authorization':f'Bearer {TOKEN}'},json=body)
        r.raise_for_status()
        return r.json()

@mcp.tool()
async def case_get(event_id: str) -> dict:
    """Read the assigned investigation case and operator feedback."""
    return await request('GET',event_id)

@mcp.tool()
async def case_update(event_id: str, investigation_notes: str, root_cause: str,
                      status: str='escalated') -> dict:
    """Record evidence and findings on the assigned case. Use escalated when uncertain.
    resolved means the investigation is complete; recovery is tracked separately.
    Learning is queued automatically by the case API. No device configuration changes.
    """
    if status not in ('investigating','resolved','escalated'): raise ValueError('Invalid investigation status')
    if not investigation_notes.strip() or not root_cause.strip(): raise ValueError('Evidence and conclusion are required')
    if len(investigation_notes)>32000 or len(root_cause)>4000: raise ValueError('Findings exceed the case size limit')
    return await request('PATCH',event_id,{'investigation_notes':investigation_notes,'root_cause':root_cause,'status':status})

if __name__=='__main__':mcp.run()
