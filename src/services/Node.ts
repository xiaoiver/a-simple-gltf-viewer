/**
 * Scene
 */
import { SERVICE_IDENTIFIER } from '@/services/constants';
import { ICameraService } from '@/services/Camera';
import { IGltfService } from '@/services/GltfService';
import { IRendererService } from '@/services/Renderer';
import { mat4, quat, vec3 } from 'gl-matrix';
import { GlTf, Node, Scene, Mesh, Material, MaterialPbrMetallicRoughness } from 'gltf-loader-ts/lib/gltf';
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
         * load attributes & material
         */
        await Promise.all(this.mesh.primitives.map(async ({ attributes, indices, material: materialIdx }) => {
            await Promise.all(Object.keys(attributes).map(async attributeName => {
                const { data, bufferView } = await this._gltf.getData(attributes[attributeName]);
                switch (attributeName) {
                    case "POSITION": 
                        this._renderer.addAttribute('a_Position', data, bufferView);
                        break;
                    case "NORMAL":
                        this._renderer.addDefine('HAS_NORMALS', 1);
                        this._renderer.addAttribute('a_Normal', data, bufferView);
                        break;
                    case "TANGENT":
                        this._renderer.addDefine('HAS_TANGENTS', 1);
                        this._renderer.addAttribute('a_Tangent', data, bufferView);
                        break;
                    case "TEXCOORD_0":
                        this._renderer.addDefine('HAS_UV', 0);
                        this._renderer.addAttribute('a_UV', data, bufferView);
                        break;
                }
                console.log("Accessor containing positions: ", attributeName, data);
            }));

            if (indices !== undefined) {
                const { data, bufferView } = await this._gltf.getData(indices);
                console.log("Accessor containing indices: ", 'indices', data);
                this._renderer.setIndices(data, bufferView);
            }

            if (materialIdx !== undefined) {
                const material = this._gltf.getMaterial(materialIdx);

                this._renderer.setCullFace(!material.doubleSided);
                
                if (material.pbrMetallicRoughness) {
                    await this.setPBRMaterial(material.pbrMetallicRoughness);
                }
            }
        }));
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
                this._renderer.addDefine('HAS_BASECOLORMAP', 1);
                this._renderer.addUniform('u_BaseColorSampler', image, 'texture');
            }
        }
        this._renderer.addUniform('u_BaseColorFactor', baseColorFactor
            || [1, 1, 1, 1]);

        // Metallic-Roughness
        this._renderer.addUniform('u_MetallicRoughnessValues',
            [metallicFactor || 1, roughnessFactor || 1]);
        if (metallicRoughnessTexture) {
            let mrt = this._gltf.getTexture(metallicRoughnessTexture.index);
            if (mrt.source !== undefined) {
                const image = await this._gltf.getImage(mrt.source);
                this._renderer.addDefine('HAS_METALROUGHNESSMAP', 1);
                this._renderer.addUniform('u_MetallicRoughnessSampler', image, 'texture');
            }
        }

        // TODO: Normals, brdfLUT, Emissive & AO
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
        // mat4.mul(mvpMatrix, mvpMatrix, modelMatrix);

        if (this.mesh) {
            this._renderer.callDrawCommand({
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
