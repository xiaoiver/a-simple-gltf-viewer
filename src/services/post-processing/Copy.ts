import { injectable } from 'inversify';
import { getModule } from '@/shaders/shader-module';
import { BasePass } from './BasePass';

@injectable()
export class Copy extends BasePass {

    setupShaders() {
        const { vs, fs } = getModule('copy-pass');
        return {
            vs,
            fs,
            uniforms: {}
        }
    }
}