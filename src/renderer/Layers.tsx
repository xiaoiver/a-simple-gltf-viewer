import * as React from 'react';
// @ts-ignore
import styled, { keyframes } from 'styled-components';
// @ts-ignore
import { slideInLeft } from 'react-animations';

interface LayerProps {
    name: string;
    index: number;
    deg: number;
}

interface LayersProps {
    size: {
        width: number;
        height: number;
    };
}

const slideInAnimation = keyframes`${slideInLeft}`;

const SlideInDiv = styled.div`
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1;
    overflow: hidden;
    user-select: none;
    pointer-events: none;
    animation: 0.5s ${slideInAnimation};
`;

const LayerLine = styled.div`
    width: 10000px;
    height: 2px;
    background-color: rgb(170, 170, 170);
    opacity: 1;
    position: absolute;
    top: -1px;
    left: -1px;
`;

// sync with shaders/frag.glsl
const LAYER_RANGE_START = 0.3;
const LAYER_RANGE_END = 0.7;
const LAYER_NUM = 6.0;
const LAYER_WIDTH = (LAYER_RANGE_END - LAYER_RANGE_START) / LAYER_NUM;
const LAYER_OFFSET = 0.1;
const LAYER_NAMES = [
    'Normal', 'Albedo', 'Metallic', 'Roughness', 'Wireframe', 'Final'
];

const Layer = ({ name, index, deg }: LayerProps) => {
    const LayerDiv = styled.div`
        position: absolute;
        left: ${(LAYER_RANGE_START + index * LAYER_WIDTH - LAYER_OFFSET) * 100}%;
        transform: translate(-50%, -50%) rotate(${deg}deg) translate(50%, 50%);
    `;

    return <LayerDiv>
        <div>{name}</div>
        {index < LAYER_NAMES.length && <LayerLine/>}
    </LayerDiv>
}

const Layers = ({ size: { width, height } }: LayersProps) => {
    const deg = Math.atan(height / (LAYER_OFFSET * 2 * width)) / Math.PI * 180;
    return <SlideInDiv>
        {LAYER_NAMES.map((name, i) => <Layer name={name} index={i+1} deg={deg} key={i}/>)}
    </SlideInDiv>
};

export default Layers;