/**
 * Scene
 */
import { container } from '@/inversify.config';
import { inject, injectable } from 'inversify';
import { mat4 } from 'gl-matrix';
import { Node } from 'gltf-loader-ts/lib/gltf';
import { SERVICE_IDENTIFIER } from '@/services/constants';
import { IGltfService } from '@/services/GltfService';
import { ISceneNodeService, SceneNode } from '@/services/Node';

export interface ISceneService {
    init(): Promise<void>;
    draw(): void;
}

/**
 * Scene
 */
@injectable()
export class SceneService implements ISceneService {
    private nodes: ISceneNodeService[] = [];
    @inject(SERVICE_IDENTIFIER.GltfService) private _gltf: IGltfService;

    /**
     * construct scene graph
     */
    public async init(): Promise<void> {
        // clean every existed node first
        this.nodes.forEach(node => node.clean());
        this.nodes = [];

        const scene = this._gltf.getScene();
        if (scene.nodes) {
            this.nodes = await Promise.all(scene.nodes.map(i => {
                const node = this._gltf.getNode(i);
                return this.createSceneNode(node, i);
            }));
        }
    }

    /**
     * create scene node recursive
     */
    private async createSceneNode(node: Node, id: number): Promise<ISceneNodeService> {
        const sceneNode = container.get<ISceneNodeService>(SERVICE_IDENTIFIER.SceneNodeService);
        sceneNode.setId(id);
        if (node.mesh !== undefined) {
            await sceneNode.setMesh(this._gltf.getMesh(node.mesh));
            // use regl to create a draw command
            sceneNode.buildDrawCommand();
        }

        // init local matrix
        if (node.matrix) {
            // @ts-ignore
            sceneNode.setMatrix(mat4.clone(node.matrix));
        } else {
            // apply RTS matrix transformation
            let localTransform = mat4.create();
            const scale: number[] = node.scale
                ? node.scale : [1, 1, 1];
            const rotation: number[] = node.rotation
                ? node.rotation : [0, 0, 0, 1];
            const translate: number[] = node.translation
                ? node.translation : [0, 0, 0];
            
            mat4.fromRotationTranslationScale(localTransform,
                // @ts-ignore
                rotation, translate, scale);
            sceneNode.setMatrix(localTransform);
        }

        // init children recursive
        if (node.children && node.children.length > 0) {
            for (const childNodeIdx of node.children) {
                sceneNode.addChild(
                    await this.createSceneNode(
                        this._gltf.getNode(childNodeIdx), childNodeIdx)
                );
            }
        }
        return sceneNode;
    }

    public draw(): void {
        this.nodes.forEach((node: SceneNode) => {
            node.draw(mat4.create());
        });
    }
}
