# 地图演示资源与来源

2026-11-02。资源用于陕西本地演示，不代表真实站址或正式地图采购。

| 资源 | 来源及处理 | 用途 |
|---|---|---|
| 陕西地市边界 | `https://geo.datav.aliyun.com/areas_v3/bound/610000_full.json`，保存到 `public/geo/shaanxi-cities.geojson`，字符串 ASCII 转义，未改几何 | 10 地市范围及合成站址采样 |
| Open Sans 字形 | CARTO 字体服务 Open Sans Regular 0-255.pbf，位于 `public/geo/fonts/Open Sans Regular/` | 数字聚合标签 |
| 字体许可 | Google Fonts Open Sans 的 OFL.txt 随字形保存 | 字体声明 |
| 标准底图 | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | 默认轻量底图，显示 OpenStreetMap 署名 |
| 卫星底图 | Esri World_Imagery 官方服务 | 手动切换时才注册与加载，显示 Esri/贡献者署名 |
| 地图 worker | 当前锁定 MapLibre npm 包 worker/shared 模块 | 本地复制，保留 BSD 许可 |

未复制 osiris 源代码，参考其地图工作台布局和交互理念，未带入 OSINT 数据、视频或密钥。
站址档案、位置和指标均为虚构；边界与影像的坐标系及现势性未做测绘级核验，不能作为真实位置依据。
公开可访问不等于生产分发授权，正式对外发布前核验资源条款、边界授权、坐标体系与部署要求。
不批量预下载公共底图。当前字体/边界随包，底图仍需在线服务，完全离线底图另行配置。

## 区县资源补充（2026-11-02）

新增 10 个地市的区县 FeatureCollection，共 107 个区县单元，来源为
`https://geo.datav.aliyun.com/areas_v3/bound/{cityId}_full.json`。
保存于 `public/geo/counties/{cityId}.geojson`，几何未修改，字符串作 ASCII 转义。
地图按地市按需加载区县边界；生成脚本用多多边形和孔洞包含判断为每个模拟站点归属区县。
地市与区县简化边缘不一致时，仅对未落入区县的合成点重新确定性采样，不更改精选场景坐标。
行政名称及边界以该公开资源版本为准，未声称符合当前测绘行政区划；正式主数据需单独核验。
