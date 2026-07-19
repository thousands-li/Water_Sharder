# Water_Sharder

![Water_Sharder 演示](assets/docs/Water_Sharder_Demo.gif)

## 项目简介

`Water_Sharder` 是一个基于 **Cocos Creator 3.8.7** 开发的 2D 水面倒影 Shader Demo，主要使用 **TypeScript** 和 Cocos Effect Shader 编写。项目围绕横版场景中的动态水面表现，实现了实时场景倒影、水波扰动、水下焦散、深浅变化、岸边透明过渡、角色移动跳跃和摄像机跟随等效果。

项目的核心思路是：先使用独立摄像机把游戏场景渲染到 `RenderTexture`，再把这张纹理分别用于正常画面显示和水面倒影显示。水面部分通过自定义 Shader 对倒影纹理做 UV 扰动、透明度渐变、颜色衰减和焦散叠加，从而形成动态水面效果。

项目中使用到的工具和 AI：

- 游戏引擎：Cocos Creator 3.8.7
- 开发语言：TypeScript
- Shader：Cocos Effect / GLSL
- 生图 AI：即梦
- 视频转 GIF：ScreenToGif
- 主要使用的 Cocos 能力：RenderTexture、Camera 分层、Sprite、SpriteFrame、Material、Effect Shader、Inspector 配置、Animation、UITransform



## 项目做了什么

- 搭建了一个横版 2D 水面演示场景，包含背景地图、玩家角色、角色行走动画和跳跃控制。
- 实现了实时场景倒影，玩家和背景会被采集到 `RenderTexture` 中，并显示在水面区域。
- 实现了水面 Shader 效果，包括倒影镜像、水波扰动、水下焦散、深度变暗、岸边透明渐变和水体染色。
- 实现了三摄像机分层渲染结构，避免采集摄像机、合成画面和 UI 互相干扰。
- 实现了水面线自动对齐，根据参考节点下边缘自动计算水面位置、显示高度、UV 偏移和采样范围。
- 实现了 RenderTexture 分辨率自适配，可以跟随设计分辨率变化自动 resize。
- 实现了跟随玩家的采集摄像机，让玩家移动时倒影内容保持同步。
- 实现了基础玩家控制，支持左右移动、跳跃、左右待机帧和行走动画切换。
- 制作了 README 演示 GIF，用于在 GitHub 页面直接展示最终效果。

## 怎么做的

项目核心代码位于 `assets/water`：

- `WaterRenderTarget.ts`：水面倒影主控制脚本，负责创建 `RenderTexture`、绑定 `SpriteFrame`、同步摄像机尺寸、计算水面线、调整水面 UV 和释放运行时资源。
- `RTCameraFollow.ts`：采集摄像机跟随脚本，负责让 `RTCamera` 横向平滑跟随玩家，并根据地图宽度限制摄像机移动范围。
- `PlayerController.ts`：玩家控制脚本，负责键盘输入、左右移动、跳跃、落地检测、待机帧切换和行走动画播放。
- `water-reflection.effect`：自定义水面 Shader，负责倒影采样、波纹扰动、焦散叠加、深度变暗、透明渐变和水体颜色控制。
- `water.mtl`：水面材质，开启波纹、焦散、UV 映射、颜色渐变和透明渐变。
- `land-rt.mtl`：地面显示材质，用于正常显示 RenderTexture 画面。

运行时会先由 `WaterRenderTarget.ts` 创建一张共享的 `RenderTexture`，并设置给 `RTCamera.targetTexture`。`RTCamera` 只渲染游戏场景层，采集到的画面会同时赋给 `LandRenderer` 和 `WaterRenderer`。其中 `LandRenderer` 用于显示正常画面，`WaterRenderer` 使用同一张纹理作为水面倒影。

为了处理 RenderTexture 的 Y 方向采样差异，项目在同一个 Shader 中使用宏做区分：`land-rt.mtl` 开启 `SAMPLE_FROM_RT`，用于修正正常画面的 Y 翻转；`water.mtl` 不开启这个宏，保留垂直镜像效果，直接作为水面倒影基础。

## 重点实现

### 1. RenderTexture 实时倒影

项目没有使用静态倒影贴图，而是通过 `RTCamera -> RenderTexture -> SpriteFrame -> Sprite` 建立实时倒影链路。玩家移动、跳跃或背景进入采集范围时，水面倒影会同步更新。

### 2. 摄像机分层渲染

场景中使用三个摄像机拆分职责：

- `RTCamera`：只采集 `GAME` 层，输出到 `RenderTexture`。
- `FixCamera`：显示合成后的场景画面，包括 `LandRenderer` 和 `WaterRenderer`。
- `UICamera`：负责 UI 层显示。

