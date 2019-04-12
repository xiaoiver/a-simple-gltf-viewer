/**
 * render w/ regl
 * @see https://github.com/regl-project/regl/blob/gh-pages/API.md
 */
import * as regl from 'regl';
import * as Stats from 'stats.js';
import { inject, injectable } from 'inversify';
import { EventEmitter } from 'eventemitter3';
import { SERVICE_IDENTIFIER, BRDFLUT_PATH } from '@/services/constants';
import { ISceneService } from '@/services/SceneService';
import { ICameraService } from '@/services/Camera';
import { IAttributeData } from '@/services/GltfService';
// @ts-ignore
import vert from '@/shaders/pbr-vert.glsl';
// @ts-ignore
import frag from '@/shaders/pbr-frag.glsl';
// @ts-ignore
import gridVert from '@/shaders/grid-vert.glsl';
// @ts-ignore
import gridFrag from '@/shaders/grid-frag.glsl';
// @ts-ignore
import shadowVert from '@/shaders/shadow-vert.glsl';
// @ts-ignore
import shadowFrag from '@/shaders/shadow-frag.glsl';
import { loadImage } from '@/utils/asset';
import { GLTF_COMPONENT_TYPE_ARRAYS, GLTF_ELEMENTS_PER_TYPE } from 'gltf-loader-ts/lib/gltf-loader';
import { mat4, vec3 } from 'gl-matrix';

const SHADOW_RES = 2048;

interface drawParams {
    attributes: {[key: string]: IAttributeData};
    uniforms: {[key: string]: any};
    indices: IAttributeData;
    defines: {[key: string]: number};
    cullFace: boolean;
}

interface DirectionalLight {
    direction: number[];
    color: number[];
}

export interface IRendererService {
    on(name: string, cb: Function): void;
    init(container: string): void;
    render(): void;
    getCanvas(): HTMLCanvasElement;
    getRegl(): regl.Regl;
    createDrawCommand(params: drawParams): regl.DrawCommand;
    createDrawDepthCommand(params: Partial<drawParams>): regl.DrawCommand;
    isSupportSRGB(): boolean;

    setSplitLayer(splitLayer: number[]): void;
    setFinalSplit(finalSplit: number[]): void;
    setWireframeLineColor(color: number[]): void;
    setWireframeLineWidth(width: number): void;
    setDirectionalLight(light: Partial<DirectionalLight>): void;
}

@injectable()
export class Renderer extends EventEmitter implements IRendererService {
    static READY_EVENT = 'ready';
    static FRAME_EVENT = 'frame';
    static RESIZE_EVENT = 'resize';

    private _regl: regl.Regl;
    private stats: Stats;
    private canvas: HTMLCanvasElement;

    /**
     * style variables
     */
    private splitLayer: number[] = [0, 0, 0, 0];
    private finalSplit: number[] = [0, 0, 0, 0];
    private wireframeLineColor: number[] = [0, 0, 0];
    private wireframeLineWidth: number = 1;
    private directionalLight: DirectionalLight = {
        direction: [0, 0.5, 0.5],
        color: [1, 1, 1]
    };

    private defines: {[key: string]: number} = {
        USE_IBL: 1,
        // TODO: Since there's a bug in regl,
        // we must do srgb conversion manually for now.
        // @see https://github.com/xiaoiver/a-simple-gltf-viewer/issues/2
        MANUAL_SRGB: 1,
        SRGB_FAST_APPROXIMATION: 1,
        USE_TEX_LOD: 0
    };

    /**
     * Uniforms relative to current environment. They will not be destroyed when model changed,
     * such as brdfLUT, diffuseEnv and specularEnv.
     */
    private sceneUniforms: {[key: string]: any} = {};
    private drawGround: regl.DrawCommand;
    private fbo: regl.Framebuffer2D;

    /**
     * WebGL extension flags
     */
    private supportSRGB: boolean = false;
    private supportTextureLod: boolean = false;
    private supportDerivatives: boolean = false;

    private inited: boolean = false;

    @inject(SERVICE_IDENTIFIER.SceneService) private _scene: ISceneService;
    @inject(SERVICE_IDENTIFIER.CameraService) private _camera: ICameraService;

    private initStats() {
        this.stats = new Stats();
        this.stats.showPanel(0);
        const $stats = this.stats.dom;
        $stats.style.position = 'absolute';
        $stats.style.left = '0px';
        $stats.style.top = '0px';
        document.body.appendChild($stats);
    }

