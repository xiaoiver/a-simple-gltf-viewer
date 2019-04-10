import { TextureMinFilterType, TextureMagFilterType, TextureWrapModeType } from "regl";

const SERVICE_IDENTIFIER = {
    GltfService: Symbol.for("GltfService"),
    SceneService: Symbol.for("SceneService"),
    SceneNodeService: Symbol.for("SceneNodeService"),
    RendererService: Symbol.for("RendererService"),
    CameraService: Symbol.for("CameraService"),
    MouseService: Symbol.for("MouseService"),
};

const BRDFLUT_PATH = 'textures/brdfLUT.png';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#samplerminfilter
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

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#samplermagfilter
 */
const MAG_FILTER: {
    [key: number]: TextureMagFilterType
} = {
    9728: 'nearest',
    9729: 'linear'
};

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#samplerwraps
 */
const WRAP_S: {
    [key: number]: TextureWrapModeType
} = {
    33071: 'clamp',
    33648: 'mirror',
    10497: 'repeat'
};
const WRAP_T = WRAP_S;

/**
 * map to regl type
 */
const REGL_COMPONENT_TYPE_ARRAYS: { [index: number]: string } = {
    5120: 'int8',
    5121: 'uint8',
    5122: 'int16',
    5123: 'uint16',
    5124: 'int32',
    5125: 'uint32',
    5126: 'float32'
};

export { SERVICE_IDENTIFIER, BRDFLUT_PATH, MIN_FILTER, MAG_FILTER, WRAP_S, WRAP_T, REGL_COMPONENT_TYPE_ARRAYS };
