/**
 * http://learnwebgl.brown37.net/07_cameras/camera_linear_motion.html
 * 
 * translate or rotate along u, v, n axis,
 * and add pitch & roll which use fixed eye point for orbit mode
 */
import { injectable } from 'inversify';
import { mat4, vec3 } from 'gl-matrix';

export interface ICameraService {
    eye: vec3;
    center: vec3;
    up: vec3;
    fovy: number;
    aspect: number;
    znear: number;
    zfar: number;

    projection: mat4;
    view: mat4;
    transform: mat4;

    init(eye: vec3, center: vec3, fovy: number, aspect: number, znear: number, zfar: number): void;

    truck(distance: number): void;
    pedestal(distance: number): void;
    dolly(distance: number): void;
    tilt(angle: number): void;
    pan(angle: number): void;
    cant(angle: number): void;
    pitch(angle: number): void;
    roll(angle: number): void;

    updateProjection(): void;
    updateTransform(): void;
}

@injectable()
export class Camera implements ICameraService {
    eye: vec3;
    center: vec3;
    up: vec3;
    fovy: number;
    aspect: number;
    znear: number;
    zfar: number;
    projection: mat4 = mat4.create();
    view: mat4 = mat4.create();
    transform: mat4 = mat4.create();

    init(eye: vec3, center: vec3, fovy: number, aspect: number, znear: number, zfar: number) {
        this.eye = eye;
        this.center = center;
        this.up = vec3.clone([0, 1, 0]);
        this.fovy = fovy;
        this.aspect = aspect;
        this.znear = znear;
        this.zfar = zfar;
    }

    /**
     * translate along u axis
     * 
     * @param {number} distance
     */
    truck(distance: number) {
        // Calculate the n camera axis
        const n = vec3.create();
        vec3.normalize(n, vec3.sub(n, this.eye, this.center));

        // Calculate the u camera axis
        const u = vec3.create();
        vec3.cross(u, this.up, n);
        vec3.normalize(u, u);
        // Scale the u axis to the desired distance to move
        vec3.scale(u, u, distance);

        // Add the direction vec3 to both the eye and center positions
        vec3.add(this.eye, this.eye, u);
        vec3.add(this.center, this.center, u);

        this.updateTransform();
    }

    /**
     * translate along v axis
     * 
     * @param {number} distance
     */
    pedestal(distance: number) {
        // Calculate the n camera axis
        const n = vec3.create();
        vec3.normalize(n, vec3.sub(n, this.eye, this.center));

        // Calculate the v camera axis
        const u = vec3.create();
        vec3.cross(u, this.up, n);
        vec3.normalize(u, u);

        const v = vec3.create();
        vec3.cross(v, n, u);
        vec3.normalize(v, v);
        // Scale the v axis to the desired distance to move
        vec3.scale(v, v, distance);

        // Add the direction vec3 to both the eye and center positions
        vec3.add(this.eye, this.eye, v);
        vec3.add(this.center, this.center, v);

        this.updateTransform();
    }

    /**
     * translate along n axis
     * 
     * @param {number} distance
     */
    dolly(distance: number) {
        const n = vec3.create();
        vec3.normalize(n, vec3.sub(n, this.eye, this.center));

        vec3.scale(n, n, distance);

        vec3.add(this.eye, this.eye, n);
        // vec3.add(this.center, this.center, n);

        this.updateTransform();
    }

