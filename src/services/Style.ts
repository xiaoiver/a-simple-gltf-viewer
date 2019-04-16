import { inject, injectable } from 'inversify';


interface DirectionalLight {
    direction: number[];
    color: number[];
}

export interface IStyleService {
    getSplitLayer(): number[];
    setSplitLayer(splitLayer: number[]): void;

    getFinalSplit(): number[];
    setFinalSplit(finalSplit: number[]): void;

    getWireframeLineColor(): number[];
    setWireframeLineColor(color: number[]): void;

    getWireframeLineWidth(): number;
    setWireframeLineWidth(width: number): void;

    getDirectionalLight(): DirectionalLight;
    setDirectionalLight(light: Partial<DirectionalLight>): void;
}

@injectable()
export class Style implements IStyleService {
    /**
     * style variables
     */
    private splitLayer: number[] = [0, 0, 0, 0];
    private finalSplit: number[] = [0, 0, 0, 0];
    private wireframeLineColor: number[] = [0, 0, 0];
    private wireframeLineWidth: number = 1;
    private directionalLight: DirectionalLight = {
        direction: [0, 0.5, 0.5],
        color: [1, 1, 1]
    };

    getSplitLayer(): number[] {
        return this.splitLayer;
    }
    getFinalSplit(): number[] {
        return this.finalSplit;
    }
    getWireframeLineColor(): number[] {
        return this.wireframeLineColor;
    }
    getWireframeLineWidth(): number {
        return this.wireframeLineWidth;
    }
    getDirectionalLight(): DirectionalLight {
        return this.directionalLight;
    }

    setFinalSplit(finalSplit: number[]) {
        this.finalSplit = finalSplit;
    }

    setSplitLayer(splitLayer: number[]) {
        this.splitLayer = splitLayer;
    }

    setWireframeLineColor(color: number[]) {
        this.wireframeLineColor = color;
    }

    setWireframeLineWidth(width: number) {
        this.wireframeLineWidth = width;
    }

    setDirectionalLight(light: Partial<DirectionalLight>) {
        this.directionalLight = { ...this.directionalLight, ...light };
    }
}