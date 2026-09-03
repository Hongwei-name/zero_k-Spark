"""Local Windows desktop companion for zero_k-Spark."""

from __future__ import annotations

import argparse
import os
import sys
import webbrowser
from pathlib import Path
from tkinter import BooleanVar, StringVar, Tk, messagebox, simpledialog, ttk
from tkinter.scrolledtext import ScrolledText

from apps.desktop.store import ClientStore


ROOT = Path(__file__).resolve().parents[2]


def client_store_path() -> Path:
    """Keep installed EXE configuration out of its potentially read-only folder."""
    if getattr(sys, "frozen", False):
        local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home()))
        return local_app_data / "zero_k-Spark" / "spark-client.json"
    return ROOT / "data" / "spark-client.json"


class SparkDesktopApp:
    def __init__(self, root: Tk, store: ClientStore) -> None:
        self.root = root
        self.store = store
        self.config = self.store.load()
        self.root.title("Spark Helper Client")
        self.root.geometry("920x640")
        self.root.minsize(780, 540)

        self.enabled = BooleanVar(value=self.config["settings"]["enabled"])
        self.dry_run = BooleanVar(value=self.config["settings"]["dry_run"])
        self.window_start = StringVar(value=self.config["settings"]["send_window_start"])
        self.window_end = StringVar(value=self.config["settings"]["send_window_end"])
        self.interval_min = StringVar(value=str(self.config["settings"]["minimum_interval_seconds"]))
        self.interval_max = StringVar(value=str(self.config["settings"]["maximum_interval_seconds"]))
        self.status = StringVar(value="本地配置已加载")

        self._configure_style()
        self._build()
        self.refresh()

    def _configure_style(self) -> None:
        style = ttk.Style(self.root)
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure("Header.TLabel", font=("Segoe UI", 16, "bold"))
        style.configure("Muted.TLabel", foreground="#5b6472")
        style.configure("Status.TLabel", padding=(12, 8))

    def _build(self) -> None:
        outer = ttk.Frame(self.root, padding=16)
        outer.pack(fill="both", expand=True)

        header = ttk.Frame(outer)
        header.pack(fill="x", pady=(0, 12))
        ttk.Label(header, text="Spark Helper", style="Header.TLabel").pack(side="left")
        ttk.Label(header, text="本地客户端", style="Muted.TLabel").pack(side="left", padx=(10, 0), pady=(5, 0))
        ttk.Button(header, text="打开抖音", command=lambda: webbrowser.open("https://www.douyin.com/jingxuan")).pack(side="right")

        notebook = ttk.Notebook(outer)
        notebook.pack(fill="both", expand=True)
        self.overview_tab = ttk.Frame(notebook, padding=16)
        self.targets_tab = ttk.Frame(notebook, padding=16)
        self.content_tab = ttk.Frame(notebook, padding=16)
        self.schedule_tab = ttk.Frame(notebook, padding=16)
        self.history_tab = ttk.Frame(notebook, padding=16)
        notebook.add(self.overview_tab, text="概览")
        notebook.add(self.targets_tab, text="好友")
        notebook.add(self.content_tab, text="文案")
        notebook.add(self.schedule_tab, text="定时")
        notebook.add(self.history_tab, text="记录")

        self._build_overview()
        self._build_targets()
        self._build_content()
        self._build_schedule()
        self._build_history()
        ttk.Label(outer, textvariable=self.status, style="Status.TLabel", anchor="w").pack(fill="x", pady=(10, 0))

    def _build_overview(self) -> None:
        frame = self.overview_tab
        self.overview_summary = ttk.Label(frame, justify="left", font=("Segoe UI", 12))
        self.overview_summary.pack(anchor="w")
        controls = ttk.Frame(frame)
        controls.pack(anchor="w", pady=(20, 0))
        ttk.Checkbutton(controls, text="启用任务", variable=self.enabled, command=self.save_settings).grid(row=0, column=0, sticky="w")
        ttk.Checkbutton(controls, text="Dry Run（只验证，不发送）", variable=self.dry_run, command=self.save_settings).grid(row=1, column=0, sticky="w", pady=(8, 0))
        ttk.Button(controls, text="记录一次本地验证", command=self.record_local_verification).grid(row=2, column=0, sticky="w", pady=(20, 0))
        ttk.Label(frame, text="实际发送由已安装的油猴脚本在抖音页面内执行。客户端保存配置和执行记录，不直接绕过浏览器登录态。", style="Muted.TLabel", wraplength=680, justify="left").pack(anchor="w", pady=(24, 0))

    def _build_targets(self) -> None:
        bar = ttk.Frame(self.targets_tab)
        bar.pack(fill="x", pady=(0, 8))
        ttk.Button(bar, text="添加好友", command=self.add_target).pack(side="left")
        ttk.Button(bar, text="启用 / 停用", command=self.toggle_target).pack(side="left", padx=8)
        ttk.Button(bar, text="删除", command=self.remove_targets).pack(side="left")
        self.target_tree = ttk.Treeview(self.targets_tab, columns=("name", "enabled", "last"), show="headings", selectmode="extended")
        self.target_tree.heading("name", text="好友昵称或备注")
        self.target_tree.heading("enabled", text="任务")
        self.target_tree.heading("last", text="最近发送")
        self.target_tree.column("name", width=380)
        self.target_tree.column("enabled", width=110, anchor="center")
        self.target_tree.column("last", width=180, anchor="center")
        self.target_tree.pack(fill="both", expand=True)

    def _build_content(self) -> None:
        ttk.Label(self.content_tab, text="每行一条文案，油猴脚本可从中随机选择。支持 [日期]、[天数]、[好友昵称]。", style="Muted.TLabel").pack(anchor="w", pady=(0, 8))
        self.template_text = ScrolledText(self.content_tab, height=17, font=("Consolas", 11), wrap="word")
        self.template_text.pack(fill="both", expand=True)
        buttons = ttk.Frame(self.content_tab)
        buttons.pack(fill="x", pady=(10, 0))
        ttk.Button(buttons, text="保存文案", command=self.save_templates).pack(side="left")

    def _build_schedule(self) -> None:
        grid = ttk.Frame(self.schedule_tab)
        grid.pack(anchor="nw")
        fields = [
            ("发送窗口开始", self.window_start),
            ("发送窗口结束", self.window_end),
            ("好友最小间隔（秒）", self.interval_min),
            ("好友最大间隔（秒）", self.interval_max),
        ]
        for row, (label, variable) in enumerate(fields):
            ttk.Label(grid, text=label).grid(row=row, column=0, sticky="w", padx=(0, 16), pady=8)
            ttk.Entry(grid, textvariable=variable, width=16).grid(row=row, column=1, sticky="w", pady=8)
        ttk.Button(grid, text="保存定时设置", command=self.save_settings).grid(row=len(fields), column=1, sticky="e", pady=(16, 0))

    def _build_history(self) -> None:
        self.history_tree = ttk.Treeview(self.history_tab, columns=("at", "status", "detail"), show="headings")
        self.history_tree.heading("at", text="时间")
        self.history_tree.heading("status", text="状态")
        self.history_tree.heading("detail", text="详情")
        self.history_tree.column("at", width=170)
        self.history_tree.column("status", width=100, anchor="center")
        self.history_tree.column("detail", width=540)
        self.history_tree.pack(fill="both", expand=True)

    def refresh(self) -> None:
        self._refresh_overview()
        self._refresh_targets()
        self._refresh_templates()
        self._refresh_history()

    def _refresh_overview(self) -> None:
        enabled_targets = sum(1 for target in self.config["targets"] if target["enabled"])
        mode = "验证模式" if self.config["settings"]["dry_run"] else "发送模式"
        state = "已启用" if self.config["settings"]["enabled"] else "未启用"
        self.overview_summary.configure(text=(
            f"任务状态：{state}\n"
            f"执行模式：{mode}\n"
            f"已启用好友：{enabled_targets}\n"
            f"发送窗口：{self.config['settings']['send_window_start']} - {self.config['settings']['send_window_end']}"
        ))

    def _refresh_targets(self) -> None:
        self.target_tree.delete(*self.target_tree.get_children())
        for target in self.config["targets"]:
            self.target_tree.insert("", "end", iid=target["name"], values=(target["name"], "启用" if target["enabled"] else "停用", target["last_sent_on"] or "从未"))

    def _refresh_templates(self) -> None:
        self.template_text.delete("1.0", "end")
        self.template_text.insert("1.0", "\n".join(self.config["templates"]))

    def _refresh_history(self) -> None:
        self.history_tree.delete(*self.history_tree.get_children())
        for run in self.config["runs"]:
            self.history_tree.insert("", "end", values=(run.get("at", ""), run.get("status", ""), run.get("detail", "")))

    def save_settings(self) -> None:
        try:
            minimum = int(self.interval_min.get())
            maximum = int(self.interval_max.get())
            if minimum < 0 or maximum < minimum:
                raise ValueError
        except ValueError:
            messagebox.showerror("设置无效", "发送间隔必须是非负整数，且最大值不能小于最小值。")
            return
        settings = self.config["settings"]
        settings.update({
            "enabled": self.enabled.get(),
            "dry_run": self.dry_run.get(),
            "send_window_start": self.window_start.get().strip(),
            "send_window_end": self.window_end.get().strip(),
            "minimum_interval_seconds": minimum,
            "maximum_interval_seconds": maximum,
        })
        self.store.save(self.config)
        self.status.set("定时与任务设置已保存")
        self._refresh_overview()

    def save_templates(self) -> None:
        templates = [line.strip() for line in self.template_text.get("1.0", "end").splitlines() if line.strip()]
        if not templates:
            messagebox.showerror("文案为空", "至少保留一条消息文案。")
            return
        self.config["templates"] = templates
        self.store.save(self.config)
        self.status.set(f"已保存 {len(templates)} 条文案")

    def add_target(self) -> None:
        name = simpledialog.askstring("添加好友", "输入好友昵称或备注名：", parent=self.root)
        if name is None:
            return
        if not self.store.add_target(self.config, name):
            messagebox.showwarning("未添加", "名称为空或已存在。")
            return
        self.status.set(f"已添加 {name.strip()}")
        self.refresh()

    def toggle_target(self) -> None:
        selected = self.target_tree.selection()
        if not selected:
            return
        for name in selected:
            current = next(target for target in self.config["targets"] if target["name"] == name)
            self.store.update_target_enabled(self.config, name, not current["enabled"])
        self.status.set("好友任务状态已更新")
        self.refresh()

    def remove_targets(self) -> None:
        selected = set(self.target_tree.selection())
        if not selected or not messagebox.askyesno("删除好友", f"删除已选中的 {len(selected)} 位好友？", parent=self.root):
            return
        self.store.remove_target(self.config, selected)
        self.status.set("已删除好友配置")
        self.refresh()

    def record_local_verification(self) -> None:
        enabled_targets = sum(1 for target in self.config["targets"] if target["enabled"])
        mode = "Dry Run" if self.dry_run.get() else "发送模式待油猴页面执行"
        self.store.record_run(self.config, "已记录", f"{mode}；已启用好友 {enabled_targets} 位。")
        self.status.set("已添加本地验证记录")
        self._refresh_history()


def main() -> None:
    parser = argparse.ArgumentParser(description="Spark Helper desktop companion")
    parser.add_argument("--smoke-test", action="store_true", help="validate persistent storage without opening the UI")
    arguments = parser.parse_args()
    store = ClientStore(client_store_path())
    if arguments.smoke_test:
        config = store.load()
        assert isinstance(config["targets"], list)
        print("Desktop client storage is available.")
        return
    root = Tk()
    SparkDesktopApp(root, store)
    root.mainloop()


if __name__ == "__main__":
    main()
