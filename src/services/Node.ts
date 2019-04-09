/**
 * Scene
 */
import * as regl from 'regl';
import { SERVICE_IDENTIFIER, WRAP_T, WRAP_S, MAG_FILTER, MIN_FILTER } from '@/services/constants';
import { ICameraService } from '@/services/Camera';
import { IGltfService } from '@/services/GltfService';
import { IRendererService } from '@/services/Renderer';
import { mat4 } from 'gl-matrix';
import { Mesh, MaterialPbrMetallicRoughness, MaterialNormalTextureInfo, TextureInfo, MaterialOcclusionTextureInfo, Sampler } from 'gltf-loader-ts/lib/gltf';
import { inject, injectable } from 'inversify';

export interface ISceneNodeService {
    setId(id: number): void;
    setMatrix(matrix: mat4): void;
    setMesh(mesh: Mesh): Promise<void>;
    addChild(node: ISceneNodeService): void;
    buildDrawCommand(): void;
    draw(parentTransform: mat4): void;
    clean(): void;
}

const defaultDefines = {
    HAS_NORMALS: 0,
    HAS_TANGENTS: 0,
    HAS_UV: 0,
    HAS_BASECOLORMAP: 0,
    HAS_METALROUGHNESSMAP: 0,
    HAS_NORMALMAP: 0,
    HAS_EMISSIVEMAP: 0,
    HAS_OCCLUSIONMAP: 0
};

/**
 * SceneNode
 */
@injectable()
export class SceneNode implements ISceneNodeService {
    private id: number;
    private matrix: mat4;
    private mesh: Mesh;
    private children: ISceneNodeService[] = [];
    private drawCommand: regl.DrawCommand;

