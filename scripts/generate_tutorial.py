from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import os
import json
import re
import shutil
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"
WORK = ROOT / ".tutorial-build"
OUT.mkdir(exist_ok=True)
WORK.mkdir(exist_ok=True)

W, H = 1280, 720
BG = "#0B0B0C"
PANEL = "#151517"
LINE = "#303036"
INK = "#F4F4F5"
MUTED = "#A1A1AA"
RED = "#E0142B"
GREEN = "#5FB98A"

FONT = "/System/Library/Fonts/SFNS.ttf"
FONT_BOLD = "/System/Library/Fonts/SFNSDisplay.ttf"

def font(size, bold=False):
    path = FONT_BOLD if bold and Path(FONT_BOLD).exists() else FONT
    return ImageFont.truetype(path, size)

def wrap(draw, text, fnt, width):
    words, lines, line = text.split(), [], ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=fnt)[2] <= width:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines

def slide(number, title, body, steps, filename):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    for x in range(0, W, 80):
        d.line((x, 0, x, H), fill="#111114", width=1)
    for y in range(0, H, 80):
        d.line((0, y, W, y), fill="#111114", width=1)
    d.rounded_rectangle((64, 52, W - 64, H - 52), radius=26, fill=PANEL, outline=LINE, width=2)
    # Exact Deal Pro mark used in the website navigation: red rounded square,
    # white D silhouette and the red crossbar cut-out.
    d.rounded_rectangle((96, 84, 160, 148), radius=13, fill=RED)
    d.rectangle((115, 100, 127, 132), fill="white")
    d.ellipse((115, 100, 148, 132), fill="white")
    d.rectangle((115, 113, 128, 120), fill=RED)
    d.text((184, 97), "DEAL PRO", font=font(27, True), fill=INK)
    d.text((W - 176, 101), f"0{number}", font=font(22, True), fill=RED)
    d.text((96, 205), title, font=font(55, True), fill=INK)
    y = 288
    for line in wrap(d, body, font(25), 1010):
        d.text((98, y), line, font=font(25), fill=MUTED)
        y += 36
    y += 28
    for item in steps:
        d.ellipse((101, y + 7, 115, y + 21), fill=GREEN)
        d.text((137, y), item, font=font(23), fill=INK)
        y += 54
    d.text((98, H - 95), "AI-guided website tutorial", font=font(18), fill=MUTED)
    d.rounded_rectangle((W - 328, H - 112, W - 96, H - 72), radius=20, fill=RED)
    d.text((W - 292, H - 104), "deal-pro-app.netlify.app", font=font(15, True), fill="white")
    im.save(filename, quality=95)

slides = [
    (1, "Welcome to Deal Pro", "Find, assess and organise property opportunities from one secure account.", ["Deal Finder", "AI Deal Analyser", "Saved deals and deal packs"]),
    (2, "Find an opportunity", "Open Deal Finder and use the filters to narrow the available private-landlord opportunities.", ["Review the headline numbers", "Compare occupancy scenarios", "Choose a deal worth investigating"]),
    (3, "Unlock details safely", "Protected contact and address details stay hidden until the required process is complete.", ["Read and sign the agreement", "Continue to the secure payment step", "Details unlock only after verified payment"]),
    (4, "Analyse with AI", "Paste an advert or enter the deal figures. Deal Pro highlights the numbers, risks and missing facts.", ["Read the plain-English verdict", "Check 60%, 80% and 100% occupancy", "Never rely on assumptions alone"]),
    (5, "Complete due diligence", "Work through the checks before presenting or progressing a deal.", ["Licensing and planning", "Landlord and property evidence", "Costs, compliance and risk"]),
    (6, "Save and prepare", "Save the opportunity to your account and return whenever you need to continue.", ["Generate the deal pack", "Keep records together", "Use Deal Pro as decision support"]),
]

paths = []
for number, title, body, steps in slides:
    path = WORK / f"slide-{number}.png"
    slide(number, title, body, steps, path)
    paths.append(path)

shutil.copy2(paths[0], OUT / "deal-pro-tutorial-poster.png")

narration = (
    "Hi, and welcome to Deal Pro. Here's how to get started. "
    "First, open Deal Finder and use the filters to narrow down the available private landlord opportunities. "
    "Take a look at the headline figures, and choose a deal you'd like to investigate. "
    "The landlord, address, and listing details stay protected at this stage. "
    "When you're ready, read and sign the Deal Introduction Agreement, then continue to secure payment. "
    "The protected details only unlock once that payment has been verified. "
    "Next, open the AI Deal Analyser. You can paste in an advert, or enter the rent, deposit, and expected nightly rate yourself. "
    "Deal Pro will explain the likely return, key risks, and anything that's still missing, without simply guessing. "
    "Finally, complete the due diligence checks, save the deal to your account, and prepare the deal pack. "
    "And remember, always verify legal, planning, licensing, and financial information independently."
)
elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
if elevenlabs_key:
    audio = WORK / "narration.mp3"
    request = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128",
        data=json.dumps({
            "text": narration,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.42, "similarity_boost": 0.78, "style": 0.28, "use_speaker_boost": True},
        }).encode("utf-8"),
        headers={"xi-api-key": elevenlabs_key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        audio.write_bytes(response.read())
else:
    audio = WORK / "narration.aiff"
    subprocess.run(["/usr/bin/say", "-v", "Flo (English (UK))", "-r", "200", "-o", str(audio), narration], check=True)

sys.path.insert(0, "/tmp/deal-video-deps")
import imageio_ffmpeg
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
probe = subprocess.run([ffmpeg, "-i", str(audio)], capture_output=True, text=True)
match = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", probe.stderr)
if not match:
    raise RuntimeError("Could not determine narration duration")
hours, minutes, seconds = match.groups()
audio_duration = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
slide_duration = max(5.5, audio_duration / len(paths))

concat = WORK / "slides.txt"
with concat.open("w") as fh:
    for path in paths:
        fh.write(f"file '{path}'\n")
        fh.write(f"duration {slide_duration:.3f}\n")
    fh.write(f"file '{paths[-1]}'\n")

subprocess.run([
    ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-i", str(audio),
    "-vf", "scale=1280:720,format=yuv420p", "-r", "30", "-c:v", "libx264", "-preset", "medium",
    "-crf", "22", "-c:a", "aac", "-b:a", "160k", "-t", f"{audio_duration:.3f}", "-movflags", "+faststart",
    str(OUT / "deal-pro-tutorial.mp4")
], check=True)

print(OUT / "deal-pro-tutorial.mp4")
