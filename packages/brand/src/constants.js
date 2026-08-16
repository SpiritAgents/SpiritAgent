/**
 * 品牌光标标识路径：代码侧唯一来源。
 * assets/*.svg 内嵌同一条 path（静态文件无法 import，属有意冗余）；
 * 修改图案时须同步更新 assets 下全部 SVG 与本常量。
 */
export const SPIRIT_GLASS_LOGO_PATH =
  "M0 0L141.409 69.4512L70.7825 78.2408C61.5778 79.3863 53.5378 85.016 49.3132 93.2737L16.8979 156.635L0 0Z";

export const SPIRIT_GLASS_LOGO_VIEWBOX = { width: 142, height: 157 };
