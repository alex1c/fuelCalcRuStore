#!/usr/bin/env python3
"""
Phase 5 Android restore smoke (production UI path).

Flow:
  baseline -> backup (share / harvest to Downloads) -> mutate ->
  restore via DocumentPicker -> verify -> force-stop relaunch -> verify

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
from datetime import datetime, timezone
from pathlib import Path

# Avoid Windows console UnicodeEncodeError on ₽ etc.
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
DEV_URL = "exp+auto-journal://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
REPORT = OUT / ".tmp-p5-restore-report.json"


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
	root = root or dump()
	return [n.attrib.get("text", "") for n in root.iter("node") if n.attrib.get("text")]


def has(fragment: str, root: ET.Element | None = None) -> bool:
	return any(fragment in t for t in texts(root))


def tap_xy(x: int, y: int, wait: float = 1.0) -> None:
	adb("shell", "input", "tap", str(x), str(y))
	time.sleep(wait)


def tap_text(text: str, wait: float = 1.2, contains: bool = False) -> None:
	"""Tap a node by text/content-desc; prefer clickable/focusable matches."""
	root = dump()
	# Prefer clickable/focusable so we hit tab buttons / links, not inert labels.
	candidates: list[tuple[int, int, int]] = []  # (priority, x, y)
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
	if candidates:
		candidates.sort()
		_, x, y = candidates[0]
		tap_xy(x, y, wait=wait)
		print(f"TAP {text!r} -> {x},{y}")
		return
	raise RuntimeError(f"missing {text!r}; have={texts()[:60]}")


def dismiss_anr_if_present() -> bool:
	"""Dismiss 'Process system isn't responding' if it blocks the UI."""
	t = texts()
	if "isn't responding" in " ".join(t) or "не отвечает" in " ".join(t):
		print("ANR dialog present; tapping Wait")
		if not tap_text_optional("Wait", wait=1.0):
			tap_text_optional("Ожидать", wait=1.0)
		time.sleep(1.0)
		return True
	return False


def tap_text_optional(text: str, contains: bool = False, wait: float = 1.0) -> bool:
	try:
		tap_text(text, contains=contains, wait=wait)
		return True
	except RuntimeError:
		return False


def wait_text(fragment: str, timeout: float = 25.0) -> None:
	deadline = time.time() + timeout
	while time.time() < deadline:
		if has(fragment):
			print(f"OK found {fragment!r}")
			return
		time.sleep(0.9)
	raise RuntimeError(f"timeout waiting for {fragment!r}; have={texts()[:60]}")


def shot(name: str) -> str:
	remote = f"/sdcard/{name}.png"
	local = OUT / f".tmp-{name}.png"
	adb_ok("shell", "screencap", "-p", remote, timeout=30)
	adb_ok("pull", remote, str(local), timeout=30)
	print(f"SHOT {local}")
	return str(local)


def back(wait: float = 0.8) -> None:
	adb("shell", "input", "keyevent", "4")
	time.sleep(wait)


def ensure_reverse() -> None:
	adb_ok("reverse", "tcp:8081", "tcp:8081")


def dismiss_expo_tools() -> None:
	"""Expo Dev Client 'Tools' overlay steals taps — dismiss without leaving the app."""
	for _ in range(3):
		t = texts()
		if "Play Store" in t or "Chrome" in t:
			return
		blob = " ".join(t)
		# Full Tools menu or a lone floating "Tools" chip
		if "Open JS debugger" in blob or "Reload" in t or "Tools" in t:
			print("dismiss Expo Tools overlay")
			if has("Reload") or has("Open JS debugger"):
				back(wait=0.5)
			else:
				# Tap away from the floating chip, then BACK if still present
				tap_xy(540, 1200, wait=0.5)
				if has("Tools"):
					back(wait=0.5)
			continue
		break


