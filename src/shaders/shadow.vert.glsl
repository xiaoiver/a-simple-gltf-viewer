attribute vec3 a_Position;

uniform mat4 u_MVPMatrixFromLight;

void main() {
    gl_Position = u_MVPMatrixFromLight * vec4(a_Position, 1.0);
}