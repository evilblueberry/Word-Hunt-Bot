"""Validation shared by preflight tooling and tests."""

import re
import subprocess


TEAM_ID_RE = re.compile(r"^[A-Z0-9]{10}$")
UDID_RE = re.compile(r"^(?:[0-9a-f]{8}-[0-9a-f]{16}|[0-9a-f]{24,40})$", re.IGNORECASE)
BUNDLE_ID_RE = re.compile(r"^[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)+$")


def validate_config(*, team_id: str, signing_id: str, udid: str, wda_bundle_id: str) -> list[str]:
    errors: list[str] = []
    team_id = team_id.strip()
    signing_id = signing_id.strip()
    udid = udid.strip()
    wda_bundle_id = wda_bundle_id.strip()

    if not TEAM_ID_RE.fullmatch(team_id):
        errors.append("Apple Team ID must be the 10-character alphanumeric Team ID, not an email or certificate suffix.")
    elif team_id == "3285Q523PM":
        errors.append("3285Q523PM is the certificate identifier (CN suffix), not the Team ID. Use the certificate OU Team ID.")
    if not signing_id:
        errors.append("Xcode signing ID is required; use the certificate common name, usually 'Apple Development'.")
    elif re.fullmatch(r"[A-Z0-9]{8,12}", signing_id, re.IGNORECASE) and signing_id.lower() != "apple development":
        errors.append("Xcode signing ID looks like a certificate suffix/Team ID; use the certificate name 'Apple Development'.")
    if not UDID_RE.fullmatch(udid):
        errors.append("Device UDID must be a complete 24-40 character hex UDID (hyphenated UDIDs are accepted).")
    if not BUNDLE_ID_RE.fullmatch(wda_bundle_id):
        errors.append("Updated WDA bundle ID must be a reverse-DNS identifier such as com.example.wordhuntbot.wda.")
    elif wda_bundle_id == "com.apple.WebDriverAgentRunner.xctrunner":
        errors.append("Updated WDA bundle ID must be unique; do not use Apple's default WDA bundle ID.")
    return errors


def detect_certificate_team_ids() -> list[str]:
    """Read Team IDs from OU fields of installed Apple Development certificates."""
    try:
        result = subprocess.run(
            ["security", "find-certificate", "-a", "-c", "Apple Development", "-p"],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return []
    team_ids: list[str] = []
    for pem in re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", result.stdout, re.DOTALL):
        parsed = subprocess.run(
            ["openssl", "x509", "-noout", "-subject", "-enddate"],
            input=pem,
            capture_output=True,
            text=True,
            check=False,
        )
        for team_id in re.findall(r"OU=([A-Z0-9]{10})", parsed.stdout):
            if team_id not in team_ids:
                team_ids.append(team_id)
    return team_ids
