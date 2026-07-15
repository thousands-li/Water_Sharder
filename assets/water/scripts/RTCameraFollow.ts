import {
    _decorator,
    Camera,
    Component,
    Node,
    UITransform,
    Vec3,
    view,
} from 'cc';

const { ccclass, property, requireComponent } = _decorator;

/**
 * Attach this component to RTCamera only.
 * FixCamera and UICamera must remain fixed.
 */
@ccclass('RTCameraFollow')
@requireComponent(Camera)
export class RTCameraFollow extends Component {
    @property({ type: Node, tooltip: 'The Player node to follow.' })
    public target: Node | null = null;

    @property({
        type: Node,
        tooltip: 'The actual map Sprite node, for example 横版图1, not its Background parent.',
    })
    public map: Node | null = null;

    @property({ tooltip: 'Horizontal look-ahead offset in design-resolution pixels.' })
    public offsetX = 0;

    @property({
        range: [0.0, 30.0, 0.1],
        slide: true,
        tooltip: 'Higher values follow faster. Use 0 for immediate following.',
    })
    public followSpeed = 8;

    private readonly _current = new Vec3();
    private readonly _targetWorld = new Vec3();
    private readonly _mapWorld = new Vec3();
    private readonly _mapScale = new Vec3();

    protected lateUpdate (deltaTime: number): void {
        if (!this.target || !this.map) {
            return;
        }

        const camera = this.getComponent(Camera);
        const mapTransform = this.map.getComponent(UITransform);
        if (!camera || !mapTransform) {
            return;
        }

        const designSize = view.getDesignResolutionSize();
        const aspect = designSize.width / Math.max(designSize.height, 1);
        const cameraHalfWidth = camera.orthoHeight * aspect;

        this.map.getWorldPosition(this._mapWorld);
        this.map.getWorldScale(this._mapScale);
        const mapHalfWidth = mapTransform.contentSize.width * Math.abs(this._mapScale.x) * 0.5;

        const minX = this._mapWorld.x - mapHalfWidth + cameraHalfWidth;
        const maxX = this._mapWorld.x + mapHalfWidth - cameraHalfWidth;

        this.target.getWorldPosition(this._targetWorld);
        let desiredX = this._targetWorld.x + this.offsetX;

        // If the map is narrower than the camera, simply keep the camera at map center.
        if (minX <= maxX) {
            desiredX = Math.min(maxX, Math.max(minX, desiredX));
        } else {
            desiredX = this._mapWorld.x;
        }

        this.node.getWorldPosition(this._current);
        const factor = this.followSpeed <= 0
            ? 1
            : 1 - Math.exp(-this.followSpeed * deltaTime);

        this._current.x += (desiredX - this._current.x) * factor;
        this.node.setWorldPosition(this._current);
    }
}
