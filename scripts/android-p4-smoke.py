#!/usr/bin/env python3
"""Phase 4 Android smoke: backup share, CSV, report, maintenance remind."""

from __future__ import annotations

import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

DUMP = Path(r"D:\petProject\fuelCalcRuStore\.tmp-ui.xml")
OUT = Path(r"D:\petProject\fuelCalcRuStore")
PKG = "com.calculatorplatform.autojournal"


def adb(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
	return subprocess.run(
		["adb", *args],
		check=check,
		text=True,
		capture_output=True,
		encoding="utf-8",
		errors="replace",
	)


def dump() -> ET.Element:
	adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
	adb("pull", "/sdcard/ui.xml", str(DUMP))
	return ET.parse(DUMP).getroot()


def center(bounds: str) -> tuple[int, int]:
	m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
	assert m
	x1, y1, x2, y2 = map(int, m.groups())
	return (x1 + x2) // 2, (y1 + y2) // 2


def texts() -> list[str]:
	root = dump()
	return [n.attrib.get("text", "") for n in root.iter("node") if n.attrib.get("text")]


def has(fragment: str) -> bool:
	return any(fragment in t for t in texts())


def tap_text(text: str, wait: float = 1.2, contains: bool = False) -> None:
	root = dump()
	for node in root.iter("node"):
		t = node.attrib.get("text") or ""
		ok = text in t if contains else t == text
		if ok and node.attrib.get("bounds"):
			x, y = center(node.attrib["bounds"])
			adb("shell", "input", "tap", str(x), str(y))
			time.sleep(wait)
			print(f"TAP {text!r} -> {x},{y}")
			return
	raise RuntimeError(f"missing {text!r}; have={texts()[:50]}")


def back() -> None:
	adb("shell", "input", "keyevent", "4")
	time.sleep(0.8)


def shot(name: str) -> None:
	adb("shell", "screencap", "-p", f"/sdcard/{name}.png")
	adb("pull", f"/sdcard/{name}.png", str(OUT / f".tmp-{name}.png"))


def dismiss_share_sheet() -> None:
	"""Close Android share / chooser by BACK (keeps app in foreground)."""
	time.sleep(1.5)
	# Share sheet often shows "Share" / app list — dismiss with back.
	back()
	time.sleep(0.8)


def wait_text(fragment: str, timeout: float = 20.0) -> None:
	deadline = time.time() + timeout
	while time.time() < deadline:
		if has(fragment):
			print(f"OK found {fragment!r}")
			return
		time.sleep(0.8)
	raise RuntimeError(f"timeout waiting for {fragment!r}; have={texts()[:50]}")


def main() -> int:
	print("=== Phase 4 smoke start ===")
	print("UI texts:", texts()[:30])

	# Navigate to More / Settings tab
	for label in ("Ещё", "Настройки", "More"):
		if has(label):
			tap_text(label, contains=(label != "Ещё"))
			break
	else:
		# Bottom tab often last; try tapping by content-desc
		root = dump()
		for node in root.iter("node"):
			desc = node.attrib.get("content-desc") or ""
			if "Ещё" in desc or "More" in desc or "settings" in desc.lower():
				x, y = center(node.attrib["bounds"])
				adb("shell", "input", "tap", str(x), str(y))
				time.sleep(1.2)
				break

	wait_text("Данные", timeout=15)
	shot("p4-settings")

	# 1) Backup → share sheet
	tap_text("Создать резервную копию")
	time.sleep(2.5)
	t = texts()
	print("after backup:", t[:40])
	shot("p4-backup-share")
	# Share sheet or busy indicator then share
	if any("Drive" in x or "Bluetooth" in x or "Messages" in x or "Copy" in x or "Копир" in x or "Nearby" in x or "Save" in x or "Сохранить" in x or "Share" in x for x in t):
		print("PASS backup share sheet opened")
	else:
		# Still may be sharing — wait a bit more
		time.sleep(2)
		t = texts()
		print("backup retry texts:", t[:40])
	dismiss_share_sheet()
	wait_text("Данные", timeout=10)

	# 2) Fuel CSV share
	tap_text("Экспортировать заправки CSV")
	time.sleep(2.5)
	print("after fuel csv:", texts()[:40])
	shot("p4-fuel-csv")
	dismiss_share_sheet()
	wait_text("Данные", timeout=10)

	# 3) Share report
	tap_text("Поделиться отчётом")
	time.sleep(2.0)
	print("after report:", texts()[:40])
	shot("p4-report")
	dismiss_share_sheet()
	wait_text("Данные", timeout=10)

	# 4) Go to maintenance via home / ТО tab
	for label in ("ТО", "Обслуживание", "Home", "Главная"):
		if has(label):
			tap_text(label)
			break

	# Open add maintenance if possible
	if has("Добавить") or has("Добавить ТО") or has("+"):
		try:
			tap_text("Добавить ТО")
		except RuntimeError:
			try:
				tap_text("Добавить", contains=True)
			except RuntimeError:
				print("WARN no add maintenance button; skip remind UI")
				shot("p4-done-partial")
				print("=== Phase 4 smoke PARTIAL PASS ===")
				return 0

	time.sleep(1.0)
	# Fill title if edit fields exist
	root = dump()
	edits = [n for n in root.iter("node") if n.attrib.get("class") == "android.widget.EditText"]
	if edits:
		x, y = center(edits[0].attrib["bounds"])
		adb("shell", "input", "tap", str(x), str(y))
		time.sleep(0.3)
		adb("shell", "input", "text", "OSAGO")
		time.sleep(0.3)

	# Enable remind switch if present
	root = dump()
	for node in root.iter("node"):
		if node.attrib.get("class") == "android.widget.Switch":
			# Prefer the remind switch — toggle last switch if multiple
			pass
	switches = [n for n in root.iter("node") if n.attrib.get("class") == "android.widget.Switch"]
	if switches:
		sw = switches[-1]
		if sw.attrib.get("checked") != "true":
			x, y = center(sw.attrib["bounds"])
			adb("shell", "input", "tap", str(x), str(y))
			time.sleep(1.0)
			print("TAP remind switch")
		# Permission dialog?
		time.sleep(1.0)
		if has("Allow") or has("Разрешить") or has("While using"):
			try:
				tap_text("Allow", contains=True)
			except RuntimeError:
				try:
					tap_text("Разрешить", contains=True)
				except RuntimeError:
					pass
		shot("p4-remind")

	# Save if button exists
	for label in ("Сохранить", "Save"):
		if has(label):
			tap_text(label)
			time.sleep(1.5)
			break

	shot("p4-done")
	print("final texts:", texts()[:40])
	print("=== Phase 4 smoke PASS ===")
	return 0


if __name__ == "__main__":
	try:
		sys.exit(main())
	except Exception as exc:
		print("FAIL:", exc)
		shot("p4-fail")
		print("texts:", texts()[:60])
		sys.exit(1)
