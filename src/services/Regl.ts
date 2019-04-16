import * as regl from 'regl';
import { injectable } from 'inversify';

export interface IWebGLContextService {
    getContext(): regl.Regl;
    init($container: HTMLElement): Promise<void>;
    isSupportSRGB(): boolean;
    isSupportTextureLod(): boolean;
    isSupportDerivatives(): boolean;
}

@injectable()
export class ReglContext implements IWebGLContextService {

    /**
     * WebGL extension flags
     */
    private supportSRGB: boolean = false;
    private supportTextureLod: boolean = false;
    private supportDerivatives: boolean = false;

    private _regl: regl.Regl;

    getContext() {
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

    async init($container: HTMLElement) {
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
                }
            });
        });

        if (this._regl.hasExtension('EXT_SRGB')) {
            this.supportSRGB = true;
        }
        if (this._regl.hasExtension('EXT_shader_texture_lod')) {
            this.supportTextureLod = true;
        }
        if (this._regl.hasExtension('OES_standard_derivatives')) {
            this.supportDerivatives = true;
        }
    }
}