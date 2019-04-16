uniform samplerCube u_Skybox;
varying vec3 v_UV;

void main() {
    gl_FragColor = textureCube(u_Skybox, v_UV);
}