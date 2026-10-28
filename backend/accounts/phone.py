import re
import unicodedata

from django.core.exceptions import ValidationError


def normalize_bd_phone(value):
    raw_value = value.strip()
    if (
        not raw_value
        or raw_value.count("+") > 1
        or ("+" in raw_value and not raw_value.startswith("+"))
        or any(not character.isdigit() and character not in "+-(). \t" for character in raw_value)
    ):
        raise ValidationError("Enter a valid Bangladesh mobile number.")
    digits = "".join(
        str(unicodedata.digit(character)) if character.isdigit() else character
        for character in raw_value
    )
    digits = "".join(character for character in digits if character.isdecimal())
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("01"):
        digits = "880" + digits[1:]
    if len(digits) == 13 and digits.startswith("8801"):
        normalized = "+" + digits
    else:
        normalized = digits
    if not re.fullmatch(r"\+8801[3-9]\d{8}", normalized):
        raise ValidationError("Enter a valid Bangladesh mobile number.")
    return normalized
