/**
 * Scene
 */
import { container } from '@/inversify.config';
import { inject, injectable } from 'inversify';
import { mat4 } from 'gl-matrix';
import { Node, AnimationChannel, AnimationSampler, AnimationChannelTarget } from 'gltf-loader-ts/lib/gltf';
import { SERVICE_IDENTIFIER } from '@/services/constants';
import { IGltfService } from '@/services/GltfService';
import { ISceneNodeService, SceneNode } from '@/services/Node';

export interface ISceneService {
    init(): Promise<void>;
    draw(): void;
    drawDepth(): void;
}

export interface NodeAnimationChannel {
    target: AnimationChannelTarget;
    sampler: AnimationSampler;
}

/**
 * Scene
 */
@injectable()
export class SceneService implements ISceneService {
    private nodes: ISceneNodeService[] = [];
    private animatedNodes: {
        [key: number]: NodeAnimationChannel[]
    } = {};
    @inject(SERVICE_IDENTIFIER.GltfService) private _gltf: IGltfService;

    /**
     * construct scene graph
     */
    public async init(): Promise<void> {
        // clean every existed node first
        this.nodes.forEach(node => node.clean());
        this.nodes = [];
        this.animatedNodes = {};

        // init animations
        // @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
        this._gltf.getAnimations().forEach(({ samplers, channels }) => {
            channels.forEach(channel => {
                const sampler = samplers[channel.sampler];
                const nodeId = channel.target.node;
                if (nodeId !== undefined) {
                    if (this.animatedNodes[nodeId] == null) {
                        this.animatedNodes[nodeId] = [];
                    }
                    this.animatedNodes[nodeId].push({
                        target: channel.target,
                        sampler
                    });
                }
            });
        });

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
        if (this.animatedNodes[id]) {
            await sceneNode.setAnimations(this.animatedNodes[id]);
        }
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

    public drawDepth(): void {
        this.nodes.forEach((node: SceneNode) => {
            node.drawDepth(mat4.create());
        });
    }
}
