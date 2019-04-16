attribute vec3 a_Position;

uniform mat4 u_VPMatrix;

varying vec3 v_UV;

void main() {
    v_UV = a_Position;
    gl_Position = u_VPMatrix * vec4(a_Position, 1.);
}
