// generate grid, borrow from clay.gl viewer
// @see https://github.com/pissang/clay-viewer/blob/master/src/graphic/ground.glsl
#extension GL_OES_standard_derivatives : enable

precision highp float;

varying vec3 v_Position;
varying vec4 v_PositionFromLight;
varying vec3 v_Normal;

uniform float u_GridSize;
uniform float u_GridSize2;
uniform vec4 u_GridColor;
uniform vec4 u_GridColor2;
uniform bool u_GridEnabled;

uniform sampler2D u_ShadowMap;
uniform vec3 u_LightDirection;
uniform vec3 u_Camera;

// shadow map
#define OFFSCREEN_WIDTH 2048.0
#define OFFSCREEN_HEIGHT 2048.0
vec2 texelSize = vec2(1.0) / vec2(OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);
float unpackDepth(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));
    float depth = dot(rgbaDepth, bitShift);
    return depth;
}

float texture2DCompare(sampler2D depths, vec2 uv, float compare, float bias){
    float depth = unpackDepth(texture2D(depths, uv));
    return step(compare - bias, depth);
}

float texture2DShadowLerp(sampler2D depths, vec2 uv, float compare, float bias){
    vec2 centroidUV = floor(uv * OFFSCREEN_WIDTH + 0.5) / OFFSCREEN_WIDTH;
    vec2 f = fract(uv * OFFSCREEN_WIDTH + 0.5);
    float lb = texture2DCompare(depths, centroidUV + texelSize * vec2(0.0, 0.0), compare, bias);
    float lt = texture2DCompare(depths, centroidUV + texelSize * vec2(0.0, 1.0), compare, bias);
    float rb = texture2DCompare(depths, centroidUV + texelSize * vec2(1.0, 0.0), compare, bias);
    float rt = texture2DCompare(depths, centroidUV + texelSize * vec2(1.0, 1.0), compare, bias);
    float a = mix(lb, lt, f.y);
    float b = mix(rb, rt, f.y);
    float c = mix(a, b, f.x);
    return c;
}

float PCFLerp(sampler2D depths, vec2 uv, float compare, float bias){
    float result = 0.0;
    for(int x = -1; x <= 1; x++){
        for(int y = -1; y <= 1; y++){
        vec2 off = texelSize * vec2(x,y);
        result += texture2DShadowLerp(depths, uv + off, compare, bias);
        }
    }
    return result / 9.0;
}

float calcShadow(sampler2D depths, vec4 positionFromLight, vec3 lightDir, vec3 normal) {
    vec3 shadowCoord = (positionFromLight.xyz / positionFromLight.w) * 0.5 + 0.5;
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    return PCFLerp(depths, shadowCoord.xy, shadowCoord.z, bias);
}

void main() {
    vec3 n = v_Normal;                             // normal at surface point
    vec3 v = normalize(u_Camera - v_Position);        // Vector from surface point to camera
    vec3 l = normalize(u_LightDirection);             // Vector from surface point to light

    // Shadow map
    float shadowFactor = calcShadow(u_ShadowMap, v_PositionFromLight, l, n);

    gl_FragColor = vec4(vec3(1. - shadowFactor), 1.);

    if (u_GridEnabled) {
        float wx = v_Position.x;
        float wz = v_Position.z;
        float x0 = abs(fract(wx / u_GridSize - 0.5) - 0.5) / fwidth(wx) * u_GridSize / 2.0;
        float z0 = abs(fract(wz / u_GridSize - 0.5) - 0.5) / fwidth(wz) * u_GridSize / 2.0;

        float x1 = abs(fract(wx / u_GridSize2 - 0.5) - 0.5) / fwidth(wx) * u_GridSize2;
        float z1 = abs(fract(wz / u_GridSize2 - 0.5) - 0.5) / fwidth(wz) * u_GridSize2;

        float v0 = 1.0 - clamp(min(x0, z0), 0.0, 1.0);
        float v1 = 1.0 - clamp(min(x1, z1), 0.0, 1.0);
        if (v0 > 0.1) {
            gl_FragColor = mix(gl_FragColor, u_GridColor, v0);
        }
        else {
            gl_FragColor = mix(gl_FragColor, u_GridColor2, v1);
        }
    }
}