# Myriad figure player

Myriad 2.5D 形象的渲染层：在一块画布上用 WebGL2 画出一套 rig 包，由外部的驱动逐帧写入参数，舞台按参数变形并绘制。

> **预发布，接口不稳定。** 1.0 之前入口里的名字和形状随时可能改，不要依赖。

## 是什么、不是什么

- **是**：舞台 `Anime25DStage`（把服装送上 GPU、网格变形、头壳转头与关键形、头发和胸的物理、表情形状、绘制、触摸命中、姿势的取出与重画），它读的驱动接口 `Anime25DDriving`，以及一个不带表演的基础驱动 `Anime25DBasicDriving`（待机摆动、眨眼、朝目标参数平滑过渡，可选跟随指针）和把两者装在一起的 `FigurePlayer`。
- **不是**：表演系统（行为排程、说话和唱歌时的身体、表演指令、贴纸脸的动态）和 rig 的导入工具都不在这里。舞台不自己动：每一帧画什么由驱动决定；基础驱动只让形象“活着”，别的动作要调用方自己写参数或自己实现驱动。

## 安装

```sh
pnpm add @myriad-you/figure-player
```

> 这个包还没有发布到 npm。发布之前可以从 git 按提交装：`pnpm add github:Myriad-You/myriad-figure-player#<提交>`。从 git 装到的是 TypeScript 源码（`src/`，`exports` 指向它），要由宿主的打包工具（Vite 等）编译；从 npm 装到的是 `dist/` 里编好的 ESM、`.d.ts` 和 source map。两种装法入口和名字相同。

在浏览器里运行，需要 WebGL2；没有运行时依赖。包里没有 Worker，也没有要另外拷贝的资源文件。没有写 `engines`：包不在 Node 里运行，Node 只经宿主的打包工具碰到它，版本要求随那个工具。

**一个应用里只能有一份这个包。** 不要让从 git 装的一份和从 npm 装的一份同时出现（比如应用从 npm 装、它依赖的另一个包从 git 装）：两份是两套模块，同名的类不是同一个类——一份建的 `Anime25DClosedEyePresentation`、`Anime25DIrisRebound` 交给另一份的 `Anime25DStage`，`instanceof` 和类型检查都对不上，舞台会读到另一套代码的对象；两份各自带着自己的着色器和缓存，体积也翻倍。换来源时让所有依赖它的包一起换，并检查锁文件里只解析出一个 `@myriad-you/figure-player`。

一个能跑的最小页面：取一个播放包（`playback.json`）和它的图集（`atlas.png`），画出来，让形象自己动：

```ts
import { FigurePlayer, isAnime25DPlayback } from '@myriad-you/figure-player'

async function main(): Promise<void> {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display: block; width: 384px; height: 512px'
  document.body.append(canvas)

  const playback = await (await fetch('/figure/playback.json')).json()
  if (!isAnime25DPlayback(playback))
    throw new Error('Not a package this player reads.')

  const player = new FigurePlayer(canvas, playback)
  player.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio)
  await player.loadAtlas('/figure/atlas.png')

  let last = performance.now()
  requestAnimationFrame(function frame(now) {
    player.tick((now - last) / 1000)
    last = now
    requestAnimationFrame(frame)
  })
}

main()
```

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

报错是带错误码和参数的 `FigureError`，消息是英文兜底，页面按错误码换成自己的话。本包抛六种：`anime25dWebglFailed`（浏览器没有 WebGL2）、`anime25dPlaybackFailed`（GPU 资源或图集出错）、`anime25dPlaybackVersion`（包的版本本包不认）、`anime25dPlaybackInvalid`（第 7 版的包缺了换算要用的形状）、`anime25dPlaybackUnconvertible`（换成另一个版本会丢掉值，例如第 7 版装不下的署名）和 `anime25dPoseVersion`（姿势 JSON 的版本本包不认）。

## 包的格式

舞台画的包（播放文档、它的图集，加上可选的 `MeropeRigManifest`）和姿势 JSON 的格式写在 [docs/format.md](docs/format.md)：每个字段的类型、单位、坐标约定、校验器检查的界限，以及版本和兼容的规则。包由 Myriad 自己的 rig 工具生成，本包不带生成或转换图集的工具。

- 包有两个版本，由顶层的 `version` 决定按哪套规则读：7（现在写出的版本）和 8（`kind: "myriad-figure"`，姿势修正的轴用驱动参数的名字）。读的一方两个都认，写的一方等所有读的一方都认 8 之后再换。别的版本拒绝。
- 拿到一个包（通常是存下来的 JSON）后，先用 `isAnime25DPlayback()` 检查它是不是本版舞台认得的包，再交给 `FigurePlayer` 或舞台；舞台本身不做这项检查，只按版本把它换成自己拿着的形式（`readAnime25DPlayback()`，版本 8 的形状），不认的版本抛 `anime25dPlaybackVersion`。`writeAnime25DPlayback()` 把这个形式按指定的版本写回去。
- 姿势 JSON 现在写版本 2（驱动参数用自己的名字），版本 1 也读。

## 开发

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build   # dist/：三个入口的 ESM、.d.ts 和 source map
```

`package.json` 的 `exports` 指向 `src/`，好让从 git 装的宿主直接用源码；打包发布时 `publishConfig` 里的 `exports` 换成 `dist/`。所以要用 `pnpm pack` / `pnpm publish` 打包，`npm pack` 不会换。`.github/workflows/release.yml` 在推送版本标签时构建并发布（npm 可信发布，带 provenance）；`package.json` 标着 `"private": true`、版本还是 `0.0.0`、标签和版本不符、或者标签的提交不在 `main` 上时，它在构建之前就停下。构建出的 JS 每个文件开头都带着第三方许可的说明（`/*! … */`），`LICENSE` 末尾附有第三方的 MIT 全文，`NOTICE` 说明哪些部分来自哪里。webpack（terser）压缩时把这段说明放进 `*.LICENSE.txt`；Vite 8 压缩时去掉所有许可注释，要用 `build.license: true`，它生成的 `.vite/license.md` 收录本包的 `LICENSE`，第三方全文也在里面。

`contracts/merope_rig_contract.json` 是 [myriad-core](https://github.com/Myriad-You/myriad-core) `shared/` 里 rig 契约的逐字节副本，不手改。

`contracts/figure_package_conformance.json` 是共用核心 `crates/conformance/v1/figure/package.json` 的逐字节副本：形象包的接受和拒收用例，服务端的校验和本包的测试都跑，同样不手改。

## 许可

MIT，见 [LICENSE](LICENSE)。参照的第三方项目及其许可见 [NOTICE](NOTICE)。
