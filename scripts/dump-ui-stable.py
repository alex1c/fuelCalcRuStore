from pathlib import Path
import re
import subprocess
import time

PKG = "com.calculatorplatform.autojournal"
path = Path(r"D:\petProject\fuelCalcRuStore\.tmp-ui.xml")

subprocess.run(["adb", "reverse", "tcp:8081", "tcp:8081"], check=False)
subprocess.run(["adb", "shell", "am", "force-stop", PKG], check=False)
time.sleep(1)
subprocess.run(
	[
		"adb",
		"shell",
		"am",
		"start",
		"-n",
		f"{PKG}/.MainActivity",
		"-a",
		"android.intent.action.VIEW",
		"-d",
		"exp+auto-journal://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081",
	],
	check=False,
)
print("waiting for bundle...")
time.sleep(18)
# Focus center to leave Expo Tools overlay
subprocess.run(["adb", "shell", "input", "tap", "540", "1200"], check=False)
time.sleep(1)
subprocess.run(["adb", "shell", "uiautomator", "dump", "/sdcard/ui.xml"], check=False)
subprocess.run(["adb", "pull", "/sdcard/ui.xml", str(path)], check=False)
subprocess.run(["adb", "shell", "screencap", "-p", "/sdcard/aj-stable.png"], check=False)
subprocess.run(
	["adb", "pull", "/sdcard/aj-stable.png", r"D:\petProject\fuelCalcRuStore\.tmp-p3-stable.png"],
	check=False,
)
text = path.read_text(encoding="utf-8", errors="replace")
print("len", len(text))
for t in sorted(set(re.findall(r'text="([^"]+)"', text))):
	print("-", t)
