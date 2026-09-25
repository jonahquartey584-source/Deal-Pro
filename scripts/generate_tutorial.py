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

# macOS system font, falling back to DejaVu on Linux.
FONTS = ["/System/Library/Fonts/SFNS.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
FONTS_BOLD = ["/System/Library/Fonts/SFNSDisplay.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]

def font(size, bold=False):
    for path in (FONTS_BOLD if bold else []) + FONTS:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)

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
    # Same geometry as the site's 20x20 SVG, scaled to 64px.
    u = 64 / 20
    d.rounded_rectangle((96, 84, 160, 148), radius=4 * u, fill=RED)
    d.rectangle((96 + 6 * u, 84 + 5 * u, 96 + 9.6 * u, 84 + 15 * u), fill="white")
    d.pieslice((96 + 4.6 * u, 84 + 5 * u, 96 + 14.6 * u, 84 + 15 * u), start=-90, end=90, fill="white")
    d.rectangle((96 + 6 * u, 84 + 9 * u, 96 + 10 * u, 84 + 11 * u), fill=RED)
    d.text((184, 97), "DEAL PRO", font=font(27, True), fill=INK)
    d.text((W - 176, 101), f"0{number}", font=font(22, True), fill=RED)
    d.text((96, 205), title, font=font(55, True), fill=INK)
    y = 288
    for line in wrap(d, body, font(25), 1010):
        d.text((98, y), line, font=font(25), fill=MUTED)
        y += 36
    y += 28
    for item in steps:
        # Power levels keep their site colours: Scout green, Analyst orange, Expert red.
        dot = {"Scout": "#34C26B", "Analyst": "#F59E0B", "Expert": "#E0142B"}.get(item.split(":")[0], GREEN)
        d.ellipse((101, y + 7, 115, y + 21), fill=dot)
        d.text((137, y), item, font=font(23), fill=INK)
        y += 54
    d.text((98, H - 95), "AI-guided website tutorial", font=font(18), fill=MUTED)
    d.rounded_rectangle((W - 328, H - 112, W - 96, H - 72), radius=20, fill=RED)
    url, url_font = "usedealpro.com", font(15, True)
    box = d.textbbox((0, 0), url, font=url_font)
    d.text(((W - 328 + W - 96 - box[2] - box[0]) / 2, (H - 112 + H - 72 - box[3] - box[1]) / 2), url, font=url_font, fill="white")
    im.save(filename, quality=95)

slides = [
    (1, "Welcome to Deal Pro", "Find, assess and organise property opportunities. Sign in with Google or your email.", ["Deal Finder", "AI Deal Analyser", "Deal Community"]),
    (2, "Choose your power level", "Scout, Analyst or Expert. The deeper the level, the more credits it uses.", ["Scout: fast first look, uses the least credits", "Analyst: full analysis, uses more credits", "Expert: stress-tested, uses the most credits"]),
    (3, "Find an opportunity", "Open Deal Finder, set your filters and search. The AI picks out the best deals for you.", ["Full details and a link to every listing", "Rent, commercial and more sites", "Copy results into Google Sheets"]),
    (4, "Analyse with AI", "Paste an advert or enter the deal figures. Deal Pro works out the numbers, risks and missing facts.", ["Plain-English verdict and score", "Profit at 60%, 80% and 100% occupancy", "Expert stress-tests the deal"]),
    (5, "Complete due diligence", "Work through the checks before presenting or progressing a deal.", ["Licensing and planning", "Landlord and property evidence", "Costs, compliance and risk"]),
    (6, "Deal Community", "Post deals where you've already spoken to the landlord or agent, and find deals other sourcers have contacted.", ["Filter by location, price and strategy", "Contact the poster directly", "R2SA, R2R, BTL, HMO and more"]),
    (7, "Save and prepare", "Save the opportunity to your account and return whenever you need to continue.", ["Generate the deal pack", "Keep records together", "Use Deal Pro as decision support"]),
]

paths = []
for number, title, body, steps in slides:
    path = WORK / f"slide-{number}.png"
    slide(number, title, body, steps, path)
    paths.append(path)

shutil.copy2(paths[0], OUT / "deal-pro-tutorial-poster.png")

narration = (
    "Hi, and welcome to Deal Pro. Here's how to get started. "
    "Sign in with Google or your email, and you'll stay signed in on your device. "
    "Before you search or analyse, choose a power level. Scout gives you a fast first look and uses the least credits. "
    "Analyst gives you a full analysis and uses more. And Expert is thorough and stress-tested, and uses the most. "
    "Open Deal Finder, set your filters and search. Every result shows the full property details and a link to the listing, "
    "and the AI picks out the best deals for you. You can copy them straight into Google Sheets. "
    "Next, open the AI Deal Analyser. Paste in an advert, or enter the rent, deposit and expected nightly rate yourself. "
    "Deal Pro explains the likely profit at different occupancy levels, the key risks, and anything that's still missing, without simply guessing. "
    "Then work through the due diligence checks, save the deal, and prepare the deal pack. "
    "You can also use the Deal Community to post deals where you've already spoken to the landlord or agent, and to find deals other sourcers have contacted. "
    "And remember, always verify legal, planning, licensing and financial information independently."
)
# ElevenLabs "Adam" voice.
VOICE_ID = "pNInz6obpgDQGcmJGAvB"
elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
if not elevenlabs_key and "--allow-system-voice" not in sys.argv:
    sys.exit("ELEVENLABS_API_KEY is not set. Set it to narrate with Adam, "
             "or pass --allow-system-voice to use the macOS voice instead.")
if elevenlabs_key:
    audio = WORK / "narration.mp3"
    request = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128",
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
try:
    import imageio_ffmpeg
except ImportError:
    sys.exit("Missing dependency: run  pip3 install pillow imageio-ffmpeg")
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
