#!/usr/bin/env python3
"""
Phase 5 product smoke (AppMetrica + Ads + trip calc + UX polish).

Checks:
  Home hero + CTAs, stats tab, trip calculator, fuel form «Полный бак»,
  save fuel without interstitial hang, backup share sheet.

Requires: emulator online, Metro fuelCalcRuStore on 8081, debug APK installed.
"""

from __future__ import annotations

import json
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
	sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
	pass

OUT = Path(r"D:\petProject\fuelCalcRuStore")
DUMP = OUT / ".tmp-ui.xml"
PKG = "com.calculatorplatform.autojournal"
SERIAL = "emulator-5554"
DEV_URL = (
	"exp+auto-journal://expo-development-client/"
	"?url=http%3A%2F%2F127.0.0.1%3A8081"
)
REPORT = OUT / ".tmp-p5-product-smoke-report.json"


def adb(*args: str, check: bool = True, timeout: float = 60) -> subprocess.CompletedProcess[str]:
	return subprocess.run(
		["adb", "-s", SERIAL, *args],
		check=check,
		text=True,
		capture_output=True,
		encoding="utf-8",
		errors="replace",
		timeout=timeout,
	)


def adb_ok(*args: str, timeout: float = 60) -> subprocess.CompletedProcess[str]:
	return adb(*args, check=False, timeout=timeout)


def ensure_reverse() -> None:
	adb_ok("reverse", "tcp:8081", "tcp:8081")


def dump(retries: int = 6) -> ET.Element:
	last_err: Exception | None = None
	for _ in range(retries):
		try:
			r = adb_ok("shell", "uiautomator", "dump", "/sdcard/ui.xml", timeout=45)
			joined = (r.stdout or "") + (r.stderr or "")
			if "ERROR" in joined or "null root" in joined:
				time.sleep(1.2)
				continue
			adb("pull", "/sdcard/ui.xml", str(DUMP), timeout=30)
			return ET.parse(DUMP).getroot()
		except Exception as exc:  # noqa: BLE001
			last_err = exc
			time.sleep(1.5)
	raise RuntimeError(f"ui dump failed: {last_err}")


def center(bounds: str) -> tuple[int, int]:
	m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
	assert m
	x1, y1, x2, y2 = map(int, m.groups())
	return (x1 + x2) // 2, (y1 + y2) // 2


def texts(root: ET.Element | None = None) -> list[str]:
	# Explicit None check — ElementTree elements are truthy-ambiguous in 3.14+.
	root = dump() if root is None else root
	return [n.attrib.get("text", "") for n in root.iter("node") if n.attrib.get("text")]


def has(fragment: str, root: ET.Element | None = None) -> bool:
	return any(fragment in t for t in texts(root))


def shot(name: str) -> Path:
	remote = f"/sdcard/{name}.png"
	local = OUT / f".tmp-{name}.png"
	adb_ok("shell", "screencap", "-p", remote)
	adb_ok("pull", remote, str(local))
	print(f"SHOT {local}")
	return local


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
		clickable = node.attrib.get("clickable") == "true"
		focusable = node.attrib.get("focusable") == "true"
		prio = 0 if clickable else (1 if focusable else 2)
		candidates.append((prio, x, y))
	if not candidates:
		return False
	candidates.sort()
	_, x, y = candidates[0]
	tap_xy(x, y, wait=wait)
	print(f"TAP {text!r} -> {x},{y}")
	return True


def back(wait: float = 0.8) -> None:
	adb("shell", "input", "keyevent", "4")
	time.sleep(wait)


def dismiss_overlays(*, allow_back: bool = False) -> None:
	"""Dismiss ANR Wait; optionally close Expo tools without leaving the screen."""
	root = dump()
	joined = " | ".join(texts(root))
	if "isn't responding" in joined or "не отвечает" in joined.lower():
		tap_text("Wait", wait=1.0) or tap_text("Ожидание", wait=1.0) or tap_xy(700, 1400)
	# Avoid BACK here — it pops stack screens (stats/trip/fuel) during smoke.
	if allow_back and ("Expo" in joined or "Dev Menu" in joined):
		tap_xy(540, 1200, wait=0.5)
		back(0.5)


def launch_app() -> None:
	ensure_reverse()
	adb_ok("shell", "am", "force-stop", PKG)
	time.sleep(1.0)
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
	print("launched")
	time.sleep(14)
	dismiss_overlays(allow_back=True)


