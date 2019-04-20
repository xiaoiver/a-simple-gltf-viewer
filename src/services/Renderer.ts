/**
 * render w/ regl
 * @see https://github.com/regl-project/regl/blob/gh-pages/API.md
 */
import * as regl from 'regl';
import { inject, injectable } from 'inversify';
import { EventEmitter } from 'eventemitter3';
import { mat4, vec3 } from 'gl-matrix';
import { SERVICE_IDENTIFIER, BRDFLUT_PATH } from '@/services/constants';
import { ISceneService } from '@/services/SceneService';
import { ICameraService } from '@/services/Camera';
import { IAttributeData } from '@/services/GltfService';
import { compileBuiltinModules } from '@/shaders';
import { getModule } from '@/shaders/shader-module';
import { loadImage } from '@/utils/asset';
import { generateBarycentric } from '@/utils/geometry';
import { IStyleService } from './Style';
import { IPostProcessorService, IPass } from './PostProcessor';
import { IWebGLContextService } from './Regl';
import { container } from '@/inversify.config';
import { ITimelineService } from './Timeline';

const SHADOW_RES = 2048;

interface drawParams {
    attributes: {[key: string]: IAttributeData};
    uniforms: {[key: string]: any};
    indices: IAttributeData;
    defines: {[key: string]: number};
    cullFace: boolean;
}

export interface IRendererService {
    on(name: string, cb: Function): void;
    init(container: string): void;
    render(): void;
    getCanvas(): HTMLCanvasElement;
    createDrawCommand(params: drawParams): regl.DrawCommand;
    createDrawDepthCommand(params: Partial<drawParams>): regl.DrawCommand;
}

@injectable()
export class Renderer extends EventEmitter implements IRendererService {
    static READY_EVENT = 'ready';
    static FRAME_EVENT = 'frame';
    static RESIZE_EVENT = 'resize';

    private canvas: HTMLCanvasElement;
    private _regl: regl.Regl;

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
    private drawSkybox: regl.DrawCommand;
    private renderToPostProcessor: regl.DrawCommand;
    private depthFBO: regl.Framebuffer2D;

    private inited: boolean = false;

