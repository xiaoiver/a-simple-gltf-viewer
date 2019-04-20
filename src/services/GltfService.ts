/**
 * provide raw scene & nodes data in glTF
 */
import { injectable } from 'inversify';
import { GltfAsset, GltfLoader, resolveURL, GLTF_COMPONENT_TYPE_ARRAYS, GLTF_ELEMENTS_PER_TYPE } from 'gltf-loader-ts';
import { Node, Scene, Mesh, Material, Texture, BufferView, Accessor, GlTfId, Sampler, Animation } from 'gltf-loader-ts/lib/gltf';

const loader: GltfLoader = new GltfLoader();

export interface IAttributeData {
    buffer: Uint8Array|Uint16Array|Float32Array;
    componentType: number;
    attributeType: string;
}

export interface IGltfService {
    load(uri: string): void;
    getScene(): Scene;
    getNode(idx: GlTfId): Node;
    getMesh(idx: GlTfId | undefined): Mesh;
    getMaterial(idx: GlTfId): Material;
    getTexture(idx: GlTfId): Texture;
    getImage(idx: GlTfId): Promise<HTMLImageElement>;
    getSampler(idx: GlTfId): Sampler;
    getData(idx: GlTfId): Promise<IAttributeData>;
    getAnimations(): Animation[];
}

@injectable()
export class GltfService implements IGltfService {
    private asset: GltfAsset;
    private nodes: Node[] = [];
    private meshes: Mesh[] = [];
    private materials: Material[] = [];
    private textures: Texture[] = [];
    private accessors: Accessor[] = [];
    private bufferViews: BufferView[] = [];
    private samplers: Sampler[] = [];
    private animations: Animation[] = [];
    private scene: Scene;

    private bufferCache: {[key: string]: ArrayBuffer} = {};

    public async load(uri: string): Promise<void> {
        this.clean();
        const asset: GltfAsset = await loader.load(uri);
        this.asset = asset;

        const { nodes, scene: sceneIdx, scenes, meshes,
            materials, textures, accessors, bufferViews, samplers, animations } = asset.gltf;
        if (scenes && nodes) {
            this.scene = scenes[sceneIdx || 0];
            this.nodes = nodes;
        }
        if (meshes) {
            this.meshes = meshes;
        }
        if (materials) {
            this.materials = materials;
        }
        if (textures) {
            this.textures = textures;
        }
        if (accessors) {
            this.accessors = accessors;
        }
        if (bufferViews) {
            this.bufferViews = bufferViews;
        }
        if (samplers) {
            this.samplers = samplers;
        }
        if (animations) {
            this.animations = animations;
        }
    }

    public getScene(): Scene {
        return this.scene;
    }

    public getNode(idx: GlTfId): Node {
        return this.nodes[idx];
    }

    public getMesh(idx: GlTfId): Mesh {
        return this.meshes[idx];
    }

    public getMaterial(idx: GlTfId): Material {
        return this.materials[idx];
    }

    public getTexture(idx: GlTfId): Texture {
        return this.textures[idx];
    }

    public getImage(idx: GlTfId): Promise<HTMLImageElement> {
        return this.asset.imageData.get(idx);
    }

    public getSampler(idx: GlTfId): Sampler {
        // TODO: fix sampler idx
        return this.samplers[0];
    }

    public getAnimations() {
        return this.animations;
    }

    private async getBinData(index: GlTfId): Promise<ArrayBuffer> {
        if (this.bufferCache[index] !== undefined) {
            return this.bufferCache[index];
        }

        const gltf = this.asset.gltf;
        if (!gltf.buffers) {
            /* istanbul ignore next */
            throw new Error('No buffers found.');
        }
        const buffer = gltf.buffers[index];
        // If present, GLB container is required to be the first buffer.
        // @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#glb-stored-buffer
        if (buffer.uri === undefined) {
            /* istanbul ignore next */
            if (index !== 0) { throw new Error('GLB container is required to be the first buffer'); }
            if (this.asset.glbData === undefined) {
                throw new Error('invalid gltf: buffer has no uri nor is there a GLB buffer');
            }
            return this.asset.glbData.binaryChunk;
        }

        const url = resolveURL(buffer.uri || '', this.asset.bufferData.baseUri);
        const bufferData: ArrayBuffer = await this.asset.bufferData.loader.load(url);
        
        this.bufferCache[index] = bufferData;
        return bufferData;
    }

    public async getData(idx: number) {
        const accessor = this.accessors[idx];
        const bufferView = this.bufferViews[accessor.bufferView || 0];

        const bufferData = await this.getBinData(bufferView.buffer);

        const bufferConstructor = GLTF_COMPONENT_TYPE_ARRAYS[accessor.componentType];
        const start = bufferView.byteOffset || 0;
        const end = start + bufferView.byteLength;
        const subStart = (accessor.byteOffset || 0);
        // const subEnd = subStart + accessor.count * GLTF_ELEMENTS_PER_TYPE[accessor.type] * bufferConstructor.BYTES_PER_ELEMENT;

        const slicedBuffer = bufferData
            .slice(start, end) // first slice per bufferview
            .slice(subStart); // then slice per attribute

        const bufferDataView = new bufferConstructor(slicedBuffer);

        return {
            buffer: bufferDataView,
            componentType: accessor.componentType,
            attributeType: accessor.type
        }
    }
    
    private clean() {
        this.bufferCache = {};
        this.nodes = [];
        this.materials = [];
        this.meshes = [];
        this.samplers = [];
        this.textures = [];
        this.animations = [];
    }
}
