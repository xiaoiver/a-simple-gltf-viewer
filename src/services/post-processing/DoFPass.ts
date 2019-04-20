import { injectable, inject } from 'inversify';
import { getModule } from '@/shaders/shader-module';
import { BasePass } from './BasePass';
import { ICameraService } from '../Camera';
import { SERVICE_IDENTIFIER } from '../constants';

interface ReglContext {
    viewportWidth: number;
    viewportHeight: number;
}

const FOCAL_LENGTH = 1.0;
const FOCUS_DISTANCE = 2.0;
const MAGNIFICATION = FOCAL_LENGTH / Math.abs(FOCUS_DISTANCE - FOCAL_LENGTH);
const FSTOP = 2.8;
const BLUR_COEFFICIENT = FOCAL_LENGTH * MAGNIFICATION / FSTOP;

@injectable()
export class DoF extends BasePass {

    @inject(SERVICE_IDENTIFIER.CameraService) private _camera: ICameraService;

    setupShaders() {
        const { vs, fs, uniforms } = getModule('dof-pass');
        const { znear, zfar } = this._camera;

        return {
            vs,
            fs,
            uniforms: {
                ...uniforms,
                u_FocusDistance: FOCUS_DISTANCE,
                u_BlurCoefficient: BLUR_COEFFICIENT,
                u_DepthRange: [ znear, zfar ],
                u_TexelOffset: [1, 0],
                u_PPM: ({ viewportWidth, viewportHeight }: ReglContext) => Math.sqrt(viewportWidth * viewportWidth + viewportHeight * viewportHeight) / 35,
                u_ViewportSize: ({ viewportWidth, viewportHeight }: ReglContext) => [ viewportWidth, viewportHeight ],
            }
        }
    }
}