    private attributes: {[key: string]: any} = {};
    private uniforms: {[key: string]: any} = {};
    private defines: {[key: string]: number} = {...defaultDefines};
    private indices: {
        data: Uint8Array | Uint16Array | Float32Array | undefined;
    };
    private textures: regl.Texture2D[] = [];
    private cullFace: boolean = true;

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
         * load attributes & material
         */
        await Promise.all(this.mesh.primitives.map(async ({ attributes, indices, material: materialIdx }) => {
            await Promise.all(Object.keys(attributes).map(async attributeName => {
                const { data, offset, stride } = await this._gltf.getData(attributes[attributeName]);
                switch (attributeName) {
                    case "POSITION": 
                        this.addAttribute('a_Position', data, offset, stride);
                        break;
                    case "NORMAL":
                        this.addDefine('HAS_NORMALS', 1);
                        this.addAttribute('a_Normal', data, offset, stride);
                        break;
                    case "TANGENT":
                        this.addDefine('HAS_TANGENTS', 1);
                        this.addAttribute('a_Tangent', data, offset, stride);
                        break;
                    case "TEXCOORD_0":
                        this.addDefine('HAS_UV', 1);
                        this.addAttribute('a_UV', data, offset, stride);
                        break;
                }
            }));

            if (indices !== undefined) {
                const { data } = await this._gltf.getData(indices);
                this.setIndices(data);
            }

            if (materialIdx !== undefined) {
                const material = this._gltf.getMaterial(materialIdx);

                // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#double-sided
                this.cullFace = !material.doubleSided;
                
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
                this.addUniform('u_BaseColorFactor', [1, 1, 1, 1]);
                this.addUniform('u_MetallicRoughnessValues', [0, 0]);
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
            this.addUniform('u_NormalSampler', { image, sampler }, 'texture');
            this.addUniform('u_NormalScale', scale || 1);
            this.addDefine('HAS_NORMALMAP', 1);
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
            this.addUniform('u_EmissiveSampler', {
                image, sampler, format: this._renderer.isSupportSRGB() ? 'srgb' : 'rgba'
            }, 'texture');
            this.addUniform('u_EmissiveFactor', emissiveFactor || [0.0, 0.0, 0.0]);
            this.addDefine('HAS_EMISSIVEMAP', 1);
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
            this.addUniform('u_OcclusionSampler', { image, sampler }, 'texture');
            this.addUniform('u_OcclusionStrength', strength || 1);
            this.addDefine('HAS_OCCLUSIONMAP', 1);
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
                this.addDefine('HAS_BASECOLORMAP', 1);
                this.addUniform('u_BaseColorSampler', {
                    image, sampler,
                    format: this._renderer.isSupportSRGB() ? 'srgb' : 'rgba'
                }, 'texture');
            }
        }

        this.addUniform('u_BaseColorFactor', baseColorFactor
            || [1, 1, 1, 1]);

        /**
         * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material
         */
        this.addUniform('u_MetallicRoughnessValues',
            [metallicFactor || 1, roughnessFactor || 1]);
        if (metallicRoughnessTexture) {
            let mrt = this._gltf.getTexture(metallicRoughnessTexture.index);
            if (mrt.source !== undefined) {
                const image = await this._gltf.getImage(mrt.source);
                const sampler = this._gltf.getSampler(mrt.source);
                this.addDefine('HAS_METALROUGHNESSMAP', 1);
                this.addUniform('u_MetallicRoughnessSampler', { image, sampler }, 'texture');
            }
        }
    }

    public addChild(node: SceneNode): void {
        this.children.push(node);
    }

    private addAttribute(attributeName: string, data: any, offset: number|undefined, stride: number|undefined) {
        const regl = this._renderer.getRegl();
        this.attributes[attributeName] = {
            buffer: regl.buffer(data)
        };
        if (offset !== undefined) {
            this.attributes[attributeName].offset = offset;
        }
        if (stride !== undefined) {
            this.attributes[attributeName].stride = stride;
        }
    }

    private addUniform(uniformName: string,
        value: { image: HTMLImageElement, sampler: Sampler, format: regl.TextureFormatType }|any,
        type?: string) {
        const regl = this._renderer.getRegl();
        if (type === 'texture') {
            const { image, sampler, format = 'rgba' } = value;
            /**
             * Any colorspace information (such as ICC profiles, intents, etc) from PNG or JPEG containers must be ignored.
             * In regl, colorSpace is default to 'none' so that we don't need to set it manually.
             * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#images
             */
            const textureParams: Partial<regl.Texture2DOptions> = {
                data: image,
                min: 'linear',
                mag: 'linear',
                // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#samplerwraps
                wrapS: 'repeat',
                wrapT: 'repeat',
                format
            };

            if (sampler) {
                if (sampler.minFilter !== undefined) {
                    textureParams.min = MIN_FILTER[sampler.minFilter];
                }
                if (sampler.magFilter !== undefined) {
                    textureParams.mag = MAG_FILTER[sampler.magFilter];
                }
                if (sampler.wrapS !== undefined) {
                    textureParams.wrapS = WRAP_S[sampler.wrapS];
                }
                if (sampler.wrapT !== undefined) {
                    textureParams.wrapT = WRAP_T[sampler.wrapT];
                }
            }
            this.uniforms[uniformName] = regl.texture(textureParams);
            this.textures.push(this.uniforms[uniformName]);
        } else {
            this.uniforms[uniformName] = value;
        }
    }

    public addDefine(defineName: string, value: number) {
        this.defines[defineName] = value;
    }

    public setIndices(indices: Uint8Array | Uint16Array | Float32Array | undefined) {
        this.indices = {
            data: indices
        };
    }

    public buildDrawCommand(): void {
        this.drawCommand = this._renderer.createDrawCommand({
            attributes: this.attributes,
            uniforms: this.uniforms,
            defines: this.defines,
            indices: this.indices,
            cullFace: this.cullFace
        });
    }

    public clean(): void {
        this.attributes = {};
        this.defines = {...defaultDefines};
        // destroy current model's textures
        this.textures.forEach(t => {
            t.destroy();
        });
        this.textures = [];
        this.uniforms = {};
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

        if (this.mesh) {
            this.drawCommand({
                // @ts-ignore
                cameraPosition: this._camera.eye,
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
