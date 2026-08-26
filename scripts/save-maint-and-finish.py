import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

DUMP = Path(r"D:\petProject\fuelCalcRuStore\.tmp-ui.xml")
OUT = Path(r"D:\petProject\fuelCalcRuStore")


def adb(*a, check=True):
	subprocess.run(
		["adb", *a],
		check=check,
		capture_output=True,
		text=True,
		encoding="utf-8",
		errors="replace",
	)


def dump():
	adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
	adb("pull", "/sdcard/ui.xml", str(DUMP))
	return ET.parse(DUMP).getroot()


def center(b):
	m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b)
	x1, y1, x2, y2 = map(int, m.groups())
	return (x1 + x2) // 2, (y1 + y2) // 2


def texts():
	return [n.attrib.get("text", "") for n in dump().iter("node") if n.attrib.get("text")]


def tap_text(t, w=1.2):
	root = dump()
	for n in root.iter("node"):
		if n.attrib.get("text") == t and n.attrib.get("bounds"):
			x, y = center(n.attrib["bounds"])
			adb("shell", "input", "tap", str(x), str(y))
			time.sleep(w)
			print("TAP", t)
			return
	raise SystemExit(f"missing {t}: {texts()[:40]}")


def tap_contains(frag, w=1.2):
	root = dump()
	for n in root.iter("node"):
		tt = n.attrib.get("text") or ""
		if frag in tt and n.attrib.get("bounds"):
			x, y = center(n.attrib["bounds"])
			adb("shell", "input", "tap", str(x), str(y))
			time.sleep(w)
			print("TAPC", frag)
			return
	raise SystemExit(f"missing {frag}: {texts()[:40]}")


def edits():
	return [
		n
		for n in dump().iter("node")
		if n.attrib.get("class") == "android.widget.EditText"
	]


def tap_edit(i):
	e = edits()
	x, y = center(e[i].attrib["bounds"])
	adb("shell", "input", "tap", str(x), str(y))
	time.sleep(0.45)
	print("EDIT", i, e[i].attrib.get("text"))


def clear_type(v):
	for _ in range(16):
		adb("shell", "input", "keyevent", "67", check=False)
	adb("shell", "input", "text", v.replace(" ", "%s"), check=False)
	time.sleep(0.4)
	print("TYPE", v)


def shot(name):
	adb("shell", "screencap", "-p", f"/sdcard/{name}.png")
	adb("pull", f"/sdcard/{name}.png", str(OUT / f".tmp-{name}.png"))


print("start", texts()[:15])
tap_edit(0)
clear_type("Maslo")
tap_edit(2)
clear_type("10000")
tap_edit(3)
clear_type("10000")
tap_edit(4)
for _ in range(12):
	adb("shell", "input", "keyevent", "67", check=False)
adb("shell", "input", "keyevent", "4", check=False)
time.sleep(0.5)
tap_text("Сохранить", 2.8)
shot("p3-maint-ok")
joined = " | ".join(texts())
print("LIST", joined)
if "9400" not in joined and "9 400" not in joined:
	raise SystemExit("no 9400 after save")

tap_text("История", 1.3)
tap_contains("300 км", 1.6)
tap_edit(2)
clear_type("25")
adb("shell", "input", "keyevent", "4", check=False)
time.sleep(0.4)
tap_text("Сохранить", 2.5)
tap_text("Главная", 1.3)
joined = " | ".join(texts())
print("EDITED", joined)
if "8,3" not in joined and "8.3" not in joined:
	raise SystemExit("no 8.3")

tap_text("История", 1.3)
tap_contains("300 км", 1.6)
tap_text("Удалить", 1.0)
time.sleep(0.6)
root = dump()
for n in list(root.iter("node"))[::-1]:
	if n.attrib.get("text") == "Удалить":
		x, y = center(n.attrib["bounds"])
		adb("shell", "input", "tap", str(x), str(y))
		time.sleep(2.2)
		print("deleted")
		break

tap_text("Главная", 1.3)
shot("p3-deleted")
print("DEL", " | ".join(texts()))

adb("shell", "am", "force-stop", "com.calculatorplatform.autojournal")
time.sleep(1.2)
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
time.sleep(20)
shot("p3-restart")
joined = " | ".join(texts())
print("RESTART", joined)
assert "Toyota" in joined
print("SMOKE_PASS")
