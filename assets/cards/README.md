# 森林牌桌 · 扑克牌图集

- 52 张普通牌：S/H/C/D + 点数 2–14；14 表示 A。PNG 600×900，附可编辑 SVG。
- 小王 J15.png、大王 J16.png：内置 image_gen 根据原创森林庆典文字设定生成，1024×1536。没有输入第三方角色或现成牌面。
- back.png / back.svg：原创几何树叶纹牌背。
- 所有牌面比例 2:3；两个牌副共用图片，牌的唯一 ID、牌值和规则仍由引擎维护。
- 星标、甩牌标记、必出标记均由游戏动态叠加，不烘焙进图片。
- 普通牌与牌背由 `scripts/build-deck.cjs` 精确绘制并用 Chromium 导出 PNG；普通牌仅在左上方保留一个点数（或 J/Q/K/A）和一个花色图案，其余留白。
- 大小王生成来源与最终提示词记录如下；本记录不构成版权权属或零争议保证。

## 大王 J16.png

Production-ready single poker playing card, PORTRAIT EXACT 2:3 aspect ratio. ONE isolated fully visible rounded rectangle card front, ivory white paper, extremely narrow muted gold line border, straight-on orthographic view, no perspective, no tilt, no shadow outside card, no background outside card, transparent outside the rounded corners. Card nearly fills image bounds with no padding. Original forest festival illustration on center/right, clean leftmost 28 percent kept empty for the index, friendly refined 2D game illustration. Top left large dark readable Chinese characters stacked vertically. NO stars anywhere (game overlays stars dynamically), NO logos or trademarks, NO watermark, NO existing franchise characters, do not copy a known commercial card design. Bottom right small rotated index mirroring top left. BIG JOKER. Index text exactly 大 王 in vermilion red. Newly invented smiling amber pine marten master of ceremonies wearing an elegant red and gold leaf-shaped cap and forest-red festival cloak, holding an acorn staff, cheerful confident posture. Ivory white negative space, restrained forest-green and gold details, uncluttered. Cardface clean and legible at mobile game size.

## 小王 J15.png

Production-ready single poker playing card, PORTRAIT EXACT 2:3 aspect ratio. ONE isolated fully visible rounded rectangle card front, ivory white paper, extremely narrow muted gold line border, straight-on orthographic view, no perspective, no tilt, no shadow outside card, no background outside card, transparent outside the rounded corners. Card nearly fills image bounds with no padding. Original forest festival illustration on center/right, clean leftmost 28 percent kept empty for the index, friendly refined 2D game illustration. Top left large dark readable Chinese characters stacked vertically. NO stars anywhere (game overlays stars dynamically), NO logos or trademarks, NO watermark, NO existing franchise characters, do not copy a known commercial card design. Bottom right small rotated index mirroring top left. SMALL JOKER. Index text exactly 小 王 in charcoal black. Newly invented cheerful pale cream flying squirrel apprentice wearing a dark forest-teal leaf cap with a small golden bell and teal festival cloak, holding a folded leaf fan. Graceful airborne pose, bushy tail, friendly eyes. Ivory white negative space, restrained muted gold detail, uncluttered. Cardface clean and legible at mobile game size.

