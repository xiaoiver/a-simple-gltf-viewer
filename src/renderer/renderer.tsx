/**
 * React renderer.
 */
import { load } from '@/loader';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

// Import the styles here to process them with webpack
import '@public/style.css';

ReactDOM.render(
  <div className='app'>
    <h4>Welcome to React, Electron and Typescript</h4>
    <p>Hello</p>
  </div>,
  document.getElementById('app')
);

// load('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxTextured/glTF/BoxTextured.gltf');
load('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Triangle/glTF/Triangle.gltf');
