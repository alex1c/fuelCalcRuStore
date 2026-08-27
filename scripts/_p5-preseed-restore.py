#!/usr/bin/env python3
"""Preseed: restore a Downloads JSON backup via production DocumentPicker UI."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(r"D:\petProject\fuelCalcRuStore")
FILENAME = sys.argv[1] if len(sys.argv) > 1 else "auto-journal-backup-2026-08-27-1406.json"

spec = importlib.util.spec_from_file_location(
	"smoke", ROOT / "scripts" / "android-p5-restore-smoke.py"
)
s = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(s)


def main() -> int:
	s.ensure_reverse()
	s.launch_app()
	s.wait_app_ready()
	preview = s.restore_from_downloads(FILENAME)
	print("PREVIEW", preview)
	m = s.capture_metrics("preseed")
	print(
		"METRICS",
		{
			k: m.get(k)
			for k in (
				"vehicle",
				"has_417",
				"has_4250",
				"has_9400",
				"fuel_entry_count_hint",
			)
		},
	)
	ok = bool(m.get("has_417") and m.get("vehicle"))
	print("PRESEED", "OK" if ok else "BAD")
	return 0 if ok else 1


if __name__ == "__main__":
	try:
		raise SystemExit(main())
	except Exception as exc:  # noqa: BLE001
		print("FAIL:", exc)
		try:
			s.shot("p5-preseed-fail")
			print("texts:", s.texts()[:60])
		except Exception:
			pass
		raise SystemExit(1)
