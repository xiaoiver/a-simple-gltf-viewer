varying vec4 v_PositionFromLight;

uniform sampler2D u_ShadowMap;

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