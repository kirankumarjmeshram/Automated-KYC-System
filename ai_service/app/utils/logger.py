import logging
import sys

def setup_logger(name: str = "ai_service") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] [TraceID=%(traceId)s]: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger

class TraceAdapter(logging.LoggerAdapter):
    """Adds traceId context into Python log records automatically."""
    def process(self, msg, kwargs):
        trace_id = self.extra.get('trace_id', 'internal-trace') if self.extra else 'internal-trace'
        kwargs.setdefault('extra', {})['traceId'] = trace_id
        return msg, kwargs
