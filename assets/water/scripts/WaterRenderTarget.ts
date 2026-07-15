import {
    _decorator,
    Camera,
    Component,
    Node,
    RenderTexture,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
    Vec3,
    view,
} from 'cc';

const { ccclass, property } = _decorator;

/**
 * Creates one shared RenderTexture for the land and water sprites.
 *
 * The capture camera renders the GAME layer into the texture. The land material
 * enables SAMPLE_FROM_RT to display it normally. The water material leaves that
 * macro disabled so the RenderTexture remains vertically mirrored.
 */
@ccclass('WaterRenderTarget')
export class WaterRenderTarget extends Component {
    @property({ type: Camera, tooltip: 'Camera that renders the GAME layer into the RenderTexture.' })
    public captureCamera: Camera | null = null;

    @property({ type: Camera, tooltip: 'Camera that displays the land and water composite layer.' })
    public compositeCamera: Camera | null = null;

    @property({ type: Sprite, tooltip: 'Full-screen sprite that displays the normal scene.' })
    public landRenderer: Sprite | null = null;

    @property({ type: Sprite, tooltip: 'Half-screen sprite that displays the water reflection.' })
    public waterRenderer: Sprite | null = null;

    @property({
        type: Node,
        tooltip: 'The lower edge of this UITransform is used as the reflection waterline.',
    })
    public reflectionSource: Node | null = null;

    @property({ tooltip: 'Automatically align the water surface and its RenderTexture UV range.' })
    public autoAlignReflection = true;

    @property({ tooltip: 'Automatically fit the capture camera, composite camera and renderers to the design size.' })
    public autoFitVerticalView = true;

    @property({ tooltip: 'Resize the water sprite to exactly fill the visible area below the waterline.' })
    public fitWaterToView = true;

    @property({
        range: [1.0, 2.5, 0.05],
        slide: true,
        tooltip: '1 keeps a linear reflection. Higher values gradually include more sky only in deeper water.',
    })
    public reflectionCoverage = 1.0;

    @property({
        range: [1.0, 6.0, 0.1],
        slide: true,
        tooltip: 'Higher values keep more of the near-water reflection at its original scale.',
    })
    public reflectionCurve = 3.0;

    @property({ tooltip: 'Use the project design resolution for the RenderTexture size.' })
    public useDesignResolution = true;

    @property({ min: 16, tooltip: 'Used when Use Design Resolution is disabled.' })
    public renderWidth = 1280;

    @property({ min: 16, tooltip: 'Used when Use Design Resolution is disabled.' })
    public renderHeight = 720;

    @property({
        range: [0.25, 1.0, 0.05],
        slide: true,
        tooltip: 'Lower this on mobile devices to reduce RenderTexture cost.',
    })
    public renderScale = 1.0;

    private _renderTexture: RenderTexture | null = null;
    private _spriteFrame: SpriteFrame | null = null;
    private readonly _sourceBottomLocal = new Vec3();
    private readonly _sourceBottomWorld = new Vec3();
    private readonly _sourceTopLocal = new Vec3();
    private readonly _sourceTopWorld = new Vec3();
    private readonly _sourceWorldScale = new Vec3();
    private readonly _cameraWorld = new Vec3();
    private readonly _landCenterWorld = new Vec3();
    private readonly _landLineLocal = new Vec3();
    private readonly _landLineWorld = new Vec3();
    private readonly _waterLineInParent = new Vec3();
    private readonly _tiling = new Vec2();
    private readonly _uvOffset = new Vec2();

    protected start (): void {
        this._createOrResizeRenderTexture();
        // Canvas and Widget layout may settle at the end of the first frame.
        this.scheduleOnce(this._createOrResizeRenderTexture, 0);
        view.on('design-resolution-changed', this._createOrResizeRenderTexture, this);
    }

    protected onDestroy (): void {
        view.off('design-resolution-changed', this._createOrResizeRenderTexture, this);

        if (this.captureCamera?.targetTexture === this._renderTexture) {
            this.captureCamera.targetTexture = null;
        }

        if (this.landRenderer?.spriteFrame === this._spriteFrame) {
            this.landRenderer.spriteFrame = null;
        }

        if (this.waterRenderer?.spriteFrame === this._spriteFrame) {
            this.waterRenderer.spriteFrame = null;
        }

        this._spriteFrame?.destroy();
        this._renderTexture?.destroy();
        this._spriteFrame = null;
        this._renderTexture = null;
    }

    private _createOrResizeRenderTexture (): void {
        if (!this.captureCamera || !this.landRenderer || !this.waterRenderer) {
            console.warn('[WaterRenderTarget] Assign Capture Camera, Land Renderer and Water Renderer.');
            return;
        }

        let displayWidth = this.renderWidth;
        let displayHeight = this.renderHeight;

        if (this.useDesignResolution) {
            const size = view.getDesignResolutionSize();
            displayWidth = size.width;
            displayHeight = size.height;
        }

        this._syncVerticalView(displayWidth, displayHeight);

        const width = Math.max(1, Math.round(displayWidth * this.renderScale));
        const height = Math.max(1, Math.round(displayHeight * this.renderScale));

        if (!this._renderTexture) {
            this._renderTexture = new RenderTexture('WaterSceneRenderTexture');
            this._renderTexture.reset({ width, height });

            this._spriteFrame = new SpriteFrame('WaterSceneSpriteFrame');
            this._spriteFrame.texture = this._renderTexture;

            // Preserve the sizes configured in the editor: full-screen land and half-screen water.
            this.landRenderer.sizeMode = Sprite.SizeMode.CUSTOM;
            this.waterRenderer.sizeMode = Sprite.SizeMode.CUSTOM;
            this.landRenderer.spriteFrame = this._spriteFrame;
            this.waterRenderer.spriteFrame = this._spriteFrame;
            this.captureCamera.targetTexture = this._renderTexture;
        } else if (this._renderTexture.width !== width || this._renderTexture.height !== height) {
            this._renderTexture.resize(width, height);
        }

        this._syncReflectionLayout();
    }

