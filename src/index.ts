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
import { IStyleService } from './services/Style';
import { IPostProcessorService } from './services/PostProcessor';

const gltfService = container.get<IGltfService>(SERVICE_IDENTIFIER.GltfService);
const renderer = container.get<IRendererService>(SERVICE_IDENTIFIER.RendererService);
const cameraService = container.get<ICameraService>(SERVICE_IDENTIFIER.CameraService);
const styleService = container.get<IStyleService>(SERVICE_IDENTIFIER.StyleService);
container.get<IPostProcessorService>(SERVICE_IDENTIFIER.PostProcessorService);
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
                styleService.setFinalSplit([0, 1, 0, 0]);
                styleService.setSplitLayer([0, 0, 0, 0]);
                break;
            case 'final':
                styleService.setFinalSplit([1, 0, 0, 0]);
                styleService.setSplitLayer([0, 0, 0, 0]);
                break;
            case 'normal':
                styleService.setFinalSplit([1, 0, 0, 0]);
                styleService.setSplitLayer([1, 0, 0, 0]);
                break;
            case 'albedo':
                styleService.setFinalSplit([1, 0, 0, 0]);
                styleService.setSplitLayer([0, 1, 0, 0]);
                break;
            case 'metallic':
                styleService.setFinalSplit([1, 0, 0, 0]);
                styleService.setSplitLayer([0, 0, 1, 0]);
                break;
            case 'roughness':
                styleService.setFinalSplit([1, 0, 0, 0]);
                styleService.setSplitLayer([0, 0, 0, 1]);
                break;
            case 'wireframe':
                styleService.setFinalSplit([1, 0, 1, 0]);
                styleService.setSplitLayer([0, 0, 0, 0]);
                break;
        }
    }

    setWireframeLineColor(color: number[]) {
        styleService.setWireframeLineColor(color);
    }

    setWireframeLineWidth(width: number) {
        styleService.setWireframeLineWidth(width);
    }

    setDirectionalLightColor(color: number[]) {
        styleService.setDirectionalLight({ color });
    }

    setDirectionalLightDiretion(direction: number[]) {
        styleService.setDirectionalLight({ direction });
    }
}
