/**
 * ported Three.js effect composer
 */
import { inject, injectable } from 'inversify';
import * as regl from 'regl';
import { IWebGLContextService } from './Regl';
import { SERVICE_IDENTIFIER } from './constants';

export interface IPass {
    init(): void;
    render(): void;
    setRenderToScreen(renderToScreen: boolean): void;
    isEnabled(): boolean;
}

export interface IPostProcessorService {
    getReadFBO(): regl.Framebuffer2D;
    getWriteFBO(): regl.Framebuffer2D;
    getScreenRenderTarget(): regl.DrawCommand;
    getOffscreenRenderTarget(): regl.DrawCommand;
    init(): void;
    resize(viewportWidth: number, viewportHeight: number): void;
    add(pass: IPass): void;
    render(): void;
}

@injectable()
export class PostProcessor implements IPostProcessorService {
    private passes: IPass[] = [];
    private readFBO: regl.Framebuffer2D;
    private writeFBO: regl.Framebuffer2D;

    private screenRenderTarget: regl.DrawCommand;
    private offscreenRenderTarget: regl.DrawCommand;

    @inject(SERVICE_IDENTIFIER.WebGLContextService) private _context: IWebGLContextService;

    getReadFBO() {
        return this.readFBO;
    }

    getWriteFBO() {
        return this.writeFBO;
    }

    getScreenRenderTarget() {
        return this.screenRenderTarget;
    }

    getOffscreenRenderTarget() {
        return this.offscreenRenderTarget;
    }

    init() {
        const _regl = this._context.getContext();
        this.readFBO = _regl.framebuffer({
            color: _regl.texture({
                width: 1,
                height: 1,
                wrap: 'clamp'
            }),
            // depth: true
        });
        this.writeFBO = _regl.framebuffer({
            color: _regl.texture({
                width: 1,
                height: 1,
                wrap: 'clamp'
            }),
            // depth: true
        });

        this.screenRenderTarget = _regl({
            framebuffer: null
        });

        this.offscreenRenderTarget = _regl({
            framebuffer: () => this.writeFBO
        });
    }

    resize(viewportWidth: number, viewportHeight: number) {
        this.readFBO.resize(viewportWidth, viewportHeight);
        this.writeFBO.resize(viewportWidth, viewportHeight);
    }

    private swap() {
		const tmp = this.readFBO;
		this.readFBO = this.writeFBO;
		this.writeFBO = tmp;
    }
    
    add(pass: IPass) {
        pass.init();
        this.passes.push(pass);
    }

    insert(pass: IPass, index: number) {
        pass.init();
        this.passes.splice(index, 0, pass);
    }
    
    private isLastEnabledPass(index: number): boolean {
		for (let i = index + 1; i < this.passes.length; i++) {
			if (this.passes[i].isEnabled()) {
				return false;
			}
		}
		return true;
	}

    render() {
        this.passes.forEach((pass, i) => {
            pass.setRenderToScreen(this.isLastEnabledPass(i));
            pass.render();
            if (i !== this.passes.length - 1) {
                this.swap();
            }
        });
    }
}