def recover_redbox_if_needed() -> bool:
	"""Tap RELOAD on Expo/RN redbox if present. Returns True if recovery attempted."""
	t = texts()
	blob = " ".join(t)
	if "RELOAD" in blob or "runtime not ready" in blob or "FabricUIManager" in blob:
		print("redbox detected; tapping RELOAD")
		if tap_text_optional("RELOAD", contains=True, wait=2.0):
			time.sleep(10)
			return True
		root = dump()
		for node in root.iter("node"):
			tx = node.attrib.get("text") or ""
			if "RELOAD" in tx and node.attrib.get("bounds"):
				x, y = center(node.attrib["bounds"])
				tap_xy(x, y, wait=2.0)
				time.sleep(10)
				return True
	return False


def ensure_app_chrome() -> None:
	"""If accessibility tree is blank / Tools-only, cold-relaunch (SQLite data persists)."""
	t = texts()
	if "Play Store" in t or "Chrome" in t:
		print("WARN launcher visible; relaunch")
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
		time.sleep(14)
		recover_redbox_if_needed()
		return
	meaningful = [x for x in t if x and x not in ("Tools",)]
	if len(meaningful) == 0 or (len(meaningful) <= 1 and "Tools" in t):
		print("WARN blank/tools UI; force-stop relaunch to recover chrome")
		adb_ok("shell", "am", "force-stop", PKG)
		time.sleep(1)
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
		time.sleep(16)
		recover_redbox_if_needed()


def go_tab(label: str) -> None:
	"""Bottom tabs: prefer clickable View bounds; fallback coords use icon center (y≈2297)."""
	dismiss_anr_if_present()
	ensure_app_chrome()
	dismiss_expo_tools()
	# Clickable tab hit-targets are ~[0..1080] x [2233..2361]; center y≈2297.
	# Do NOT tap label centers at y≈2338 — that grazes the system gesture bar.
	fallback = {
		"Главная": (108, 2297),
		"История": (324, 2297),
		"ТО": (540, 2297),
		"Стат.": (756, 2297),
		"Ещё": (972, 2297),
	}
	if label not in fallback:
		raise RuntimeError(f"unknown tab {label}")

	root = dump()
	matches: list[tuple[int, int, int]] = []  # (clickable_prio, y, x)
	for node in root.iter("node"):
		t = node.attrib.get("text") or ""
		desc = node.attrib.get("content-desc") or ""
		b = node.attrib.get("bounds")
		if not b:
			continue
		if not (t == label or desc == label):
			continue
		x, y = center(b)
		# Only consider bottom tab strip
		if y < 2100:
			continue
		prio = 0 if node.attrib.get("clickable") == "true" else 1
		matches.append((prio, y, x))
	if matches:
		matches.sort()
		_, y, x = matches[0]
		# Nudge up slightly if we only matched the small text label
		if y > 2320:
			y = 2297
		tap_xy(x, y, wait=1.4)
		print(f"TAB {label!r} -> {x},{y}")
	else:
		x, y = fallback[label]
		tap_xy(x, y, wait=1.4)
		print(f"TAB_FALLBACK {label!r} -> {x},{y}")

	t = texts()
	if len([x for x in t if x and x != "Tools"]) == 0:
		ensure_app_chrome()
		x, y = fallback[label]
		tap_xy(x, y, wait=1.4)


def wait_app_ready(timeout: float = 60.0) -> None:
	deadline = time.time() + timeout
	while time.time() < deadline:
		recover_redbox_if_needed()
		t = texts()
		if any(x in t for x in ("Ещё", "Главная", "Toyota", "История")):
			return
		low = " ".join(t).lower()
		if "failed to connect" in low or "problem loading" in low:
			tap_text_optional("Reload", contains=True)
			time.sleep(8)
			continue
		time.sleep(1.5)
	raise RuntimeError(f"app not ready; ui={texts()[:40]}")


