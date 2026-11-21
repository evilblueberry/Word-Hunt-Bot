"""Check live CoreDevice connectivity, not merely a remembered device name."""
import argparse
import json
import subprocess


def inspect_devices(payload, udid):
    for device in payload.get('result', {}).get('devices', []):
        if device.get('hardwareProperties', {}).get('udid', '').lower() != udid.lower():
            continue
        connection = device.get('connectionProperties', {})
        properties = device.get('deviceProperties', {})
        state = connection.get('tunnelState', 'unknown')
        result = {'connected': False, 'state': state, 'platform_version': properties.get('osVersionNumber')}
        if state != 'connected':
            result['message'] = (
                f'iPhone {udid} is remembered by Xcode but currently {state}. '
                'Reconnect with a USB data cable, unlock the iPhone, approve Trust/Allow Accessory prompts, '
                'and confirm it appears in Finder before retrying. A charging connection alone is insufficient.'
            )
        elif connection.get('pairingState') != 'paired':
            result['message'] = 'The iPhone is connected but not paired. Approve Trust This Computer on the iPhone and in Finder.'
        elif properties.get('developerModeStatus') != 'enabled':
            result['message'] = 'Enable Developer Mode in iPhone Settings → Privacy & Security, then restart and unlock it.'
        else:
            result.update(connected=True, message='iPhone connected, paired, and Developer Mode enabled.')
        return result
    return {'connected': False, 'state': 'not_found', 'message': f'iPhone {udid} is not listed by Xcode. Connect and unlock it over USB.'}


def probe_device(udid):
    try:
        response = subprocess.run(['xcrun', 'devicectl', 'list', 'devices', '--json-output', '-'],
                                  capture_output=True, text=True, timeout=15, check=False)
        if response.returncode:
            raise RuntimeError((response.stderr or response.stdout).strip())
        return inspect_devices(json.loads(response.stdout), udid)
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
        return {'connected': False, 'state': 'check_failed', 'message': f'Cannot verify iPhone connectivity: {error}'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--udid', required=True)
    args = parser.parse_args()
    result = probe_device(args.udid)
    print(json.dumps(result))
    raise SystemExit(0 if result['connected'] else 2)
