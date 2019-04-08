/**
 * render w/ regl
 * @see https://github.com/regl-project/regl/blob/gh-pages/API.md
 */
import * as regl from 'regl';
import { inject, injectable } from 'inversify';
import { EventEmitter } from 'eventemitter3';
import { SERVICE_IDENTIFIER } from '@/services/constants';
import { ISceneService } from '@/services/SceneService';
import { ICameraService } from '@/services/Camera';
import vert from '@/shaders/vert.glsl';
import frag from '@/shaders/frag.glsl';
import * as Stats from 'stats.js';
import { mat4 } from 'gl-matrix';
import { BufferView } from 'gltf-loader-ts/lib/gltf';
import { IMouseService, Mouse, MouseData } from '@/services/Mouse';

export interface IRendererService {
    on(name: string, cb: Function): void;
    render(): void;
    getCanvas(): HTMLCanvasElement;
    addAttribute(attributeName: string, value: Uint8Array, bufferView: BufferView): void;
    addDefine(defineName: string, value: number): void;
    addUniform(uniformName: string, value: any, type?: string): void;
    setIndices(indices: Uint8Array, bufferView: BufferView): void;
    setCullFace(enabled: boolean): void;
    callDrawCommand(body?: regl.CommandBodyFn<regl.DefaultContext, {}> | undefined): void;
}

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
        bufferView: BufferView;
    };
    private attributes = {};
    private uniforms = {};
    private defines: {
        USE_IBL: number;
        HAS_NORMALS: number;
        HAS_TANGENTS: number;
        HAS_UV: number;
        HAS_BASECOLORMAP: number;
        HAS_METALROUGHNESSMAP: number;
    } = {
        USE_IBL: 0,
        HAS_NORMALS: 0,
        HAS_TANGENTS: 0,
        HAS_UV: 0,
        HAS_BASECOLORMAP: 0,
        HAS_METALROUGHNESSMAP: 0
    };
    private cullFace: boolean = true;

    @inject(SERVICE_IDENTIFIER.SceneService) private _scene: ISceneService;
    @inject(SERVICE_IDENTIFIER.CameraService) private _camera: ICameraService;
    @inject(SERVICE_IDENTIFIER.MouseService) private _mouse: IMouseService;

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

    private initDrawCommand() {
        this.draw = this._regl({
            vert: this.prefixDefines(vert),
            frag: this.prefixDefines(frag),
            attributes: this.attributes,
            uniforms: {
                u_LightDirection: [0, 0.5, 0.5],
                u_LightColor: [1, 1, 1],
                u_Camera: this._regl.prop('cameraPosition'),
                u_ModelMatrix: this._regl.prop('modelMatrix'),
                u_NormalMatrix: this._regl.prop('normalMatrix'),
                u_MVPMatrix: this._regl.prop('mvpMatrix'),
                u_ScaleDiffBaseMR: [1, 1, 1, 1],
                u_ScaleFGDSpec: [0, 0, 0, 0],
                u_ScaleIBLAmbient: [1, 1, 0, 0],
                u_MetallicRoughnessValues: [1, 1],
                u_BaseColorFactor: [1, 1, 1, 1],
                ...this.uniforms
            },
            // cull: {
            //     enable: this._regl.this('cullFace'),
            //     face: 'back'
            // },
            // depth: {
            //     enable: false
            // },
            elements: this._regl.elements({
                primitive: 'triangles',
                data: this.indices.data
            })
        });
    }

    public callDrawCommand(body?: regl.CommandBodyFn<regl.DefaultContext, {}> | undefined): void {
        this.draw(body);
    }

    private registerEventListeners(): void {
        const canvas = this.getCanvas();
        canvas.addEventListener('resize', () => {
            if (this._camera.eye) {
                this._camera.aspect = canvas.width / canvas.height;
                this._camera.updateProjection();
                this._camera.updateTransform();
            }
            this.emit(Renderer.RESIZE_EVENT);
        });

        this._mouse.on(Mouse.MOVE_EVENT, (data: MouseData) => {
            const {deltaX, deltaY, deltaZ} = data;
            const moveSpeed = 10;
          
            // if (isTruck) {
            //   this._camera.pan(deltaX * 0.001 * moveSpeed);
            //   this._camera.tilt(deltaY * 0.001 * moveSpeed);
            //   this._camera.dolly(deltaZ * 0.05 * moveSpeed);
            // } else {
            this._camera.truck(-deltaX * 0.01 * moveSpeed);
            this._camera.pedestal(deltaY * 0.01 * moveSpeed);
            this._camera.cant(deltaZ * 0.05 * moveSpeed);
            // }
        });
    }

    private async init(): Promise<void> {
        this.initStats();
        
        // create a fullscreen canvas
        await new Promise((resolve, reject) => {
            this._regl = regl({
                extensions: [
                    'EXT_shader_texture_lod',
                    'OES_standard_derivatives'
                ],
                // profile: true,
                onDone: (err, _regl) => {
                    if (err) {
                        console.log(err);
                        reject(err);
                        return;
                    }
                    resolve();
                    this.emit(Renderer.READY_EVENT);
                }
            });
        });

        await this._scene.init();

        this.initDrawCommand();

        this.registerEventListeners();
    }

    public setCullFace(enabled: boolean) {
        this.cullFace = enabled;
    }

    public setIndices(indices: Uint8Array, bufferView: BufferView) {
        this.indices = {
            data: indices,
            bufferView
        }
    }

    public addAttribute(attributeName: string, value: Uint8Array, bufferView: BufferView) {
        this.attributes[attributeName] = {
            buffer: this._regl.buffer(value),
        };
    }

    public addUniform(uniformName: string, value: any, type?: string) {
        if (type === 'texture') {
            this.uniforms[uniformName] = this._regl.texture(value);
        } else {
            this.uniforms[uniformName] = value;
        }
    }

    public addDefine(defineName: string, value: number) {
        this.defines[defineName] = value;
    }

    public getCanvas() {
        if (!this.canvas) {
            this.canvas = document.getElementsByTagName('canvas')[0];
        }
        return this.canvas;
    }

    public async render() {
        await this.init();
        this._regl.frame(() => {
            this._regl.clear({
                color: [0, 0, 0, 1],
                // depth: 1,
                stencil: 0
            });

            this.stats.update();
            this._scene.draw();
            this.emit(Renderer.FRAME_EVENT);
        });
    }
}