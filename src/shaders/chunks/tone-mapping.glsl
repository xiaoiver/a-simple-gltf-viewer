// http://filmicworlds.com/blog/filmic-tonemapping-operators/
vec3 filmicToneMap(vec3 color)
{
    vec3 x = max(vec3(0.0), color - 0.004);
    return (x*(6.2*x+0.5))/(x*(6.2*x+1.7)+0.06);
}

const vec3 whiteScale = vec3(11.2);
vec3 uncharted2ToneMap(vec3 x)
{
    const float A = 0.22;   // Shoulder Strength
    const float B = 0.30;   // Linear Strength
    const float C = 0.10;   // Linear Angle
    const float D = 0.20;   // Toe Strength
    const float E = 0.01;   // Toe Numerator
    const float F = 0.30;   //Toe Denominator

    return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}
vec3 color = uncharted2ToneMap(tex) / uncharted2ToneMap(whiteScale);

// https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
vec3 ACESToneMapping(vec3 color)
{
    const float A = 2.51;
    const float B = 0.03;
    const float C = 2.43;
    const float D = 0.59;
    const float E = 0.14;
    return (color * (A * color + B)) / (color * (C * color + D) + E);
}