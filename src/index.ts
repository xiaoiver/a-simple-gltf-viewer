/**
 * glTF loader
 */
import { container } from '@/inversify.config';
import { SERVICE_IDENTIFIER } from '@/services/constants';
import { IGltfService } from '@/services/GltfService';
import { IRendererService, Renderer } from '@/services/Renderer';
import { ICameraService } from '@/services/Camera';
import { IMouseService } from '@/services/Mouse';
import { IStatsService } from '@/services/Stats';
import { vec3 } from 'gl-matrix';

const gltfService = container.get<IGltfService>(SERVICE_IDENTIFIER.GltfService);
const renderer = container.get<IRendererService>(SERVICE_IDENTIFIER.RendererService);
const cameraService = container.get<ICameraService>(SERVICE_IDENTIFIER.CameraService);
container.get<IMouseService>(SERVICE_IDENTIFIER.MouseService);
container.get<IStatsService>(SERVICE_IDENTIFIER.StatsService);

interface GltfViewerOptions {
    container: string;
    camera?: {
        eye: number[];
        center: number[];
        fovy: number;
        near: number;
        far: number;
    };
    onResize?(size : { width: number; height: number }): void;
}

const defaultCamera = {
    eye: [0, 0, 4],
    center: [0, 0, 0],
    fovy: 45,
    near: 0.01,
    far: 100
};

export class GltfViewer {
    private container: string = 'viewer-container';

    constructor({ container, camera = defaultCamera, onResize }: GltfViewerOptions) {
        const { eye, center, fovy, near, far } = camera;
        this.container = container;

        cameraService.init(vec3.clone(eye), vec3.clone(center), fovy, 1, near, far);
        renderer.on(Renderer.RESIZE_EVENT, (params: { width: number; height: number }[]) => {
            const { width, height } = params[0];
            if (onResize) {
                onResize({ width, height });
            }
        });
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
            case 'layers':
                renderer.setFinalSplit([0, 1, 0, 0]);
                renderer.setSplitLayer([0, 0, 0, 0]);
                break;
            case 'final':
                renderer.setFinalSplit([1, 0, 0, 0]);
                renderer.setSplitLayer([0, 0, 0, 0]);
                break;
            case 'normal':
                renderer.setFinalSplit([1, 0, 0, 0]);
                renderer.setSplitLayer([1, 0, 0, 0]);
                break;
            case 'albedo':
                renderer.setFinalSplit([1, 0, 0, 0]);
                renderer.setSplitLayer([0, 1, 0, 0]);
                break;
            case 'metallic':
                renderer.setFinalSplit([1, 0, 0, 0]);
                renderer.setSplitLayer([0, 0, 1, 0]);
                break;
            case 'roughness':
                renderer.setFinalSplit([1, 0, 0, 0]);
                renderer.setSplitLayer([0, 0, 0, 1]);
                break;
            case 'wireframe':
                renderer.setFinalSplit([1, 0, 1, 0]);
                renderer.setSplitLayer([0, 0, 0, 0]);
                break;
        }
    }

    setWireframeLineColor(color: number[]) {
        renderer.setWireframeLineColor(color);
    }

    setWireframeLineWidth(width: number) {
        renderer.setWireframeLineWidth(width);
    }

    setDirectionalLightColor(color: number[]) {
        renderer.setDirectionalLight({ color });
    }

    setDirectionalLightDiretion(direction: number[]) {
        renderer.setDirectionalLight({ direction });
    }
}
