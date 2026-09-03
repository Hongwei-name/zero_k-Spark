"""Playwright adapter boundary for a manually authenticated browser session."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SendResult:
    recipient: str
    sent: bool
    detail: str


class DouyinClient:
    """Target-site adapter placeholder; keep selectors isolated in this class."""

    async def validate_session(self) -> bool:
        raise NotImplementedError("Implement site-specific session validation here.")

    async def send_message(self, recipient: str, message: str, *, dry_run: bool) -> SendResult:
        raise NotImplementedError("Implement site-specific conversation handling here.")
