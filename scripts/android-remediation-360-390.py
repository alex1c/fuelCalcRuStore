#!/usr/bin/env python3
"""
Final release remediation walk for Auto Journal.

Captures screens at ~360dp and ~390dp widths on Pixel_10 emulator,
checks CTA/banner stacking, ads behavior, and launcher branding.

Requires: emulator online, Metro on 8081, debug APK installed.
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
DUMP = OUT / ".tmp-remediation-ui.xml"
PKG = "com.calculatorplatform.autojournal"
SERIAL = "emulator-5554"
DEV_URL = (
	"exp+auto-journal://expo-development-client/"
	"?url=http%3A%2F%2F127.0.0.1%3A8081"
)
REPORT = OUT / ".tmp-remediation-report.json"

# Physical px kept at 1080-wide; density controls logical dp width.
# 360dp: density = 1080 * 160 / 360 = 480
# 390dp: density = 1080 * 160 / 390 ≈ 443
MODE_360 = {"tag": "360", "size": "1080x2400", "density": "480"}
MODE_390 = {"tag": "390", "size": "1080x2400", "density": "443"}


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


def dump(retries: int = 8) -> ET.Element:
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


def parse_bounds(bounds: str) -> tuple[int, int, int, int]:
	m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
	assert m
	return tuple(map(int, m.groups()))  # type: ignore[return-value]


def texts(root: ET.Element | None = None) -> list[str]:
	root = dump() if root is None else root
	return [n.attrib.get("text", "") for n in root.iter("node") if n.attrib.get("text")]


def all_nodes(root: ET.Element | None = None) -> list[ET.Element]:
	root = dump() if root is None else root
	return list(root.iter("node"))


def find_nodes_with_text(fragment: str, root: ET.Element | None = None) -> list[ET.Element]:
	root = dump() if root is None else root
	out: list[ET.Element] = []
	for node in root.iter("node"):
		t = node.attrib.get("text") or ""
		desc = node.attrib.get("content-desc") or ""
		if fragment in t or fragment in desc:
			out.append(node)
	return out


def shot(name: str) -> Path:
	remote = f"/sdcard/{name}.png"
	local = OUT / f".tmp-remediation-{name}.png"
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
	root = dump()
	joined = " | ".join(texts(root))
	if "isn't responding" in joined or "не отвечает" in joined.lower():
		tap_text("Wait", wait=1.0) or tap_text("Ожидание", wait=1.0) or tap_xy(700, 1400)
	if allow_back and ("Expo" in joined or "Dev Menu" in joined):
		tap_xy(540, 1200, wait=0.5)
		back(0.5)


def set_wm(size: str, density: str) -> None:
	adb_ok("shell", "wm", "size", size)
	adb_ok("shell", "wm", "density", density)
	time.sleep(1.0)
	sz = (adb_ok("shell", "wm", "size").stdout or "").strip()
	den = (adb_ok("shell", "wm", "density").stdout or "").strip()
	print(f"WM {sz} | {den}")


def reset_wm() -> None:
	adb_ok("shell", "wm", "size", "reset")
	adb_ok("shell", "wm", "density", "reset")
	time.sleep(0.8)
	print("WM reset")


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
	time.sleep(16)
	dismiss_overlays(allow_back=True)


def wait_home(timeout: float = 60.0) -> list[str]:
	deadline = time.time() + timeout
	while time.time() < deadline:
		dismiss_overlays(allow_back=True)
		t = texts()
		if any("Средний расход" in x for x in t) or any("+ Заправка" in x for x in t):
			return t
		if any("Главная" in x for x in t) and any("Ещё" in x for x in t):
			time.sleep(1.2)
			continue
		time.sleep(1.2)
	raise RuntimeError(f"home not ready; have={texts()[:40]}")


def go_tab(label: str) -> None:
	if not tap_text(label, wait=1.5):
		# Coordinate fallbacks for 5-tab bar on ~1080-wide emulator.
		fallbacks = {
			"Главная": (108, 2297),
			"История": (324, 2297),
			"ТО": (540, 2297),
			"Стат.": (756, 2297),
			"Ещё": (972, 2297),
		}
		if label in fallbacks:
			x, y = fallbacks[label]
			print(f"TAB FALLBACK {label} -> {x},{y}")
			tap_xy(x, y, wait=1.5)
		else:
			raise RuntimeError(f"tab {label!r} missing; have={texts()[:40]}")


def node_visible(node: ET.Element, screen_w: int, screen_h: int) -> bool:
	b = node.attrib.get("bounds")
	if not b:
		return False
	x1, y1, x2, y2 = parse_bounds(b)
	if x2 <= x1 or y2 <= y1:
		return False
	# Fully clipped off-screen?
	if x2 <= 0 or y2 <= 0 or x1 >= screen_w or y1 >= screen_h:
		return False
	return True


def analyze_home_layout(tag: str) -> dict:
	"""Check +Заправка visibility and that banner is below CTA."""
	root = dump()
	# Physical size from wm (Override size line preferred).
	sz_out = adb_ok("shell", "wm", "size").stdout or ""
	m = re.search(r"Override size:\s*(\d+)x(\d+)", sz_out)
	if not m:
		m = re.search(r"Physical size:\s*(\d+)x(\d+)", sz_out)
	screen_w, screen_h = (int(m.group(1)), int(m.group(2))) if m else (1080, 2400)

	cta_nodes = find_nodes_with_text("+ Заправка", root)
	cta_ok = False
	cta_bounds = None
	for n in cta_nodes:
		if n.attrib.get("bounds") and node_visible(n, screen_w, screen_h):
			cta_ok = True
			cta_bounds = parse_bounds(n.attrib["bounds"])
			break

	# Banner heuristics: WebView / Ad view / yandex package below CTA.
	banner_below = True
	banner_covering = False
	banner_notes: list[str] = []
	cta_bottom = cta_bounds[3] if cta_bounds else None

	for n in root.iter("node"):
		cls = n.attrib.get("class") or ""
		pkg = n.attrib.get("package") or ""
		desc = (n.attrib.get("content-desc") or "").lower()
		text = (n.attrib.get("text") or "").lower()
		is_adish = (
			"WebView" in cls
			or "yandex" in pkg.lower()
			or "ad" in desc
			or "реклам" in text
			or "banner" in desc
		)
		if not is_adish or not n.attrib.get("bounds"):
			continue
		bx1, by1, bx2, by2 = parse_bounds(n.attrib["bounds"])
		# Ignore tiny / zero nodes and full-screen containers.
		h = by2 - by1
		w = bx2 - bx1
		if h < 40 or w < 80:
			continue
		if h > screen_h * 0.6:
			continue
		banner_notes.append(f"{cls}:{n.attrib['bounds']}")
		if cta_bottom is not None:
			# Banner covering CTA if it overlaps CTA vertical range significantly.
			cta_top = cta_bounds[1] if cta_bounds else 0
			overlap = not (by2 <= cta_top or by1 >= cta_bottom)
			if overlap and by1 < cta_bottom - 20:
				banner_covering = True
			if by1 < cta_bottom - 40:
				banner_below = False

	# Also check secondary CTAs not clipped.
	secondary_ok = True
	for label in ("+ Расход", "+ ТО"):
		nodes = find_nodes_with_text(label, root)
		if nodes and not any(
			node_visible(n, screen_w, screen_h) for n in nodes if n.attrib.get("bounds")
		):
			secondary_ok = False

	defects: list[str] = []
	if not cta_ok:
		defects.append("+ Заправка missing or clipped")
	if banner_covering:
		defects.append("banner overlaps/covers +Заправка")
	if not banner_below and banner_notes:
		defects.append("banner appears above/overlapping CTA stack")
	if not secondary_ok:
		defects.append("secondary CTAs clipped")

	result = {
		"screen": "home",
		"cta_visible": cta_ok,
		"cta_bounds": cta_bounds,
		"banner_below_cta": banner_below,
		"banner_covering_cta": banner_covering,
		"banner_notes": banner_notes[:6],
		"secondary_ctas_ok": secondary_ok,
		"defects": defects,
		"texts_sample": [t for t in texts(root) if t][:20],
	}
	print(f"[{tag}] home layout: cta={cta_ok} banner_below={banner_below} covering={banner_covering} defects={defects}")
	return result


def analyze_generic(screen: str, expect_any: list[str], tag: str) -> dict:
	root = dump()
	t = texts(root)
	joined = " | ".join(t)
	found = [e for e in expect_any if any(e in x for x in t)]
	ok = len(found) > 0
	# Overflow heuristic: look for truncated-looking very short labels that match starts
	# of expected longer titles — weak signal; mainly rely on screenshots.
	defects: list[str] = []
	if not ok:
		defects.append(f"expected any of {expect_any}, got sample={t[:15]}")
	# Detect ANR / blank
	if "isn't responding" in joined:
		defects.append("ANR dialog")
	print(f"[{tag}] {screen}: ok={ok} found={found}")
	return {
		"screen": screen,
		"ok": ok and not defects,
		"found": found,
		"defects": defects,
		"texts_sample": t[:20],
	}


def fill_focused(text: str) -> None:
	adb("shell", "input", "text", text.replace(" ", "%s"))
	time.sleep(0.3)


def check_fuel_save_no_interstitial(tag: str) -> dict:
	"""Open fuel form, attempt save, ensure no interstitial hang."""
	go_tab("Главная")
	time.sleep(0.8)
	if not tap_text("+ Заправка", wait=1.8):
		return {"ok": False, "detail": "CTA missing", "defects": ["cannot open fuel form"]}
	time.sleep(1.5)
	fuel_t = texts()
	form_ok = any("Заправка" in t for t in fuel_t) or any("Полный бак" in t for t in fuel_t)
	shot(f"{tag}-fuel-add")

	root = dump()
	edits = [
		n
		for n in root.iter("node")
		if "EditText" in (n.attrib.get("class") or "") and n.attrib.get("bounds")
	]
	# Unique odometer per run to avoid validation collisions.
	odo = str(900000 + int(time.time()) % 90000)
	values = [odo, "35", "2100"]
	for idx, node in enumerate(edits[:3]):
		x, y = center(node.attrib["bounds"])
		tap_xy(x, y, wait=0.3)
		adb_ok("shell", "input", "keyevent", "KEYCODE_MOVE_END")
		for _ in range(16):
			adb_ok("shell", "input", "keyevent", "67")
		fill_focused(values[idx])

	adb_ok("logcat", "-c")
	if not tap_text("Сохранить", wait=2.5):
		back(1.0)
		return {
			"ok": form_ok,
			"detail": "save button missing",
			"defects": ["save missing"] if form_ok else ["fuel form incomplete"],
			"form_ok": form_ok,
		}

	time.sleep(2.5)
	dismiss_overlays(allow_back=False)
	after = texts()
	stuck_ad = any(
		x in " ".join(after).lower() for x in ("реклама", "закрыть реклам", "close ad")
	)
	anr = any("isn't responding" in t for t in after)
	back_home = any("Средний расход" in t for t in after) or any("+ Заправка" in t for t in after)
	# logcat interstitial hints
	log = adb_ok("logcat", "-d", "-t", "80").stdout or ""
	interstitial_log = any(
		k in log.lower() for k in ("interstitial", "fullscreenad", "showinterstitial")
	)
	ok = form_ok and not stuck_ad and not anr and not interstitial_log
	defects: list[str] = []
	if stuck_ad:
		defects.append("ad UI after fuel save")
	if anr:
		defects.append("ANR after fuel save")
	if interstitial_log:
		defects.append("interstitial mentioned in logcat after save")
	shot(f"{tag}-fuel-after-save")
	if not back_home:
		back(1.0)
		go_tab("Главная")
	return {
		"ok": ok,
		"form_ok": form_ok,
		"back_home": back_home,
		"stuck_ad": stuck_ad,
		"anr": anr,
		"interstitial_log": interstitial_log,
		"defects": defects,
	}


def walk_mode(mode: dict) -> dict:
	tag = mode["tag"]
	print(f"\n=== MODE {tag} dp ===")
	set_wm(mode["size"], mode["density"])
	launch_app()
	wait_home()

	screens: list[dict] = []
	shots: list[str] = []

	# Home
	home = analyze_home_layout(tag)
	p = shot(f"{tag}-home")
	shots.append(str(p))
	screens.append(home)

	# Fuel add (open only; save checked once later in ads section for 360)
	go_tab("Главная")
	if tap_text("+ Заправка", wait=1.8):
		time.sleep(1.2)
		fuel = analyze_generic("fuel_add", ["Заправка", "Полный бак", "Сохранить"], tag)
		p = shot(f"{tag}-fuel-add")
		shots.append(str(p))
		screens.append(fuel)
		back(1.0)
	else:
		screens.append({"screen": "fuel_add", "ok": False, "defects": ["CTA missing"]})

	# History
	go_tab("История")
	time.sleep(1.2)
	hist = analyze_generic("history", ["История"], tag)
	p = shot(f"{tag}-history")
	shots.append(str(p))
	screens.append(hist)

	# Maintenance (ТО)
	go_tab("ТО")
	time.sleep(1.2)
	maint = analyze_generic("maintenance", ["Обслуживание", "ТО", "+ ТО"], tag)
	p = shot(f"{tag}-maintenance")
	shots.append(str(p))
	screens.append(maint)

	# Stats
	go_tab("Стат.")
	time.sleep(2.5)
	dismiss_overlays(allow_back=False)
	st = texts()
	if any(x in " ".join(st).lower() for x in ("закрыть", "close ad")) and not any(
		"Статистика" in t for t in st
	):
		back(1.0)
		st = texts()
	stats = analyze_generic("stats", ["Статистика"], tag)
	# Layout break check: tabs still visible after open
	tabs_ok = any("Главная" in t for t in texts()) and any("Ещё" in t for t in texts())
	if not tabs_ok:
		stats["defects"] = list(stats.get("defects") or []) + ["tabs missing after stats open"]
		stats["ok"] = False
	p = shot(f"{tag}-stats")
	shots.append(str(p))
	screens.append(stats)

	# Settings / Ещё
	go_tab("Ещё")
	time.sleep(1.2)
	settings = analyze_generic(
		"settings",
		["Ещё", "Калькулятор поездки", "резервн", "Настройки", "Автожурнал"],
		tag,
	)
	p = shot(f"{tag}-settings")
	shots.append(str(p))
	screens.append(settings)

	# Trip calculator
	if not tap_text("Калькулятор поездки", wait=1.8):
		screens.append({"screen": "trip", "ok": False, "defects": ["button missing"]})
	else:
		time.sleep(1.5)
		trip = analyze_generic(
			"trip",
			["Калькулятор поездки", "расстояние", "Понадобится", "Введите"],
			tag,
		)
		p = shot(f"{tag}-trip")
		shots.append(str(p))
		screens.append(trip)
		back(1.0)

	# Ads / CTA stacking checks (home banner + fuel save) — run once per mode on home
	go_tab("Главная")
	time.sleep(1.0)
	home2 = analyze_home_layout(tag)
	screens.append({"screen": "home_ads_recheck", **{k: home2[k] for k in home2 if k != "screen"}})

	fuel_save = check_fuel_save_no_interstitial(tag)
	screens.append({"screen": "fuel_save_no_interstitial", **fuel_save})

	all_defects: list[str] = []
	for s in screens:
		for d in s.get("defects") or []:
			all_defects.append(f"{s.get('screen')}: {d}")

	# Pass if every named screen opened and no layout/ad defects.
	required = {"home", "fuel_add", "history", "maintenance", "stats", "settings", "trip"}
	seen = {s.get("screen") for s in screens}
	missing = required - seen
	screen_fails = [
		s.get("screen")
		for s in screens
		if s.get("screen") in required and s.get("ok") is False
	]
	home_fail = any(
		s.get("screen") == "home" and s.get("defects") for s in screens
	)
	ads_fail = any(
		s.get("screen") == "fuel_save_no_interstitial" and not s.get("ok") for s in screens
	)
	passed = not missing and not screen_fails and not home_fail and not ads_fail and not all_defects

	result = {
		"mode": tag,
		"pass": passed,
		"screens_checked": sorted(required & seen),
		"missing_screens": sorted(missing),
		"defects": all_defects,
		"screens": screens,
		"screenshots": shots,
		"wm": mode,
	}
	print(f"MODE {tag}: {'PASS' if passed else 'FAIL'} defects={all_defects}")
	return result


def check_launcher_branding() -> dict:
	"""Confirm launcher label is Автожурнал, not tile calculator branding."""
	# Dump launcher after HOME
	adb_ok("shell", "input", "keyevent", "KEYCODE_HOME")
	time.sleep(1.5)
	# Try to find app icon via launcher dump
	root = dump()
	t = texts(root)
	labels = [x for x in t if "Автожурнал" in x or "калькулятор" in x.lower() or "Calculator" in x]
	# Also query package manager label
	pm = adb_ok(
		"shell",
		"dumpsys",
		"package",
		PKG,
	).stdout or ""
	# applicationLabel from dumpsys is sparse; use cmd package resolve / pm path + aapt if needed
	label_dump = adb_ok(
		"shell",
		"cmd",
		"package",
		"resolve-activity",
		"--brief",
		PKG,
	).stdout or ""

	# Prefer UIAutomator: open app drawer search if present
	has_autojournal = any("Автожурнал" in x for x in t)
	has_calc_brand = any(
		re.search(r"(?i)tile.?calc|calculator.?platform|калькулятор платформ", x)
		for x in t
	)

	# Fallback: parse AndroidManifest application label via dumpsys activity
	act = adb_ok("shell", "dumpsys", "activity", "activities").stdout or ""
	# Check installed app label via `adb shell pm dump`
	pmd = adb_ok("shell", "pm", "dump", PKG).stdout or ""
	# Look for applicationInfo labelRes / nonLocalizedLabel
	m = re.search(r"nonLocalizedLabel=([^\s]+)", pmd)
	nll = m.group(1) if m else ""
	# Also try: aapt from local apk
	apk = OUT / "android" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
	aapt_label = ""
	if apk.exists():
		aapt = Path(os.environ.get("ANDROID_HOME", r"C:\Users\alex1\AppData\Local\Android\Sdk")) / "build-tools"
		# pick newest build-tools
		bt = sorted([p for p in aapt.iterdir() if p.is_dir()], reverse=True)
		if bt:
			aapt_bin = bt[0] / "aapt.exe"
			if aapt_bin.exists():
				r = subprocess.run(
					[str(aapt_bin), "dump", "badging", str(apk)],
					capture_output=True,
					text=True,
					encoding="utf-8",
					errors="replace",
				)
				mm = re.search(r"application-label(?:-ru)?:'([^']+)'", r.stdout or "")
				if not mm:
					mm = re.search(r"application-label:'([^']+)'", r.stdout or "")
				if mm:
					aapt_label = mm.group(1)

	ok = (aapt_label == "Автожурнал") or has_autojournal
	bad = ("calc" in aapt_label.lower()) or has_calc_brand
	shot("launcher-home")
	result = {
		"ok": ok and not bad,
		"aapt_label": aapt_label,
		"nonLocalizedLabel": nll,
		"launcher_texts_hit": labels[:10],
		"has_autojournal_on_home": has_autojournal,
		"has_calc_brand": has_calc_brand,
		"resolve": label_dump.strip()[:200],
	}
	print(f"BRANDING ok={result['ok']} label={aapt_label!r} hits={labels[:8]}")
	return result


def main() -> int:
	print("=== Final release remediation 360/390 ===")
	ensure_reverse()
	# Confirm metro
	try:
		import urllib.request

		with urllib.request.urlopen("http://127.0.0.1:8081/status", timeout=3) as resp:
			print("metro", resp.read()[:80])
	except Exception as exc:  # noqa: BLE001
		print("WARN metro status:", exc)

	branding = check_launcher_branding()

	results = []
	try:
		results.append(walk_mode(MODE_360))
		results.append(walk_mode(MODE_390))
	finally:
		reset_wm()

	report = {
		"branding": branding,
		"modes": results,
		"overall_360": results[0]["pass"] if results else False,
		"overall_390": results[1]["pass"] if len(results) > 1 else False,
	}
	REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
	print("REPORT", REPORT)
	print("360", "PASS" if report["overall_360"] else "FAIL")
	print("390", "PASS" if report["overall_390"] else "FAIL")
	print("branding", "PASS" if branding.get("ok") else "FAIL")
	return 0 if report["overall_360"] and report["overall_390"] and branding.get("ok") else 1


if __name__ == "__main__":
	raise SystemExit(main())
