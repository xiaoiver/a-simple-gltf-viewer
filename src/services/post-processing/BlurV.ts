import { injectable } from 'inversify';
import { getModule } from '@/shaders/shader-module';
import { BasePass } from './BasePass';

interface ReglContext {
    viewportWidth: number;
    viewportHeight: number;
}

@injectable()
export class BlurV extends BasePass {

    setupShaders() {
        const { vs, fs, uniforms } = getModule('blur-pass');
        return {
            vs,
            fs,
            uniforms: {
                ...uniforms,
                u_BlurDir: [0.0, 8.0],
                u_ViewportSize: ({ viewportWidth, viewportHeight }: ReglContext) => [ viewportWidth, viewportHeight ],
            }
        }
    }
}