def launch_app() -> None:
	ensure_reverse()
	adb_ok("shell", "am", "force-stop", PKG)
	time.sleep(1.5)
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
	time.sleep(18)
	recover_redbox_if_needed()
	dismiss_expo_tools()
	t = texts()
	if "Play Store" in t or "Chrome" in t:
		print("WARN on launcher; relaunch")
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
		time.sleep(16)
		recover_redbox_if_needed()


def open_more_settings() -> None:
	"""Navigate to More/Settings and confirm Data section is visible."""
	dismiss_anr_if_present()
	# Leave share sheets / document pickers if still open
	for _ in range(3):
		t = texts()
		blob = " ".join(t)
		if "Данные" in blob and "Создать резервную копию" in blob:
			break
		if "Downloads" in t or "Загрузки" in t or "Documents" in blob:
			back(wait=0.8)
			continue
		if has("ОТМЕНА") or has("Отмена"):
			tap_text_optional("ОТМЕНА") or tap_text_optional("Отмена")
			time.sleep(0.6)
			continue
		break
	go_tab("Ещё")
	# Retry once if settings chrome missing
	if not has("Данные"):
		ensure_app_chrome()
		go_tab("Ещё")
	wait_text("Данные", timeout=25)
	# Confirm backup action is on-screen before callers tap it
	if not has("Создать резервную копию"):
		# Scroll down a bit within More screen
		adb("shell", "input", "swipe", "540", "1600", "540", "900", "300")
		time.sleep(0.8)
	if not has("Создать резервную копию"):
		raise RuntimeError(f"settings missing backup actions; ui={texts()[:50]}")
	shot("p5-settings")


def extract_metrics_from_texts(tag: str, home: list[str], history: list[str], maint: list[str]) -> dict:
	metrics: dict = {"tag": tag}
	# Normalize NBSP so "9 400" matches UI "9\u00a0400"
	norm_home = [t.replace("\u00a0", " ") for t in home]
	norm_hist = [t.replace("\u00a0", " ") for t in history]
	norm_maint = [t.replace("\u00a0", " ") for t in maint]
	metrics["vehicle"] = next((t for t in home if t.strip() == "Toyota" or "Toyota" in t), None)
	metrics["has_417"] = any("4.17" in t or "4,17" in t for t in norm_home)
	metrics["has_708"] = any("7.08" in t or "7,08" in t for t in norm_home)
	metrics["has_4250"] = any("4250" in t for t in norm_home)
	metrics["has_9400"] = any("9 400" in t or "9400" in t for t in norm_home)
	metrics["consumption_clues"] = [t for t in home if "4.17" in t or "л/100" in t or "расход" in t.lower()]
	metrics["expense_clues"] = [t for t in home if "4250" in t or "Расход" in t]
	metrics["maint_clues"] = [t for t in (home + maint) if "9 400" in t.replace("\u00a0", " ") or "Maslo" in t or "ТО" in t][:20]
	metrics["fuel_history_clues"] = [t for t in history if "Заправка" in t or "₽" in t or "л" in t][:30]
	metrics["fuel_entry_count_hint"] = sum(1 for t in history if "Заправка" in t)
	metrics["has_mutate_car"] = any("P5MutateCar" in t for t in (home + history + maint))
	metrics["has_mutate_expense"] = any("P5MutateExpense" in t for t in (home + history + maint))
	metrics["home_sample"] = home[:40]
	metrics["history_sample"] = history[:40]
	metrics["maint_sample"] = maint[:40]
	# Keep lint quiet for unused after normalize
	_ = (norm_hist, norm_maint)
	return metrics


