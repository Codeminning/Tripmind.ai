import os
from PIL import Image, ImageDraw, ImageFont

# Brand colors directly sampled from the user's source-of-truth images
DARK_GREEN = (43, 81, 67, 255)       # #2b5143
OFF_WHITE = (247, 246, 242, 255)     # #f7f6f2
WHITE = (255, 255, 255, 255)
BG_CANVAS = (240, 240, 236, 255)
CARD_BG = (255, 255, 255, 255)
BORDER_COLOR = (215, 220, 215, 255)
TEXT_MUTED = (110, 115, 108, 255)

font_bold_path = r'C:\Windows\Fonts\segoeuib.ttf'
font_reg_path = r'C:\Windows\Fonts\segoeui.ttf'

font_title = ImageFont.truetype(font_bold_path, 22)
font_label = ImageFont.truetype(font_bold_path, 15)
font_brand = ImageFont.truetype(font_bold_path, 20)
font_tab = ImageFont.truetype(font_reg_path, 13)
font_caption = ImageFont.truetype(font_reg_path, 13)

# Load generated assets
logo_icon = Image.open('public/icon-512.png').convert('RGBA')
fav_32 = Image.open('public/favicon-32x32.png').convert('RGBA')
apple_icon = Image.open('public/apple-touch-icon.png').convert('RGBA')

W, H = 1000, 750
canvas = Image.new('RGBA', (W, H), BG_CANVAS)
draw = ImageDraw.Draw(canvas)

# Title Header
draw.text((40, 30), "TripMind AI — Official Brand Assets Verification Suite", font=font_title, fill=DARK_GREEN)
draw.text((40, 62), "Verification of updated compass brand mark across Browser Tab, Header, Footer, and Mobile App Icon", font=font_caption, fill=TEXT_MUTED)

# 1. BROWSER TAB PREVIEW
box1 = [(40, 110), (470, 390)]
draw.rounded_rectangle(box1, radius=12, fill=CARD_BG, outline=BORDER_COLOR, width=1)
draw.text((60, 130), "1. Browser Tab Preview", font=font_label, fill=DARK_GREEN)

# Fake browser tab bar
tab_bar = [(60, 165), (450, 215)]
draw.rounded_rectangle(tab_bar, radius=8, fill=(235, 238, 235, 255))
tab_pill = [(70, 172), (320, 215)]
draw.rounded_rectangle(tab_pill, radius=6, fill=WHITE)

# Paste favicon in tab
tab_fav = fav_32.resize((18, 18), Image.Resampling.LANCZOS)
canvas.paste(tab_fav, (80, 185), tab_fav)
draw.text((106, 186), "TripMind AI — Your trip, t...", font=font_tab, fill=(40, 40, 40, 255))

draw.text((60, 235), "Asset: /favicon.ico (Multi-size: 16, 32, 48, 64px)", font=font_caption, fill=TEXT_MUTED)
draw.text((60, 255), "Sizes: favicon-32x32.png (?v=3)", font=font_caption, fill=TEXT_MUTED)
draw.text((60, 275), "Theme Color: #2b5143 (Brand Dark Green)", font=font_caption, fill=TEXT_MUTED)

# Small showcase of 16px and 32px favicons
fav_show_16 = fav_32.resize((16, 16), Image.Resampling.LANCZOS)
fav_show_32 = fav_32.resize((32, 32), Image.Resampling.LANCZOS)
canvas.paste(fav_show_16, (60, 315), fav_show_16)
draw.text((85, 314), "16px readable icon", font=font_caption, fill=DARK_GREEN)
canvas.paste(fav_show_32, (220, 307), fav_show_32)
draw.text((260, 314), "32px crisp icon", font=font_caption, fill=DARK_GREEN)

# 2. MOBILE HOME SCREEN ICON PREVIEW
box2 = [(510, 110), (940, 390)]
draw.rounded_rectangle(box2, radius=12, fill=CARD_BG, outline=BORDER_COLOR, width=1)
draw.text((530, 130), "2. Mobile Home-Screen / Apple Touch Icon", font=font_label, fill=DARK_GREEN)

