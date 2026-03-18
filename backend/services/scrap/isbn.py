import re

def normalize_isbn(raw: str) -> str:
    cleaned = re.sub(r"[\s\-]", "", raw.strip()).upper()
    return cleaned

def _check_isbn13(digits: str) -> bool:
    if len(digits) != 13 or not digits.isdigit():
        return False
    total = sum(
        int(d) * (1 if i % 2 == 0 else 3)
        for i, d in enumerate(digits)
    )
    return total % 10 == 0

def _check_isbn10(digits: str) -> bool:
    if len(digits) != 10:
        return False
    if not digits[:9].isdigit():
        return False
    if digits[9] not in "0123456789X":
        return False
    total = sum(
        (10 if c == "X" else int(c)) * (10 - i)
        for i, c in enumerate(digits)
    )
    return total % 11 == 0

def validate_isbn(raw: str) -> bool:
    normalized = normalize_isbn(raw)
    if len(normalized) == 13:
        return _check_isbn13(normalized)
    if len(normalized) == 10:
        return _check_isbn10(normalized)
    return False
