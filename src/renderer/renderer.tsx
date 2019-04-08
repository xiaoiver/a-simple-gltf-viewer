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

    const models = ['Triangle', 'Box', 'BoxTextured', 'DamagedHelmet'
      //'MetalRoughSpheres'
    ];

    const text = { Model: 'BoxTextured' };
    folder.add(text, 'Model', models).onChange(this.loadModel);
    folder.open();

    this.loadModel('BoxTextured');
  }

  loadModel = async (modelName: string) => {
    this.setState({ loading: true });
    await this.viewer.load(
      `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/${modelName}/glTF/${modelName}.gltf`);
    this.setState({ loading: false });
  };

  render() {
    const { loading } = this.state;
    return <>
      {loading && <ReactLoading type="balls" color="blue" height={'64px'} width={'64px'} />}
      <div id="viewer-container"></div>
    </>
  }
}

ReactDOM.render(
  <App/>,
  document.getElementById('app')
);