    private _syncVerticalView (displayWidth: number, displayHeight: number): void {
        if (!this.autoFitVerticalView || !this.captureCamera || !this.landRenderer || !this.waterRenderer) {
            return;
        }

        const landTransform = this.landRenderer.getComponent(UITransform);
        const waterTransform = this.waterRenderer.getComponent(UITransform);
        if (!landTransform || !waterTransform) {
            return;
        }

        landTransform.setContentSize(displayWidth, displayHeight);
        waterTransform.setContentSize(displayWidth, waterTransform.contentSize.height);

        if (this.reflectionSource) {
            const sourceTransform = this.reflectionSource.getComponent(UITransform);
            if (sourceTransform) {
                this.reflectionSource.getWorldScale(this._sourceWorldScale);
                const sourceWorldHeight = sourceTransform.contentSize.height
                    * Math.abs(this._sourceWorldScale.y);
                this.captureCamera.orthoHeight = Math.max(1, sourceWorldHeight);

                this._sourceTopLocal.set(
                    0,
                    (1 - sourceTransform.anchorPoint.y) * sourceTransform.contentSize.height,
                    0,
                );
                sourceTransform.convertToWorldSpaceAR(this._sourceTopLocal, this._sourceTopWorld);
                this.captureCamera.node.getWorldPosition(this._cameraWorld);
                this._cameraWorld.y = this._sourceTopWorld.y - this.captureCamera.orthoHeight;
                this.captureCamera.node.setWorldPosition(this._cameraWorld);
            }
        } else {
            this.captureCamera.orthoHeight = displayHeight * 0.5;
        }

        if (this.compositeCamera) {
            this.compositeCamera.orthoHeight = displayHeight * 0.5;
            this.landRenderer.node.getWorldPosition(this._landCenterWorld);
            this.compositeCamera.node.getWorldPosition(this._cameraWorld);
            this._cameraWorld.x = this._landCenterWorld.x;
            this._cameraWorld.y = this._landCenterWorld.y;
            this.compositeCamera.node.setWorldPosition(this._cameraWorld);
        }
    }

    private _syncReflectionLayout (): void {
        if (!this.autoAlignReflection
            || !this.captureCamera
            || !this.landRenderer
            || !this.waterRenderer
            || !this.reflectionSource) {
            return;
        }

        const sourceTransform = this.reflectionSource.getComponent(UITransform);
        const landTransform = this.landRenderer.getComponent(UITransform);
        const waterTransform = this.waterRenderer.getComponent(UITransform);
        const waterParentTransform = this.waterRenderer.node.parent?.getComponent(UITransform);
        if (!sourceTransform || !landTransform || !waterTransform || !waterParentTransform) {
            console.warn('[WaterRenderTarget] Reflection Source and renderer nodes need UITransform components.');
            return;
        }

        const captureHeight = this.captureCamera.orthoHeight * 2;
        if (captureHeight <= 0 || landTransform.contentSize.height <= 0) {
            return;
        }

        // Project the source node's lower edge into the captured RenderTexture.
        this._sourceBottomLocal.set(
            0,
            -sourceTransform.anchorPoint.y * sourceTransform.contentSize.height,
            0,
        );
        sourceTransform.convertToWorldSpaceAR(this._sourceBottomLocal, this._sourceBottomWorld);
        this.captureCamera.node.getWorldPosition(this._cameraWorld);

        const captureBottom = this._cameraWorld.y - this.captureCamera.orthoHeight;
        const waterlineUv = Math.min(
            1,
            Math.max(0, (this._sourceBottomWorld.y - captureBottom) / captureHeight),
        );

        // The land sprite displays the whole RenderTexture, so the projected UV
        // can also be used to place the top edge of the water sprite on screen.
        this._landLineLocal.set(
            0,
            (waterlineUv - landTransform.anchorPoint.y) * landTransform.contentSize.height,
            0,
        );
        landTransform.convertToWorldSpaceAR(this._landLineLocal, this._landLineWorld);
        waterParentTransform.convertToNodeSpaceAR(this._landLineWorld, this._waterLineInParent);

        waterTransform.setAnchorPoint(waterTransform.anchorPoint.x, 1);
        const waterPosition = this.waterRenderer.node.position;
        this.waterRenderer.node.setPosition(
            waterPosition.x,
            this._waterLineInParent.y,
            waterPosition.z,
        );

        const landSize = landTransform.contentSize;
        if (this.fitWaterToView) {
            waterTransform.setContentSize(
                waterTransform.contentSize.width,
                Math.max(1, waterlineUv * landSize.height),
            );
        }

        const waterSize = waterTransform.contentSize;
        const baseTilingY = waterSize.height / Math.max(landSize.height, 1);
        this._tiling.set(
            waterSize.width / Math.max(landSize.width, 1),
            baseTilingY,
        );
        this._uvOffset.set(0, waterlineUv);

        const material = this.waterRenderer.getMaterialInstance(0);
        material?.setProperty('tiling', this._tiling);
        material?.setProperty('uvOffset', this._uvOffset);
        const remainingUv = Math.max(0, 1 - waterlineUv - baseTilingY);
        material?.setProperty(
            'farReflectionBoost',
            Math.min(
                remainingUv,
                baseTilingY * Math.max(0, this.reflectionCoverage - 1),
            ),
        );
        material?.setProperty('farReflectionCurve', this.reflectionCurve);
    }
}