def capture_metrics(tag: str) -> dict:
	go_tab("Главная")
	time.sleep(1.2)
	dismiss_expo_tools()
	home = texts()
	# Ensure we are actually on Home (tab taps can miss under Expo Tools).
	if "Средний расход" not in home and "Автомобиль" not in home:
		print("WARN not on home after tab; retry")
		go_tab("Главная")
		time.sleep(1.5)
		home = texts()
	if home == ["Tools"] or (len(home) <= 2 and "Tools" in home):
		dismiss_expo_tools()
		go_tab("Главная")
		home = texts()
	shot(f"p5-{tag}-home")

	go_tab("История")
	time.sleep(1.2)
	history = texts()
	if "Все" not in history and "Заправки" not in history:
		print("WARN not on history after tab; retry")
		go_tab("История")
		time.sleep(1.5)
		history = texts()
	shot(f"p5-{tag}-history")

	maint: list[str] = []
	try:
		go_tab("ТО")
		time.sleep(1.2)
		maint = texts()
		shot(f"p5-{tag}-maint")
	except Exception as exc:  # noqa: BLE001
		print(f"WARN maint capture: {exc}")
		shot(f"p5-{tag}-maint-fail")

	metrics = extract_metrics_from_texts(tag, home, history, maint)
	print("METRICS", tag, json.dumps({
		k: metrics[k]
		for k in (
			"vehicle",
			"has_417",
			"has_708",
			"has_4250",
			"has_9400",
			"fuel_entry_count_hint",
			"has_mutate_car",
			"has_mutate_expense",
			"consumption_clues",
		)
		if k in metrics
	}, ensure_ascii=False))
	return metrics


def create_backup_to_downloads() -> str:
	open_more_settings()
	tap_text("Создать резервную копию")
	time.sleep(3.0)
	shot("p5-backup-share")
	sheet = texts()
	print("share sheet texts:", sheet[:40])

	# Capture production filename from share sheet title if present.
	filename = None
	for t in sheet:
		if t.startswith("auto-journal-backup-") and t.endswith(".json"):
			filename = t
			break
	if not filename:
		filename = f"auto-journal-backup-p5-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"

	# Do NOT dive into Drive/Files share targets (easy to leave the app).
	# One BACK dismisses the share sheet while keeping Auto Journal foreground.
	back(wait=1.0)
	# Ensure we are still in settings
	if not has("Данные"):
		open_more_settings()

	device_download = f"/sdcard/Download/{filename}"
	local_backup = OUT / ".tmp-p5-backup.json"

	# List cache dir without shell globs (toybox/run-as globbing is unreliable).
	ls_cache = adb_ok(
		"shell",
		"run-as",
		PKG,
		"ls",
		"cache",
		timeout=60,
	).stdout.strip()
	print("cache dir:", ls_cache)
	names = [ln.strip() for ln in ls_cache.splitlines() if ln.strip()]
	json_names = [
		n for n in names
		if n.endswith(".json") and n.startswith("auto-journal-backup-")
	]
	print("backup json names:", json_names)
	if not json_names:
		raise RuntimeError(f"no backup json in app cache after share; cache={names[:30]}")

	picked_name = filename if filename in json_names else sorted(json_names)[-1]
	picked_cache = f"cache/{picked_name}"
	raw = adb_ok("shell", "run-as", PKG, "cat", picked_cache, timeout=60)
	if raw.returncode != 0 or not raw.stdout.strip().startswith("{"):
		raise RuntimeError(f"failed to read cache backup {picked_cache}: {(raw.stderr or raw.stdout)[:200]}")

	local_backup.write_text(raw.stdout, encoding="utf-8")
	print(f"harvested {picked_cache} size={local_backup.stat().st_size}")
	filename = picked_name
	device_download = f"/sdcard/Download/{filename}"

	adb("push", str(local_backup), device_download)
	adb_ok(
		"shell",
		"am",
		"broadcast",
		"-a",
		"android.intent.action.MEDIA_SCANNER_SCAN_FILE",
		"-d",
		f"file://{device_download}",
	)
	ls = adb_ok("shell", "ls", "-l", device_download).stdout
	print("download ls:", ls.strip())
	return filename


