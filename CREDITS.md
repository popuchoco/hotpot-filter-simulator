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
