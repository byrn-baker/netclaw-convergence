"""ITSM gate module for gNMI Set operations.

Validates ServiceNow Change Request numbers before allowing any
gNMI Set (write) operation.  The CR must:
  1. Match the format CHG followed by one or more digits.
  2. Be in "Implement" state in ServiceNow.

In production the state check queries the ServiceNow REST API over verified HTTPS.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

logger = logging.getLogger("gnmi-mcp.itsm")

# CR number pattern: CHG followed by digits
_CR_PATTERN = re.compile(r"CHG[0-9]+")


def validate_change_request(cr_number: str) -> dict[str, Any]:
    """Validate a ServiceNow Change Request number.

    Returns a dict with keys:
      - valid (bool): Whether the CR passed validation.
      - message (str): Explanation (always present).
      - cr_number (str): The CR number that was checked.
      - state (str | None): The CR state if retrieved.

    In lab mode (NETCLAW_LAB_MODE=true) format-only validation is performed
    without contacting ServiceNow.
    """
    # --- Format validation ---
    if not cr_number:
        return {
            "valid": False,
            "message": "Change request number is required for gNMI Set operations",
            "cr_number": cr_number,
            "state": None,
        }

    if not isinstance(cr_number, str) or not _CR_PATTERN.fullmatch(cr_number):
        return {
            "valid": False,
            "message": (
                f"Invalid CR format: '{cr_number}'. "
                "Expected format: CHG followed by digits (e.g. CHG0012345)"
            ),
            "cr_number": cr_number,
            "state": None,
        }

    # --- Lab mode bypass ---
    lab_mode = os.environ.get("NETCLAW_LAB_MODE", "false").lower() in ("true", "1", "yes")
    if lab_mode:
        logger.info("Lab mode: skipping ServiceNow state verification for %s", cr_number)
        return {
            "valid": True,
            "message": f"CR {cr_number} format valid (lab mode — ServiceNow check skipped)",
            "cr_number": cr_number,
            "state": "lab_mode",
        }

    # Production verification is mandatory. Missing service or errors deny writes.
    try:
        cr_state = _check_servicenow_cr_state(cr_number)
        if cr_state is None:
            # An unverified change never authorizes production work.
            logger.warning("Could not verify CR %s with ServiceNow", cr_number)
            return {
                "valid": False,
                "message": (
                    f"CR {cr_number} could not be verified. "
                    "ServiceNow verification unavailable — write blocked."
                ),
                "cr_number": cr_number,
                "state": "unverified",
            }

        if cr_state.lower() == "implement":
            return {
                "valid": True,
                "message": f"CR {cr_number} is in 'Implement' state — approved for changes",
                "cr_number": cr_number,
                "state": cr_state,
            }
        else:
            return {
                "valid": False,
                "message": (
                    f"CR {cr_number} is in '{cr_state}' state, not 'Implement'. "
                    "gNMI Set operations require the CR to be in 'Implement' state."
                ),
                "cr_number": cr_number,
                "state": cr_state,
            }

    except Exception as exc:
        logger.warning("ITSM verification error for %s: %s", cr_number, type(exc).__name__)
        return {
            "valid": False,
            "message": (
                f"CR {cr_number} could not be verified. "
                "ServiceNow verification encountered an error — write blocked."
            ),
            "cr_number": cr_number,
            "state": "error",
        }


def _check_servicenow_cr_state(cr_number: str) -> str | None:
    """Read the exact approved CR; no cached approval and no ServiceNow writes."""
    import httpx
    url = os.environ.get("SERVICENOW_INSTANCE_URL", "")
    username = os.environ.get("SERVICENOW_USERNAME")
    password = os.environ.get("SERVICENOW_PASSWORD")
    if not (url.startswith("https://") and username and password):
        return None
    response = httpx.get(url.rstrip("/") + "/api/now/table/change_request",
                        auth=(username, password), timeout=20,
                        params={"sysparm_query": "number=" + cr_number,
                                "sysparm_fields": "number,state,approval",
                                "sysparm_limit": 2}, follow_redirects=False)
    response.raise_for_status()
    rows = response.json().get("result", [])
    if not isinstance(rows, list) or len(rows) != 1 or rows[0].get("number") != cr_number:
        return None
    record = rows[0]
    if str(record.get("approval", "")).lower() != "approved":
        return "unapproved"
    state = str(record.get("state", "")).strip().lower()
    return "implement" if state in ("implement", "-1") else state