    /**
     * rotate along u axis
     * 
     * @param {number} angle
     */
    tilt(angle: number) {
        // Calculate the n camera axis
        const n = vec3.create();
        vec3.normalize(n, vec3.sub(n, this.eye, this.center));

        // Calculate the u camera axis
        const u = vec3.create();
        vec3.cross(u, this.up, n);
        vec3.normalize(u, u);

        // Move the camera coordinate system to the origin. We only calculate
        // the center point because we are not going to change the eye point
        let newCenter = vec3.create();
        vec3.sub(newCenter, this.center, this.eye);

        // Create a rotation transform about u
        const tiltmat4 = mat4.create();
        mat4.fromRotation(tiltmat4, angle, u);

        // Rotate the center point. Since this is a vec3 that has no location,
        // we only need to multiply by the rotation part of the transform.
        vec3.transformMat4(newCenter, newCenter, tiltmat4);

        // Translate the center point back to the location of the camera.
        vec3.add(this.center, newCenter, this.eye);

        // If the angle between the line-of-sight and the "up vec3" is less
        // than 10 degrees or greater than 170 degrees, then rotate the
        // "up_vec3" about the u axis.
        // cos(10 degrees) = 0.985; cos(170 degrees) = -0.985
        if (Math.abs(vec3.dot(n, this.up)) >= 0.985) {
            vec3.transformMat4(this.up, this.up, tiltmat4);
        }
        // Calculate a new camera transform
        this.updateTransform();
    }

    /**
     * rotate along v axis
     * 
     * @param {number} angle
     */
    pan(angle: number) {
        const n = vec3.create();
        vec3.normalize(n, vec3.sub(n, this.eye, this.center));

        const u = vec3.create();
        vec3.cross(u, this.up, n);
        vec3.normalize(u, u);

        let v = vec3.create();
        vec3.cross(v, n, u);
        vec3.normalize(v, v);

        const panmat4 = mat4.create();
        mat4.fromRotation(panmat4, angle, v);

        let newCenter = vec3.create();
        vec3.sub(newCenter, this.center, this.eye);
        vec3.transformMat4(newCenter, newCenter, panmat4);
        vec3.add(this.center, newCenter, this.eye);

        if (Math.abs(vec3.dot(n, this.up)) >= 0.985) {
            vec3.transformMat4(this.up, this.up, panmat4);
        }
        this.updateTransform();
    }

    /**
     * rotate along n axis
     * 
     * @param {number} angle
     */
    cant(angle: number) {
        const normalize = vec3.create();
        vec3.normalize(normalize, vec3.sub(normalize, this.eye, this.center));

        let newCenter = vec3.create();
        vec3.sub(newCenter, this.center, this.eye);
        const cantmat4 = mat4.create();
        mat4.fromRotation(cantmat4, angle, normalize);

        vec3.transformMat4(newCenter, newCenter, cantmat4);

        vec3.add(this.center, newCenter, this.eye);
        vec3.transformMat4(this.up, this.up, cantmat4);

        this.updateTransform();
    }

    /**
     * in orbit mode, rotate along u axis, but fix center point
     * 
     * @param {number} angle
     */
    pitch(angle: number) {
        // Calculate the n camera axis
        const n = vec3.create();
        vec3.normalize(n, vec3.sub(n, this.eye, this.center));

        // Calculate the u camera axis
        const u = vec3.create();
        vec3.cross(u, this.up, n);
        vec3.normalize(u, u);

        // Move the camera coordinate system to the origin. We only calculate
        // the center point because we are not going to change the eye point
        let newCenter = vec3.create();
        vec3.sub(newCenter, this.center, this.eye);

        // Create a rotation transform about u
        const tiltmat4 = mat4.create();
        mat4.fromRotation(tiltmat4, angle, u);

        vec3.transformMat4(this.eye, this.eye, tiltmat4);

        this.updateTransform();
    }

    /**
     * in orbit mode, rotate along v axis, but fix center point
     * 
     * @param {number} angle
     */
    roll(angle: number) {
        const n = vec3.create();
        vec3.normalize(n, vec3.sub(n, this.eye, this.center));

        const u = vec3.create();
        vec3.cross(u, this.up, n);
        vec3.normalize(u, u);

        let v = vec3.create();
        vec3.cross(v, n, u);
        vec3.normalize(v, v);

        const panmat4 = mat4.create();
        mat4.fromRotation(panmat4, angle, v);

        vec3.transformMat4(this.eye, this.eye, panmat4);

        this.updateTransform();
    }

    updateTransform() {
        mat4.lookAt(this.view, this.eye, this.center, this.up);
        mat4.mul(this.transform, this.projection, this.view);
    }

    updateProjection() {
        mat4.perspective(this.projection, this.fovy, this.aspect, this.znear, this.zfar);
    }
}