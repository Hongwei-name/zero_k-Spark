from apps.desktop.store import ClientStore


def test_store_persists_targets_and_runs(tmp_path) -> None:
    store = ClientStore(tmp_path / "client.json")
    config = store.load()

    assert store.add_target(config, "001") is True
    store.update_target_enabled(config, "001", False)
    store.record_run(config, "ok", "saved")

    restored = store.load()
    assert restored["targets"] == [{"name": "001", "enabled": False, "last_sent_on": ""}]
    assert restored["runs"][0]["status"] == "ok"
