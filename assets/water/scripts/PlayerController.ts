import {
    _decorator,
    Animation,
    AnimationClip,
    Component,
    EventKeyboard,
    input,
    Input,
    KeyCode,
    Node,
    Sprite,
    SpriteFrame,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

const WALK_LEFT_STATE = 'walk-left';
const WALK_RIGHT_STATE = 'walk-right';

@ccclass('PlayerController')
export class PlayerController extends Component {
    @property({ type: Node, tooltip: 'The child node with Sprite. Animation clips are played on this node.' })
    public view: Node | null = null;

    @property({ type: AnimationClip })
    public walkLeftClip: AnimationClip | null = null;

    @property({ type: AnimationClip })
    public walkRightClip: AnimationClip | null = null;

    @property({ type: SpriteFrame })
    public idleLeftFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame })
    public idleRightFrame: SpriteFrame | null = null;

    @property({ min: 0, tooltip: 'Horizontal movement speed in scene units per second.' })
    public moveSpeed = 260;

    @property({ min: 0, tooltip: 'Initial upward velocity when pressing Space.' })
    public jumpSpeed = 720;

    @property({ tooltip: 'Gravity acceleration. Keep it negative for downward gravity.' })
    public gravity = -1800;

    @property({ tooltip: 'Use the Player start Y as the ground height.' })
    public useStartYAsGround = true;

    @property({ tooltip: 'Ground height used when Use Start Y As Ground is disabled.' })
    public groundY = -270;

    @property({ tooltip: 'Clamp the Player X position between Min X and Max X.' })
    public limitHorizontal = false;

    @property({ tooltip: 'Minimum X when Limit Horizontal is enabled.' })
    public minX = -700;

    @property({ tooltip: 'Maximum X when Limit Horizontal is enabled.' })
    public maxX = 700;

    private readonly _position = new Vec3();
    private _animation: Animation | null = null;
    private _sprite: Sprite | null = null;
    private _leftPressed = false;
    private _rightPressed = false;
    private _moveAxis = 0;
    private _isGrounded = true;
    private _velocityY = 0;
    private _facing = 1;
    private _currentState = '';

    protected onEnable (): void {
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    protected onDisable (): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
        this._leftPressed = false;
        this._rightPressed = false;
        this._moveAxis = 0;
    }

    protected start (): void {
        if (this.useStartYAsGround) {
            this.groundY = this.node.position.y;
        }

        this._setupView();
        this._showIdleFrame();
    }

    protected update (deltaTime: number): void {
        const horizontal = this._moveAxis;

        this.node.getPosition(this._position);

        if (horizontal !== 0) {
            this._facing = horizontal;
            this._position.x += horizontal * this.moveSpeed * deltaTime;
        }

        if (!this._isGrounded || this._velocityY !== 0) {
            this._velocityY += this.gravity * deltaTime;
            this._position.y += this._velocityY * deltaTime;

            if (this._position.y <= this.groundY) {
                this._position.y = this.groundY;
                this._velocityY = 0;
                this._isGrounded = true;
            }
        }

        if (this.limitHorizontal) {
            this._position.x = Math.min(this.maxX, Math.max(this.minX, this._position.x));
        }

        this.node.setPosition(this._position);
        this._updateAnimation(horizontal);
    }

    private _setupView (): void {
        const view = this.view ?? this.node.children[0] ?? this.node;
        this.view = view;
        this._sprite = view.getComponent(Sprite);

        if (this.walkLeftClip || this.walkRightClip) {
            this._animation = view.getComponent(Animation) ?? view.addComponent(Animation);
            this._animation.playOnLoad = false;

            if (this.walkLeftClip && !this._animation.getState(WALK_LEFT_STATE)) {
                this._animation.addClip(this.walkLeftClip, WALK_LEFT_STATE);
            }

            if (this.walkRightClip && !this._animation.getState(WALK_RIGHT_STATE)) {
                this._animation.addClip(this.walkRightClip, WALK_RIGHT_STATE);
            }
        }
    }

    private _onKeyDown (event: EventKeyboard): void {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                if (this._leftPressed) {
                    break;
                }

                this._leftPressed = true;
                this._setMoveAxis(-1);
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                if (this._rightPressed) {
                    break;
                }

                this._rightPressed = true;
                this._setMoveAxis(1);
                break;
            case KeyCode.SPACE:
                this._jump();
                break;
            default:
                break;
        }
    }

    private _onKeyUp (event: EventKeyboard): void {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this._leftPressed = false;
                if (this._moveAxis < 0) {
                    this._setMoveAxis(this._rightPressed ? 1 : 0);
                }
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this._rightPressed = false;
                if (this._moveAxis > 0) {
                    this._setMoveAxis(this._leftPressed ? -1 : 0);
                }
                break;
            default:
                break;
        }
    }

    private _setMoveAxis (axis: number): void {
        if (this._moveAxis === axis) {
            return;
        }

        this._moveAxis = axis;
        if (axis !== 0) {
            this._facing = axis;
        }

        this._updateAnimation(axis);
    }

    private _jump (): void {
        if (!this._isGrounded) {
            return;
        }

        this._isGrounded = false;
        this._velocityY = this.jumpSpeed;
    }

    private _updateAnimation (horizontal: number): void {
        if (horizontal < 0) {
            this._play(WALK_LEFT_STATE);
            return;
        }

        if (horizontal > 0) {
            this._play(WALK_RIGHT_STATE);
            return;
        }

        if (this._currentState !== '') {
            this._animation?.stop();
            this._currentState = '';
        }

        this._showIdleFrame();
    }

    private _play (stateName: string): void {
        if (!this._animation || this._currentState === stateName || !this._animation.getState(stateName)) {
            return;
        }

        this._showIdleFrame();
        this._animation.stop();
        this._animation.play(stateName);
        this._currentState = stateName;
    }

    private _showIdleFrame (): void {
        if (!this._sprite) {
            return;
        }

        const frame = this._facing < 0 ? this.idleLeftFrame : this.idleRightFrame;
        if (frame) {
            this._sprite.spriteFrame = frame;
        }
    }
}
