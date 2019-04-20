import * as React from 'react';
import { Button, Slider } from 'antd';
// @ts-ignore
import styled from 'styled-components';

interface TimelineProps {
    paused: boolean;
    onStart(): void;
    onPause(): void;
    onChange(value: number): void;
    value: number;
}

const TimelineDiv = styled.div`
    position: fixed;
    bottom: 10px;
    left: 10%;
    right: 10%;
    z-index: 1;
    overflow: hidden;
    user-select: none;
    display: flex;
`;

const SliderDiv = styled.div`
    flex: 1;
`;

const Timeline = ({ paused, onStart, onPause, onChange, value }: TimelineProps) => {
    return <TimelineDiv>
        <Button icon={ paused ? "caret-right" : "pause" } onClick={() => {
            if (paused) {
                onStart();
            } else {
                onPause();
            }
        }}></Button>
        <SliderDiv>
            <Slider value={value} max={1} min={0} defaultValue={0} step={0.05} onChange={onChange}/>
        </SliderDiv>
    </TimelineDiv>
};

export default Timeline;