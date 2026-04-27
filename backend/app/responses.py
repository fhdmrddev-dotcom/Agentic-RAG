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
        if self._stop_event.is_set():
            raise StopAsyncIteration
        try:
            return await self._gen.__anext__()
        except StopAsyncIteration:
            raise
        except GeneratorExit:
            logger.info("SSE client disconnected (GeneratorExit)")
            await self.aclose()
            raise StopAsyncIteration
        except OSError:
            logger.info("SSE client disconnected (OSError)")
            await self.aclose()
            raise StopAsyncIteration
        except AssertionError as e:
            err = str(e).lower()
            if any(kw in err for kw in ("send", "close", "write")):
                logger.debug("SSE transport closed: %s", e)
                await self.aclose()
                raise StopAsyncIteration
            raise
        except RuntimeError as e:
            err = str(e).lower()
            if any(kw in err for kw in ("disconnect", "closed", "send")):
                logger.debug("SSE transport error in iterator: %s", e)
                await self.aclose()
                raise StopAsyncIteration
            raise


class SSEStreamingResponse(StreamingResponse):
    """StreamingResponse that suppresses ASGI transport errors on client disconnect.

    Two-part strategy:
    1. _safe_send wraps the ASGI send callable — catches OSError and transport
       errors, sets stop_event so the iterator stops producing new chunks.
    2. __call__ catches any remaining transport errors and aclose()'s the iterator
       in finally, so the underlying async generator is cancelled rather than
       orphaned (which would waste LLM API calls running to completion).

    We override __call__ to replace Starlette's task-group-based disconnect
    handling with direct error suppression, because Starlette's approach
    (anyio CancelScope) can leave the generator running after a disconnect.
    """

    async def __call__(self, scope, receive, send):
        closed = False

        async def _safe_send(event):
            nonlocal closed
            if closed:
                return
            try:
                await send(event)
            except OSError:
                closed = True
                stop_event.set()
                logger.info("SSE client disconnected (OSError)")
            except AssertionError as e:
                err = str(e).lower()
                if any(kw in err for kw in ("send", "close", "write")):
                    closed = True
                    stop_event.set()
                    logger.debug("SSE transport closed: %s", e)
                else:
                    raise
            except RuntimeError as e:
                err = str(e).lower()
                if any(kw in err for kw in ("disconnect", "closed", "send")):
                    closed = True
                    stop_event.set()
                    logger.debug("SSE runtime disconnect: %s", e)
                else:
                    raise

        # Reuse the pre-created stop_event from the iterator if available.
        # This ensures event_stream()'s stop_event parameter and the disconnect
        # event set by _safe_send are the SAME asyncio.Event instance.
        # If the iterator has no pre-created event, create one now.
        if isinstance(self.body_iterator, _SilentSSEIterator):
            stop_event = self.body_iterator._stop_event  # reuse — do NOT overwrite
        else:
            stop_event = asyncio.Event()

        try:
            await super().__call__(scope, receive, _safe_send)
        except OSError:
            stop_event.set()
            logger.info("SSE client disconnected (OSError in call)")
        except AssertionError as e:
            err = str(e).lower()
            if any(kw in err for kw in ("send", "close", "write")):
                stop_event.set()
                logger.debug("SSE transport closed: %s", e)
            else:
                raise
        except RuntimeError as e:
            err = str(e).lower()
            if any(kw in err for kw in ("disconnect", "closed", "send")):
                stop_event.set()
                logger.debug("SSE runtime disconnect: %s", e)
            else:
                raise
        finally:
            if hasattr(self.body_iterator, "aclose"):
                await self.body_iterator.aclose()


def sse_response(gen, media_type="text/event-stream", stop_event=None):
    """Create a StreamingResponse that silently handles SSE client disconnects.

    If stop_event is provided (pre-created by the route handler), it is passed
    to _SilentSSEIterator so that SSEStreamingResponse.__call__ can reuse the
    same event object rather than creating a new one. This ensures that
    event_stream()'s stop_event parameter and the disconnect-detection event
    are the SAME asyncio.Event instance.
    """
    return SSEStreamingResponse(_SilentSSEIterator(gen, stop_event), media_type=media_type)