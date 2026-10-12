"""保留完整字形，将原始像素字体无损转为网页使用的 WOFF2；需要 fonttools[woff]。"""
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
source = root / 'public/fonts/zpix.ttf'
target = source.with_suffix('.woff2')
font = TTFont(source)
font.flavor = 'woff2'
font.save(target)
print(f'字体已压缩：{source.stat().st_size} → {target.stat().st_size} 字节，保留完整字形。')
