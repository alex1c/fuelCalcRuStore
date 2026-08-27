#!/usr/bin/env python3
"""Quick ad smoke after native SDK rebuild."""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
try:
	sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
	pass

SERIAL = "emulator-5554"
PKG = "com.calculatorplatform.autojournal"
DEV_URL = "exp+auto-journal://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
OUT = Path(r"D:\petProject\fuelCalcRuStore")
DUMP = OUT / ".tmp-ad-ui.xml"


def adb(*args: str) -> subprocess.CompletedProcess[str]:
	return subprocess.run(
		["adb", "-s", SERIAL, *args],
		text=True,
		capture_output=True,
		encoding="utf-8",
		errors="replace",
	)


def texts() -> list[str]:
	adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
	adb("pull", "/sdcard/ui.xml", str(DUMP))
	raw = DUMP.read_text(encoding="utf-8", errors="replace")
	return sorted(set(re.findall(r'text="([^"]+)"', raw)))


def tap(label: str) -> bool:
	raw = DUMP.read_text(encoding="utf-8", errors="replace")
	for m in re.finditer(
		r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
		raw,
	):
		if label in m.group(1):
			x = (int(m.group(2)) + int(m.group(4))) // 2
			y = (int(m.group(3)) + int(m.group(5))) // 2
			adb("shell", "input", "tap", str(x), str(y))
			return True
	for m in re.finditer(
		r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="([^"]*)"',
		raw,
	):
		if label in m.group(5):
			x = (int(m.group(1)) + int(m.group(3))) // 2
			y = (int(m.group(2)) + int(m.group(4))) // 2
			adb("shell", "input", "tap", str(x), str(y))
			return True
	return False


def shot(name: str) -> None:
	remote = f"/sdcard/{name}.png"
	adb("shell", "screencap", "-p", remote)
	adb("pull", remote, str(OUT / f".tmp-{name}.png"))


def main() -> int:
	adb("reverse", "tcp:8081", "tcp:8081")
	adb("shell", "am", "force-stop", PKG)
	time.sleep(1)
	adb("logcat", "-c")
	adb(
		"shell",
		"am",
		"start",
		"-n",
		f"{PKG}/.MainActivity",
		"-a",
		"android.intent.action.VIEW",
		"-d",
		DEV_URL,
	)
	time.sleep(18)
	adb("shell", "input", "keyevent", "4")
	time.sleep(1)

	home = texts()
	print(
		"HOME",
		[
			t
			for t in home
			if any(k in t for k in ("Заправ", "расход", "л/100", "Toyota", "Стат"))
		][:15],
	)
	shot("p5-ad-home")

	# Banner may take a moment with demo units; layout must stay usable either way.
	time.sleep(4)
	home2 = texts()
	print("HOME_AFTER_WAIT usable=", any("+ Заправка" in t for t in home2))

	tap("Стат.") or tap("Статистика")
	time.sleep(4)
	stats = texts()
	print("STATS", stats[:30])
	shot("p5-ad-stats")

	# Interstitial may be policy-skipped (<3 sessions); must not ANR / blank forever.
	anr = "Application Not Responding" in " ".join(stats)
	print("stats_anr", anr)

	log = adb("logcat", "-d", "-t", "300").stdout
	hits = [
		ln
		for ln in log.splitlines()
		if re.search(r"yandex|Yandex|MobileAds|BannerView|Interstitial|AppMetrica", ln, re.I)
	]
	print("AD_LOG_HITS", len(hits))
	for ln in hits[:20]:
		print(ln[:220])

	print("AD_SMOKE_OK" if not anr else "AD_SMOKE_FAIL")
	return 0 if not anr else 1


if __name__ == "__main__":
	raise SystemExit(main())
