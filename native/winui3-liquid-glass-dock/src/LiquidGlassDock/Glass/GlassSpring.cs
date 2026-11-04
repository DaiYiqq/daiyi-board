namespace LiquidGlassDock.Glass;

/// <summary>
/// 欠阻尼弹簧（stiffness + damping）积分器，用于：
///  1. 横向滑动后的弹性回弹（position = 偏移，target = 0）
///  2. 指针高光位置的平滑跟随（position = 平滑后的指针 X）
/// 采用半隐式欧拉，帧率无关（传入 dt 秒）。禁止线性过渡，天然给出缓入缓出的手感。
/// </summary>
public sealed class GlassSpring
{
    private float _position;
    private float _velocity;
    private float _target;

    public float Position => _position;
    public float Velocity => _velocity;
    public float Target { get => _target; set => _target = value; }

    public GlassSpring(float initialPosition = 0f, float target = 0f)
    {
        _position = initialPosition;
        _target = target;
    }

    /// <summary>推进一帧，返回当前 position。</summary>
    public float Step(float dt, float stiffness, float damping)
    {
        // 半隐式欧拉：先速度后位置，稳定且无帧率耦合。
        var acceleration = stiffness * (_target - _position) - damping * _velocity;
        _velocity += acceleration * dt;
        _position += _velocity * dt;

        // 接近目标时吸合，避免长时间微抖。
        if (MathF.Abs(_position - _target) < 0.02f && MathF.Abs(_velocity) < 0.02f)
        {
            _position = _target;
            _velocity = 0f;
        }
        return _position;
    }

    public bool IsSettled(float tolerance = 0.05f) =>
        MathF.Abs(_position - _target) < tolerance && MathF.Abs(_velocity) < tolerance;

    public void SetImmediate(float position)
    {
        _position = position;
        _target = position;
        _velocity = 0f;
    }
}
