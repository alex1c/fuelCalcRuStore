#!/usr/bin/env python3
"""Finish an already-open DocumentPicker restore for Phase 5 preseed."""

from __future__ import annotations

import importlib.util
import sys
import time
from pathlib import Path

ROOT = Path(r"D:\petProject\fuelCalcRuStore")
spec = importlib.util.spec_from_file_location(
	"smoke", ROOT / "scripts" / "android-p5-restore-smoke.py"
)
s = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(s)


def main() -> int:
	print("picker texts:", s.texts()[:40])
	s.shot("p5-preseed-picker")

	# Prefer the older 12:55 backup (known-good baseline with 2 fuels / 4.17).
	# Grid tiles truncate names; tap by content or approximate left/right.
	picked = False
	for fragment in (
		"1255",
		"12:55",
		"auto-journal-backup-2026-08-27-1255",
		"auto-journal-backup",
		".json",
	):
		if s.has(fragment):
			s.tap_text(fragment, contains=True, wait=2.0)
			picked = True
			break
	if not picked:
		# Left tile is usually the newer 13:46; right is 12:55 in current grid.
		# Prefer right tile (12:55) for known-good seed.
		print("TAP grid right tile for 12:55 backup")
		s.tap_xy(810, 900, wait=2.0)

	time.sleep(2.5)
	s.shot("p5-preseed-preview")
	preview_texts = s.texts()
	print("preview:", preview_texts[:50])
	if not any("Автомобилей" in t or "Заправок" in t for t in preview_texts):
		# Maybe still on picker — try left tile once
		print("no preview yet; trying left tile")
		s.tap_xy(270, 900, wait=2.5)
		s.shot("p5-preseed-preview2")
		preview_texts = s.texts()
		print("preview2:", preview_texts[:50])

	if not s.tap_text_optional("Восстановить"):
		raise RuntimeError(f"confirm missing; ui={preview_texts[:40]}")
	time.sleep(3.5)
	s.shot("p5-preseed-done")
	s.tap_text_optional("ОК") or s.tap_text_optional("OK") or s.tap_text_optional("Готово")
	time.sleep(1.0)

	m = s.capture_metrics("preseed")
	print(
		"METRICS",
		{
			"vehicle": m.get("vehicle"),
			"has_417": m.get("has_417"),
			"has_4250": m.get("has_4250"),
			"has_9400": m.get("has_9400"),
			"fuel_entry_count_hint": m.get("fuel_entry_count_hint"),
			"home_sample": m.get("home_sample", [])[:20],
		},
	)
	return 0 if m.get("has_417") and m.get("vehicle") else 1


if __name__ == "__main__":
	try:
		sys.exit(main())
	except Exception as exc:  # noqa: BLE001
		print("FAIL:", exc)
		try:
			s.shot("p5-preseed-fail")
			print("texts:", s.texts()[:60])
		except Exception:
			pass
		sys.exit(1)