app_icon_size = 120
app_icon = apple_icon.resize((app_icon_size, app_icon_size), Image.Resampling.LANCZOS)
mask = Image.new('L', (app_icon_size, app_icon_size), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([(0, 0), (app_icon_size, app_icon_size)], radius=26, fill=255)

icon_card = Image.new('RGBA', (app_icon_size, app_icon_size), OFF_WHITE)
icon_card.paste(app_icon, (0, 0), app_icon)
canvas.paste(icon_card, (540, 175), mask)

draw.text((680, 185), "apple-touch-icon.png (180x180)", font=font_caption, fill=DARK_GREEN)
draw.text((680, 210), "icon-192.png (PWA Manifest)", font=font_caption, fill=TEXT_MUTED)
draw.text((680, 235), "icon-512.png (PWA Splash/Store)", font=font_caption, fill=TEXT_MUTED)
draw.text((680, 260), "Solid off-white #f7f6f2 background", font=font_caption, fill=TEXT_MUTED)
draw.text((540, 315), "TripMind iOS/Android home-screen badge", font=font_caption, fill=TEXT_MUTED)

# 3. WEBSITE HEADER BRAND MARK PREVIEW
box3 = [(40, 420), (940, 560)]
draw.rounded_rectangle(box3, radius=12, fill=CARD_BG, outline=BORDER_COLOR, width=1)
draw.text((60, 440), "3. Website Navbar & Header Brand Mark", font=font_label, fill=DARK_GREEN)

header_bar = [(60, 475), (920, 535)]
draw.rounded_rectangle(header_bar, radius=8, fill=OFF_WHITE, outline=BORDER_COLOR, width=1)

# Header logo (36x36 brand-mark)
header_logo = logo_icon.resize((36, 36), Image.Resampling.LANCZOS)
canvas.paste(header_logo, (80, 487), header_logo)

draw.text((126, 493), "tripmind", font=font_brand, fill=DARK_GREEN)
bbox_h = draw.textbbox((126, 493), "tripmind", font=font_brand)
draw.text((bbox_h[2], 493), ".ai", font=font_brand, fill=(125, 155, 124, 255))

nav_font = ImageFont.truetype(font_reg_path, 14)
draw.text((450, 497), "How It Works", font=nav_font, fill=TEXT_MUTED)
draw.text((570, 497), "Destinations", font=nav_font, fill=TEXT_MUTED)
draw.text((690, 497), "Why TripMind", font=nav_font, fill=TEXT_MUTED)
draw.rounded_rectangle([(810, 487), (900, 523)], radius=6, fill=DARK_GREEN)
draw.text((828, 496), "Sign In", font=ImageFont.truetype(font_bold_path, 13), fill=WHITE)

# 4. FOOTER BRAND MARK PREVIEW
box4 = [(40, 580), (940, 710)]
draw.rounded_rectangle(box4, radius=12, fill=CARD_BG, outline=BORDER_COLOR, width=1)
draw.text((60, 600), "4. Website Footer Brand Mark", font=font_label, fill=DARK_GREEN)

footer_bar = [(60, 630), (920, 690)]
draw.rounded_rectangle(footer_bar, radius=8, fill=(244, 245, 241, 255), outline=BORDER_COLOR, width=1)

footer_logo = logo_icon.resize((34, 34), Image.Resampling.LANCZOS)
canvas.paste(footer_logo, (80, 643), footer_logo)
draw.text((124, 647), "tripmind", font=font_brand, fill=DARK_GREEN)
bbox_f = draw.textbbox((124, 647), "tripmind", font=font_brand)
draw.text((bbox_f[2], 647), ".ai", font=font_brand, fill=(125, 155, 124, 255))

draw.text((360, 652), "Thoughtful itineraries powered by Gemini AI intelligence.", font=nav_font, fill=TEXT_MUTED)
draw.text((750, 652), "DESIGNED TO WANDER © 2026", font=ImageFont.truetype(font_bold_path, 11), fill=(140, 145, 138, 255))

final_img = canvas.convert('RGB')
final_img.save('preview_verification.png', 'PNG')
print("Generated preview_verification.png successfully.")
