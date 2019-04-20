import { injectable } from 'inversify';

export interface ITimelineService {
    elapsedSec(): number;
    toggle(): void
    start(): void;
    pause(pausedTime?: number): void;
    unpause(): void;
    reset(): void;
    setFixedTime(timeInSec: number): void;
    setDuration(duration: number): void;
    getDuration(): number;
}

@injectable()
export class Timeline implements ITimelineService {

    startTime: number = 0;
    paused: boolean = true;
    fixedTime: number = 0;
    pausedTime: number = 0;
    duration: number = 1;

    elapsedSec(): number {
        return this.paused ? this.pausedTime / 1000
            : this.fixedTime || (new Date().getTime() - this.startTime) / 1000;
    }

    toggle(): void {
        if (this.paused) {
            this.unpause();
        }
        else {
            this.pause();
        }
    }

    start() {
        this.startTime = new Date().getTime();
        this.paused = false;
    }

    pause(pausedTime?: number) {
        this.pausedTime = pausedTime === undefined ? new Date().getTime() - this.startTime
            : pausedTime * this.duration * 1000;
        this.paused = true;
    }

    unpause() {
        this.startTime += new Date().getTime() - this.startTime - this.pausedTime;
        this.paused = false;
    }

    reset() {
        if(!this.paused) {
            this.startTime = new Date().getTime();
        }
        else {
            this.startTime = 0;
        }
        this.pausedTime = 0;
    }

    setFixedTime(timeInSec: number) {
        this.paused = false;
        this.fixedTime = timeInSec;
    }

    getDuration(): number {
        return this.duration;
    }

    setDuration(duration: number) {
        this.duration = duration;
    }
}