def mutate_visible() -> str:
	"""Delete one fuel entry from History so restore is obvious."""
	go_tab("История")
	time.sleep(1.0)
	dismiss_expo_tools()
	dismiss_anr_if_present()
	# Dismiss leftover alerts if any
	if has("ОТМЕНА") or has("Отмена"):
		tap_text_optional("ОТМЕНА") or tap_text_optional("Отмена")
		time.sleep(0.8)
	shot("p5-before-mutate")

	root = dump()
	candidates = []
	for node in root.iter("node"):
		t = node.attrib.get("text") or ""
		b = node.attrib.get("bounds")
		if not b or not t:
			continue
		if "Заправка" not in t:
			continue
		y = center(b)[1]
		if 350 < y < 2000:
			candidates.append(node)

	if not candidates:
		go_tab("Главная")
		if tap_text_optional("+ Расход", contains=True):
			time.sleep(1.0)
			root = dump()
			edits = [n for n in root.iter("node") if n.attrib.get("class") == "android.widget.EditText"]
			if edits:
				x, y = center(edits[0].attrib["bounds"])
				tap_xy(x, y, wait=0.3)
				adb("shell", "input", "text", "P5MutateExpense")
			for label in ("Сохранить", "Save"):
				if has(label):
					tap_text(label)
					break
			shot("p5-after-mutate")
			return "added_expense_P5MutateExpense"
		raise RuntimeError(f"no fuel rows to delete; ui={texts()[:50]}")

	x, y = center(candidates[0].attrib["bounds"])
	tap_xy(x, y, wait=2.0)
	dismiss_expo_tools()
	# Confirm we are on the edit screen; re-open once if Tools stole focus
	if not (has("Удалить") or has("Редактирование") or has("Сохранить")):
		print("WARN fuel detail missing after tap; retrying row open")
		go_tab("История")
		time.sleep(1.0)
		dismiss_expo_tools()
		tap_xy(x, y, wait=2.0)
		dismiss_expo_tools()
	shot("p5-fuel-detail")

	# Delete may sit below the fold — swipe up once, then tap
	if not has("Удалить"):
		adb("shell", "input", "swipe", "540", "1800", "540", "900", "300")
		time.sleep(0.8)
		dismiss_expo_tools()

	if not tap_text_optional("Удалить", contains=True, wait=1.2):
		raise RuntimeError(f"delete control missing; ui={texts()[:50]}")
	time.sleep(1.0)
	shot("p5-delete-confirm")

	# Android Alert buttons are often UPPERCASE
	confirmed = False
	for label in ("УДАЛИТЬ", "Удалить", "DELETE", "Delete"):
		if has(label):
			tap_text(label, contains=False, wait=1.5)
			confirmed = True
			break
	if not confirmed:
		raise RuntimeError(f"confirm delete missing; ui={texts()[:50]}")

	# Wait until confirm dialog gone
	deadline = time.time() + 10
	while time.time() < deadline:
		t = texts()
		if "Удалить заправку?" not in t and "ОТМЕНА" not in t:
			break
		time.sleep(0.6)
	shot("p5-after-mutate")
	return "deleted_fuel_entry"


