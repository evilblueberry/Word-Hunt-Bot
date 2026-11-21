import unittest

from config_validation import detect_certificate_team_ids, validate_config


class ConfigValidationTests(unittest.TestCase):
    def test_valid_configuration(self):
        self.assertEqual(
            validate_config(
                team_id="287MYRCJ37",
                signing_id="Apple Development",
                udid="00008120-000C12345678901E",
                wda_bundle_id="com.malcolm.wordhuntbot.wda",
            ),
            [],
        )

    def test_bad_values_are_specific(self):
        errors = validate_config(
            team_id="bad-team",
            signing_id="3285Q523PM",
            udid="1234",
            wda_bundle_id="not a bundle",
        )
        self.assertTrue(any("Team ID" in error for error in errors))
        self.assertTrue(any("certificate suffix" in error for error in errors))
        self.assertTrue(any("complete" in error for error in errors))
        self.assertTrue(any("reverse-DNS" in error for error in errors))

    def test_certificate_suffix_is_not_accepted_as_team_id(self):
        errors = validate_config(
            team_id="3285Q523PM",
            signing_id="Apple Development",
            udid="00008120-000C12345678901E",
            wda_bundle_id="com.malcolm.wordhuntbot.wda",
        )
        self.assertTrue(any("certificate identifier" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
