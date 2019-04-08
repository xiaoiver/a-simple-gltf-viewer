import { TextureMinFilterType, TextureMagFilterType, TextureWrapModeType } from "regl";

const SERVICE_IDENTIFIER = {
    GltfService: Symbol.for("GltfService"),
    SceneService: Symbol.for("SceneService"),
    SceneNodeService: Symbol.for("SceneNodeService"),
    RendererService: Symbol.for("RendererService"),
    CameraService: Symbol.for("CameraService"),
    MouseService: Symbol.for("MouseService"),
};

/**
 * map glsl
 * @see https://github.com/regl-project/regl/blob/gh-pages/API.md#textures
 * @see https://gist.github.com/szimek/763999
 */

const MIN_FILTER: {
    [key: number]: TextureMinFilterType
} = {
    9728: 'nearest',
    9729: 'linear',
    9984: 'nearest mipmap nearest',
    9985: 'linear mipmap nearest',
    9986: 'nearest mipmap linear',
    9987: 'linear mipmap linear'
};
const MAG_FILTER: {
    [key: number]: TextureMagFilterType
} = {
    9728: 'nearest',
    9729: 'linear'
};
const WRAP_S: {
    [key: number]: TextureWrapModeType
} = {
    33071: 'clamp',
    33648: 'mirror',
    10497: 'repeat'
};
const WRAP_T = WRAP_S;

export { SERVICE_IDENTIFIER, MIN_FILTER, MAG_FILTER, WRAP_S, WRAP_T };
