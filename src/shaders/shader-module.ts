import uniq from 'lodash.uniq';

enum SHADER_TYPE {
    VS = 'vs',
    FS = 'fs'
}

type UniformValue = boolean|string|number|number[];

interface Module {
    [SHADER_TYPE.VS]: string;
    [SHADER_TYPE.FS]: string;
    uniforms: {
        [key: string]: UniformValue;
    }
}

const moduleCache: {
    [key: string]: Module;
} = {};

const rawContentCache: {
    [key: string]: {
        [SHADER_TYPE.VS]: string;
        [SHADER_TYPE.FS]: string;
        uniforms: {
            [key: string]: UniformValue;
        }
    }
} = {};
const precisionRegExp = /precision\s+(high|low|medium)p\s+float/;
const globalDefaultprecision = '#ifdef GL_FRAGMENT_PRECISION_HIGH\n precision highp float;\n #else\n precision mediump float;\n#endif\n';
const includeRegExp = /#pragma include (["^+"]?["\ "[a-zA-Z_0-9](.*)"]*?)/g;
const uniformRegExp = /uniform\s+(bool|float|int|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube)\s+([\s\S]*?);/g;

function processModule(rawContent: string, includeList: string[], type: SHADER_TYPE)
    : { content: string; includeList: string[]} {
    const compiled = rawContent.replace(includeRegExp, (_, strMatch) => {
        const includeOpt = strMatch.split(' ');
        const includeName = includeOpt[0].replace(/"/g, '');

        if (includeList.indexOf(includeName) > -1) {
            return '';
        }

        const txt = rawContentCache[includeName][type];
        includeList.push(includeName);

        const { content } = processModule(txt, includeList, type);
        return content;
    });

    return {
        content: compiled,
        includeList
    };
}

function getUniformLengthByType(type: string) {
    let arrayLength = 0;
    switch (type) {
        case 'vec2':
        case 'ivec2':
            arrayLength = 2;
            break;
        case 'vec3':
        case 'ivec3':
            arrayLength = 3;
            break;
        case 'vec4':
        case 'ivec4':
        case 'mat2':
            arrayLength = 4;
            break;
        case 'mat3':
            arrayLength = 9;
            break;
        case 'mat4':
            arrayLength = 16;
            break;
        default:
    }
    return arrayLength;
}

function extractUniforms(content: string) {
    const uniforms: {
        [key: string]: UniformValue;
    } = {};
    content = content.replace(uniformRegExp, (_, type, c) => {
        const defaultValues = c.split(':');
        const uniformName = defaultValues[0].trim();
        let defaultValue: UniformValue = '';
        if (defaultValues.length > 1) {
            defaultValue = defaultValues[1].trim();
        }

        // set default value for uniform according to its type
        // eg. vec2 u -> [0.0, 0.0]
        switch (type) {
            case 'bool':
                defaultValue = defaultValue === 'true';
                break;
            case 'float':
            case 'int':
                defaultValue = Number(defaultValue);
                break;
            case 'vec2':
            case 'vec3':
            case 'vec4':
            case 'ivec2':
            case 'ivec3':
            case 'ivec4':
            case 'mat2':
            case 'mat3':
            case 'mat4':
                if (defaultValue) {
                    defaultValue = defaultValue.toString().replace('[', '').replace(']', '')
                        .split(',')
                        .reduce((prev: any[], cur: string) => {
                            prev.push(Number(cur.trim()));
                            return prev;
                        }, []);
                } else {
                    defaultValue = new Array(getUniformLengthByType(type)).fill(0);
                }
                break;
            default:
        }

        uniforms[uniformName] = defaultValue;
        return `uniform ${type} ${uniformName};\n`;
    });
    return {
        content,
        uniforms
    };
}

export function registerModule(moduleName: string, { vs = '', fs = '', uniforms: declaredUniforms }: Partial<Module>) {
    const { content: extractedVS, uniforms: vsUniforms } = extractUniforms(vs);
    const { content: extractedFS, uniforms: fsUniforms } = extractUniforms(fs);

    rawContentCache[moduleName] = {
        [SHADER_TYPE.VS]: extractedVS,
        [SHADER_TYPE.FS]: extractedFS,
        uniforms: {
            ...vsUniforms,
            ...fsUniforms,
            ...declaredUniforms
        }
    };
}

export function getModule(moduleName: string): Module {
    if (moduleCache[moduleName]) {
        return moduleCache[moduleName];
    }

    const rawVS = rawContentCache[moduleName][SHADER_TYPE.VS];
    const rawFS = rawContentCache[moduleName][SHADER_TYPE.FS];

    const { content: vs, includeList: vsIncludeList } = processModule(rawVS, [], SHADER_TYPE.VS);
    let { content: fs, includeList: fsIncludeList } = processModule(rawFS, [], SHADER_TYPE.FS);
    // TODO: extract uniforms and their default values from GLSL
    const uniforms = uniq(vsIncludeList.concat(fsIncludeList).concat(moduleName))
        .reduce((prev: {[key: string]: UniformValue;}, cur: string) => {
        return {
            ...prev,
            ...rawContentCache[cur].uniforms
        };
    }, {});

    /**
     * set default precision for fragment shader
     * https://stackoverflow.com/questions/28540290/why-it-is-necessary-to-set-precision-for-the-fragment-shader
     */
    if (!precisionRegExp.test(fs)) {
        fs = globalDefaultprecision + fs;
    }

    moduleCache[moduleName] = {
        [SHADER_TYPE.VS]: vs.trim(),
        [SHADER_TYPE.FS]: fs.trim(),
        uniforms
    };
    return moduleCache[moduleName];
}