    private prefixDefines(glsl: string, defines: any): string {
        const d = { ...this.defines, ...defines };
        return `
        ${Object.keys(d).reduce((prev, defineName) => {
            return prev + (d[defineName] ?
                `#define ${defineName} ${d[defineName]} \n` : '');
        }, '')}
        ${glsl}`;
    }

    /**
     * generate barycentric coordinates
     * @see https://xiaoiver.github.io/coding/2018/10/22/Wireframe-%E7%9A%84%E5%AE%9E%E7%8E%B0.html
     */
    private generateBarycentric(attributes: {
        [key: string]: IAttributeData;
    }, indices: IAttributeData) {
        const uniqueAttributes: {
            [key: string]: {
                buffer: Uint8Array|Uint16Array|Float32Array;
            };
        } = {};
        const indiceNum = indices.buffer.length;

        // create empty typed array according to indices' num
        Object.keys(attributes).forEach(attributeName => {
            const { componentType, attributeType } = attributes[attributeName];
            const size = GLTF_ELEMENTS_PER_TYPE[attributeType];
            const bufferConstructor = GLTF_COMPONENT_TYPE_ARRAYS[componentType];
            uniqueAttributes[attributeName] = {
                buffer: new bufferConstructor(size * indiceNum)
            };
        });
        
        // reallocate attribute data
        let cursor = 0;
        const bufferConstructor = GLTF_COMPONENT_TYPE_ARRAYS[indices.componentType];
        const uniqueIndices = new bufferConstructor(indiceNum);
        for (var i = 0; i < indiceNum; i++) {
            var ii = indices.buffer[i];

            Object.keys(attributes).forEach(name => {
                const { buffer, attributeType } = attributes[name];
                const size = GLTF_ELEMENTS_PER_TYPE[attributeType || 'VEC3'];
                for (var k = 0; k < size; k++) {
                    uniqueAttributes[name].buffer[cursor * size + k] = buffer[ii * size + k];
                }
            });
            uniqueIndices[i] = cursor;
            cursor++;
        }

        // create barycentric attributes
        const barycentricBuffer = new Float32Array(indiceNum * 3);
        for (let i = 0; i < indiceNum;) {
            for (let j = 0; j < 3; j++) {
                const ii = uniqueIndices[i++];
                barycentricBuffer[ii * 3 + j] = 1;
            }
        }
        uniqueAttributes['a_Barycentric'] = {
            buffer: barycentricBuffer
        };

        return {
            uniqueAttributes,
            uniqueIndices
        }
    }

    /**
     * every scene node can use this method to create its own draw command
     */
    public createDrawCommand({ attributes, uniforms, defines, indices, cullFace }: drawParams) {
        const { uniqueAttributes, uniqueIndices } = this.generateBarycentric(attributes, indices);

        return this._regl({
            vert: this.prefixDefines(vert, defines),
            frag: this.prefixDefines(frag, defines),
            attributes: uniqueAttributes,
            uniforms: {
                u_LightDirection: () => this.directionalLight.direction,
                u_LightColor: () => this.directionalLight.color,
                u_Camera: () => this._camera.eye,
                // @ts-ignore
                u_ModelMatrix: this._regl.prop('modelMatrix'),
                // @ts-ignore
                u_NormalMatrix: this._regl.prop('normalMatrix'),
                // @ts-ignore
                u_MVPMatrix: this._regl.prop('mvpMatrix'),
                u_ScaleDiffBaseMR: () => this.splitLayer,
                u_FinalSplit: () => this.finalSplit,
                u_ScaleIBLAmbient: [1, 1, 0, 0],
                u_WireframeLineColor: () => this.wireframeLineColor,
                u_WireframeLineWidth: () => this.wireframeLineWidth,
                u_ViewportWidth: this._regl.context('viewportWidth'),
                u_ViewportHeight: this._regl.context('viewportHeight'),
                ...uniforms,
                ...this.sceneUniforms
            },
            cull: {
                // @ts-ignore
                enable: cullFace,
                face: 'back'
            },
            elements: this._regl.elements({
                primitive: 'triangles',
                data: uniqueIndices
            })
        });
    }

    public createDrawDepthCommand({ attributes, indices }: drawParams) {
        return this._regl({
            vert: shadowVert,
            frag: shadowFrag,
            attributes: {
                a_Position: attributes['a_Position'].buffer
            },
            uniforms: {
                // @ts-ignore
                u_MVPMatrixFromLight: (_, props) => {
                    const vm = mat4.create();
                    const projectionMatrix = mat4.create();
                    mat4.lookAt(vm, this.directionalLight.direction, this._camera.center, this._camera.up);

                    mat4.ortho(projectionMatrix, -25, 25, -20, 20, -25, 25);
                    mat4.mul(projectionMatrix, projectionMatrix, vm);
                    // @ts-ignore
                    return mat4.mul(projectionMatrix, projectionMatrix, props.modelMatrix);
                }
            },
            elements: this._regl.elements({
                primitive: 'triangles',
                data: <Uint8Array|Uint16Array|Uint32Array>indices.buffer
            }),
            framebuffer: this.fbo
        });
    }

    /**
     * draw a plane mesh with grid
     */
    private createDrawGroundCommand() {
        this.drawGround = this._regl({
            vert: gridVert,
            frag: gridFrag,
            attributes: {
                a_Position: [
                    [-4, -1, -4],
                    [4, -1, -4],
                    [4, -1, 4],
                    [-4, -1, 4]
                ],
                a_Normal: [
                    [0, -1, 0],
                    [0, -1, 0],
                    [0, -1, 0],
                    [0, -1, 0]
                ]
            },
            uniforms: {
                u_MVPMatrix: () => this._camera.transform,
                u_MVPMatrixFromLight: () => {
                    const vm = mat4.create();
                    const projectionMatrix = mat4.create();
                    mat4.lookAt(vm, this.directionalLight.direction, this._camera.center, this._camera.up);

                    mat4.ortho(projectionMatrix, -25, 25, -20, 20, -25, 25);
                    mat4.mul(projectionMatrix, projectionMatrix, vm);
                    return mat4.mul(projectionMatrix, projectionMatrix, mat4.create());
                },
                u_GridSize: 5,
                u_GridSize2: 1,
                u_GridColor: [0, 0, 0, 1],
                u_GridColor2: [0.3, 0.3, 0.3, 1],
                u_GridEnabled: true,
                u_ShadowMap: () => this.fbo,
                u_Camera: () => this._camera.eye,
                u_LightDirection: () => this.directionalLight.direction
            },
            elements: [
                [0, 2, 3],
                [2, 0, 1]
            ]
        });
    }

    private async createRegl($container: HTMLElement) {
        this._regl = await new Promise((resolve, reject) => {
            regl({
                container: $container,
                extensions: [
                    'EXT_shader_texture_lod', // IBL
                    'OES_standard_derivatives', // wireframe
                    'EXT_SRGB', // baseColor emmisive
                    'OES_texture_float' // shadow map
                ],
                // profile: true,
                onDone: (err, _regl) => {
                    if (err || !_regl) {
                        console.log(err);
                        reject(err);
                        return;
                    }
                    resolve(_regl);

                    this.canvas = $container.getElementsByTagName('canvas')[0];
                    this.emit(Renderer.READY_EVENT);
                }
            });
        });

        if (this._regl.hasExtension('EXT_SRGB')) {
            this.supportSRGB = true;
        } else {
            /**
             * if EXT_SRGB is not supported, we must converted to linear space in fragment shader manually.
             * if supported, baseColorTexture, emissiveTexture & brdfLUT must use 'srgb' in regl.
             */
            this.defines['MANUAL_SRGB'] = 1;
        }
        if (this._regl.hasExtension('EXT_shader_texture_lod')) {
            this.supportTextureLod = true;
            this.defines['USE_TEX_LOD'] = 1;
        }
        if (this._regl.hasExtension('OES_standard_derivatives')) {
            this.supportDerivatives = true;
        }

        // create a fbo for shadow map
        this.fbo = this._regl.framebuffer({
            color: this._regl.texture({
                width: SHADOW_RES,
                height: SHADOW_RES,
                wrap: 'clamp',
                type: 'float'
            }),
            depth: true
        });
    }

    /**
     * update VP matrix in camera when resize
     */
    private updateCamera() {
        this._camera.aspect = this.canvas.width / this.canvas.height;
        this._camera.updateProjection();
        this._camera.updateTransform();
    }

    public async init(container: string): Promise<void> {
        this.initStats();

        const $container = document.getElementById(container);
        if ($container) {
            // create a fullscreen canvas
            await this.createRegl($container);

            this.updateCamera();
            window.addEventListener('resize', () => {
                this.updateCamera();
                this.emit(Renderer.RESIZE_EVENT, [{
                    width: this.canvas.width,
                    height: this.canvas.height
                }]);
            });
        } else {
            throw new Error(`${container} container is not exist.`);
        }
    }

    public getCanvas() {
        return this.canvas;
    }

    public getRegl() {
        return this._regl;
    }

    public isSupportSRGB() {
        return this.supportSRGB;
    }

    public isSupportTextureLod() {
        return this.supportTextureLod;
    }

    public isSupportDerivatives() {
        return this.supportDerivatives;
    }

    private async loadBrdfLUT() {
        const image = await loadImage(BRDFLUT_PATH);
        this.sceneUniforms['u_brdfLUT'] = this._regl.texture({
            data: image,
            min: 'linear',
            mag: 'linear',
            wrapS: 'clamp',
            wrapT: 'clamp',
            format: this.isSupportSRGB() ? 'srgb' : 'rgba'
        });
    }

    private async loadEnvironment(envMap: string, type: string, uniformName: string, mipLevels: number) {
        const path = `textures/${envMap}/${type}/${type}`;
        const posXMipMaps = [];
        const negXMipMaps = [];
        const posYMipMaps = [];
        const negYMipMaps = [];
        const posZMipMaps = [];
        const negZMipMaps = [];
        for (let j = 0; j < mipLevels; j++) {
            posXMipMaps.push(await loadImage(`${path}_right_${j}.jpg`));
            negXMipMaps.push(await loadImage(`${path}_left_${j}.jpg`));
            posYMipMaps.push(await loadImage(`${path}_top_${j}.jpg`));
            negYMipMaps.push(await loadImage(`${path}_bottom_${j}.jpg`));
            posZMipMaps.push(await loadImage(`${path}_front_${j}.jpg`));
            negZMipMaps.push(await loadImage(`${path}_back_${j}.jpg`));
        }

        const cubeMap = this._regl.cube({
            // @ts-ignore
            faces: mipLevels === 1 ?
                [posXMipMaps[0], negXMipMaps[0], posYMipMaps[0], negYMipMaps[0], posZMipMaps[0], negZMipMaps[0]]
                : [ { mipmap: posXMipMaps },
                    { mipmap: negXMipMaps },
                    { mipmap: posYMipMaps },
                    { mipmap: negYMipMaps },
                    { mipmap: posZMipMaps },
                    { mipmap: negZMipMaps } ],
            wrapS: 'clamp',
            wrapT: 'clamp',
            min: mipLevels === 1 ? 'linear' : 'linear mipmap linear',
            mag: 'linear',
            format: this.isSupportSRGB() ? 'srgb' : 'rgba'
        });

        this.sceneUniforms[uniformName] = cubeMap;
    }

    setFinalSplit(finalSplit: number[]) {
        this.finalSplit = finalSplit;
    }

    setSplitLayer(splitLayer: number[]) {
        this.splitLayer = splitLayer;
    }

    setWireframeLineColor(color: number[]) {
        this.wireframeLineColor = color;
    }

    setWireframeLineWidth(width: number) {
        this.wireframeLineWidth = width;
    }

    setDirectionalLight(light: Partial<DirectionalLight>) {
        this.directionalLight = { ...this.directionalLight, ...light };
    }

    public async render() {
        if (!this.inited) {
            // load resources relative to current environment only once
            await this.loadBrdfLUT();
            await this.loadEnvironment('papermill', 'diffuse', 'u_DiffuseEnvSampler', 1);
            await this.loadEnvironment('papermill', 'specular', 'u_SpecularEnvSampler', 10);
        }

        // rebuild scene graph
        await this._scene.init();

        if (!this.inited) {
            this.createDrawGroundCommand();
            this._regl.frame(() => {
                this._regl.clear({
                    color: [0.2, 0.2, 0.2, 1],
                    depth: 1
                });

                // shadow map pass
                this._scene.drawDepth();

                // lighting pass
                this.drawGround();                
                this._scene.draw();

                // update stats.js
                this.stats.update();
                this.emit(Renderer.FRAME_EVENT);
            });
            this.inited = true;
        }

        const canvas = this.getCanvas();
        this.emit(Renderer.RESIZE_EVENT, [{
            width: canvas.width,
            height: canvas.height
        }]);
    }
}