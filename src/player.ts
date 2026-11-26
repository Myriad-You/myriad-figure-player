import type { Anime25DBasicFigure } from './anime25drig/basicDriving'
import type { Anime25DDriver } from './anime25drig/driver'
import type { Anime25DInspection } from './anime25drig/playerInspection'
import type { Anime25DPose } from './anime25drig/pose'
import type { VisibleTouchHit } from './anime25drig/touchVisibility'
import type { Anime25DPlayback } from './anime25drig/types'
import type { MeropeRigManifest } from './rig/types'
import { Anime25DBasicDriving } from './anime25drig/basicDriving'
import { Anime25DStage } from './anime25drig/stage'

/**
 * A figure on a canvas that lives on its own: the stage (Anime25DStage) moved by the basic driving
 * (Anime25DBasicDriving), which sways, blinks and eases toward what set() asks.
 *
 * The page drives the frames. Nothing is drawn until the atlas is in (loadAtlas or replaceLivePackage) and resize()
 * has given the canvas its size; then each animation frame the page calls tick() with the seconds since the last
 * one, usually from requestAnimationFrame, and stops calling it while the figure is hidden. A long gap is caught up
 * on only so far, so a page coming back does not fast-forward. resize() goes with every change of the canvas's
 * CSS size or the device pixel ratio. dispose() releases the GPU.
 */
export class FigurePlayer {
  private readonly driving: Anime25DBasicDriving
  private readonly stage: Anime25DStage<Anime25DBasicFigure>

  /** `random` decides the blinks; seed it for a repeatable figure. Throws a FigureError without WebGL2. */
  constructor(
    canvas: HTMLCanvasElement,
    playback: Anime25DPlayback,
    rigManifest?: MeropeRigManifest,
    random: () => number = Math.random,
  ) {
    this.driving = new Anime25DBasicDriving(random)
    this.stage = new Anime25DStage(canvas, playback, rigManifest, this.driving, this.driving.shared)
  }

  /** Asks for some of the driver's values, each bounded to its range; the figure eases there. */
  set(partial: Partial<Anime25DDriver>): void {
    this.driving.set(partial)
  }

  /** What has been asked for (set), not what is drawn now (inspect().driver). */
  get(): Anime25DDriver {
    return { ...this.driving.target }
  }

  /** The pointer over the canvas, −1…1 across and down it; followed while the driver's `followPointer` is on. */
  setPointer(x: number, y: number, inside: boolean): void {
    this.driving.setPointer(x, y, inside)
  }

  /** Blinks now, then goes on blinking at its own pace. */
  blinkNow(): void {
    this.driving.blinkNow(this.stage.animationTime())
  }

  /** Moves the figure on by `deltaSeconds` and draws it. */
  tick(deltaSeconds: number): void {
    this.stage.tick(deltaSeconds)
  }

  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    this.stage.resize(cssWidth, cssHeight, devicePixelRatio)
  }

  /** Another outfit; the last one keeps drawing until it is ready, and stays if it fails. */
  replaceLivePackage(playback: Anime25DPlayback, rigManifest: MeropeRigManifest | undefined, atlasUrl: string): Promise<void> {
    return this.stage.replaceLivePackage(playback, rigManifest, atlasUrl)
  }

  /** The atlas of the package the player was made with. */
  loadAtlas(url: string): Promise<void> {
    return this.stage.loadAtlas(url)
  }

  /** What is drawn under a point in client coordinates, if anything. */
  hitTestTouch(clientX: number, clientY: number): VisibleTouchHit | null {
    return this.stage.hitTestTouch(clientX, clientY)
  }

  /** The frame drawn last, as data; null until one is drawn. */
  getPose(): Anime25DPose | null {
    return this.stage.getPose()
  }

  /** Draws a pose in place of the figure; false for a pose of another outfit. */
  renderPose(pose: Readonly<Anime25DPose>): boolean {
    return this.stage.renderPose(pose)
  }

  /** What was drawn this frame, copied out. */
  inspect(): Anime25DInspection {
    return this.stage.inspect()
  }

  dispose(): void {
    this.stage.dispose()
  }
}
