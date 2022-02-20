const path = require('path');

const moduleConfig = {
    mode: 'production',
    entry: './src/index.js',
    experiments: {
        outputModule: true,
    },
    output: {
        filename: 'AsyncIndexedDB.module.min.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            type: 'module',
        },
    },
};

const varConfig = {
    mode: 'production',
    entry: './src/index.js',
    experiments: {
        outputModule: true,
    },
    output: {
        filename: 'AsyncIndexedDB.min.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            name: 'AsyncIndexedDB',
            type: 'var',
        },
    },
};

module.exports = [moduleConfig, varConfig];