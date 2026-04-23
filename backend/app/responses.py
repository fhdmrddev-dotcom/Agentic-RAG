import asyncio
import logging
from starlette.responses import StreamingResponse

logger = logging.getLogger(__name__)


class _SilentSSEIterator:
    """Wraps an async generator to suppress transport errors when SSE clients disconnect.

    On disconnect, stops iteration immediately by raising StopAsyncIteration.
    The shared stop_event lets SSEStreamingResponse signal the iterator from the
    send side — without this, Starlette would keep iterating the entire generator
    even after the client disconnected, wasting LLM API calls.
    """

    def __init__(self, gen, stop_event=None):
        self._gen = gen
        self._closed = False
        self._stop_event = stop_event or asyncio.Event()

    def __aiter__(self):
        return self

    async def aclose(self):
        if self._closed:
            return
        self._closed = True
        if hasattr(self._gen, "aclose"):
            try:
                await self._gen.aclose()
            except Exception:
                pass

    async def __anext__(self):
        # If the client already disconnected (signaled via stop_event), stop immediately
        if self._stop_event.is_set():
            raise StopAsyncIteration
        try:
            return await self._gen.__anext__()
        except StopAsyncIteration:
            raise
        except GeneratorExit:
            logger.info("SSE client disconnected")
            await self.aclose()
            raise StopAsyncIteration
        except (ConnectionResetError, BrokenPipeError):
            logger.info("SSE client disconnected during send")
            await self.aclose()
            raise StopAsyncIteration
        except AssertionError as e:
            err = str(e).lower()
            if any(kw in err for kw in ("send", "close", "write")):
                logger.debug("SSE transport closed: %s", e)
                await self.aclose()
                raise StopAsyncIteration
            raise


class SSEStreamingResponse(StreamingResponse):
    """StreamingResponse that suppresses ASGI transport errors on client disconnect.

    Two-part strategy:
    1. _safe_send wraps the ASGI send callable — catches transport errors and sets
       stop_event so the iterator stops producing new chunks immediately.
    2. __call__ catches any remaining transport errors and aclose()'s the iterator
       in finally, so the underlying async generator is cancelled rather than
       orphaned (which would waste LLM API calls running to completion).
    """

    async def __call__(self, scope, receive, send):
        closed = False
        stop_event = asyncio.Event()

        async def _safe_send(event):
            nonlocal closed
            if closed:
                return
            try:
                await send(event)
            except (ConnectionResetError, BrokenPipeError):
                closed = True
                stop_event.set()
                logger.info("SSE client disconnected during write")
            except AssertionError as e:
                err = str(e).lower()
                if any(kw in err for kw in ("send", "close", "write")):
                    closed = True
                    stop_event.set()
                    logger.debug("SSE transport closed: %s", e)
                else:
                    raise

        # Wire the stop_event into the iterator so __anext__ checks it
        if isinstance(self.body_iterator, _SilentSSEIterator):
            self.body_iterator._stop_event = stop_event

        try:
            await super().__call__(scope, receive, _safe_send)
        except (ConnectionResetError, BrokenPipeError):
            stop_event.set()
            logger.info("SSE client disconnected")
        except AssertionError as e:
            err = str(e).lower()
            if any(kw in err for kw in ("send", "close", "write")):
                stop_event.set()
                logger.debug("SSE transport closed: %s", e)
            else:
                raise
        finally:
            if hasattr(self.body_iterator, "aclose"):
                await self.body_iterator.aclose()


def sse_response(gen, media_type="text/event-stream"):
    """Create a StreamingResponse that silently handles SSE client disconnects."""
    return SSEStreamingResponse(_SilentSSEIterator(gen), media_type=media_type)