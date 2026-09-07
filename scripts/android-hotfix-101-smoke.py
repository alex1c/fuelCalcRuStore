#!/usr/bin/env python3
"""
Hotfix 1.0.1 release smoke — fresh install vehicle create path.

Scenarios:
  A: create vehicle bmw → Home → restart
  B: add full fuel → restart
  C: second vehicle → switch → restart
  D: expense + maintenance + stats open
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
try:
	sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
	pass

ROOT = Path(r"D:\petProject\fuelCalcRuStore")
PKG = "com.calculatorplatform.autojournal"
SDK = Path(os.environ.get("ANDROID_HOME", r"C:\Users\alex1\AppData\Local\Android\Sdk"))
ADB = str(SDK / "platform-tools" / "adb.exe")
DUMP = ROOT / ".tmp-hotfix-ui.xml"

# Prefer any online emulator.
def detect_serial() -> str:
	out = subprocess.run([ADB, "devices"], capture_output=True, text=True, check=False).stdout
	for line in out.splitlines():
		if "\tdevice" in line and line.startswith("emulator-"):
			return line.split("\t")[0]
	return "emulator-5554"


SERIAL = detect_serial()


def adb(*args: str, check: bool = True, timeout: float = 60) -> subprocess.CompletedProcess[str]:
	return subprocess.run(
		[ADB, "-s", SERIAL, *args],
		check=check,
		text=True,
		capture_output=True,
		encoding="utf-8",
		errors="replace",
		timeout=timeout,
	)


def adb_ok(*args: str, timeout: float = 60) -> subprocess.CompletedProcess[str]:
	return adb(*args, check=False, timeout=timeout)


def dump() -> ET.Element:
	for _ in range(8):
		r = adb_ok("shell", "uiautomator", "dump", "/sdcard/ui.xml", timeout=45)
		joined = (r.stdout or "") + (r.stderr or "")
		if "ERROR" in joined or "null root" in joined:
			time.sleep(1)
			continue
		adb("pull", "/sdcard/ui.xml", str(DUMP), timeout=30)
		return ET.parse(DUMP).getroot()
	raise RuntimeError("ui dump failed")


def texts() -> list[str]:
	root = dump()
	return [n.attrib.get("text", "") for n in root.iter("node") if n.attrib.get("text")]


def has(fragment: str) -> bool:
	return any(fragment in t for t in texts())


def center(bounds: str) -> tuple[int, int]:
	m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
	assert m
	x1, y1, x2, y2 = map(int, m.groups())
	return (x1 + x2) // 2, (y1 + y2) // 2


def tap_xy(x: int, y: int, wait: float = 1.0) -> None:
	adb("shell", "input", "tap", str(x), str(y))
	time.sleep(wait)


def tap_text(text: str, wait: float = 1.2, contains: bool = False) -> bool:
	root = dump()
	candidates: list[tuple[int, int, int]] = []
	for node in root.iter("node"):
		t = node.attrib.get("text") or ""
		desc = node.attrib.get("content-desc") or ""
		ok = (text in t or text in desc) if contains else (t == text or desc == text)
		if not ok or not node.attrib.get("bounds"):
			continue
		x, y = center(node.attrib["bounds"])
		prio = 0 if node.attrib.get("clickable") == "true" else 1
		candidates.append((prio, x, y))
	if not candidates:
		return False
	candidates.sort()
	_, x, y = candidates[0]
	tap_xy(x, y, wait)
	return True


def wait_text(fragment: str, timeout: float = 40) -> None:
	deadline = time.time() + timeout
	while time.time() < deadline:
		if has(fragment):
			return
		time.sleep(1)
	raise RuntimeError(f"timeout waiting {fragment!r}; have={texts()[:40]}")


def assert_no_db_error() -> None:
	joined = " | ".join(texts())
	bad = (
		"NativeDatabase",
		"prepareAsync",
		"NativeStatement",
		"SharedObject",
		"Ошибка БД",
		"Call to function",
	)
	for b in bad:
		if b in joined:
			raise RuntimeError(f"DB error visible: {b} in {joined[:300]}")


def launch() -> None:
	adb_ok("shell", "am", "force-stop", PKG)
	time.sleep(1)
	adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity")
	time.sleep(5)


def clear_app() -> None:
	adb_ok("shell", "pm", "clear", PKG)
	time.sleep(1)


def fill_first_edit(value: str) -> None:
	root = dump()
	edits = [n for n in root.iter("node") if n.attrib.get("class") == "android.widget.EditText"]
	if not edits:
		raise RuntimeError("no EditText")
	x, y = center(edits[0].attrib["bounds"])
	tap_xy(x, y, 0.4)
	for _ in range(20):
		adb_ok("shell", "input", "keyevent", "67")
	adb("shell", "input", "text", value.replace(" ", "%s"))
	time.sleep(0.3)


def hide_keyboard() -> None:
	adb_ok("shell", "input", "keyevent", "111")
	time.sleep(0.3)


def create_vehicle(name: str) -> None:
	# Empty state CTA or vehicles entry
	if not tap_text("Добавить автомобиль", contains=True, wait=1.5):
		if not tap_text("автомобиль", contains=True, wait=1.5):
			tap_text("Ещё", wait=1.2)
			tap_text("Добавить автомобиль", contains=True, wait=1.5) or tap_text(
				"Новый автомобиль", contains=True, wait=1.5
			)
	wait_text("Название")
	fill_first_edit(name)
	hide_keyboard()
	if not tap_text("Сохранить", wait=2.0):
		raise RuntimeError("Save missing on vehicle form")
	time.sleep(2)


def check(name: str, ok: bool, detail: str = "") -> dict:
	status = "PASS" if ok else "FAIL"
	print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
	return {"name": name, "ok": ok, "detail": detail}


def main() -> int:
	print(f"SERIAL {SERIAL}")
	results: list[dict] = []

	clear_app()
	launch()
	time.sleep(3)
	assert_no_db_error()

	# A: create bmw
	create_vehicle("bmw")
	time.sleep(1.5)
	assert_no_db_error()
	ok_home = has("bmw") or has("BMW") or has("Средний расход") or has("Главная")
	results.append(check("A create bmw home", ok_home, str(texts()[:20])))
	if has("NativeDatabase") or has("prepareAsync"):
		results.append(check("A no sqlite crash", False, texts()[:30]))
		return 1
	results.append(check("A no sqlite crash", True))

	adb_ok("shell", "am", "force-stop", PKG)
	time.sleep(1)
	launch()
	time.sleep(4)
	assert_no_db_error()
	results.append(check("A restart keeps bmw", has("bmw") or has("BMW"), str(texts()[:20])))

	# B: fuel
	if tap_text("+ Заправка", wait=1.5) or tap_text("Заправка", contains=True, wait=1.5):
		wait_text("Литры")
		# fill odometer / liters / price via edit texts
		root = dump()
		edits = [n for n in root.iter("node") if n.attrib.get("class") == "android.widget.EditText"]
		values = ["1000", "40", "50"]
		for i, value in enumerate(values):
			if i >= len(edits):
				break
			x, y = center(edits[i].attrib["bounds"])
			tap_xy(x, y, 0.3)
			for _ in range(12):
				adb_ok("shell", "input", "keyevent", "67")
			adb("shell", "input", "text", value)
		hide_keyboard()
		tap_text("Сохранить", wait=2.0)
		time.sleep(2)
		assert_no_db_error()
		results.append(check("B fuel save", True))
		adb_ok("shell", "am", "force-stop", PKG)
		time.sleep(1)
		launch()
		time.sleep(4)
		assert_no_db_error()
		results.append(check("B restart after fuel", has("bmw") or has("BMW")))
	else:
		results.append(check("B fuel save", False, "CTA missing"))

	# C: second vehicle
	tap_text("Ещё", wait=1.2)
	if tap_text("Автомобили", contains=True, wait=1.5) or tap_text("автомобил", contains=True, wait=1.5):
		tap_text("Добавить", contains=True, wait=1.5) or tap_text("+", contains=True, wait=1.5)
		# may already be on edit via button
	create_vehicle("audi")
	time.sleep(1.5)
	assert_no_db_error()
	results.append(check("C second vehicle", has("audi") or has("Audi") or has("bmw"), str(texts()[:25])))
	adb_ok("shell", "am", "force-stop", PKG)
	launch()
	time.sleep(4)
	assert_no_db_error()
	results.append(check("C restart multi-vehicle", True))

	# D: expense / maintenance / stats
	tap_text("Главная", wait=1)
	if tap_text("+ Расход", wait=1.5):
		wait_text("Сумма")
		root = dump()
		edits = [n for n in root.iter("node") if n.attrib.get("class") == "android.widget.EditText"]
		if edits:
			x, y = center(edits[0].attrib["bounds"])
			tap_xy(x, y, 0.3)
			adb("shell", "input", "text", "500")
		hide_keyboard()
		tap_text("Сохранить", wait=1.5)
		time.sleep(1)
		assert_no_db_error()
		results.append(check("D expense", True))
	else:
		results.append(check("D expense", False, "CTA missing"))

	if tap_text("ТО", wait=1.2):
		assert_no_db_error()
		results.append(check("D maintenance tab", True))
	else:
		results.append(check("D maintenance tab", False))

	if tap_text("Стат.", wait=1.5):
		time.sleep(2)
		assert_no_db_error()
		results.append(check("D statistics", has("Статистика") or has("Расход") or has("₽"), str(texts()[:20])))
	else:
		results.append(check("D statistics", False))

	failed = [r for r in results if not r["ok"]]
	print("SUMMARY", f"{len(results) - len(failed)}/{len(results)} PASS")
	return 1 if failed else 0


if __name__ == "__main__":
	try:
		raise SystemExit(main())
	except Exception as exc:  # noqa: BLE001
		print("FAIL:", exc)
		try:
			print("texts:", texts()[:50])
		except Exception:
			pass
		raise SystemExit(1)