def wait_home(timeout: float = 45.0) -> list[str]:
	deadline = time.time() + timeout
	while time.time() < deadline:
		dismiss_overlays(allow_back=True)
		t = texts()
		if any("Средний расход" in x for x in t) or any("+ Заправка" in x for x in t):
			return t
		if any("Главная" in x for x in t) and any("Ещё" in x for x in t):
			# Tabs visible but content still loading
			time.sleep(1.2)
			continue
		time.sleep(1.2)
	raise RuntimeError(f"home not ready; have={texts()[:40]}")


def go_tab(label: str) -> None:
	if not tap_text(label, wait=1.5):
		raise RuntimeError(f"tab {label!r} missing; have={texts()[:40]}")


def fill_focused(text: str) -> None:
	adb("shell", "input", "text", text.replace(" ", "%s"))
	time.sleep(0.4)


def check(name: str, ok: bool, detail: str = "") -> dict:
	status = "PASS" if ok else "FAIL"
	print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
	return {"name": name, "ok": ok, "detail": detail}


def main() -> int:
	print("=== Phase 5 product smoke ===")
	results: list[dict] = []
	ensure_reverse()
	launch_app()
	home = wait_home()
	shot("p5-home")

	# 1) Home hero + CTAs (banner optional)
	has_hero = any("Средний расход" in t for t in home)
	has_cta = any("+ Заправка" in t for t in home) and any("+ Расход" in t for t in home)
	results.append(check("home_hero_ctas", has_hero and has_cta, f"hero={has_hero} cta={has_cta}"))

	# 2) Stats tab (interstitial skip OK)
	go_tab("Стат.")
	time.sleep(2.5)
	dismiss_overlays(allow_back=False)
	st = texts()
	# Fullscreen interstitial is optional / often skipped by policy.
	if any(x in " ".join(st).lower() for x in ("закрыть", "close ad")) and not any(
		"Статистика" in t for t in st
	):
		back(1.0)
		st = texts()
	stats_ok = any("Статистика" in t for t in st)
	if not stats_ok:
		# Coordinate fallback for 4th bottom tab on Pixel_10 (1080-wide).
		tap_xy(756, 2297, wait=2.0)
		st = texts()
		stats_ok = any("Статистика" in t for t in st)
	shot("p5-stats")
	results.append(check("stats_open", stats_ok, f"sample={st[:8]}"))

	# 3) Trip calculator via Ещё
	go_tab("Ещё")
	time.sleep(1.2)
	if not tap_text("Калькулятор поездки", wait=1.5):
		results.append(check("trip_open", False, "button missing"))
	else:
		time.sleep(1.5)
		trip_texts = texts()
		trip_open = any("Калькулятор поездки" in t for t in trip_texts)
		shot("p5-trip")
		# Enter distance into first field
		# Prefer tapping placeholder/label then typing
		if not tap_text("350", wait=0.6, contains=False):
			# Tap the distance field by label proximity — focus first EditText
			root = dump()
			edit = None
			for node in root.iter("node"):
				cls = node.attrib.get("class") or ""
				if "EditText" in cls and node.attrib.get("bounds"):
					edit = node
					break
			if edit is not None:
				x, y = center(edit.attrib["bounds"])
				tap_xy(x, y, wait=0.5)
		# Clear then type distance
		adb_ok("shell", "input", "keyevent", "KEYCODE_MOVE_END")
		for _ in range(12):
			adb_ok("shell", "input", "keyevent", "67")  # DEL
		fill_focused("350")
		time.sleep(1.2)
		after = texts()
		# Fuel estimate shows «Понадобится топлива» + liters when fields filled
		estimate_ok = any("Понадобится топлива" in t for t in after) or any(
			" л" in t and re.search(r"\d", t) for t in after
		)
		# If consumption/price empty, muted prompt is still a valid open
		if not estimate_ok and any("Введите расстояние" in t for t in after):
			# Try fill consumption/price with demo values via next EditTexts
			root = dump()
			edits = [
				n
				for n in root.iter("node")
				if "EditText" in (n.attrib.get("class") or "") and n.attrib.get("bounds")
			]
			for idx, node in enumerate(edits):
				x, y = center(node.attrib["bounds"])
				tap_xy(x, y, wait=0.35)
				adb_ok("shell", "input", "keyevent", "KEYCODE_MOVE_END")
				for _ in range(10):
					adb_ok("shell", "input", "keyevent", "67")
				if idx == 0:
					fill_focused("350")
				elif idx == 1:
					fill_focused("8.5")
				else:
					fill_focused("55")
			time.sleep(1.0)
			after = texts()
			estimate_ok = any("Понадобится топлива" in t for t in after)
		shot("p5-trip-estimate")
		results.append(
			check(
				"trip_calculator",
				trip_open and estimate_ok,
				f"open={trip_open} estimate={estimate_ok} sample={[t for t in after if 'топлив' in t.lower() or 'л' in t][:6]}",
			)
		)
		back(1.0)

	# 4) Fuel form — Полный бак wording
	go_tab("Главная")
	time.sleep(1.0)
	if not tap_text("+ Заправка", wait=1.5):
		results.append(check("fuel_full_tank_label", False, "CTA missing"))
	else:
		time.sleep(1.5)
		fuel_t = texts()
		full_ok = any("Полный бак" in t for t in fuel_t)
		shot("p5-fuel-form")
		results.append(check("fuel_full_tank_label", full_ok, f"sample={fuel_t[:12]}"))

		# 5) Save fuel without interstitial hang (use unique odometer)
		# Find EditTexts and fill minimal valid values if empty-ish
		root = dump()
		edits = [
			n
			for n in root.iter("node")
			if "EditText" in (n.attrib.get("class") or "") and n.attrib.get("bounds")
		]
		# Heuristic: odometer / liters / total or price fields — fill last few with safe values
		# Prefer not corrupting too much: set odometer high unique, liters, sum
		values = ["999991", "40", "2200"]
		for idx, node in enumerate(edits[:3]):
			x, y = center(node.attrib["bounds"])
			tap_xy(x, y, wait=0.35)
			adb_ok("shell", "input", "keyevent", "KEYCODE_MOVE_END")
			for _ in range(16):
				adb_ok("shell", "input", "keyevent", "67")
			fill_focused(values[idx] if idx < len(values) else "1")
		# Ensure full tank off (default) — just save
		if not tap_text("Сохранить", wait=2.0):
			results.append(check("fuel_save_no_interstitial", False, "save missing"))
		else:
			time.sleep(2.5)
			dismiss_overlays(allow_back=False)
			after_save = texts()
			# Success = back on home OR still on form without ANR / ad fullscreen
			stuck_ad = any(
				x in " ".join(after_save).lower()
				for x in ("реклама", "yandex", "закрыть реклам")
			)
			anr = any("isn't responding" in t for t in after_save)
			back_home = any("Средний расход" in t for t in after_save) or any(
				"+ Заправка" in t for t in after_save
			)
			# If validation error, still proves no interstitial hang
			validation = any("л" in t or "одометр" in t.lower() or "Ошибка" in t for t in after_save)
			ok_save = (back_home or validation) and not stuck_ad and not anr
			shot("p5-fuel-after-save")
			results.append(
				check(
					"fuel_save_no_interstitial",
					ok_save,
					f"home={back_home} ad={stuck_ad} anr={anr}",
				)
			)
			if not back_home:
				back(1.0)
				go_tab("Главная")

	# 6) Backup share sheet
	go_tab("Ещё")
	time.sleep(1.0)
	if not tap_text("Создать резервную копию", wait=2.0):
		results.append(check("backup_share", False, "button missing"))
	else:
		time.sleep(2.5)
		share_t = texts()
		share_ok = any(
			any(k in t for k in ("Share", "Поделиться", "Сохранить", "Nearby", "Drive", "Files", "Копия"))
			for t in share_t
		) or any("chooser" in (n.attrib.get("package") or "") for n in dump().iter("node"))
		# Also accept Android Sharesheet package
		root = dump()
		pkgs = {n.attrib.get("package") for n in root.iter("node") if n.attrib.get("package")}
		if "com.android.intentresolver" in pkgs or "android" in "".join(pkgs):
			# intentresolver present → share sheet
			if any("intentresolver" in (p or "") for p in pkgs):
				share_ok = True
		shot("p5-backup-share")
		results.append(check("backup_share", share_ok, f"pkgs={sorted(p for p in pkgs if p)[:8]} texts={share_t[:10]}"))
		back(1.0)
		back(0.8)

	failed = [r for r in results if not r["ok"]]
	report = {
		"ok": len(failed) == 0,
		"results": results,
		"failed": [r["name"] for r in failed],
	}
	REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
	print("REPORT", REPORT)
	print("OVERALL", "PASS" if report["ok"] else "FAIL", report["failed"])
	return 0 if report["ok"] else 1


if __name__ == "__main__":
	raise SystemExit(main())