    @inject(SERVICE_IDENTIFIER.WebGLContextService) private _context: IWebGLContextService;
    @inject(SERVICE_IDENTIFIER.SceneService) private _scene: ISceneService;
    @inject(SERVICE_IDENTIFIER.CameraService) private _camera: ICameraService;
    @inject(SERVICE_IDENTIFIER.StyleService) private _style: IStyleService;
    @inject(SERVICE_IDENTIFIER.PostProcessorService) private _postProcessor: IPostProcessorService;
    @inject(SERVICE_IDENTIFIER.TimelineService) private _timeline: ITimelineService;

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
     * every scene node can use this method to create its own draw command
     */
    public createDrawCommand({ attributes, uniforms, defines, indices, cullFace }: drawParams) {
        const { uniqueAttributes, uniqueIndices } = generateBarycentric(attributes, indices);
        const { vs, fs } = getModule('render-pass');
        return this._regl({
            vert: this.prefixDefines(vs, defines),
            frag: this.prefixDefines(fs, defines),
            attributes: uniqueAttributes,
            uniforms: {
                u_LightDirection: () => this._style.getDirectionalLight().direction,
                u_LightColor: () => this._style.getDirectionalLight().color,
                u_Camera: () => this._camera.eye,
                // @ts-ignore
                u_ModelMatrix: this._regl.prop('modelMatrix'),
                // @ts-ignore
                u_NormalMatrix: this._regl.prop('normalMatrix'),
                // @ts-ignore
                u_MVPMatrix: this._regl.prop('mvpMatrix'),
                u_ScaleDiffBaseMR: () => this._style.getSplitLayer(),
                u_FinalSplit: () => this._style.getFinalSplit(),
                u_ScaleIBLAmbient: [1, 1, 0, 0],
                u_WireframeLineColor: () => this._style.getWireframeLineColor(),
                u_WireframeLineWidth: () => this._style.getWireframeLineWidth(),
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
        const { vs, fs } = getModule('shadow-pass');
        return this._regl({
            vert: vs,
            frag: fs,
            attributes: {
                a_Position: attributes['a_Position'].buffer
            },
            uniforms: {
                // @ts-ignore
                u_MVPMatrixFromLight: (_, props) => {
                    const vm = mat4.create();
                    const projectionMatrix = mat4.create();
                    mat4.lookAt(vm, this._style.getDirectionalLight().direction, this._camera.center, this._camera.up);

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
            framebuffer: this.depthFBO
        });
    }

    /**
     * draw a plane mesh with grid
     */
    private createDrawGroundCommand() {
        const { vs, fs, uniforms } = getModule('grid');
        this.drawGround = this._regl({
            vert: vs,
            frag: fs,
            attributes: {
                a_Position: [
                    [-4, -1, -4],
                    [4, -1, -4],
                    [4, -1, 4],
                    [-4, -1, 4]
                ],
                a_Normal: [
                    [0, 0, 1],
                    [0, 0, 1],
                    [0, 0, 1],
                    [0, 0, 1]
                ]
            },
            uniforms: {
                ...uniforms,
                u_MVPMatrix: () => this._camera.transform,
                u_MVPMatrixFromLight: () => {
                    const vm = mat4.create();
                    const projectionMatrix = mat4.create();
                    mat4.lookAt(vm, this._style.getDirectionalLight().direction, this._camera.center, this._camera.up);

                    mat4.ortho(projectionMatrix, -25, 25, -20, 20, -25, 25);
                    mat4.mul(projectionMatrix, projectionMatrix, vm);
                    return mat4.mul(projectionMatrix, projectionMatrix, mat4.create());
                },
                u_ShadowMap: () => this.depthFBO,
                u_Camera: () => this._camera.eye,
                u_LightColor: () => this._style.getDirectionalLight().color,
                u_LightDirection: () => this._style.getDirectionalLight().direction,
            },
            elements: [
                [0, 3, 2],
                [2, 1, 0]
            ],
            cull: {
                enable: true
            }
        });
    }

    private createDrawSkyboxCommand() {
        const { vs, fs, uniforms } = getModule('skybox');
        this.drawSkybox = this._regl({
            vert: vs,
            frag: fs,
            attributes: {
                a_Position: [
                    [1.0, 1.0, 1.0],  [-1.0, 1.0, 1.0],  [-1.0,-1.0, 1.0],   [1.0,-1.0, 1.0], // v0-v1-v2-v3 front
                    [1.0, 1.0, 1.0],   [1.0,-1.0, 1.0],   [1.0,-1.0,-1.0],   [1.0, 1.0,-1.0], // v0-v3-v4-v5 right
                    [1.0, 1.0, 1.0],   [1.0, 1.0,-1.0],  [-1.0, 1.0,-1.0],  [-1.0, 1.0, 1.0], // v0-v5-v6-v1 up
                   [-1.0, 1.0, 1.0],  [-1.0, 1.0,-1.0],  [-1.0,-1.0,-1.0],  [-1.0,-1.0, 1.0], // v1-v6-v7-v2 left
                   [-1.0,-1.0,-1.0],   [1.0,-1.0,-1.0],   [1.0,-1.0, 1.0],  [-1.0,-1.0, 1.0], // v7-v4-v3-v2 down
                    [1.0,-1.0,-1.0],  [-1.0,-1.0,-1.0],  [-1.0, 1.0,-1.0],   [1.0, 1.0,-1.0]  // v4-v7-v6-v5 back
                ],
            },
            uniforms: {
                ...uniforms,
                u_VPMatrix: () => {
                    // remove translation in original view matrix
                    const vm = this._camera.view;
                    const viewMatrix = mat4.create();
                    mat4.set(viewMatrix, vm[0], vm[1], vm[2], 0,
                        vm[4], vm[5], vm[6], 0,
                        vm[8], vm[9], vm[10], 0,
                        0, 0, 0, 1);
                    const vpMatrix = mat4.create();
                    mat4.mul(vpMatrix, this._camera.projection, viewMatrix);
                    return vpMatrix;
                },
                u_Skybox: this.sceneUniforms['u_SpecularEnvSampler']
            },
            elements: [
                [0, 1, 2],   [0, 2, 3],    // front
                [4, 5, 6],   [4, 6, 7],    // right
                [8, 9,10],   [8,10,11],    // up
                [12,13,14],  [12,14,15],    // left
                [16,17,18],  [16,18,19],    // down
                [20,21,22],  [20,22,23]     // back
            ],
            cull: {
                enable: false
            },
            depth: {
                // put skybox to the bottom
                mask: false
            }
        });
    }

    private async createRegl($container: HTMLElement) {
        await this._context.init($container);
        this._regl = this._context.getContext();

        this.canvas = $container.getElementsByTagName('canvas')[0];
        this.emit(Renderer.READY_EVENT);

        if (!this._context.isSupportSRGB()) {
            /**
             * if EXT_SRGB is not supported, we must converted to linear space in fragment shader manually.
             * if supported, baseColorTexture, emissiveTexture & brdfLUT must use 'srgb' in regl.
             */
            this.defines['MANUAL_SRGB'] = 1;
        }
        if (this._context.isSupportTextureLod()) {
            this.defines['USE_TEX_LOD'] = 1;
        }

        // create a fbo for shadow map
        this.depthFBO = this._regl.framebuffer({
            color: this._regl.texture({
                width: SHADOW_RES,
                height: SHADOW_RES,
                format: 'rgba',
                type: 'uint8'
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
        const $container = document.getElementById(container);
        if ($container) {
            // create a fullscreen canvas
            await this.createRegl($container);

            // compile shader modules
            compileBuiltinModules();

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

    private async loadBrdfLUT() {
        const image = await loadImage(BRDFLUT_PATH);
        this.sceneUniforms['u_brdfLUT'] = this._regl.texture({
            data: image,
            min: 'linear',
            mag: 'linear',
            wrapS: 'clamp',
            wrapT: 'clamp',
            format: this._context.isSupportSRGB() ? 'srgb' : 'rgba'
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
            format: this._context.isSupportSRGB() ? 'srgb' : 'rgba'
        });

        this.sceneUniforms[uniformName] = cubeMap;
    }

    public async render() {
        if (!this.inited) {
            // load resources relative to current environment only once
            await this.loadBrdfLUT();
            await this.loadEnvironment('papermill', 'diffuse', 'u_DiffuseEnvSampler', 1);
            await this.loadEnvironment('papermill', 'specular', 'u_SpecularEnvSampler', 10);

            this._postProcessor.init();
            // this._postProcessor.add(container.get<IPass>(SERVICE_IDENTIFIER.BlurHPass));
            // this._postProcessor.add(container.get<IPass>(SERVICE_IDENTIFIER.BlurVPass));
            // this._postProcessor.add(container.get<IPass>(SERVICE_IDENTIFIER.DoFPass));
            this._postProcessor.add(container.get<IPass>(SERVICE_IDENTIFIER.CopyPass));

            this.renderToPostProcessor = this._regl({
                cull: {
                    enable: true
                },
                // depth: {
                //     enable: true
                // },
                // since post-processor will swap read/write fbos, we must retrieve it dynamically
                // framebuffer: () => this._postProcessor.getReadFBO()
            });
        }

        // rebuild scene graph
        await this._scene.init();

        this._timeline.reset();
        this._timeline.start();

        if (!this.inited) {
            // create draw ground & skybox command for later use
            this.createDrawGroundCommand();
            this.createDrawSkyboxCommand();
            this._regl.frame(({ viewportWidth, viewportHeight }) => {

                this._regl.clear({
                    color: [1, 1, 1, 1],
                    depth: 1,
                    // stencil: 0,
                    framebuffer: this.depthFBO
                });

                // shadow map pass
                this._scene.drawDepth();

                this._postProcessor.resize(viewportWidth, viewportHeight);

                this.renderToPostProcessor({}, () => {
                    this._regl.clear({
                        color: [1, 1, 1, 1],
                        depth: 1,
                        // stencil: 0,
                        framebuffer: this._postProcessor.getReadFBO()
                    });

                    // lighting pass
                    this.drawSkybox();
                    this.drawGround();
                    this._scene.draw();
                });

                // post-processing pass
                // this._postProcessor.render();

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