import os
from PIL import Image, ImageDraw, ImageFont

# Brand colors directly sampled from the user's source-of-truth images
DARK_GREEN = (43, 81, 67, 255)       # #2b5143
OFF_WHITE = (247, 246, 242, 255)     # #f7f6f2
WHITE = (255, 255, 255, 255)

def render_compass_icon(size, thicken_ring_for_small=False, bg_color=None, circle_margin=2.0):
    """
    Renders the compass icon from IMAGE 2:
    - Dark green circle (#2b5143)
    - White ring
    - White needle diamond
    - Dark green center dot
    with 8x supersampling for ultra-crisp antialiasing.
    """
    supersample = 8
    target_dim = size * supersample
    scale = target_dim / 64.0
    
    if bg_color:
        img = Image.new('RGBA', (int(target_dim), int(target_dim)), bg_color)
    else:
        img = Image.new('RGBA', (int(target_dim), int(target_dim)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx = 32.0 * scale
    cy = 32.0 * scale
    
    # Circle radius
    r_circle = (32.0 - circle_margin) * scale
    draw.ellipse(
        [(cx - r_circle, cy - r_circle), (cx + r_circle, cy + r_circle)],
        fill=DARK_GREEN
    )
    
    # Ring
    # If size is small (<= 16px), slightly thicken ring for readability
    if thicken_ring_for_small and size <= 24:
        r_ring = 15.6 * scale
        ring_stroke = 6.2 * scale
    else:
        r_ring = 15.8 * scale
        ring_stroke = 5.0 * scale
        
    draw.ellipse(
        [(cx - r_ring, cy - r_ring), (cx + r_ring, cy + r_ring)],
        outline=WHITE,
        width=int(round(ring_stroke))
    )
    
    # Needle Diamond
    # Top-right: (40.5, 23.5)
    # Side 1: (35.1, 35.1)
    # Bottom-left: (23.5, 40.5)
    # Side 2: (28.9, 28.9)
    needle_pts = [
        (40.5 * scale, 23.5 * scale),
        (35.1 * scale, 35.1 * scale),
        (23.5 * scale, 40.5 * scale),
        (28.9 * scale, 28.9 * scale)
    ]
    draw.polygon(needle_pts, fill=WHITE)
    
    # Center Dot
    dot_r = 2.2 * scale
    draw.ellipse(
        [(cx - dot_r, cy - dot_r), (cx + dot_r, cy + dot_r)],
        fill=DARK_GREEN
    )
    
    return img.resize((size, size), Image.Resampling.LANCZOS)

def generate_icon_svg():
    """
    Generate clean vector SVG with 64x64 viewBox.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title">
  <title>TripMind AI</title>
  <circle cx="32" cy="32" r="30" fill="#2b5143"/>
  <circle cx="32" cy="32" r="15.8" fill="none" stroke="#ffffff" stroke-width="5"/>
  <path d="M 40.5 23.5 L 35.1 35.1 L 23.5 40.5 L 28.9 28.9 Z" fill="#ffffff"/>
  <circle cx="32" cy="32" r="2.2" fill="#2b5143"/>
</svg>
'''

def generate_logo_svg():
    """
    Generate full logo SVG with icon + 'TripMind AI' wordmark matching IMAGE 1.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 64" role="img" aria-labelledby="logo-title">
  <title id="logo-title">TripMind AI</title>
  <!-- Icon Emblem -->
  <g transform="translate(0, 0)">
    <circle cx="32" cy="32" r="30" fill="#2b5143"/>
    <circle cx="32" cy="32" r="15.8" fill="none" stroke="#ffffff" stroke-width="5"/>
    <path d="M 40.5 23.5 L 35.1 35.1 L 23.5 40.5 L 28.9 28.9 Z" fill="#ffffff"/>
    <circle cx="32" cy="32" r="2.2" fill="#2b5143"/>
  </g>
  <!-- Wordmark -->
  <text x="74" y="42" font-family="'Segoe UI', Inter, system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif" font-weight="700" font-size="31" fill="#2b5143" letter-spacing="-0.3px">TripMind AI</text>
</svg>
'''

def render_og_image(output_path):
    """
    Creates 1200x630 og-image.png as specified in Step 4:
    IMAGE 1 design: full logo (icon plus 'TripMind AI' wordmark) centered on solid off-white (#f7f6f2) background,
    with plenty of empty space around it.
    """
    W, H = 1200, 630
    card = Image.new('RGB', (W, H), (247, 246, 242))
    draw = ImageDraw.Draw(card)
    
    icon_d = 140
    icon = render_compass_icon(icon_d, circle_margin=2.0)
    
    font_path = r'C:\Windows\Fonts\segoeuib.ttf'
    font = ImageFont.truetype(font_path, 80)
    
    text = "TripMind AI"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    gap = 40
    total_w = icon_d + gap + text_w
    
    start_x = (W - total_w) // 2
    icon_y = (H - icon_d) // 2
    text_y = icon_y + (icon_d - text_h) // 2 - 10
    
    card.paste(icon, (start_x, icon_y), icon)
    draw.text((start_x + icon_d + gap, text_y), text, font=font, fill=(43, 81, 67))
    
    card.save(output_path, 'PNG', optimize=True)
    print(f"Generated OG image: {output_path}")

def main():
    public_dir = os.path.abspath('public')
    os.makedirs(public_dir, exist_ok=True)
    
    # 1. tripmind-icon.svg
    svg_icon_path = os.path.join(public_dir, 'tripmind-icon.svg')
    with open(svg_icon_path, 'w', encoding='utf-8') as f:
        f.write(generate_icon_svg())
    print(f"Generated {svg_icon_path}")
    
    # 2. tripmind-logo.svg
    svg_logo_path = os.path.join(public_dir, 'tripmind-logo.svg')
    with open(svg_logo_path, 'w', encoding='utf-8') as f:
        f.write(generate_logo_svg())
    print(f"Generated {svg_logo_path}")
    
    # 3. Raster files from icon SVG
    # favicon sizes
    img16 = render_compass_icon(16, thicken_ring_for_small=True)
    img32 = render_compass_icon(32)
    img48 = render_compass_icon(48)
    img64 = render_compass_icon(64)
    img192 = render_compass_icon(192)
    img512 = render_compass_icon(512)
    
    # apple-touch-icon.png (180x180, circle filling the canvas with solid off-white background)
    apple_img = render_compass_icon(180, bg_color=OFF_WHITE, circle_margin=4.0)
    apple_path = os.path.join(public_dir, 'apple-touch-icon.png')
    apple_img.save(apple_path, 'PNG')
    print(f"Generated {apple_path}")
    
    # favicon-32x32.png
    fav32_path = os.path.join(public_dir, 'favicon-32x32.png')
    img32.save(fav32_path, 'PNG')
    print(f"Generated {fav32_path}")
    
    # icon-192.png
    icon192_path = os.path.join(public_dir, 'icon-192.png')
    img192.save(icon192_path, 'PNG')
    print(f"Generated {icon192_path}")
    
    # icon-512.png
    icon512_path = os.path.join(public_dir, 'icon-512.png')
    img512.save(icon512_path, 'PNG')
    print(f"Generated {icon512_path}")
    
    # multi-size favicon.ico (16, 32, 48, 64)
    ico_path = os.path.join(public_dir, 'favicon.ico')
    img64.save(
        ico_path,
        format='ICO',
        append_images=[img16, img32, img48],
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    print(f"Generated multi-size {ico_path}")
    
    # 4. og-image.png (1200x630)
    og_path = os.path.join(public_dir, 'og-image.png')
    render_og_image(og_path)

if __name__ == '__main__':
    main()
