/**
 * Scene
 */
import { SERVICE_IDENTIFIER } from '@/services/constants';
import { ICameraService } from '@/services/Camera';
import { IGltfService } from '@/services/GltfService';
import { IRendererService } from '@/services/Renderer';
import { mat4, quat, vec3 } from 'gl-matrix';
import { GlTf, Node, Scene, Mesh, Material, MaterialPbrMetallicRoughness, MaterialNormalTextureInfo, TextureInfo, MaterialOcclusionTextureInfo } from 'gltf-loader-ts/lib/gltf';
import { inject, injectable } from 'inversify';

export interface ISceneNodeService {
    setId(id: number): void;
    setMatrix(matrix: mat4): void;
    setMesh(mesh: Mesh): Promise<void>;
    addChild(node: ISceneNodeService): void;
    draw(parentTransform: mat4): void;
}

/**
 * SceneNode
 */
@injectable()
export class SceneNode implements ISceneNodeService {
    private id: number;
    private matrix: mat4;
    private mesh: Mesh;
    private children: ISceneNodeService[] = [];

    @inject(SERVICE_IDENTIFIER.GltfService) private _gltf: IGltfService;
    @inject(SERVICE_IDENTIFIER.RendererService) private _renderer: IRendererService;
    @inject(SERVICE_IDENTIFIER.CameraService) private _camera: ICameraService;

    public setId(id: number): void {
        this.id = id;
    }
    
    public setMatrix(matrix: mat4): void {
        this.matrix = matrix;
    }

    public async setMesh(mesh: Mesh): Promise<void> {
        this.mesh = mesh;

        /**
         * if EXT_SRGB is not supported, we must converted to linear space in fragment shader manually.
         * if supported, baseColorTexture, emissiveTexture & brdfLUT must use 'srgb' in regl.
         */
        if (!this._renderer.isSupportSRGB) {
            this._renderer.addDefine('MANUAL_SRGB', 1);
        }

        /**
         * load attributes & material
         */
        await Promise.all(this.mesh.primitives.map(async ({ attributes, indices, material: materialIdx }) => {
            await Promise.all(Object.keys(attributes).map(async attributeName => {
                const { data, offset, stride } = await this._gltf.getData(attributes[attributeName]);
                switch (attributeName) {
                    case "POSITION": 
                        this._renderer.addAttribute('a_Position', data, offset, stride);
                        break;
                    case "NORMAL":
                        this._renderer.addDefine('HAS_NORMALS', 1);
                        this._renderer.addAttribute('a_Normal', data, offset, stride);
                        break;
                    case "TANGENT":
                        this._renderer.addDefine('HAS_TANGENTS', 1);
                        this._renderer.addAttribute('a_Tangent', data, offset, stride);
                        break;
                    case "TEXCOORD_0":
                        this._renderer.addDefine('HAS_UV', 1);
                        this._renderer.addAttribute('a_UV', data, offset, stride);
                        break;
                }
            }));

            if (indices !== undefined) {
                const { data } = await this._gltf.getData(indices);
                this._renderer.setIndices(data);
            }

            if (materialIdx !== undefined) {
                const material = this._gltf.getMaterial(materialIdx);

                // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#double-sided
                this._renderer.setCullFace(!material.doubleSided);
                
                if (material.pbrMetallicRoughness) {
                    await this.setPBRMaterial(material.pbrMetallicRoughness);
                }

                if (material.normalTexture) {
                    await this.setNormalTexture(material.normalTexture);
                }

                if (material.emissiveTexture) {
                    await this.setEmissiveTexture(material.emissiveTexture, material.emissiveFactor);
                }

                if (material.occlusionTexture) {
                    await this.setOcclusionTexture(material.occlusionTexture);
                }
            } else {
                // add defaults for non-pbr material
                this._renderer.addUniform('u_BaseColorFactor', [1, 1, 1, 1]);
                this._renderer.addUniform('u_MetallicRoughnessValues', [0, 0]);
            }
        }));
    }

