import { inject, injectable } from 'inversify';
import * as regl from 'regl';
import { IPass, IPostProcessorService } from '../PostProcessor';
import { IWebGLContextService } from '../Regl';
import { SERVICE_IDENTIFIER } from '../constants';

@injectable()
export class BasePass implements IPass {
    private drawCommand: regl.DrawCommand;
    private enabled: boolean = true;
    private renderToScreen: boolean = false;

    @inject(SERVICE_IDENTIFIER.WebGLContextService) private _context: IWebGLContextService;
    @inject(SERVICE_IDENTIFIER.PostProcessorService) private _postProcessor: IPostProcessorService;

    protected setupShaders(): {
        vs: string;
        fs: string;
        uniforms: {[key: string]: any}
    } {
        throw Error('Unimplemented method: initUniforms');
    }

    init() {
        const _regl = this._context.getContext();
        const { vs, fs, uniforms } = this.setupShaders();
        this.drawCommand = _regl({
            frag: fs,
            vert: vs,
            attributes: {
                // using a full-screen triangle
                a_Position: [ -4, -4, 4, -4, 0, 4 ]
            },
            uniforms: {
                ...uniforms,
                //@ts-ignore
                u_Texture: _regl.prop('texture'),
                //@ts-ignore
                // u_Depth: _regl.prop('depth'),
            },
            depth: { enable: false },
            count: 3
        });
    }

    render() {
        const getRenderTarget = this.renderToScreen ?
            this._postProcessor.getScreenRenderTarget()
            : this._postProcessor.getOffscreenRenderTarget();
        getRenderTarget({}, () => {
            this.drawCommand({
                texture: this._postProcessor.getReadFBO(),
                // @ts-ignore
                // depth: this._postProcessor.getReadFBO().depth,
            });
        });
    }

    isEnabled() {
        return this.enabled;
    }

    setRenderToScreen(renderToScreen: boolean) {
        this.renderToScreen = renderToScreen;
    }
}