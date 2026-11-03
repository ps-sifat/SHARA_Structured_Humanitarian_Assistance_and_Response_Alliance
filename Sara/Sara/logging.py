import logging
import re


class SensitiveURLFilter(logging.Filter):
    def filter(self, record):
        def redact(value):
            return re.sub(r'([?&](?:token|uid|tracking_code)=)[^&\s"]*', r'\1[redacted]', value) if isinstance(value,str) else value
        record.msg = redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(redact(value) for value in record.args)
        return True
