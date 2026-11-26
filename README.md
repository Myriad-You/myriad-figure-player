# Myriad figure player

Myriad 2.5D 形象的渲染层：在一块画布上用 WebGL2 画出一套 rig 包，由外部的驱动逐帧写入参数，舞台按参数变形并绘制。

> **预发布，接口不稳定。** 1.0 之前入口里的名字和形状随时可能改，不要依赖。

## 是什么、不是什么

- **是**：舞台 `Anime25DStage`（把服装送上 GPU、网格变形、头壳转头与关键形、头发和胸的物理、表情形状、绘制、触摸命中、姿势的取出与重画），它读的驱动接口 `Anime25DDriving`，以及一个不带表演的基础驱动 `Anime25DBasicDriving`（呼吸、眨眼、朝目标参数平滑过渡，可选跟随指针）和把两者装在一起的 `FigurePlayer`。
- **不是**：表演系统（行为排程、说话和唱歌时的身体、表演指令、贴纸脸的动态）和 rig 的导入工具都不在这里。舞台不自己动：每一帧画什么由驱动决定；基础驱动只让形象“活着”，别的动作要调用方自己写参数或自己实现驱动。

## 入口

`package.json` 的 `exports` 有两个入口，目录里别的文件都是内部的：

- `@myriad/figure-player`（`src/index.ts`）：播放用的一切——`FigurePlayer`、舞台 `Anime25DStage`、驱动接口和基础驱动、姿势（`Anime25DPose`）的 `poseToJSON` / `poseFromJSON` / `blendPoses`、错误 `FigureError`。
- `@myriad/figure-player/workbench`（`src/workbench.ts`）：给 rig 制作工具用的，播放的页面用不到：舞台交给工具的当前帧和 GPU 图层（`PoseCorrectionStageSource`，经 `Anime25DStage.poseStage()` 取）、姿势修正的拾取与投影、`WORKBENCH_DRIVER`、运动包络探针。`Anime25DStage.previewPoseCorrections()` 也只给工具用。这个入口不作任何稳定承诺。

### 最简用法：`FigurePlayer`

```ts
import { FigurePlayer } from '@myriad/figure-player'

const player = new FigurePlayer(canvas, playback, rigManifest)
player.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio)
await player.loadAtlas(atlasUrl)

// 帧循环归页面：每帧把距上一帧的秒数交给 tick()，它推进形象并画出来。
let last = performance.now()
function frame(now: number): void {
  player.tick((now - last) / 1000)
  last = now
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// 想要的参数，按范围截断后形象平滑过去；呼吸和眨眼一直在。
player.set({ lipCurve: 0.4, headYaw: 0.2 })
```

- 图集载入前、`resize()` 之前什么都不画。画布的 CSS 尺寸或设备像素比变了就再调 `resize()`；形象看不见时停掉帧循环；不用了调 `dispose()`。
- 驱动参数的开关：`rand` 管头和身体的呼吸，`blink` 管自动眨眼，`mouse` 管跟随指针（配合 `setPointer(x, y, inside)`，x、y 是画布上 −1…1、向右向下），`idle`（胸口呼吸、头发的风）和 `phys`（头发、胸、衣物的物理）由舞台直接读。全关掉形象也不完全静止：舞台自己让头和身体随呼吸轻轻上下起伏（3.4 秒一周），不归任何开关管。
- 构造函数第四个参数是随机源（默认 `Math.random`），给定种子就能让眨眼可复现。
- `getPose()` 取出最后画的一帧，`renderPose(pose)` 把它原样再画出来；`poseToJSON` / `poseFromJSON` 把姿势存成 JSON 再读回，`blendPoses(a, b, share)` 给两帧之间的帧。

### 自己写驱动

```ts
import { Anime25DIrisRebound, Anime25DStage, ClosedEyePresentation, IDENTITY_DRIVER } from '@myriad/figure-player'

const shared = {
  current: { ...IDENTITY_DRIVER },
  closedEyes: new ClosedEyePresentation(),
  irisRebound: new Anime25DIrisRebound(),
}
const stage = new Anime25DStage(canvas, playback, rigManifest, driving, shared)
await stage.loadAtlas(atlasUrl)
stage.tick(1 / 60) // 每个子步调用 driving.step()，它写 shared.current
```

`Anime25DBasicDriving` 也可以直接交给舞台（`new Anime25DStage(canvas, playback, rigManifest, driving, driving.shared)`），在它的 `target` 之上再加自己的东西时可以从它开始。

报错是带错误码和参数的 `FigureError`，消息是英文兜底，页面按错误码换成自己的话。本包只抛两种：`anime25dWebglFailed`（浏览器没有 WebGL2）和 `anime25dPlaybackFailed`（GPU 资源或图集出错）。

## 包的格式

舞台画的播放包（`Anime25DPlayback` 和它的图集，加上可选的 `MeropeRigManifest`）由 Myriad 自己的 rig 工具生成。这个格式还没有给第三方定版本：没有公开的规格，也不保证兼容，1.0 之前会变。本包不带生成或转换播放包的工具：拿到一个包（通常是存下来的 JSON）后，先用 `isAnime25DPlayback()` 检查它是不是本版舞台认得的包，再交给 `FigurePlayer` 或舞台；舞台本身不做这项检查。

## 开发

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

`contracts/merope_rig_contract.json` 是 [myriad-core](https://github.com/Myriad-You/myriad-core) `shared/` 里 rig 契约的逐字节副本，不手改。

## 许可

MIT，见 [LICENSE](LICENSE)。参照的第三方项目及其许可见 [NOTICE](NOTICE)。
