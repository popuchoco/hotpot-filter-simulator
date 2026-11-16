# 第三方字型

## Noto Sans TC

- Repo 檔案：`assets/fonts/NotoSansTC-subset.woff2`；授權文字：`assets/fonts/OFL-NotoSansTC.txt`
- 上游來源：[Google Fonts — Noto Sans TC](https://github.com/google/fonts/tree/main/ofl/notosanstc)
- 作者：Adobe / Google
- Copyright：`Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'`
- 授權：SIL Open Font License 1.1
- 修改：使用 `tools/fonts/subset.py` 依 `index.html`、`src/*.js`、ASCII 與常用全形標點縮減字元，輸出 WOFF2；字重軸限制為 400–700。網站以 `Noto Sans TC` 作為 CSS `font-family` alias；上游宣告的 Reserved Font Name `Source` 保留，沒有用它重新命名衍生字型。

## Baloo 2

- Repo 檔案：`assets/fonts/Baloo2-subset.woff2`；授權文字：`assets/fonts/OFL-Baloo2.txt`
- 上游來源：[Google Fonts — Baloo 2](https://github.com/google/fonts/tree/main/ofl/baloo2)
- 作者：The Baloo 2 Project Authors
- Copyright：`Copyright 2019 The Baloo 2 Project Authors (https://github.com/EkType/Baloo2)`
- 授權：SIL Open Font License 1.1
- 修改：使用 `tools/fonts/subset.py` 保留 ASCII 字元並輸出 WOFF2；字重軸限制為 500–700。網站使用上游家族名稱 `Baloo 2` 作為 CSS `font-family` alias。

# 美術與音效（S7 擬真視覺）

- 鍋具（不鏽鋼／翡翠／暖銅）、湯底、蒸氣與氣泡：`src/renderer.js`、`src/rendering.js`，以 Canvas 程式繪製並快取於離屏畫布。
- 食材 sprite（肉沫、芋頭、南瓜、番茄、馬鈴薯、骨頭、辣椒片、味噌豆渣、浮油）：`src/food-sprites.js`，程式繪製。
- 互動回饋（水花、漣漪、分數浮字、漏下水滴）：`src/visual-effects.js`、`src/renderer.js`，程式繪製。
- 介面木紋／磚紅／米白質感：`style.css`，純 CSS 漸層。
- 以上皆為本專案自行製作，未使用任何第三方圖片、照片、材質或音效檔；音效沿用既有 Web Audio 合成（預設關閉）。
