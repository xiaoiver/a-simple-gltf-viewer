/**
 * render w/ regl
 * @see https://github.com/regl-project/regl/blob/gh-pages/API.md
 */
import * as regl from 'regl';
import * as Stats from 'stats.js';
import { inject, injectable } from 'inversify';
import { EventEmitter } from 'eventemitter3';
import { SERVICE_IDENTIFIER, MIN_FILTER, MAG_FILTER, WRAP_S, WRAP_T } from '@/services/constants';
import { ISceneService } from '@/services/SceneService';
// @ts-ignore
import vert from '@/shaders/vert.glsl';
// @ts-ignore
import frag from '@/shaders/frag.glsl';
import { Sampler } from 'gltf-loader-ts/lib/gltf';
import { loadImage } from '@/utils/asset';
import { IGltfService } from './GltfService';

export interface IRendererService {
    on(name: string, cb: Function): void;
    init(container: string): void;
    render(): void;
    getCanvas(): HTMLCanvasElement;
    addAttribute(attributeName: string, data: any, offset: number|undefined, stride: number|undefined): void;
    addDefine(defineName: string, value: number): void;
    addUniform(uniformName: string, value: any, type?: string): void;
    setIndices(indices: Uint8Array | Uint16Array | Float32Array | undefined): void;
    setCullFace(enabled: boolean): void;
    callDrawCommand(body?: regl.CommandBodyFn<regl.DefaultContext, {}> | undefined): void;
    isSupportSRGB(): boolean;
}

const defaultDefines = {
    USE_IBL: 0,
    HAS_NORMALS: 0,
    HAS_TANGENTS: 0,
    HAS_UV: 0,
    HAS_BASECOLORMAP: 0,
    HAS_METALROUGHNESSMAP: 0,
    HAS_NORMALMAP: 0,
    MANUAL_SRGB: 0,
    HAS_EMISSIVEMAP: 0,
    HAS_OCCLUSIONMAP: 0
};

@injectable()
export class Renderer extends EventEmitter implements IRendererService {
    static READY_EVENT = 'ready';
    static FRAME_EVENT = 'frame';
    static RESIZE_EVENT = 'resize';

    private _regl: regl.Regl;
    private stats: Stats;
    private draw: regl.DrawCommand;
    private canvas: HTMLCanvasElement;
    private indices: {
        data: Uint8Array;
    };
    private attributes: {[key: string]: any} = {};
    private uniforms: {[key: string]: any} = {};
    private defines: {[key: string]: number} = {...defaultDefines};
    private cullFace: boolean = true;
    private supportSRGB: boolean = false;
    private inited: boolean = false;

    @inject(SERVICE_IDENTIFIER.SceneService) private _scene: ISceneService;
    @inject(SERVICE_IDENTIFIER.GltfService) private _gltf: IGltfService;

    private initStats() {
        this.stats = new Stats();
        this.stats.showPanel(0);
        const $stats = this.stats.dom;
        $stats.style.position = 'absolute';
        $stats.style.left = '0px';
        $stats.style.top = '0px';
        document.body.appendChild($stats);
    }

    private prefixDefines(glsl: string): string {
        return `
        ${Object.keys(this.defines).reduce((prev, defineName) => {
            return prev + (this.defines[defineName] ?
                `#define ${defineName} ${this.defines[defineName]} \n` : '');
        }, '')}
        ${glsl}`;
    }

    private createDrawCommand() {
        this.draw = this._regl({
            vert: this.prefixDefines(vert),
            frag: this.prefixDefines(frag),
            attributes: this.attributes,
            uniforms: {
                u_LightDirection: [0, 4, 4],
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
                ...this.uniforms
            },
            cull: {
                // @ts-ignore
                enable: this._regl.this('cullFace'),
                face: 'back'
            },
            elements: this._regl.elements({
                primitive: 'triangles',
                data: this.indices.data
            })
        });
    }

    public callDrawCommand(body?: regl.CommandBodyFn<regl.DefaultContext, {}> | undefined): void {
        this.draw(body);
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

    public setCullFace(enabled: boolean) {
        this.cullFace = enabled;
    }

    public setIndices(indices: Uint8Array) {
        this.indices = {
            data: indices
        };
    }

    public addAttribute(attributeName: string, data: any, offset: number|undefined, stride: number|undefined) {
        this.attributes[attributeName] = {
            buffer: this._regl.buffer(data)
        };
        if (offset !== undefined) {
            this.attributes[attributeName].offset = offset;
        }
        if (stride !== undefined) {
            this.attributes[attributeName].stride = stride;
        }
    }

    public addUniform(uniformName: string,
        value: { image: HTMLImageElement, sampler: Sampler, format: regl.TextureFormatType },
        type?: string) {
        if (type === 'texture') {
            const { image, sampler, format = 'rgba' } = value;
            const textureParams: Partial<regl.Texture2DOptions> = {
                data: image,
                format
            };

            if (sampler) {
                if (sampler.minFilter !== undefined) {
                    textureParams.min = MIN_FILTER[sampler.minFilter];
                }
                if (sampler.magFilter !== undefined) {
                    textureParams.mag = MAG_FILTER[sampler.magFilter];
                }
                if (sampler.wrapS !== undefined) {
                    textureParams.wrapS = WRAP_S[sampler.wrapS];
                }
                if (sampler.wrapT !== undefined) {
                    textureParams.wrapT = WRAP_T[sampler.wrapT];
                }
                this.uniforms[uniformName] = this._regl.texture(textureParams);
            }
        } else {
            this.uniforms[uniformName] = value;
        }
    }

    public addDefine(defineName: string, value: number) {
        this.defines[defineName] = value;
    }

    public getCanvas() {
        return this.canvas;
    }

    public isSupportSRGB() {
        return this.supportSRGB;
    }

    private async loadBrdfLUT() {
        // brdfLUT
        const image = await loadImage('textures/brdfLUT.png');
        const sampler = this._gltf.getSampler(0);
        this.addUniform('brdfLUT', {
            image, sampler,
            format: this.isSupportSRGB ? 'srgb' : 'rgba'
        }, 'texture');
    }

    private clean() {
        this.attributes = {};
        this.uniforms = {};
        this.defines = { ...defaultDefines };
    }

    public async render() {
        this.clean();

        await this._scene.init();

        this.createDrawCommand();

        const canvas = this.getCanvas();
        this.emit(Renderer.RESIZE_EVENT, [{
            width: canvas.width,
            height: canvas.height
        }]);

        if (!this.inited) {
            await this.loadBrdfLUT();

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
    }
}