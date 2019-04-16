uniform vec3 u_WireframeLineColor;
uniform float u_WireframeLineWidth;

varying vec3 v_Barycentric;

// wireframe
float edgeFactor() {
    vec3 d = fwidth(v_Barycentric);
    vec3 a3 = smoothstep(vec3(0.0), d * u_WireframeLineWidth, v_Barycentric);
    return min(min(a3.x, a3.y), a3.z);
}