def restore_from_downloads(filename: str) -> dict:
	open_more_settings()
	tap_text("Восстановить из резервной копии")
	time.sleep(2.5)
	shot("p5-doc-picker")
	print("picker texts:", texts()[:50])

	# If target JSON is already listed (common when picker opens on Downloads),
	# do NOT tap the "Downloads" breadcrumb — that jumps to Recent/roots.
	already_listed = has(filename) or any(
		"auto-journal-backup" in t and t.endswith(".json") for t in texts()
	)
	if not already_listed:
		root = dump()
		for node in root.iter("node"):
			desc = (node.attrib.get("content-desc") or "").lower()
			if any(k in desc for k in ("show roots", "drawer", "navigate up", "меню", "навигац")):
				if node.attrib.get("bounds"):
					x, y = center(node.attrib["bounds"])
					tap_xy(x, y, wait=1.0)
					break
		for label in ("Downloads", "Загрузки", "Download"):
			# Only tap a roots-drawer entry, not the top app-bar title when already inside
			root = dump()
			for node in root.iter("node"):
				t = node.attrib.get("text") or ""
				if t != label:
					continue
				b = node.attrib.get("bounds") or ""
				m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b)
				if not m:
					continue
				y1 = int(m.group(2))
				# Drawer rows are mid-screen; skip the top title bar (~y<400)
				if y1 < 400:
					continue
				x, y = center(b)
				tap_xy(x, y, wait=1.2)
				print(f"TAP roots {label!r} -> {x},{y}")
				break
			time.sleep(0.8)

	# Prefer list view for stabler hit targets if available
	root = dump()
	for node in root.iter("node"):
		desc = (node.attrib.get("content-desc") or "").lower()
		if "list view" in desc and node.attrib.get("clickable") == "true":
			x, y = center(node.attrib["bounds"])
			tap_xy(x, y, wait=1.0)
			print("switched to list view")
			break

	shot("p5-doc-picker-downloads")

	# DocumentsUI: filename TextView is often NOT clickable.
	# Tap the large clickable card FrameLayout that contains the file
	# (avoid the small "Preview the file ..." control).
	picked = False
	root = dump()
	cards: list[tuple[int, int, int, str]] = []
	for node in root.iter("node"):
		if node.attrib.get("clickable") != "true":
			continue
		b = node.attrib.get("bounds")
		if not b:
			continue
		desc = node.attrib.get("content-desc") or ""
		text = node.attrib.get("text") or ""
		# Collect child text for cards with empty self text
		child_texts = []
		for ch in node.iter("node"):
			ct = ch.attrib.get("text") or ""
			if ct:
				child_texts.append(ct)
		blob = " ".join([desc, text, *child_texts])
		if filename not in blob and "auto-journal-backup" not in blob:
			continue
		if "preview the file" in desc.lower():
			continue
		m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b)
		if not m:
			continue
		x1, y1, x2, y2 = map(int, m.groups())
		area = (x2 - x1) * (y2 - y1)
		if area < 20000:
			continue
		x, y = (x1 + x2) // 2, (y1 + y2) // 2
		cards.append((area, x, y, blob[:80]))

	cards.sort(reverse=True)
	print("picker cards:", cards[:5])
	if cards:
		_, x, y, blob = cards[0]
		# Prefer exact filename match if present among top cards
		for area, cx, cy, bl in cards:
			if filename in bl:
				x, y, blob = cx, cy, bl
				break
		tap_xy(x, y, wait=2.5)
		print(f"TAP file card {blob!r} -> {x},{y}")
		picked = True

	if not picked:
		raise RuntimeError(f"DocumentPicker could not select {filename}; ui={texts()[:60]}")

	# Wait for preview alert from app
	deadline = time.time() + 15
	while time.time() < deadline:
		if has("Автомобилей") or has("Резервная копия") or has("Восстановить"):
			break
		time.sleep(0.8)

	shot("p5-restore-preview")
	preview_texts = texts()
	print("preview texts:", preview_texts[:50])
	joined = "\n".join(preview_texts)
	preview = {
		"raw": preview_texts[:60],
		"has_vehicles": "Автомобилей" in joined,
		"has_fuel": "Заправок" in joined,
		"has_expenses": "Расходов" in joined,
		"has_maint": "ТО:" in joined,
		"has_replace_warning": ("заменены" in joined.lower()) or ("замен" in joined.lower()),
	}
	for key, pat in (
		("vehicleCount", r"Автомобилей:\s*(\d+)"),
		("fuelCount", r"Заправок:\s*(\d+)"),
		("expenseCount", r"Расходов:\s*(\d+)"),
		("maintenanceCount", r"ТО:\s*(\d+)"),
	):
		m = re.search(pat, joined)
		preview[key] = int(m.group(1)) if m else None

	if not preview["has_vehicles"] or not preview["has_fuel"]:
		raise RuntimeError(f"preview dialog missing expected fields: {preview_texts[:40]}")

	if not tap_text_optional("Восстановить") and not tap_text_optional("ВОССТАНОВИТЬ"):
		raise RuntimeError("confirm Восстановить missing")
	time.sleep(3.5)
	shot("p5-restore-done")
	for label in ("ОК", "OK", "Готово"):
		if has(label):
			tap_text_optional(label)
			time.sleep(0.8)
			break
	return preview


