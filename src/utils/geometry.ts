import { GLTF_COMPONENT_TYPE_ARRAYS, GLTF_ELEMENTS_PER_TYPE } from 'gltf-loader-ts/lib/gltf-loader';
import { IAttributeData } from '@/services/GltfService';

/**
 * generate barycentric coordinates
 * @see https://xiaoiver.github.io/coding/2018/10/22/Wireframe-%E7%9A%84%E5%AE%9E%E7%8E%B0.html
 */
export function generateBarycentric(attributes: {
    [key: string]: IAttributeData;
}, indices: IAttributeData) {
    const uniqueAttributes: {
        [key: string]: {
            buffer: Uint8Array|Uint16Array|Float32Array;
        };
    } = {};
    const indiceNum = indices.buffer.length;

    // create empty typed array according to indices' num
    Object.keys(attributes).forEach(attributeName => {
        const { componentType, attributeType, buffer } = attributes[attributeName];
        const size = GLTF_ELEMENTS_PER_TYPE[attributeType];
        const bufferConstructor = GLTF_COMPONENT_TYPE_ARRAYS[componentType];
        uniqueAttributes[attributeName] = {
            // buffer
            buffer: new bufferConstructor(size * indiceNum)
        };
    });
    
    // reallocate attribute data
    let cursor = 0;
    const bufferConstructor = GLTF_COMPONENT_TYPE_ARRAYS[indices.componentType];
    const uniqueIndices = new bufferConstructor(indiceNum);
    for (var i = 0; i < indiceNum; i++) {
        var ii = indices.buffer[i];

        Object.keys(attributes).forEach(name => {
            const { buffer, attributeType } = attributes[name];
            const size = GLTF_ELEMENTS_PER_TYPE[attributeType || 'VEC3'];
            for (var k = 0; k < size; k++) {
                uniqueAttributes[name].buffer[cursor * size + k] = buffer[ii * size + k];
            }
        });
        uniqueIndices[i] = cursor;
        cursor++;
    }

    // create barycentric attributes
    const barycentricBuffer = new Float32Array(indiceNum * 3);
    for (let i = 0; i < indiceNum;) {
        for (let j = 0; j < 3; j++) {
            const ii = uniqueIndices[i++];
            barycentricBuffer[ii * 3 + j] = 1;
        }
    }
    uniqueAttributes['a_Barycentric'] = {
        buffer: barycentricBuffer
    };

    return {
        uniqueAttributes,
        uniqueIndices
    }
}