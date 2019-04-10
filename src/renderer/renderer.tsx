/**
 * React renderer.
 */
import { GltfViewer } from '@/index';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as dat from 'dat.gui';
import ReactLoading from 'react-loading';

// Import the styles here to process them with webpack
import '@public/style.css';

class App extends React.Component<{}, {
  loading: boolean;
}> {
  public readonly state = {
    loading: false
  };

  private viewer: GltfViewer;
  
  componentDidMount() {
    this.viewer = new GltfViewer({
      container: 'viewer-container'
    });
    this.viewer.init();

    const gui = new dat.GUI();
    const folder = gui.addFolder('glTF viewer');

    const models = ['Triangle', 'Box', 'BoxTextured', 'DamagedHelmet', 'Corset', 
      'MetalRoughSpheres'
    ];
    const layers = ['all', 'albedo', 'normal', 'metallic', 'roughness'];

    const text = { Model: 'BoxTextured', Layer: 'all' };
    folder.add(text, 'Model', models).onChange(this.loadModel);
    folder.add(text, 'Layer', layers).onChange(this.showLayer);

    const wireframeFolder = folder.addFolder('wireframe');
    const wireframe = { lineColor: [255, 255, 255], lineWidth: 1 };
    wireframeFolder.addColor(wireframe, 'lineColor').onChange(this.changeWireframeLineColor);
    wireframeFolder.add(wireframe, 'lineWidth', 1, 5).onChange(this.changeWireframeLineWidth);

    folder.open();

    this.showLayer('all');
    this.loadModel('BoxTextured');
  }

  loadModel = async (modelName: string) => {
    this.setState({ loading: true });
    await this.viewer.load(
      `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/${modelName}/glTF/${modelName}.gltf`);
    this.setState({ loading: false });
  };

  showLayer = (layerName: string) => {
    this.viewer.showLayer(layerName);
  };

  changeWireframeLineColor = (color: number[]) => {
    this.viewer.setWireframeLineColor(color.map(c => c / 255));
  }
  
  changeWireframeLineWidth = (width: number) => {
    this.viewer.setWireframeLineWidth(width);
  }

  render() {
    const { loading } = this.state;
    return <>
      {loading && <div style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-32px, -32px)',
        zIndex: 1
      }}>
        <ReactLoading type="balls" color="blue" height={'64px'} width={'64px'}/></div>}
      <div id="viewer-container"></div>
    </>
  }
}

ReactDOM.render(
  <App/>,
  document.getElementById('app')
);
