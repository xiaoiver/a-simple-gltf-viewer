/**
 * React renderer.
 */
import { GltfViewer } from '@/index';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as dat from 'dat.gui';
import { notification, Button, Spin, message } from 'antd';
import Layers from './Layers';
import registerServiceWorker from './registerServiceWorker';

import '@public/style.css';

class App extends React.Component<{}, {
    loading: boolean;
    showLayers: boolean;
    size: { width: number; height: number };
}> {
    public readonly state = {
        loading: false,
        showLayers: false,
        size: { width: 1, height: 1 }
    };

    private viewer: GltfViewer;

    componentDidMount() {
        this.registerSW();

        this.viewer = new GltfViewer({
            container: 'viewer-container',
            onResize: this.handleResize
        });
        this.viewer.init();

        const gui = new dat.GUI();
        const folder = gui.addFolder('glTF viewer');

        const models = ['Triangle', 'Box', 'BoxTextured', 'DamagedHelmet', 'Corset',
            'MetalRoughSpheres'
        ];
        const layers = ['layers', 'final', 'albedo', 'normal', 'metallic', 'roughness', 'wireframe'];

        const text = { Model: 'DamagedHelmet', Layer: 'layers' };
        folder.add(text, 'Model', models).onChange(this.loadModel);
        folder.add(text, 'Layer', layers).onChange(this.showLayer);

        const wireframeFolder = folder.addFolder('wireframe');
        const wireframe = { lineColor: [255, 255, 255], lineWidth: 1 };
        wireframeFolder.addColor(wireframe, 'lineColor').onChange(this.changeWireframeLineColor);
        wireframeFolder.add(wireframe, 'lineWidth', 1, 5).onChange(this.changeWireframeLineWidth);

        const lightFolder = folder.addFolder('directional light');
        const directionalLight = { color: [0, 0, 0], rotation: 0, pitch: 0 };
        lightFolder.addColor(directionalLight, 'color').onChange(this.changeDirectionalLightColor);
        lightFolder.add(directionalLight, 'rotation', 0, 360)
            .onChange(() => this.changeDirectionalLightDirection(directionalLight.rotation, directionalLight.pitch));
        lightFolder.add(directionalLight, 'pitch', -90, 90)
            .onChange(() => this.changeDirectionalLightDirection(directionalLight.rotation, directionalLight.pitch));
        folder.open();

        this.showLayer('layers');
        this.loadModel('DamagedHelmet');
    }

    loadModel = async (modelName: string) => {
        this.setState({ loading: true });
        await this.viewer.load(
            `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/${modelName}/glTF/${modelName}.gltf`);
        this.setState({ loading: false });
    };

    showLayer = (layerName: string) => {
        this.setState({ showLayers: layerName === 'layers' });
        this.viewer.showLayer(layerName);
    };

    changeWireframeLineColor = (color: number[]) => {
        this.viewer.setWireframeLineColor(color.map(c => c / 255));
    }

    changeWireframeLineWidth = (width: number) => {
        this.viewer.setWireframeLineWidth(width);
    }

    changeDirectionalLightColor = (color: number[]) => {
        this.viewer.setDirectionalLightColor(color.map(c => c / 255));
    }

    changeDirectionalLightDirection = (rotation: number, pitch: number) => {
        rotation = rotation * Math.PI / 180;
        pitch = pitch * Math.PI / 180;

        this.viewer.setDirectionalLightDiretion([
            Math.sin(rotation) * Math.cos(pitch),
            Math.sin(pitch),
            Math.cos(rotation) * Math.cos(pitch)
        ]);
    }

    handleResize = (size: { width: number; height: number }) => {
        this.setState({ size });
    }

    registerSW() {
        registerServiceWorker();

        window.addEventListener('sw.offline', () => {
            message.warning('当前已离线');
        });

        // Pop up a prompt on the page asking the user if they want to use the latest version
        window.addEventListener('sw.updated', (e) => {
            const reloadSW = async () => {
                // Check if there is sw whose state is waiting in ServiceWorkerRegistration
                // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
                // @ts-ignore
                const worker = e.detail && e.detail.waiting;
                if (!worker) {
                    return Promise.resolve();
                }
                // Send skip-waiting event to waiting SW with MessageChannel
                await new Promise((resolve, reject) => {
                    const channel = new MessageChannel();
                    channel.port1.onmessage = event => {
                        if (event.data.error) {
                            reject(event.data.error);
                        } else {
                            resolve(event.data);
                        }
                    };
                    worker.postMessage({ type: 'skip-waiting' }, [channel.port2]);
                });
                // Refresh current page to use the updated HTML and other assets after SW has skiped waiting
                window.location.reload(true);
                return true;
            };
            const key = `open${Date.now()}`;
            const btn = (
                // @ts-ignore
                <Button
                    type="primary"
                    onClick={() => {
                        notification.close(key);
                        reloadSW();
                    }}
                >确认更新</Button>
            );
            notification.open({
                message: '站点内容有更新',
                description: '站点内容有更新',
                btn,
                key,
                onClose: async () => { },
            });
        });
    }

    render() {
        const { loading, showLayers, size } = this.state;
        return <>
            <Spin spinning={loading} style={{
                position: 'fixed',
                top: '0',
                bottom: '0',
                left: '0',
                right: '0'
            }}>
                <div id="viewer-container"></div>
                {!loading && showLayers && <Layers size={size} />}
            </Spin>
        </>
    }
}

ReactDOM.render(
    <App />,
    document.getElementById('app')
);
