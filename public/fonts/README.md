# 像素字体

`zpix.ttf` 是保留的原始字体，`zpix.woff2` 是网页优先加载的无损压缩版本。
两者保留完整字形，不按当前文案裁剪，玩家自定义名字仍可使用原字体支持的字符。

替换原始字体后，安装 `fonttools[woff]`，在仓库根目录运行
`python scripts/compress-font.py`，然后一并提交新的 WOFF2。
发布流程直接使用已提交的字体，不需要在构建机安装 Python 字体工具。
