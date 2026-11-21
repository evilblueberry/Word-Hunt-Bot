import unittest

from device_connection import inspect_devices


class DeviceConnectionTests(unittest.TestCase):
    def payload(self, state='connected', paired='paired', mode='enabled'):
        return {'result': {'devices': [{
            'hardwareProperties': {'udid': '00008120-000C65C00CA2201E'},
            'connectionProperties': {'tunnelState': state, 'pairingState': paired},
            'deviceProperties': {'developerModeStatus': mode, 'osVersionNumber': '26.6.2'},
        }]}}

    def test_remembered_but_unavailable_device_is_not_connected(self):
        result = inspect_devices(self.payload(state='unavailable'), '00008120-000C65C00CA2201E')
        self.assertFalse(result['connected'])
        self.assertIn('USB data cable', result['message'])

    def test_connected_paired_developer_device_passes(self):
        result = inspect_devices(self.payload(), '00008120-000c65c00ca2201e')
        self.assertTrue(result['connected'])
        self.assertEqual(result['platform_version'], '26.6.2')

    def test_unpaired_or_developer_mode_disabled_is_actionable(self):
        for payload, text in [(self.payload(paired='unpaired'), 'Trust This Computer'),
                              (self.payload(mode='disabled'), 'Developer Mode')]:
            result = inspect_devices(payload, '00008120-000C65C00CA2201E')
            self.assertFalse(result['connected'])
            self.assertIn(text, result['message'])
