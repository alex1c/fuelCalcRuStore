#!/usr/bin/env python3
"""Phase 3 Android smoke against already-running app (no relaunch)."""

from __future__ import annotations

import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

DUMP = Path(r"D:\petProject\fuelCalcRuStore\.tmp-ui.xml")
OUT = Path(r"D:\petProject\fuelCalcRuStore")


def adb(*args: str) -> subprocess.CompletedProcess[str]:
	return subprocess.run(
		["adb", *args],
		check=True,
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
	raise RuntimeError(f"missing {text!r}; have={texts()[:40]}")


def edits() -> list[ET.Element]:
	root = dump()
	return [
		n
		for n in root.iter("node")
		if n.attrib.get("class") == "android.widget.EditText"
	]


def tap_edit(i: int) -> None:
	nodes = edits()
	if i >= len(nodes):
		raise RuntimeError(f"edit[{i}] missing count={len(nodes)}")
	x, y = center(nodes[i].attrib["bounds"])
	adb("shell", "input", "tap", str(x), str(y))
	time.sleep(0.4)
	print(f"EDIT[{i}] was={nodes[i].attrib.get('text')!r}")


def clear_type(value: str) -> None:
	# Prefer select-all + delete; fall back to many DELs without failing the run.
	try:
		adb("shell", "input", "keyevent", "KEYCODE_MOVE_END")
	except Exception:
		pass
	for _ in range(20):
		try:
			adb("shell", "input", "keyevent", "67")
		except Exception:
			break
	adb("shell", "input", "text", value.replace(" ", "%s"))
	time.sleep(0.35)
	print(f"TYPE {value!r}")


def back() -> None:
	adb("shell", "input", "keyevent", "4")
	time.sleep(0.5)


def shot(name: str) -> None:
	adb("shell", "screencap", "-p", f"/sdcard/{name}.png")
	adb("pull", f"/sdcard/{name}.png", str(OUT / f".tmp-{name}.png"))


def set_switch(want_on: bool) -> None:
	root = dump()
	for node in root.iter("node"):
		if node.attrib.get("class") == "android.widget.Switch":
			is_on = node.attrib.get("checked") == "true"
			if is_on != want_on:
				x, y = center(node.attrib["bounds"])
				adb("shell", "input", "tap", str(x), str(y))
				time.sleep(0.5)
			print(f"SWITCH want={want_on}")
			return


def has(fragment: str) -> bool:
	return any(fragment in t for t in texts())


def main() -> int:
	print("UI now:", texts()[:30])
	shot("p3-smoke0")

	if has("Добавить автомобиль"):
		tap_text("Добавить автомобиль", 2.0)
		tap_edit(0)
		clear_type("Toyota")
		tap_edit(3)
		clear_type("10000")
		back()
		tap_text("Сохранить", 2.5)
		shot("p3-smoke-vehicle")

	def add_fuel(odo: str, liters: str, price: str, full: bool) -> None:
		tap_text("+ Заправка", 2.0)
		print("fuel edits", [e.attrib.get("text") for e in edits()])
		tap_edit(1)
		clear_type(odo)
		tap_edit(2)
		clear_type(liters)
		tap_edit(3)
		clear_type(price)
		set_switch(full)
		back()
		tap_text("Сохранить", 2.5)

	print("=== fuels ===")
	add_fuel("10000", "40", "50", True)
	add_fuel("10300", "20", "50", False)
	add_fuel("10600", "25", "50", True)
	shot("p3-smoke-fuel")
	joined = " | ".join(texts())
	print("HOME:", joined)
	if "7,5" not in joined and "7.5" not in joined:
		raise RuntimeError("expected 7.5 consumption")

	print("=== expense ===")
	tap_text("+ Расход", 2.0)
	if has("Мойка"):
		tap_text("Мойка", 0.6)
	tap_edit(0)
	clear_type("1000")
	back()
	tap_text("Сохранить", 2.5)

	print("=== maintenance ===")
	tap_text("ТО", 1.2)
	if has("Добавить ТО"):
		tap_text("Добавить ТО", 2.0)
	print("maint edits", [e.attrib.get("text") for e in edits()])
	tap_edit(0)
	clear_type("Maslo")
	# last odo + interval
	nodes = edits()
	if len(nodes) >= 4:
		tap_edit(2)
		clear_type("10000")
		tap_edit(3)
		clear_type("10000")
	back()
	tap_text("Сохранить", 2.5)
	shot("p3-smoke-maint")
	joined = " | ".join(texts())
	print("MAINT:", joined)

	print("=== edit partial ===")
	tap_text("История", 1.2)
	# open row with 10300
	root = dump()
	opened = False
	for node in root.iter("node"):
		t = node.attrib.get("text") or ""
		if "10300" in t:
			x, y = center(node.attrib["bounds"])
			adb("shell", "input", "tap", str(x), str(y))
			time.sleep(1.5)
			opened = True
			break
	if opened:
		tap_edit(2)
		clear_type("25")
		back()
		tap_text("Сохранить", 2.5)
		tap_text("Главная", 1.2)
		joined = " | ".join(texts())
		print("AFTER EDIT:", joined)
		if "8,3" not in joined and "8.3" not in joined:
			raise RuntimeError("expected ~8.3 after edit")

		# delete
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
			# confirm
			time.sleep(0.5)
			root = dump()
			for node in list(root.iter("node"))[::-1]:
				if node.attrib.get("text") == "Удалить":
					x, y = center(node.attrib["bounds"])
					adb("shell", "input", "tap", str(x), str(y))
					time.sleep(2.0)
					break

	print("=== restart persistence ===")
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
	shot("p3-smoke-restart")
	joined = " | ".join(texts())
	print("RESTART:", joined)
	if "Toyota" not in joined:
		raise RuntimeError("vehicle lost after restart")

	print("SMOKE_PASS")
	return 0


if __name__ == "__main__":
	try:
		sys.exit(main())
	except Exception as exc:
		print("SMOKE_FAIL:", exc)
		try:
			shot("p3-smoke-fail")
			print("UI:", texts())
		except Exception:
			pass
		sys.exit(1)
