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
import { IStyleService, Style } from '@/services/Style';
import { IPostProcessorService, PostProcessor, IPass } from '@/services/PostProcessor';
import { EventEmitter } from 'eventemitter3';
import { Container, decorate, injectable } from 'inversify';
import { IWebGLContextService, ReglContext } from '@/services/Regl';
import { BlurV } from '@/services/post-processing/BlurV';
import { BlurH } from '@/services/post-processing/BlurH';
import { Copy } from '@/services/post-processing/Copy';

const container: Container = new Container();

container.bind<IWebGLContextService>(SERVICE_IDENTIFIER.WebGLContextService)
    .to(ReglContext).inSingletonScope();
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
container.bind<IStyleService>(SERVICE_IDENTIFIER.StyleService)
    .to(Style).inSingletonScope();

container.bind<IPostProcessorService>(SERVICE_IDENTIFIER.PostProcessorService)
    .to(PostProcessor).inSingletonScope();
container.bind<IPass>(SERVICE_IDENTIFIER.BlurHPass)
    .to(BlurH);
container.bind<IPass>(SERVICE_IDENTIFIER.BlurVPass)
    .to(BlurV);
container.bind<IPass>(SERVICE_IDENTIFIER.CopyPass)
    .to(Copy);

decorate(injectable(), EventEmitter);

export { container };
