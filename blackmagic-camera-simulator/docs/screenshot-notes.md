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
