#!/usr/bin/env python3
"""Continue Phase 3 smoke from maintenance form (already filled)."""

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
			print("TAP", text, x, y)
			return
	raise RuntimeError(f"missing {text} have={texts()[:40]}")


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
	time.sleep(0.4)


def clear_type(value: str) -> None:
	for _ in range(18):
		adb("shell", "input", "keyevent", "67", check=False)
	adb("shell", "input", "text", value.replace(" ", "%s"))
	time.sleep(0.3)


def shot(name: str) -> None:
	adb("shell", "screencap", "-p", f"/sdcard/{name}.png")
	adb("pull", f"/sdcard/{name}.png", str(OUT / f".tmp-{name}.png"))


def has(s: str) -> bool:
	return any(s in t for t in texts())


print("continue UI:", texts()[:25])
if has("Сохранить"):
	tap_text("Сохранить", 2.5)
shot("p3-maint-saved")
joined = " | ".join(texts())
print("MAINT LIST:", joined)
if "9400" not in joined and "9 400" not in joined:
	print("WARN remaining km text not on list; opening item may still be ok")

tap_text("Главная", 1.5)
shot("p3-home-after-maint")
print("HOME:", " | ".join(texts()))

# Edit partial via history
tap_text("История", 1.2)
root = dump()
for node in root.iter("node"):
	t = node.attrib.get("text") or ""
	if "10300" in t:
		x, y = center(node.attrib["bounds"])
		adb("shell", "input", "tap", str(x), str(y))
		time.sleep(1.5)
		print("opened 10300")
		break
else:
	raise SystemExit("no 10300 row")

tap_edit(2)
clear_type("25")
adb("shell", "input", "keyevent", "4", check=False)
time.sleep(0.4)
tap_text("Сохранить", 2.5)
tap_text("Главная", 1.2)
joined = " | ".join(texts())
print("AFTER EDIT:", joined)
if "8,3" not in joined and "8.3" not in joined:
	raise SystemExit("expected ~8.3")

# Delete partial
tap_text("История", 1.2)
root = dump()
for node in root.iter("node"):
	t = node.attrib.get("text") or ""
	if "10300" in t:
		x, y = center(node.attrib["bounds"])
		adb("shell", "input", "tap", str(x), str(y))
		time.sleep(1.5)
		break
if has("Удалить"):
	tap_text("Удалить", 1.0)
	time.sleep(0.4)
	root = dump()
	for node in list(root.iter("node"))[::-1]:
		if node.attrib.get("text") == "Удалить":
			x, y = center(node.attrib["bounds"])
			adb("shell", "input", "tap", str(x), str(y))
			time.sleep(2.0)
			print("confirmed delete")
			break

tap_text("Главная", 1.2)
shot("p3-after-delete")
print("AFTER DELETE:", " | ".join(texts()))

# Restart
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
time.sleep(12)
shot("p3-restart")
joined = " | ".join(texts())
print("RESTART:", joined)
if "Toyota" not in joined:
	raise SystemExit("lost Toyota")
print("SMOKE_PASS")
