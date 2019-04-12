attribute vec3 a_Position;
attribute vec3 a_Normal;

varying vec3 v_Position;
varying vec4 v_PositionFromLight;
varying vec3 v_Normal;

uniform mat4 u_MVPMatrix;
uniform mat4 u_MVPMatrixFromLight;

void main() {
    v_Position = a_Position;
    v_PositionFromLight = u_MVPMatrixFromLight * vec4(a_Position, 1.);
    v_Normal = a_Normal;
    gl_Position = u_MVPMatrix * vec4(a_Position, 1.);
}