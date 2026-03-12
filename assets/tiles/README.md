# 麻将牌图标

本项目的麻将牌面图标通过 **jsDelivr CDN** 从以下开源仓库加载，未在本地存储 SVG 文件：

- **FluffyStuff/riichi-mahjong-tiles**  
  https://github.com/FluffyStuff/riichi-mahjong-tiles  
  日式立直麻将矢量图（SVG），采用 MIT 许可证。

使用时由 `mahjong.js` 中的 `tileSvgUrl(id)` 生成每张牌对应的 CDN 地址（如 `Man1.svg`、`Pin5.svg`、`Ton.svg` 等），界面中通过 `<img src="...">` 引用。

若需改为本地图标，可将该仓库的 `Regular/*.svg` 下载到本目录，并修改 `mahjong.js` 中 `TILE_ICONS_BASE` 为相对路径（如 `assets/tiles`）。
