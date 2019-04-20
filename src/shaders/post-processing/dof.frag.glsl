// https://github.com/tsherif/webgl2examples/blob/master/dof.html

#define MAX_BLUR 20.0

uniform sampler2D u_Texture;
uniform sampler2D u_Depth;

uniform float u_FocusDistance: 2.0;
uniform float u_BlurCoefficient: 2.0;
uniform float u_PPM: 2.0;
uniform vec2 u_DepthRange;
uniform vec2 u_TexelOffset;

uniform vec2 u_ViewportSize: [1.0, 1.0];

varying vec2 v_UV;

void main() {
    vec2 resolution = vec2(u_ViewportSize);
    // Convert to linear depth
    float ndc = texture2D(u_Depth, v_UV).r * 2.0 - 1.0;
    float depth = -(2.0 * u_DepthRange.y * u_DepthRange.x) / (ndc * (u_DepthRange.y - u_DepthRange.x) - u_DepthRange.y - u_DepthRange.x);

    float deltaDepth = abs(u_FocusDistance - depth);
    
    // Blur more quickly in the foreground.
    float xdd = depth < u_FocusDistance ? abs(u_FocusDistance - deltaDepth) : abs(u_FocusDistance + deltaDepth);
    float blurRadius = min(floor(u_BlurCoefficient * (deltaDepth / xdd) * u_PPM), MAX_BLUR);
    
    vec4 color = vec4(0.0);
    if (blurRadius > 1.0) {
        float halfBlur = blurRadius * 0.5;
        float count = 0.0;
        for (float i = 0.0; i <= MAX_BLUR; ++i) {
            if (i > blurRadius) {
                break;
            }
            // texelFetch outside texture gives vec4(0.0) (undefined in ES 3)
            vec2 sampleCoord = clamp(v_UV + vec2(((i - halfBlur) * u_TexelOffset)), vec2(0), resolution);
            color += texture2D(u_Texture, sampleCoord);
            ++count;
        }
        color /= count;
    } else {
        color = texture2D(u_Texture, fragCoord);
    }
    gl_FragColor = color;
}