这种结构可以避免采集摄像机把水面合成结果再次拍进去，也方便后续继续扩展 UI 或特效层。

### 3. 一套 Shader 复用两种材质

地面正常画面和水面倒影都使用 `water-reflection.effect`，但通过材质宏控制不同逻辑。地面材质只做 RenderTexture 采样修正，水面材质则开启波纹、焦散、渐变和透明控制，减少了重复 Shader 文件。

### 4. 自动水面线和 UV 对齐

`WaterRenderTarget.ts` 会把 `reflectionSource` 节点的下边缘作为水面线，并自动计算水面节点位置、显示高度、`tiling`、`uvOffset`、`farReflectionBoost` 和 `farReflectionCurve`。这样调整场景尺寸、水面高度或设计分辨率后，不需要手动反复对齐倒影。

### 5. 可配置水面效果

水面材质暴露了多组 Inspector 参数，包括：

- 波纹速度、强度、方向和重复次数
- 焦散强度、缩放、速度、RGB 分离和亮度
- 水体透明度、水体颜色和深度变暗
- 岸边透明渐变和深水倒影覆盖

这些参数可以直接在 Cocos Creator 材质面板中调节，用于快速测试不同水面风格。

### 6. 横版动态演示闭环

项目不只是单独展示一张水面贴图，而是加入了玩家控制、行走动画、跳跃、地图背景和摄像机跟随。这样可以直接观察动态物体在水面中的倒影变化，更接近实际游戏场景需求。

## 做过的优化

- 使用一张共享 `RenderTexture` 同时服务正常画面和水面倒影，避免重复创建纹理资源。
- 提供 `renderScale` 参数，可以在移动端或低性能设备上降低 RenderTexture 分辨率，减少渲染开销。
- 监听设计分辨率变化，自动 resize RenderTexture，并重新同步摄像机、画面尺寸和水面 UV。
- 使用材质宏控制 Shader 功能开关，未开启的波纹、焦散或渐变逻辑不会进入对应分支。
- 复用 `Vec2`、`Vec3` 临时对象，减少运行时频繁分配。
- 摄像机跟随使用指数平滑，降低玩家移动时的镜头突变感。
- 摄像机根据地图宽度做边界限制，避免采集到地图外空区域。
- `onDestroy` 中主动解绑 `targetTexture`，并销毁运行时创建的 `SpriteFrame` 和 `RenderTexture`，减少场景切换后的资源残留。
- 水面高度、UV 偏移和深水采样由脚本自动计算，减少手动配置成本。

## 如何运行

1. 使用 Cocos Creator 3.8.7 打开项目。
2. 打开场景 `assets/scene/water.scene`。
3. 点击编辑器预览运行。
4. 在预览窗口中测试角色移动、跳跃和水面倒影效果。

操作方式：

- `A` / `←`：向左移动
- `D` / `→`：向右移动
- `Space`：跳跃

## 项目结构

```text
assets/
├─ scene/
│  └─ water.scene
├─ water/
│  ├─ scripts/
│  │  ├─ WaterRenderTarget.ts
│  │  ├─ RTCameraFollow.ts
│  │  └─ PlayerController.ts
│  ├─ shaders/
│  │  └─ water-reflection.effect
│  └─ materials/
│     ├─ water.mtl
│     └─ land-rt.mtl
├─ art/
│  ├─ textures/
│  │  ├─ water_wave_noise_512.png
│  │  └─ water_caustic_512.png
│  └─ pictures/
└─ docs/
   └─ Water_Sharder_Demo.gif
```

## 还差什么

- 还没有实现玩家入水、溅水、水波扩散、涟漪传播等交互效果，目前水面主要是倒影和材质动画。
- 还没有加入移动端触控输入，当前主要通过键盘测试角色移动和跳跃。
- 还没有提供运行时调参 UI，水面参数需要在 Cocos Creator 的材质面板中调整。
- 还没有做系统化性能测试，需要在不同设备上测试 `renderScale`、Shader 开关和 RenderTexture 分辨率对性能的影响。
- 还没有封装成可直接复用的 Prefab 或插件，迁移到其他场景时仍需要手动配置节点、摄像机、材质和脚本引用。
- 还没有补充自动化测试或构建脚本，目前主要通过 Cocos Creator 编辑器预览验证。
- 还没有接入真实游戏逻辑，例如游泳状态、水面碰撞、角色深度遮挡、水下区域判定等。
- 素材来源说明和 License 还需要继续补充，方便后续公开发布和协作。
