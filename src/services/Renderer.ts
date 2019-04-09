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
// @ts-ignore
import vert from '@/shaders/vert.glsl';
// @ts-ignore
import frag from '@/shaders/frag.glsl';
import { loadImage } from '@/utils/asset';

interface drawParams {
    attributes: {[key: string]: any};
    uniforms: {[key: string]: any};
    indices: any;
    defines: {[key: string]: number};
    cullFace: boolean;
}

export interface IRendererService {
    on(name: string, cb: Function): void;
    init(container: string): void;
    render(): void;
    getCanvas(): HTMLCanvasElement;
    getRegl(): regl.Regl;
    createDrawCommand(params: drawParams): regl.DrawCommand;
    isSupportSRGB(): boolean;
}

@injectable()
export class Renderer extends EventEmitter implements IRendererService {
    static READY_EVENT = 'ready';
    static FRAME_EVENT = 'frame';
    static RESIZE_EVENT = 'resize';

    private _regl: regl.Regl;
    private stats: Stats;
    private canvas: HTMLCanvasElement;

    private defines: {[key: string]: number} = {
        USE_IBL: 1,
        MANUAL_SRGB: 0,
        USE_TEX_LOD: 0
    };

    /**
     * Uniforms relative to current environment. They will not be destroyed when model changed,
     * such as brdfLUT, diffuseEnv and specularEnv.
     */
    private sceneUniforms: {[key: string]: any} = {};

    /**
     * WebGL extension flags
     */
    private supportSRGB: boolean = false;
    private supportTextureLod: boolean = false;
    private supportDerivatives: boolean = false;

    private inited: boolean = false;

    @inject(SERVICE_IDENTIFIER.SceneService) private _scene: ISceneService;

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

    public createDrawCommand({ attributes, uniforms, defines, indices, cullFace }: drawParams) {
        return this._regl({
            vert: this.prefixDefines(vert, defines),
            frag: this.prefixDefines(frag, defines),
            attributes,
            uniforms: {
                u_LightDirection: [0, 0.5, 0.5],
                u_LightColor: [1, 1, 1],
                // @ts-ignore
                u_Camera: this._regl.prop('cameraPosition'),
                // @ts-ignore
                u_ModelMatrix: this._regl.prop('modelMatrix'),
                // @ts-ignore
                u_NormalMatrix: this._regl.prop('normalMatrix'),
                // @ts-ignore
                u_MVPMatrix: this._regl.prop('mvpMatrix'),
                u_ScaleDiffBaseMR: [0, 0, 0, 0],
                u_ScaleFGDSpec: [0, 0, 0, 0],
                u_ScaleIBLAmbient: [1, 1, 0, 0],
                ...uniforms,
                ...this.sceneUniforms
            },
            cull: {
                // @ts-ignore
                enable: cullFace,
                face: 'back'
            },
            depth: {
                enable: true
            },
            elements: this._regl.elements({
                primitive: 'triangles',
                data: indices.data
            })
        });
    }

    public async init(container: string): Promise<void> {
        this.initStats();

        const $container = document.getElementById(container);
        if ($container) {
            // create a fullscreen canvas
            this._regl = await new Promise((resolve, reject) => {
                regl({
                    container: $container,
                    extensions: [
                        'EXT_shader_texture_lod',
                        'OES_standard_derivatives',
                        'EXT_SRGB'
                    ],
                    // profile: true,
                    onDone: (err, _regl) => {
                        if (err || !_regl) {
                            console.log(err);
                            reject(err);
                            return;
                        }

                        if (_regl.hasExtension('EXT_SRGB')) {
                            this.supportSRGB = true;
                        } else {
                            /**
                             * if EXT_SRGB is not supported, we must converted to linear space in fragment shader manually.
                             * if supported, baseColorTexture, emissiveTexture & brdfLUT must use 'srgb' in regl.
                             */
                            this.defines['MANUAL_SRGB'] = 1;
                        }
                        if (_regl.hasExtension('EXT_shader_texture_lod')) {
                            this.supportTextureLod = true;
                            this.defines['USE_TEX_LOD'] = 1;
                        }
                        if (_regl.hasExtension('OES_standard_derivatives')) {
                            this.supportDerivatives = true;
                        }

                        resolve(_regl);
                        this.canvas = $container.getElementsByTagName('canvas')[0];
                        this.emit(Renderer.READY_EVENT);
                    }
                });
            });

            window.addEventListener('resize', () => {
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
            this._regl.frame(() => {
                this._regl.clear({
                    color: [0, 0, 0, 1],
                    stencil: 0
                });

                this.stats.update();
                this._scene.draw();
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