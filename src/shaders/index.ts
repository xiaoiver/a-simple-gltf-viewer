
// @ts-ignore
import common from './chunks/common.glsl';
// @ts-ignore
import splitLayer from './chunks/split-layer.glsl';
// @ts-ignore
import wireframeVS from './chunks/wireframe.vert.glsl';
// @ts-ignore
import wireframeFS from './chunks/wireframe.frag.glsl';
// @ts-ignore
import shadowVS from './chunks/shadow.vert.glsl';
// @ts-ignore
import shadowFS from './chunks/shadow.frag.glsl';

// @ts-ignore
import gridVS from './grid.vert.glsl';
// @ts-ignore
import gridFS from './grid.frag.glsl';
// @ts-ignore
import skyboxVS from './skybox.vert.glsl';
// @ts-ignore
import skyboxFS from './skybox.frag.glsl';
// @ts-ignore
import renderPassVS from './pbr.vert.glsl';
// @ts-ignore
import renderPassFS from './pbr.frag.glsl';
// @ts-ignore
import shadowPassVert from './shadow.vert.glsl';
// @ts-ignore
import shadowPassFrag from './shadow.frag.glsl';
// @ts-ignore
import quadVert from './post-processing/quad.vert.glsl';
// @ts-ignore
import copyPassFrag from './post-processing/copy.frag.glsl';
// @ts-ignore
import blurPassFrag from './post-processing/blur.frag.glsl';


import { registerModule } from './shader-module';

export function compileBuiltinModules() {
    // chunks
    registerModule('common', { vs: common, fs: common });
    registerModule('shadow', { vs: shadowVS, fs: shadowFS });
    registerModule('wireframe', { vs: wireframeVS, fs: wireframeFS });
    registerModule('split-layer', { vs: '', fs: splitLayer });

    // lighting & shadow pass
    registerModule('grid', { vs: gridVS, fs: gridFS });
    registerModule('skybox', { vs: skyboxVS, fs: skyboxFS });
    registerModule('render-pass', { vs: renderPassVS, fs: renderPassFS });
    registerModule('shadow-pass', { vs: shadowPassVert, fs: shadowPassFrag });

    // post-processing
    registerModule('copy-pass', { vs: quadVert, fs: copyPassFrag });
    registerModule('blur-pass', { vs: quadVert, fs: blurPassFrag });
}