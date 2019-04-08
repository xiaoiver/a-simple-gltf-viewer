/**
 * glTF loader
 */
import { container } from '@/inversify.config';
import { SERVICE_IDENTIFIER } from '@/services/constants';
import { IGltfService } from '@/services/GltfService';
import { IRendererService } from '@/services/Renderer';
import { ICameraService } from '@/services/Camera';
import { vec3 } from 'gl-matrix';

const gltfService = container.get<IGltfService>(SERVICE_IDENTIFIER.GltfService);
const renderer = container.get<IRendererService>(SERVICE_IDENTIFIER.RendererService);
const camera = container.get<ICameraService>(SERVICE_IDENTIFIER.CameraService);

export async function load(uri: string): Promise<void> {
    await gltfService.load(uri);
    camera.init(vec3.clone([0, 0, 4]), vec3.clone([0, 0, 0]), 45, 1, .01, 100);
    await renderer.render();
}
