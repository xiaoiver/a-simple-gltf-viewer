import { quat } from 'gl-matrix';
import { chunk } from 'lodash';

function clamp(number: number, min: number, max: number) {
    return Math.min(Math.max(number, min), max);
}

function linear(start: number[], end: number[], t: number) {
    const result: number[] = [];
    for (let i = 0; i < start.length; i++) {
        result.push(start[i] * (1 - t) + end[i] * t);
    }
    return result;
}

// https://xiaoiver.github.io/coding/2018/12/28/Camera-%E8%AE%BE%E8%AE%A1-%E4%B8%80.html
function slerpQuat(q1: quat, q2: quat, t: number) {
    const qn1 = quat.create();
    const qn2 = quat.create();

    quat.normalize(qn1, q1);
    quat.normalize(qn2, q2);

    const quatResult = quat.create();

    quat.slerp(quatResult, qn1, qn2, t);
    quat.normalize(quatResult, quatResult);

    return quatResult;
}

// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#appendix-c-spline-interpolation
// function cubicSpline(start: number[], end: number[],
//     next: number[], far: number[],
//     keyDelta: number, t: number) {
//     const tSq = t ** 2;
//     const tCub = t ** 3;
//     const result: number[] = [];
//     for (let i = 0; i < start.length; i++) {
//         const v0 = start[i];
//         const v1 = end[i];
//         const a = keyDelta * output[nextIndex + i + A];
//         const b = keyDelta * output[prevIndex + i + B];
//         result.push((2*tCub - 3*tSq + 1) * v0) + ((tCub - 2*tSq + t) * b) + ((-2*tCub + 3*tSq) * v1) + ((tCub - tSq) * a);
//     }
//     return result;

//     // stride: Count of components (4 in a quaternion).
//     // Scale by 3, because each output entry consist of two tangents and one data-point.
//     const prevIndex = prevKey * stride * 3;
//     const nextIndex = nextKey * stride * 3;
//     const A = 0;
//     const V = 1 * stride;
//     const B = 2 * stride;

//     const result = new glMatrix.ARRAY_TYPE(stride);
    

//     // We assume that the components in output are laid out like this: in-tangent, point, out-tangent.
//     // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#appendix-c-spline-interpolation
//     for(let i = 0; i < stride; ++i)
//     {
//         const v0 = output[prevIndex + i + V];
//         const a = keyDelta * output[nextIndex + i + A];
//         const b = keyDelta * output[prevIndex + i + B];
//         const v1 = output[nextIndex + i + V];

//         result[i] = ();
//     }

//     return result;
// }

export function chunkArray(array: ArrayLike<number>, size: number): number[][]|ArrayLike<number> {
    if (size == 1) {
        return array;
    }
    return chunk(array, size);
}

export enum Interpolation {
    LINEAR = 'LINEAR',
    STEP = 'STEP',
    CUBICSPLINE = 'CUBICSPLINE'
}

export enum InterpolationPath {
    TRANSLATION = 'translation',
    ROTATION = 'rotation',
    SCALE = 'scale',
    WEIGHTS = 'weights'
}

export class KeyFrame {
    prevKey: number;
    prevTime: number;

    // @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animation-samplerinterpolation
    interpolation: Interpolation;
    path: string;
    timeline: ArrayLike<number>;
    duration: number;
    values: number[][];

    constructor(params: {
        timeline: ArrayLike<number>;
        values: number[][];
        interpolation: Interpolation;
        path: string;
    }) {
        this.interpolation = params.interpolation;
        this.timeline = params.timeline;
        this.duration = this.timeline[this.timeline.length - 1] - this.timeline[0];
        this.values = params.values;
        this.path = params.path;
    }

    interpolate(t: number) {
        // Wrap t around, so the animation loops.
        // Make sure that t is never earlier than the first keyframe.
        t = Math.max(t % this.duration, this.timeline[0]);

        if (this.prevTime > t) {
            this.prevKey = 0;
        }

        this.prevTime = t;

        // Find next keyframe: min{ t of input | t > prevKey }
        let nextKey = 0;
        for (let i = this.prevKey; i < this.timeline.length; ++i)
        {
            if (t <= this.timeline[i])
            {
                nextKey = clamp(i, 1, this.timeline.length - 1);
                break;
            }
        }
        this.prevKey = clamp(nextKey - 1, 0, nextKey);

        const keyDelta = this.timeline[nextKey] - this.timeline[this.prevKey];

        // Normalize t: [t0, t1] -> [0, 1]
        const tn = (t - this.timeline[this.prevKey]) / keyDelta;

        const start = this.values[this.prevKey];
        const end = this.values[nextKey];

        if (this.path === InterpolationPath.ROTATION) {
            if (Interpolation.CUBICSPLINE === this.interpolation) {
                // TODO: // GLTF requires cubic spline interpolation for quaternions.
                // // https://github.com/KhronosGroup/glTF/issues/1386
                // const result = this.cubicSpline(this.prevKey, nextKey, output, keyDelta, tn, 4);
                // quat.normalize(result, result);
                // return result;
            } else {
                // @ts-ignore
                return slerpQuat(start, end, tn);
            }
        }
        
        switch (this.interpolation) {
            case Interpolation.LINEAR:
                return linear(start, end, tn);
            case Interpolation.STEP:
                return start;
            // case Interpolation.CUBICSPLINE:
            //     return cubicSpline(start, end,
            //         this.values[nextKey + 1], this.values[nextKey + 2],
            //         keyDelta, tn);
        }
    }
}


