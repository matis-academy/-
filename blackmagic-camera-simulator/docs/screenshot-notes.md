# Transcription of screenshots (app on iPhone, portrait settings; RU locale bits like "Микрофон iPhone")
## Main screen (IMG_0143, landscape)
Top HUD: LENS 24mm | FPS 30 | SHUTTER[A] 1/49 | IRIS f/1.8 (greyed) | TC 00:00:01:15 (big, center) | ISO[A] 614 | WB[A] 4830K | TINT[A] 11 | badge "4K / 16:9" | battery "30%"
Blue [A] badge = auto.
Left edge/right edge of image: three-dot vertical handles (⋮) at mid-height both sides (quick panels left/right).
Bottom-left: histogram panel titled "Apple Log - HDR" (color space) with RGB histogram + small vertical bars at right.
Bottom-center: storage panel: phone icon | "Internal Storage" / "1:53:46" / bar / "10%  51GB".
Bottom-right: audio panel "Микрофон iPhone" ch1/ch2 meters scale -45 -30 -20 -10 -6 -3 0 3.
Right column (inside camera area, outside image): [frame-corners icon] / [camera-with-circle + A] (auto focus?) / [+/- exposure + A] / big REC button (red dot in white ring) / [lens circle icon] / [LUT icon] / [camera rotate/sync icon w dot].
Far right nav rail: Camera (active, blue highlighted box) / Media / Chat / Settings.
Left black rounded pill with green dot (that's iOS dynamic island in landscape — ignore / device).

## Settings (portrait, single scrolling list "Settings", bottom tab bar Camera/Media/Chat/Settings; drill-in pages show section title as nav title with back chevron, a group header with option name, checkmark list)
### Record
- Codec: HEVC (H.265) > [Apple ProRes 422 HQ, Apple ProRes 422, Apple ProRes 422 LT, Apple ProRes 422 Proxy, HEVC (H.265), H.264]; Bit Rate group (for HEVC): Max (54Mbps), High (36Mbps), Medium (27Mbps), Low (18Mbps)
- Resolution: 4K > [4K, HD, 720p, Open Gate]
- Color Space: Apple Log - HDR > [Rec.709, Rec.2020 - HDR, P3 D65, Apple Log - HDR]
- HDR Video: toggle (on)
- Timelapse Recording: toggle (off)
- Capture 1 Frame Every: 1 Minute > (greyed when timelapse off)
-- group
- Trigger Record Indicator: None > [Beeper, Beeper and Flash, None]  (page title "Camera")
- Use Volume Button to Trigger Record: on
- Swipe Right to Dim Screen While Recording: on
- Lock White Balance on Record: on
- If Media Drops Frame: Alert > [Alert, Stop Recording]
-- group
- Timecode Display: Record Run > [Record Run, Time of Day (TOD)]
- Reference Source: None > (greyed)
### Camera
- Cinematic Mode (subtitle "Records a depth of field effect to the clip."): off
-- group
- Enable Vertical Video: on
- Lock Current Orientation: on
- Mirror Front-Facing Camera: on
-- group
- Shutter Measurement: Speed > [Speed, Angle]
- Flicker Free Shutter Based On: 50Hz > [50Hz, 60Hz]
- Iris Measurement: Fraction > [Fraction, Decimal]
-- group
- Lens Correction: on
- Use External Lens: off
- Anamorphic De-Squeeze: None > [None, 1.33, 1.55, 2.00]
- Flip Image for SLR Lens: off
### Media
- Save Clips to: In-App and Photo Library > [In-App Only, In-App and Photo Library, Files >, Pro Video Storage (greyed, sub "For ProRes codecs")]; separate row "Configure Pro Video Storage >"
- Save Location Data to Clip: on
- Filename Convention: Blackmagic Camera >
-- group
- Record Proxy: on
- Proxy Clip Manager >
-- group
- Auto Upload To Selected Project: on
- Upload Clips: Proxies Only >
- Live Sync: on
- Enable Upload Only Over Wi-Fi: off
### Audio
- Audio Source: Микрофон iPhone >
- iPhone Microphone: Auto >
- (Media) Filename Convention > [Blackmagic Camera, iOS]
- Proxy Clip Manager page: row "14 Clips   15,6 GB"; button [X] "Delete Proxy Clips"
- Upload Clips > [Proxies Only, Originals and Proxies]
### Audio (cont)
- Audio Source > [None, iPhone Microphone(RU locale "Микрофон iPhone")]
- iPhone Microphone > [Auto, Back(Задний), Bottom(Снизу), Front(Впереди)]
-- group
- Audio Format: IEEE Float > [Linear PCM, IEEE Float, AAC]
- Record Audio as: Stereo > [Mono, Stereo, Dual Mono, 4 Channels]
- Sample Rate: Auto > [Auto, 44.1 kHz, 48.0 kHz, 96.0 kHz, 192.0 kHz]
-- group
- Audio Metering: VU (-18dBFS) > [VU (-18dBFS), VU (-20dBFS), PPM (-18dBFS), PPM (-20dBFS)]
- Audio Monitor: on
- Audio Output: Speaker (Динамик) > [Speaker with airplay icon]
### Monitor
- Focus Assist: Colored Lines > [Peaking, Colored Lines]
- Focus Assist Color: Red > [White, Black, Red, Green, Blue]
- Guides Opacity: 25% > [25,50,75,100%]
- Guides Color: White > [White, Black, Red, Green, Blue]
- Grids Opacity: 25% > [25,50,75,100%]
-- group
- HDMI Out: Mirror Display > page: [Mirror Display, Video Feed] then group of toggles (greyed unless Video Feed): Clean Feed, Status Text, Text Surrounds Image, Display LUT, Zebra, Focus Assist, Frame Guide, Grid, Safe Area Guide, False Color, Limit Monitoring to HD
-- group
- Display Audio Meters on; Display Histogram on; Display Storage Status on; Display Stream Status on; Display Upload Status off; Display Battery Indicator on
### Live Stream
- Platform: Blackmagic Cloud > [Blackmagic Cloud, YouTube, Twitch, Vimeo]; button "Import Stream Settings"
- Log in to Blackmagic Cloud >
- Live Stream toggle (greyed until logged in)
### Function Buttons
- Function Buttons toggle on; F1 None >; F2 None >; F3 None >
### LUTs
- LUTs Manager: 11 > page "LUTs": group "Blackmagic LUTs": Enable Blackmagic LUTs (on); list with toggles: Rec 709 Neutral, Cinema Teal, Day Night, Dusty, Monochrome, Nature, Nostalgic, Paloma, Rift, Vivid, Warm Fade; buttons Import LUT, Export LUT, Remove LUTs
- Record LUT to Clip (greyed toggle)
### Remote Camera Control
- Remote Camera Control toggle off; Use This iPhone as: Controller > (greyed)
-- group (greyed): Camera Name: A; Remote Password: No password set; Camera Available for: Control and Monitor >; Sync Clips To Controller after Record (toggle)
-- Remote Cameras Manager: No Cameras Saved >
-- group: Sync Record Across Cameras; Hide Remote Camera Video Feed; Dim Remote Cameras on Record (toggles, greyed)
### Presets
- Preset Selection > page: buttons Save New Preset (+), Import Preset (download), Export Preset (share), Overwrite Preset (refresh)
### Accessories
- Use Bluetooth off; Nucleus Wireless Lens Control: None >
### Network Access
- HTTP Server >
### Blackmagic Cloud
- Log in to Blackmagic Cloud >
### Reset
- Reset Blackmagic Cam Settings >
### About
- App Version 3.5.200045; Learn More at Blackmagicdesign.com
- bottom outline button "Open Blackmagic Cam Settings" (opens iOS settings)

## Portrait camera (IMG_0142): TC on top; image 16:9; below: histogram panel (left), REC button (center), audio meter panel (right); row: LENS 24mm | FPS 30 | SHUTTER[A] 1/37 | IRIS f/1,8 grey | ISO[A] 451 | WB[A] 4160K | TINT[A] 9; icon row: [focus-target dotted], [LUT], [lens circle], [+/- A], [cam circle A], [frame corners]; ⋮ handles at both sides; storage panel bottom; tab bar.
Bottom tab bar items (portrait): Camera/Media/Chat/Settings; selected tab gets dark blue rounded box w/ blue icon+label.
Settings style: black bg, grouped rounded cards #1c1c1e-ish, section headers grey bold, iOS blue toggles, chevrons, values grey right.

# Video transcription (2 screen recordings, landscape, app 3.5) — key frames in video-frames/
## General dial pattern (tap any HUD item → it highlights blue box; a vertical control column opens at right edge of image)
- Column: thin vertical ruler with fine ticks + small grey labels (finer values), plus a column of large "quick" values/preset icons to the right.
- Current value shown in a dark rounded bubble left of ruler with a blue pointer line to center mark. Drag ruler up/down to scrub.
- Top of column: lock icon (padlock) — locks value (Shutter, ISO, WB, Tint); WB/TINT also have "AUTO" button (blue when auto) next to lock.
- Tapping a quick value selects it (blue pill). Choosing manual value removes blue "A" badge from HUD label.
## LENS (tap "LENS 24mm"): top ↺ (reset zoom). Quick column: 120mm, 48mm, 24mm, 13mm (lens icons, selected blue), then "Front" (person icon), bottom icon camera+arrow (switch?). Ruler shows zoom (0.5x…5x labels like 1.5x, 2x, 2.5x, 5.5x); bubble "1x", "2x", "5x", "0.5x", "1.5x". HUD LENS shows 13/24/48/120mm. Right column lens icon shows small "2.0x"/"0.5x" under it. IRIS shows f/1,8 (24/48), f/2,2 (13mm), f/2,8 (120mm), greyed.
## FPS: top "OFF/ SPEED" button; ruler values 23.98,24,25,29.97,30,48,50,59.94,60; bubble "60"/"30"/"23.98"; bottom "TIME LAPSE" button. Storage time changes with fps (1:15:14 at 60).
## SHUTTER: top lock; quick column 1/100, 1/50, 1/33, 1/25 (flicker-free for 50Hz); ruler 1/24..1/200 etc; bubble "1/27","1/100","1/30","1/24". Auto shutter shows odd values (1/35, 1/49).
## ISO: top lock; quick column 3200,1600,800,400,200,100; ruler fine values (5280,5000,4000,3200,2500,2000,1600,1250,1000,800,640,500,400,320,250,200); bubble value.
## WB: top AUTO (blue = auto) + lock; quick icons: sun (Daylight ~5600K), bulb (Incandescent ~3200K), fluorescent tube (~4000K), house-shade (Shade ~7500K), cloud (Cloud ~6500K); ruler 2500K..10000K labels each 500K; bubble "4480K". When WB locked, HUD shows small lock icon next to WB.
## TINT: AUTO + lock; same preset icons; ruler −50..+50 (labels 0,10,20,30,40); bubble "15", "10".
## Right column icons (top→bottom) & what they open:
1. Frame-corners = MONITORING TOOLS: column with top OFF/ON (for selected tool) and icons: zebra (striped circle) → level ruler 75–100% (bubble "85%"); focus assist (person in brackets); grid (#) → sub-options popover: thirds grid, crosshair, center dot (multi-select, blue); frame guide (rect); safe area (rect in rect); false color (landscape/wave icon, blue when on); bottom "⚡50" (unknown, likely flicker/50Hz or torch — ask).
2. Camera-circle + A = FOCUS: top AUTO (blue = AF); ruler 0.000–1.000 (bubble 0.659/0.741/1.000/0.531); bottom icon mountains+arrow (rack focus presets?). Tap on image shows "AF" bracket square; long-press shows "AE/AF" (lock).
3. +/- with A = EXPOSURE: top AUTO; ruler −2..+2 EV (labels -1.0,-0.5,0.0,+0.5,+1.0,+1.5,+2.0), bubble "0.0","+0.8","+2.0","-1.1"; with AUTO on, SHUTTER and ISO show A and change automatically.
4. REC button.
5. Lens circle (with "0.5x"/"2.0x" sublabel) = opens LENS dial (same as tapping LENS).
6. LUT icon = LUT panel: top OFF/ON; list of LUT names with thumbnail chips (selected one has rainbow outline): Rec 709 Neutral, Cinema Teal, Day Night, Dusty, Monochrome, Nature, Nostalgic, Paloma, Rift, Vivid, Warm Fade; bottom icon arrow-into-camera = Record LUT to clip. When ON: small "LUT" badge top-left of image and HUD text hides while panel open.
   Looks: Rec709 Neutral = normal contrast/saturation; Cinema Teal = warm skin/teal shadows, punchy; Day Night = dark blue; Dusty = desaturated faded warm; Monochrome = B/W; Nature = bright pastel/greens; (Nostalgic/Paloma/Rift/Vivid/Warm Fade — not seen clearly).
   With LUT OFF + Apple Log: flat, low-contrast greyish image.
7. Bottom icon focus-target with dots (⊙ with brackets) — not opened in video (maybe stabilization/AE metering?) — ask.
## Bottom panels: histogram (tap → large RGB parade/scope overlay with 0–100% lines, 0..1023 scale, opacity slider 100%, 3 page dots); Internal Storage; audio meters (tap → large "iPhone Microphone" meter overlay). Badge "4K 16:9" and battery "25%" in HUD top-right.
## Side "⋮" handles: not opened in video.
## Media tab (landscape): header: sidebar toggle icon, "No project selected - All Clips", icons: (aperture/filter?), select clips (check), sort (lines+arrow), cloud. Grid 4 columns of thumbnails with duration (00:01, 15:06) and name under: A001_10111718_C019 (Camera A, reel 001, MMDDHHMM, clip C019).
## Chat tab: Blackmagic Cloud logo, "Log in to Blackmagic Cloud to access your projects chat.", blue "Log In" button.
## Settings (landscape): split view — left list "Settings": Record, Camera, Media, Audio, Monitor, Live Stream, Function Buttons, LUTs, ... (selected blue row); right: section page with same rows; nav rail at far right.

# Video 3 (monitoring tools detail, stabilization, torch)
- Tools column icons (top→bottom): Zebra, Focus Assist, Grid, Frame Guide, Safe Area, False Color, Torch (⚡ + level number). Small white dot under an icon = that tool is enabled. Tapping an icon selects it (blue square) and shows its ruler; OFF/ON at top toggles the selected tool.
- Zebra: ruler 75–100% (bubble "90%"); below ruler two text buttons "Mid Grey" and "MG+1" (zebra for 18% mid grey / mid grey +1 stop).
- Focus Assist: ruler 0–100% sensitivity (bubbles 100%, 13%).
- Grid: popover with 4 toggles: Thirds grid, (2nd icon square with cross-lines at corner — probably horizon/level ⚠), Crosshair, Centre Dot. Multi-select. Lines drawn white thin.
- Frame Guide: ruler of ratios 9:16, 4:5, 1:1, 4:3, 14:9, 1.85:1, 2:1, 2.35:1, 2.39:1, 2.4:1, 2.76:1; drawn as thin white lines (vertical for portrait ratios, horizontal for scope); outside area slightly darkened.
- Safe Area: ruler 5–100% (seen 37…100%), white rectangle centered with that % of frame size.
- False Color: overlay colors + vertical legend at left: red (clip, top), yellow 95%WC, light grey 80%WC, pink MG+1, green 18%MG, blue NBDL, purple BDL (bottom), greys between.
- Torch (⚡50): ON/OFF top, ruler 0–100% (73%,100%,34%,11%,3%,1%), AUTO button bottom; when on, blue ⚡ badge top-left of image; image visibly brighter on near objects.
- Focus panel bottom icon (mountains+arrow) = focus presets/rack (not opened). Focus 0.000 = near (close), 1.000 = far.
- Exposure comp range confirmed −3.0…+3.0.
- Bottom right-column icon (target with dashes) = STABILIZATION: vertical list Off / Standard / Cinematic / Extreme (selected blue). Icon turns blue when stabilization active.
- Record LUT to clip button (bottom of LUT panel) → when on blue; histogram label changes from "Apple Log - HDR" to "Rec.709".
- LUT looks: Nature = warm orange, saturated; Paloma = golden/warm; Monochrome = B/W; Day Night = cold dark blue; Dusty = desaturated; Cinema Teal = teal-orange; Rec 709 Neutral = normal.