def metrics_match(baseline: dict, current: dict, stage: str) -> list[str]:
	issues = []
	if baseline.get("has_417") and not current.get("has_417"):
		issues.append(f"{stage}: missing consumption 4.17")
	if baseline.get("vehicle") and not (current.get("vehicle") and "Toyota" in str(current.get("vehicle"))):
		issues.append(f"{stage}: Toyota missing")
	if baseline.get("has_4250") and not current.get("has_4250"):
		issues.append(f"{stage}: expenses 4250 missing")
	if baseline.get("has_9400") and not current.get("has_9400"):
		issues.append(f"{stage}: maint 9400 missing")
	if current.get("has_mutate_car") or current.get("has_mutate_expense"):
		issues.append(f"{stage}: mutate marker still present")
	# Fuel count should be restored at least to baseline hint if we deleted one
	b = baseline.get("fuel_entry_count_hint") or 0
	c = current.get("fuel_entry_count_hint") or 0
	if b and c < b:
		issues.append(f"{stage}: fuel history count {c} < baseline {b}")
	return issues


def main() -> int:
	print("=== Phase 5 restore smoke ===")
	ensure_reverse()
	launch_app()
	wait_app_ready()
	shot("p5-app-ready")

	baseline = capture_metrics("baseline")
	if not baseline.get("has_417") or not baseline.get("vehicle"):
		raise RuntimeError(
			f"baseline not usable for restore smoke: "
			f"vehicle={baseline.get('vehicle')} has_417={baseline.get('has_417')} "
			f"home={baseline.get('home_sample', [])[:20]}"
		)
	backup_name = create_backup_to_downloads()
	print("BACKUP_FILE", backup_name)

	mutate_action = mutate_visible()
	print("MUTATE", mutate_action)
	mutated = capture_metrics("mutated")

	preview = restore_from_downloads(backup_name)
	print("PREVIEW", json.dumps(preview, ensure_ascii=False, indent=2))

	post = capture_metrics("post-restore")
	issues = metrics_match(baseline, post, "post-restore")
	print("POST_ISSUES", issues)

	adb_ok("shell", "am", "force-stop", PKG)
	time.sleep(1.5)
	launch_app()
	wait_app_ready(timeout=40)
	post_restart = capture_metrics("post-restart")
	issues2 = metrics_match(baseline, post_restart, "post-restart")
	print("RESTART_ISSUES", issues2)

	passed = not issues and not issues2 and baseline.get("has_417") is True
	report = {
		"result": "PASS" if passed else "FAIL",
		"baseline": baseline,
		"mutate": mutate_action,
		"backup_filename": backup_name,
		"backup_path": f"/sdcard/Download/{backup_name}",
		"preview": preview,
		"mutated": mutated,
		"post_restore": post,
		"post_restart": post_restart,
		"defects": issues + issues2,
	}
	REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
	print("REPORT", REPORT)
	print("RESULT", report["result"])
	return 0 if passed else 1


if __name__ == "__main__":
	try:
		sys.exit(main())
	except Exception as exc:  # noqa: BLE001
		print("FAIL:", exc)
		try:
			shot("p5-fail")
			print("texts:", texts()[:80])
		except Exception:
			pass
		sys.exit(1)
