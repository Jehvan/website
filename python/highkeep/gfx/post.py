"""Full-screen post pass: filmic tone mapping, cheap bloom, vignette, subtle colour grade and grain."""
from direct.filter.FilterManager import FilterManager
from panda3d.core import Shader, Texture, FrameBufferProperties, Vec2, Vec4

FRAG = """
#version 130
uniform sampler2D tex;
uniform vec2 texel;
uniform vec4 grade;      // x=exposure y=bloom z=vignette w=grain
uniform vec4 tint;       // rgb = shadow tint, a = saturation
uniform float time;
in vec2 uv;
out vec4 fragColor;

vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
    vec3 col = texture(tex, uv).rgb;
    // cheap bloom: two rings of taps, thresholded
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5236;
        vec2 d = vec2(cos(a), sin(a));
        vec3 s1 = texture(tex, uv + d * texel * 5.0).rgb;
        vec3 s2 = texture(tex, uv + d * texel * 12.0).rgb;
        vec3 s3 = texture(tex, uv + d * texel * 24.0).rgb;
        glow += max(s1 - 0.8, 0.0) * 0.5 + max(s2 - 0.75, 0.0) * 0.35 + max(s3 - 0.7, 0.0) * 0.25;
    }
    col += glow / 12.0 * grade.y * 4.0;
    col *= grade.x;
    vec3 mapped = aces(col);
    float l = dot(mapped, vec3(0.299, 0.587, 0.114));
    mapped = mix(vec3(l), mapped, tint.a);
    mapped = mix(mapped * tint.rgb, mapped, smoothstep(0.0, 0.5, l));      // tint the shadows
    vec2 q = uv - 0.5;
    float v = 1.0 - dot(q, q) * grade.z;
    mapped *= clamp(v, 0.0, 1.0);
    mapped += (hash(uv * 1000.0 + time) - 0.5) * grade.w;
    fragColor = vec4(mapped, 1.0);
}
"""
VERT = """
#version 130
uniform mat4 p3d_ModelViewProjectionMatrix;
in vec4 p3d_Vertex;
in vec2 p3d_MultiTexCoord0;
out vec2 uv;
void main() { gl_Position = p3d_ModelViewProjectionMatrix * p3d_Vertex; uv = p3d_MultiTexCoord0; }
"""


class Post:
    def __init__(self, base):
        self.base = base
        self.mgr = FilterManager(base.win, base.cam)
        self.tex = Texture("scene")
        props = FrameBufferProperties()
        props.setRgbColor(True)
        props.setRgbaBits(16, 16, 16, 0)
        props.setFloatColor(True)
        props.setDepthBits(24)
        self.quad = self.mgr.renderSceneInto(colortex=self.tex, fbprops=props)
        if self.quad is None:
            raise RuntimeError("post-processing is unavailable")
        self.quad.setShader(Shader.make(Shader.SL_GLSL, VERT, FRAG))
        self.quad.setShaderInput("tex", self.tex)
        self.quad.setShaderInput("time", 0.0)
        self.set_grade()
        self.resize()

    def set_grade(self, exposure=1.0, bloom=0.5, vignette=1.1, grain=0.025, tint=(0.9, 0.95, 1.08), sat=0.9):
        self.quad.setShaderInput("grade", Vec4(exposure, bloom, vignette, grain))
        self.quad.setShaderInput("tint", Vec4(tint[0], tint[1], tint[2], sat))

    def resize(self):
        w, h = self.base.win.getXSize(), self.base.win.getYSize()
        self.quad.setShaderInput("texel", Vec2(1.0 / max(1, w), 1.0 / max(1, h)))

    def update(self, t):
        self.quad.setShaderInput("time", float(t % 100))

    def destroy(self):
        self.mgr.cleanup()
