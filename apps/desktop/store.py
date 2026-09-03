"""Persistent local state for the desktop companion."""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


DEFAULT_CONFIG: dict[str, Any] = {
    "schema_version": 1,
    "settings": {
        "enabled": False,
        "dry_run": True,
        "send_window_start": "08:00",
        "send_window_end": "10:00",
        "minimum_interval_seconds": 8,
        "maximum_interval_seconds": 25,
    },
    "templates": ["你好，[好友昵称]，今天也顺利。"],
    "targets": [],
    "runs": [],
}


@dataclass(frozen=True)
class Target:
    name: str
    enabled: bool = True
    last_sent_on: str = ""


class ClientStore:
    """Small JSON store with atomic writes so the client needs no server."""

    def __init__(self, path: Path) -> None:
        self.path = path

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return deepcopy(DEFAULT_CONFIG)
        try:
            stored = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return deepcopy(DEFAULT_CONFIG)
        return self._normalize(stored)

    def save(self, config: dict[str, Any]) -> None:
        normalized = self._normalize(config)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)

    def add_target(self, config: dict[str, Any], name: str) -> bool:
        normalized_name = name.strip()
        if not normalized_name or any(target["name"] == normalized_name for target in config["targets"]):
            return False
        config["targets"].append({"name": normalized_name, "enabled": True, "last_sent_on": ""})
        self.save(config)
        return True

    def update_target_enabled(self, config: dict[str, Any], name: str, enabled: bool) -> None:
        for target in config["targets"]:
            if target["name"] == name:
                target["enabled"] = enabled
                self.save(config)
                return

    def remove_target(self, config: dict[str, Any], names: set[str]) -> None:
        config["targets"] = [target for target in config["targets"] if target["name"] not in names]
        self.save(config)

    def record_run(self, config: dict[str, Any], status: str, detail: str) -> None:
        config["runs"] = [{
            "at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": status,
            "detail": detail,
        }, *config["runs"]][:100]
        self.save(config)

    @staticmethod
    def _normalize(raw: Any) -> dict[str, Any]:
        config = deepcopy(DEFAULT_CONFIG)
        if not isinstance(raw, dict):
            return config
        if isinstance(raw.get("settings"), dict):
            config["settings"].update({key: value for key, value in raw["settings"].items() if key in config["settings"]})
        if isinstance(raw.get("templates"), list):
            config["templates"] = [str(template).strip() for template in raw["templates"] if str(template).strip()] or config["templates"]
        if isinstance(raw.get("targets"), list):
            config["targets"] = [
                {
                    "name": str(target.get("name", "")).strip(),
                    "enabled": bool(target.get("enabled", True)),
                    "last_sent_on": str(target.get("last_sent_on", "")),
                }
                for target in raw["targets"]
                if isinstance(target, dict) and str(target.get("name", "")).strip()
            ]
        if isinstance(raw.get("runs"), list):
            config["runs"] = [run for run in raw["runs"] if isinstance(run, dict)][:100]
        return config