    /**
     * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#normaltextureinfo
     */
    private async setNormalTexture(normalTexture: MaterialNormalTextureInfo) {
        const { index, scale } = normalTexture;
        if (index !== undefined) {
            const image = await this._gltf.getImage(index);
            const sampler = this._gltf.getSampler(index);
            this._renderer.addUniform('u_NormalSampler', { image, sampler }, 'texture');
            this._renderer.addUniform('u_NormalScale', scale || 1);
            this._renderer.addDefine('HAS_NORMALMAP', 1);
        }
    }

    /**
     * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#materialemissivetexture
     */
    private async setEmissiveTexture(emissiveTexture: TextureInfo, emissiveFactor: number[]|undefined) {
        const { index } = emissiveTexture;
        if (index !== undefined) {
            const image = await this._gltf.getImage(index);
            const sampler = this._gltf.getSampler(index);
            this._renderer.addUniform('u_EmissiveSampler', {
                image, sampler, format: this._renderer.isSupportSRGB ? 'srgb' : 'rgba'
            }, 'texture');
            this._renderer.addUniform('u_EmissiveFactor', emissiveFactor || [0.0, 0.0, 0.0]);

            this._renderer.addDefine('HAS_EMISSIVEMAP', 1);
        }
    }

     /**
     * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#occlusiontextureinfo
     */
    private async setOcclusionTexture(occlusionTexture: MaterialOcclusionTextureInfo) {
        const { index, strength } = occlusionTexture;
        if (index !== undefined) {
            const image = await this._gltf.getImage(index);
            const sampler = this._gltf.getSampler(index);
            this._renderer.addUniform('u_OcclusionSampler', { image, sampler }, 'texture');
            this._renderer.addUniform('u_OcclusionStrength', strength || 1);
            this._renderer.addDefine('HAS_OCCLUSIONMAP', 1);
        }
    }

    private async setPBRMaterial(pbrMetallicRoughness: MaterialPbrMetallicRoughness) {
        const { baseColorFactor, baseColorTexture,
            metallicFactor, metallicRoughnessTexture,
            roughnessFactor } = pbrMetallicRoughness;
        // base color
        if (baseColorTexture) {
            let bct = this._gltf.getTexture(baseColorTexture.index);
            if (bct.source !== undefined) {
                const image = await this._gltf.getImage(bct.source);
                const sampler = this._gltf.getSampler(bct.source);
                this._renderer.addDefine('HAS_BASECOLORMAP', 1);
                this._renderer.addUniform('u_BaseColorSampler', {
                    image, sampler,
                    format: this._renderer.isSupportSRGB ? 'srgb' : 'rgba'
                }, 'texture');
            }
        }

        this._renderer.addUniform('u_BaseColorFactor', baseColorFactor
            || [1, 1, 1, 1]);

        /**
         * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material
         */
        this._renderer.addUniform('u_MetallicRoughnessValues',
            [metallicFactor || 0, roughnessFactor || 0]);
        if (metallicRoughnessTexture) {
            let mrt = this._gltf.getTexture(metallicRoughnessTexture.index);
            if (mrt.source !== undefined) {
                const image = await this._gltf.getImage(mrt.source);
                const sampler = this._gltf.getSampler(mrt.source);
                this._renderer.addDefine('HAS_METALROUGHNESSMAP', 1);
                this._renderer.addUniform('u_MetallicRoughnessSampler', { image, sampler }, 'texture');
            }
        }
    }

    public addChild(node: SceneNode): void {
        this.children.push(node);
    }

    public async draw(parentTransform: mat4): Promise<void> {
        const modelMatrix = mat4.create();
        mat4.multiply(modelMatrix, this.matrix, parentTransform);

        const modelInverse = mat4.create();
        const normalMatrix = mat4.create();

        mat4.invert(modelInverse, modelMatrix);
        mat4.transpose(normalMatrix, modelInverse);

        const mvpMatrix = mat4.create();
        mat4.mul(mvpMatrix, this._camera.transform, modelMatrix);

        const cameraPosition = vec3.create();
        vec3.mul(cameraPosition, this._camera.eye, vec3.set(cameraPosition, 1, 1, -1));
        if (this.mesh) {
            this._renderer.callDrawCommand({
                // @ts-ignore
                cameraPosition,
                modelMatrix,
                normalMatrix,
                mvpMatrix
            });
        }
    
        for (const childNode of this.children) {
            await childNode.draw(modelMatrix);
        }
    }
}
