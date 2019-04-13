import { injectable, inject } from 'inversify';
import * as Stats from 'stats.js';
import { IRendererService, Renderer } from './Renderer';
import { SERVICE_IDENTIFIER } from '@/services/constants';

export interface IStatsService {
}

@injectable()
export class StatsService implements IStatsService {
    private stats: Stats;

    constructor(
        @inject(SERVICE_IDENTIFIER.RendererService) _renderer: IRendererService,
    ) {
        this.initStats();
        _renderer.on(Renderer.FRAME_EVENT, () => {
            this.stats.update();
        });
    }

    private initStats() {
        this.stats = new Stats();
        this.stats.showPanel(0);
        const $stats = this.stats.dom;
        $stats.style.position = 'absolute';
        $stats.style.left = '0px';
        $stats.style.top = '0px';
        document.body.appendChild($stats);
    }
}