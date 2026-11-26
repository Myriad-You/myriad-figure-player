# Myriad figure player

Myriad 2.5D 形象的渲染层：在一块画布上用 WebGL2 画出一套 rig 包，由外部的驱动逐帧写入参数，舞台按参数变形并绘制。

> **预发布，接口不稳定。** 1.0 之前入口里的名字和形状随时可能改，不要依赖。

## 是什么、不是什么

- **是**：舞台 `Anime25DStage`（把服装送上 GPU、网格变形、头壳转头与关键形、头发和胸的物理、表情形状、绘制、触摸命中、姿势的取出与重画），它读的驱动接口 `Anime25DDriving`，以及一个不带表演的基础驱动 `Anime25DBasicDriving`（待机摆动、眨眼、朝目标参数平滑过渡，可选跟随指针）和把两者装在一起的 `FigurePlayer`。
- **不是**：表演系统（行为排程、说话和唱歌时的身体、表演指令、贴纸脸的动态）和 rig 的导入工具都不在这里。舞台不自己动：每一帧画什么由驱动决定；基础驱动只让形象“活着”，别的动作要调用方自己写参数或自己实现驱动。

## 入口

`package.json` 的 `exports` 有三个入口，目录里别的文件都是内部的：

- `@myriad-you/figure-player`（`src/index.ts`）：播放用的一切——`FigurePlayer`、舞台 `Anime25DStage`、驱动接口和基础驱动、姿势（`Anime25DPose`）的 `poseToJSON` / `poseFromJSON` / `blendPoses`、错误 `FigureError`。类型只有用这些时要写出名字的那些（`Anime25DPlayback`、`MeropeRigManifest`、`Anime25DDriver`、驱动接口、姿势、调试和检视的结果）；包格式和清单的各个部分的类型在 `./internals`。
- `@myriad-you/figure-player/workbench`（`src/workbench.ts`）：给 rig 制作工具用的，播放的页面用不到：舞台交给工具的当前帧和 GPU 图层（`PoseCorrectionStageSource`，经 `Anime25DStage.poseStage()` 取）、姿势修正的拾取与投影、`WORKBENCH_DRIVER`、运动包络探针、写进每个包的参照项目名称、许可和版权。`Anime25DStage.previewPoseCorrections()` 也只给工具用。这个入口不作任何稳定承诺。
- `@myriad-you/figure-player/internals`（`src/internals.ts`）：舞台内部一些较低层的零件，是在舞台之上自己写一整套驱动的宿主用得到的那些：包格式的类型和词表（包括从图层名读出角色和分组）、驱动参数的响应与合成步骤、变形和姿势的辅助，以及舞台自己的表情图形辅助——它们读取图上的像素（嘴唇、牙齿、线条的颜色），在载入和绘制时画出生成的嘴形，并给出生成的眼睛图形按眼睛大小取的比例。这份清单不是设计好的工具集，也不完整；不作任何稳定承诺，名字和形状在任何版本都可能变。这个入口本身不含表演系统，也不含做 rig 的工具。只播放的页面用不到。

### 最简用法：`FigurePlayer`

```ts
import { FigurePlayer } from '@myriad-you/figure-player'

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

// 想要的参数，按范围截断后形象平滑过去；呼吸、摆动和眨眼一直在（见下面的开关）。
player.set({ lipCurve: 0.4, headYaw: 0.2 })
```

- 图集载入前、`resize()` 之前什么都不画。画布的 CSS 尺寸或设备像素比变了就再调 `resize()`；形象看不见时停掉帧循环；不用了调 `dispose()`。
- 驱动参数里的开关（都是布尔值，用 `set()` 改）：
  - `breathing`：舞台的呼吸，3.4 秒一周，头和身体轻轻起伏、胸口随之鼓起；关掉后缓到半口气停住。
  - `torsoBreath`：呼吸也带着上身抬落（`talking`、`singing` 开着时也会）。
  - `hairWind`：头发里的微风，要 `physics` 开着才有。
  - `physics`：头发、胸、衣物和饰物的物理；关掉后它们按姿势挂着。
  - `idleSway`：基础驱动的待机摆动，头慢慢转、点、歪，身体侧倾；站姿还会左右换重心。
  - `autoBlink`：基础驱动的自动眨眼。
  - `followPointer`：头和眼睛跟随指针（配合 `setPointer(x, y, inside)`，x、y 是画布上 −1…1、向右向下）。
  - 默认除 `followPointer` 外都开着。把 `breathing`、`torsoBreath`、`hairWind`、`physics`、`idleSway`、`autoBlink` 全关掉，等物理停稳后形象完全静止，每帧逐像素相同。
  - `talking`、`singing`、`thinking` 不是开关，是表演系统记下的状态：舞台只在 `talking` 或 `singing` 开着时让呼吸带上身，`thinking` 舞台不读。
- 构造函数第四个参数是随机源（默认 `Math.random`），给定种子就能让眨眼可复现。
- `getPose()` 取出最后画的一帧，`renderPose(pose)` 把它原样再画出来；`poseToJSON` / `poseFromJSON` 把姿势存成 JSON 再读回，`blendPoses(a, b, share)` 给两帧之间的帧。

### 自己写驱动

```ts
import { Anime25DClosedEyePresentation, Anime25DIrisRebound, Anime25DStage, IDENTITY_DRIVER } from '@myriad-you/figure-player'

const shared = {
  current: { ...IDENTITY_DRIVER },
  closedEyes: new Anime25DClosedEyePresentation(),
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
