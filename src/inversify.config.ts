/**
 * inversify entry point
 */
import 'reflect-metadata';
import { SERVICE_IDENTIFIER } from '@/services/constants';
import { ICameraService, Camera } from '@/services/Camera';
import { GltfService, IGltfService } from '@/services/GltfService';
import { IRendererService, Renderer } from '@/services/Renderer';
import { ISceneService, SceneService } from '@/services/SceneService';
import { IMouseService, Mouse } from '@/services/Mouse';
import { StatsService, IStatsService } from '@/services/Stats';
import { ISceneNodeService, SceneNode } from '@/services/Node';
import { EventEmitter } from 'eventemitter3';
import { Container, decorate, injectable } from 'inversify';


const container: Container = new Container();
container.bind<IGltfService>(SERVICE_IDENTIFIER.GltfService)
    .to(GltfService).inSingletonScope();
container.bind<ISceneService>(SERVICE_IDENTIFIER.SceneService)
    .to(SceneService).inSingletonScope();
container.bind<ISceneNodeService>(SERVICE_IDENTIFIER.SceneNodeService)
    .to(SceneNode);
container.bind<IRendererService>(SERVICE_IDENTIFIER.RendererService)
    .to(Renderer).inSingletonScope();
container.bind<ICameraService>(SERVICE_IDENTIFIER.CameraService)
    .to(Camera).inSingletonScope();
container.bind<IMouseService>(SERVICE_IDENTIFIER.MouseService)
    .to(Mouse).inSingletonScope();
container.bind<IStatsService>(SERVICE_IDENTIFIER.StatsService)
    .to(StatsService).inSingletonScope();

decorate(injectable(), EventEmitter);

export { container };
