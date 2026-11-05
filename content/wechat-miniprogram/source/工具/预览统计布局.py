"""可选 Pillow 布局预览。先运行 导出统计布局.cjs；不代表微信 Canvas 或真机验收。"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = Path('C:/Windows/Fonts/msyh.ttc')
if not FONT.is_file():
    raise SystemExit('请为本机设置可用中文字体；主教程和业务测试不依赖此预览脚本。')
for name in ['normal', 'empty']:
    data = json.loads((ROOT / '验证' / ('第八阶段图表布局-' + name + '.json')).read_text(encoding='utf-8'))
    scale, header = 2, 52
    width, height = data['plan']['width'], data['plan']['height']
    image = Image.new('RGB', (width * scale, height * scale + header), 'white')
    draw = ImageDraw.Draw(image)
    draw.text((8, 6), '图表布局预览（非微信截图）', font=ImageFont.truetype(str(FONT), 20), fill='#334155')
    draw.text((8, 30), '固定练习数据 2026-10-27 — 2026-11-02 · ' + name, font=ImageFont.truetype(str(FONT), 14), fill='#64748b')
    for op in data['operations']:
        if op['type'] == 'rect':
            x, y, w, h = op['args']
            draw.rectangle((round(x * scale), round(y * scale + header), round((x + w) * scale), round((y + h) * scale + header)), fill=op['color'])
        elif op['type'] == 'line':
            draw.line([(round(x * scale), round(y * scale + header)) for x, y in op['points']], fill=op['color'], width=scale)
        elif op['type'] == 'text':
            anchor = {'left': 'lm', 'right': 'rm', 'center': 'mm'}.get(op['align'], 'lm')
            draw.text((op['x'] * scale, op['y'] * scale + header), op['text'], fill=op['color'],
                      font=ImageFont.truetype(str(FONT), 11 * scale), anchor=anchor)
    image.save(ROOT / '验证' / ('第八阶段柱状图预览-' + name + '.png'), optimize=True)
print('Preview images generated; these are layout replays, not WeChat screenshots.')
