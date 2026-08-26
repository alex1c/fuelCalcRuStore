#!/usr/bin/env python3
"""Finish Phase 3 smoke: fix maintenance intervals, edit/delete fuel, restart."""

from __future__ import annotations

import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

DUMP = Path(r"D:\petProject\fuelCalcRuStore\.tmp-ui.xml")
OUT = Path(r"D:\petProject\fuelCalcRuStore")


def adb(*args: str, check: bool = True) -> None:
	subprocess.run(
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


def tap_text(text: str, wait: float = 1.2) -> None:
	root = dump()
	for node in root.iter("node"):
		if node.attrib.get("text") == text and node.attrib.get("bounds"):
			x, y = center(node.attrib["bounds"])
			adb("shell", "input", "tap", str(x), str(y))
			time.sleep(wait)
			print("TAP", text)
			return
	raise RuntimeError(f"missing {text!r} have={texts()[:50]}")


def tap_contains(fragment: str, wait: float = 1.2) -> None:
	root = dump()
	for node in root.iter("node"):
		t = node.attrib.get("text") or ""
		if fragment in t and node.attrib.get("bounds"):
			x, y = center(node.attrib["bounds"])
			adb("shell", "input", "tap", str(x), str(y))
			time.sleep(wait)
			print("TAP_CONTAINS", fragment, "->", t)
			return
	raise RuntimeError(f"missing contains {fragment!r} have={texts()[:50]}")


def edits():
	root = dump()
	return [
		n
		for n in root.iter("node")
		if n.attrib.get("class") == "android.widget.EditText"
	]


def tap_edit(i: int) -> None:
	nodes = edits()
	x, y = center(nodes[i].attrib["bounds"])
	adb("shell", "input", "tap", str(x), str(y))
	time.sleep(0.45)


def clear_type(value: str) -> None:
	# Long-press delete via repeated DEL; ignore adb flakiness.
	for _ in range(16):
		adb("shell", "input", "keyevent", "67", check=False)
	adb("shell", "input", "text", value.replace(" ", "%s"), check=False)
	time.sleep(0.35)
	print("TYPE", value)


def shot(name: str) -> None:
	adb("shell", "screencap", "-p", f"/sdcard/{name}.png")
	adb("pull", f"/sdcard/{name}.png", str(OUT / f".tmp-{name}.png"))


def has(s: str) -> bool:
	return any(s in t for t in texts())


# Wait for metro reload after code change
time.sleep(3)
adb("shell", "input", "text", "RR", check=False)  # no-op if not in menu

print("=== Fix maintenance Maslo intervals ===")
tap_text("ТО", 1.2)
if has("Maslo"):
	tap_contains("Maslo", 1.5)
else:
	tap_text("Добавить ТО", 2.0)
	tap_edit(0)
	clear_type("Maslo")

# Fields: 0 title, 1 date, 2 lastOdo, 3 intervalKm, 4 intervalDays
tap_edit(2)
clear_type("10000")
tap_edit(3)
clear_type("10000")
# Clear days so only km schedule applies (placeholder 365 must not linger in state)
tap_edit(4)
for _ in range(8):
	adb("shell", "input", "keyevent", "67", check=False)
adb("shell", "input", "keyevent", "4", check=False)
time.sleep(0.4)
tap_text("Сохранить", 2.5)
shot("p3-maint-fixed")
joined = " | ".join(texts())
print("MAINT:", joined)
if "9400" not in joined and "9 400" not in joined:
	raise SystemExit("expected 9400 km remaining")

print("=== Edit partial 20L -> 25L ===")
tap_text("История", 1.2)
# Locale may use NBSP between thousands: match on trailing part.
tap_contains("300 км", 1.5)
tap_edit(2)
clear_type("25")
adb("shell", "input", "keyevent", "4", check=False)
time.sleep(0.3)
tap_text("Сохранить", 2.5)
tap_text("Главная", 1.2)
joined = " | ".join(texts())
print("AFTER EDIT:", joined)
if "8,3" not in joined and "8.3" not in joined:
	raise SystemExit("expected ~8.3 after liters edit")

print("=== Delete partial ===")
tap_text("История", 1.2)
tap_contains("300 км", 1.5)
if has("Удалить"):
	tap_text("Удалить", 1.0)
	time.sleep(0.5)
	root = dump()
	for node in list(root.iter("node"))[::-1]:
		if node.attrib.get("text") == "Удалить":
			x, y = center(node.attrib["bounds"])
			adb("shell", "input", "tap", str(x), str(y))
			time.sleep(2.0)
			print("deleted")
			break

tap_text("Главная", 1.2)
shot("p3-after-delete")
print("AFTER DELETE:", " | ".join(texts()))

print("=== Restart ===")
adb("shell", "am", "force-stop", "com.calculatorplatform.autojournal")
time.sleep(1)
adb(
	"shell",
	"am",
	"start",
	"-n",
	"com.calculatorplatform.autojournal/.MainActivity",
	"-a",
	"android.intent.action.VIEW",
	"-d",
	"exp+auto-journal://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081",
)
time.sleep(14)
shot("p3-restart")
joined = " | ".join(texts())
print("RESTART:", joined)
assert "Toyota" in joined
assert "7.5" in joined or "7,5" in joined or "4,1" in joined or "4.1" in joined
print("SMOKE_PASS")
