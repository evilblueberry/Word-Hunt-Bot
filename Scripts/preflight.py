#!/usr/bin/env python3
"""Actionable local preflight for the Word Hunt bot configuration."""

import argparse
import json
import platform
import shutil
import subprocess

from config_validation import detect_certificate_team_ids, validate_config


def command(*args: str) -> tuple[bool, str]:
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=False)
        return result.returncode == 0, (result.stdout + result.stderr).strip()
    except OSError as error:
        return False, str(error)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--team-id', required=True)
    parser.add_argument('--signing-id', default='Apple Development')
    parser.add_argument('--udid', required=True)
    parser.add_argument('--wda-bundle-id', required=True)
    args = parser.parse_args()

    detected_team_ids = detect_certificate_team_ids()
    config_errors = validate_config(
        team_id=args.team_id,
        signing_id=args.signing_id,
        udid=args.udid,
        wda_bundle_id=args.wda_bundle_id,
    )
    if args.team_id not in detected_team_ids:
        config_errors.append(
            f"Entered Team ID {args.team_id} does not match any Apple Development certificate OU. Detected: {', '.join(detected_team_ids) or '(none)'}."
        )
    checks: dict[str, object] = {
        'platform': platform.platform(),
        'config_errors': config_errors,
        'detected_certificate_team_ids': detected_team_ids,
    }
    for name, cmd in {
        'xcode_select': ('xcode-select', '-p'),
        'xcodebuild': ('xcodebuild', '-version'),
        'xctrace_devices': ('xcrun', 'xctrace', 'list', 'devices'),
        'devicectl_devices': ('xcrun', 'devicectl', 'list', 'devices'),
        'signing_identities': ('security', 'find-identity', '-v', '-p', 'codesigning'),
    }.items():
        ok, output = command(*cmd)
        checks[name] = {'ok': ok, 'output': output}
    checks['appium'] = shutil.which('appium') or 'not found on PATH (launcher uses its isolated runtime)'

    print(json.dumps(checks, indent=2))
    return 1 if checks['config_errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
