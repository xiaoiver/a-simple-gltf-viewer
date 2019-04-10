/**
 * glTF loader
 */
import { container } from '@/inversify.config';
import { SERVICE_IDENTIFIER } from '@/services/constants';
import { IGltfService } from '@/services/GltfService';
import { IRendererService } from '@/services/Renderer';
import { ICameraService } from '@/services/Camera';
import { IMouseService } from '@/services/Mouse';
import { vec3 } from 'gl-matrix';

const gltfService = container.get<IGltfService>(SERVICE_IDENTIFIER.GltfService);
const renderer = container.get<IRendererService>(SERVICE_IDENTIFIER.RendererService);
const cameraService = container.get<ICameraService>(SERVICE_IDENTIFIER.CameraService);
container.get<IMouseService>(SERVICE_IDENTIFIER.MouseService);

interface GltfViewerOptions {
    container: string;
    camera?: {
        eye: number[];
        center: number[];
        fovy: number;
        near: number;
        far: number;
    }
}

const defaultCamera = {
    eye: [0, 2, 2],
    center: [0, 0, 0],
    fovy: 45,
    near: 0.01,
    far: 100
};

export class GltfViewer {
    private container: string = 'viewer-container';

    constructor({ container, camera = defaultCamera }: GltfViewerOptions) {
        const { eye, center, fovy, near, far } = camera;
        this.container = container;

        cameraService.init(vec3.clone(eye), vec3.clone(center), fovy, 1, near, far);
    }

    async init() {
        await renderer.init(this.container);
    }

    async load(uri: string): Promise<void> {
        await gltfService.load(uri);
        await renderer.render();
    }

    showLayer(layerName: string) {
        switch (layerName) {
            case 'all':
                renderer.setSplitLayer([0, 0, 0, 0]);
                break;
            case 'normal':
                renderer.setSplitLayer([1, 0, 0, 0]);
                break;
            case 'albedo':
                renderer.setSplitLayer([0, 1, 0, 0]);
                break;
            case 'metallic':
                renderer.setSplitLayer([0, 0, 1, 0]);
                break;
            case 'roughness':
                renderer.setSplitLayer([0, 0, 0, 1]);
                break;
        }
    }

    setWireframeLineColor(color: number[]) {
        renderer.setWireframeLineColor(color);
    }

    setWireframeLineWidth(width: number) {
        renderer.setWireframeLineWidth(width);
    }
}
